import { NextResponse } from "next/server";

async function getAdminModules() {
  const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");
  return { adminAuth, adminDb };
}

async function verifyAdmin(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const { adminAuth } = await getAdminModules();
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID ? decoded : null;
  } catch { return null; }
}

/**
 * POST /api/admin/set-referral-serial
 * Manually set the next serial number for referral codes
 * Body: { nextSerialNumber: 2 }
 */
export async function POST(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { nextSerialNumber } = body;

    if (!nextSerialNumber || typeof nextSerialNumber !== 'number' || nextSerialNumber < 1) {
      return NextResponse.json({
        error: "nextSerialNumber must be a positive number"
      }, { status: 400 });
    }

    const { adminDb } = await getAdminModules();

    // Get current metadata
    const metadataRef = adminDb.collection("referralMetadata").doc("globalCounter");
    const metadataDoc = await metadataRef.get();

    const currentSerial = metadataDoc.exists ? metadataDoc.data().nextSerialNumber : null;

    // Update the serial number
    await metadataRef.set({
      nextSerialNumber: nextSerialNumber,
      lastUpdated: new Date().toISOString(),
      updatedBy: admin.uid,
    }, { merge: true });

    console.log(`[set-referral-serial] Updated from ${currentSerial} to ${nextSerialNumber}`);

    return NextResponse.json({
      success: true,
      message: `Serial number updated to ${nextSerialNumber}`,
      previousSerial: currentSerial,
      newSerial: nextSerialNumber
    });

  } catch (err) {
    console.error("[set-referral-serial]", err);
    return NextResponse.json(
      { error: err.message || "Failed to update serial number" },
      { status: 500 }
    );
  }
}
