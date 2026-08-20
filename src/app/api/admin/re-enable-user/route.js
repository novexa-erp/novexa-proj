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

// POST /api/admin/re-enable-user
// Body: { uid }
// Re-enables a disabled Firebase Auth account and sets Firestore status to "active"
export async function POST(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { uid } = body;
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    if (uid === process.env.NEXT_PUBLIC_ADMIN_UID)
      return NextResponse.json({ error: "Cannot modify admin account" }, { status: 403 });

    const { adminAuth, adminDb } = await getAdminModules();

    // Re-enable in Firebase Auth — if Auth record was deleted directly from console,
    // skip Auth step and only update Firestore
    try {
      await adminAuth.updateUser(uid, { disabled: false });
    } catch (authErr) {
      if (authErr.code !== "auth/user-not-found") throw authErr;
      // Auth record gone — Firestore cleanup still possible
    }

    // Update Firestore status back to active
    await adminDb.collection("users").doc(uid).update({
      status:      "active",
      restoredAt:  new Date().toISOString(),
      deletedAt:   null,
    });

    console.log(`[re-enable-user] Re-enabled uid: ${uid}`);
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[re-enable-user]", err);
    return NextResponse.json({ error: err.message || "Re-enable failed" }, { status: 500 });
  }
}
