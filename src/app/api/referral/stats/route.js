import { NextResponse } from "next/server";

/**
 * GET /api/referral/stats?uid=xxx
 * Get referral statistics for a user
 * 
 * Returns: {
 *   referralCode: "NOV-REF-01020926",
 *   availableCredits: 1495,
 *   totalReferrals: 5,
 *   totalCreditsEarned: 2495,
 *   totalCreditsRedeemed: 1000,
 *   referredUsers: [...],
 *   creditsHistory: [...]
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

export async function GET(request) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid") || user.uid;

    // Users can only view their own stats unless they're admin
    if (uid !== user.uid && user.uid !== process.env.NEXT_PUBLIC_ADMIN_UID) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { adminDb } = await getAdminModules();

    // Get user data
    const userDoc = await adminDb.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();

    // Get referral stats
    const statsDoc = await adminDb.collection("referralStats").doc(uid).get();
    const statsData = statsDoc.exists ? statsDoc.data() : {};

    // Return combined stats
    return NextResponse.json({
      referralCode: userData.referralCode || null,
      hasReferralCode: !!userData.referralCode,
      availableCredits: userData.referralCredits || 0,
      totalReferrals: statsData.totalReferrals || 0,
      totalCreditsEarned: statsData.totalCreditsEarned || 0,
      totalCreditsRedeemed: statsData.totalCreditsRedeemed || 0,
      referredUsers: statsData.referredUsers || [],
      creditsHistory: userData.referralCreditsHistory || [],
      referredBy: userData.referredBy || null,
      referredByUid: userData.referredByUid || null
    });

  } catch (err) {
    console.error("[referral/stats]", err);
    return NextResponse.json(
      { error: err.message || "Failed to get referral stats" },
      { status: 500 }
    );
  }
}
