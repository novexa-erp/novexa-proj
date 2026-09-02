import { NextResponse } from "next/server";

/**
 * POST /api/referral/redeem
 * Redeem referral credits for billing or add-ons
 * 
 * Body: {
 *   uid,
 *   amount: 500,
 *   description: "Applied to monthly billing"
 * }
 * 
 * Returns: {
 *   success: true,
 *   amountRedeemed: 500,
 *   newBalance: 995
 * }
 */

async function getAdminModules() {
  const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");
  return { adminAuth, adminDb };
}

async function verifyToken(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const { adminAuth } = await getAdminModules();
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded;
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { uid, amount, description } = body;

    if (!uid || !amount || !description) {
      return NextResponse.json(
        { error: "Missing required fields: uid, amount, description" },
        { status: 400 }
      );
    }

    // Users can only redeem their own credits unless they're admin
    if (uid !== user.uid && user.uid !== process.env.NEXT_PUBLIC_ADMIN_UID) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    const { adminDb } = await getAdminModules();

    // Get user document
    const userRef = adminDb.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    const currentCredits = userData.referralCredits || 0;

    // Check if user has enough credits
    if (currentCredits < amount) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          available: currentCredits,
          requested: amount
        },
        { status: 400 }
      );
    }

    const newBalance = currentCredits - amount;

    // Use batch for atomic operations
    const batch = adminDb.batch();

    // Create redemption history entry
    const currentHistory = userData.referralCreditsHistory || [];
    const historyEntry = {
      type: "redeemed",
      amount: amount,
      description: description,
      createdAt: new Date().toISOString()
    };

    // Update user document
    batch.update(userRef, {
      referralCredits: newBalance,
      referralCreditsHistory: [...currentHistory, historyEntry],
      lastUpdated: new Date().toISOString()
    });

    // Update referral stats
    const statsRef = adminDb.collection("referralStats").doc(uid);
    const statsDoc = await statsRef.get();

    if (statsDoc.exists) {
      const statsData = statsDoc.data();
      batch.update(statsRef, {
        totalCreditsRedeemed: (statsData.totalCreditsRedeemed || 0) + amount,
        availableCredits: newBalance,
        lastUpdated: new Date().toISOString()
      });
    }

    // Commit changes
    await batch.commit();

    return NextResponse.json({
      success: true,
      amountRedeemed: amount,
      newBalance,
      description
    });

  } catch (err) {
    console.error("[referral/redeem]", err);
    return NextResponse.json(
      { error: err.message || "Failed to redeem credits" },
      { status: 500 }
    );
  }
}
