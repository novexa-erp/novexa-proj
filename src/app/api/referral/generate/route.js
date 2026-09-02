import { NextResponse } from "next/server";

/**
 * POST /api/referral/generate
 * Generate referral code for a user (called when package is activated)
 * 
 * Body: { uid, userName, userEmail }
 * Returns: { success: true, code: "NOV-REF-01020926" }
 */

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
    // Allow super-admin or the user themselves
    return decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID ? decoded : null;
  } catch { return null; }
}

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

    const { uid, userName, userEmail } = body;

    if (!uid || !userName || !userEmail) {
      return NextResponse.json(
        { error: "Missing required fields: uid, userName, userEmail" },
        { status: 400 }
      );
    }

    const { adminDb } = await getAdminModules();

    // Check if user already has a referral code
    const userDoc = await adminDb.collection("users").doc(uid).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();

    // If user already has a referral code, return it
    if (userData.referralCode) {
      return NextResponse.json({
        success: true,
        code: userData.referralCode,
        alreadyExists: true
      });
    }

    // Check if user's package is active
    if (userData.status !== "active") {
      return NextResponse.json(
        { error: "User package must be active to generate referral code" },
        { status: 400 }
      );
    }

    // Get or initialize metadata
    const metadataRef = adminDb.collection("referralMetadata").doc("globalCounter");
    const metadataDoc = await metadataRef.get();

    let serialNumber = 1;

    if (metadataDoc.exists) {
      serialNumber = metadataDoc.data().nextSerialNumber || 1;
    }

    // Generate code with current date
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const serial = String(serialNumber).padStart(2, '0');
    
    const code = `NOV-REF-${serial}${day}${month}${year}`;

    // Use batch write for atomic operations
    const batch = adminDb.batch();

    // Store in referralCodes collection
    const codeRef = adminDb.collection("referralCodes").doc(code);
    batch.set(codeRef, {
      code,
      uid,
      userName,
      userEmail,
      serialNumber,
      generatedAt: new Date().toISOString(),
      isActive: true,
      usageCount: 0,
      totalCreditsEarned: 0
    });

    // Update user document
    batch.update(adminDb.collection("users").doc(uid), {
      referralCode: code,
      referralCredits: 0,
      referralCreditsHistory: [],
      lastUpdated: new Date().toISOString()
    });

    // Initialize referral stats
    const statsRef = adminDb.collection("referralStats").doc(uid);
    batch.set(statsRef, {
      uid,
      totalReferrals: 0,
      totalCreditsEarned: 0,
      totalCreditsRedeemed: 0,
      availableCredits: 0,
      referredUsers: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });

    // Update or create metadata
    if (metadataDoc.exists) {
      batch.update(metadataRef, {
        nextSerialNumber: serialNumber + 1,
        totalCodesGenerated: (metadataDoc.data().totalCodesGenerated || 0) + 1,
        lastUpdated: new Date().toISOString()
      });
    } else {
      batch.set(metadataRef, {
        nextSerialNumber: serialNumber + 1,
        totalCodesGenerated: 1,
        totalReferrals: 0,
        discountPercentage: 10,
        commissionPercentage: 10,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }

    // Commit all operations
    await batch.commit();

    return NextResponse.json({
      success: true,
      code,
      serialNumber,
      alreadyExists: false
    });

  } catch (err) {
    console.error("[referral/generate]", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate referral code" },
      { status: 500 }
    );
  }
}
