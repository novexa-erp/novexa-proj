import { NextResponse } from "next/server";

/**
 * POST /api/referral/apply-discount
 * Apply discount to new user and credit referrer
 * Called after new user's package is activated
 * 
 * Body: {
 *   newUserUid,
 *   newUserName,
 *   referralCode,
 *   packagePrice (original price before discount)
 * }
 * 
 * Returns: {
 *   success: true,
 *   discount: { originalPrice, discountAmount, finalPrice },
 *   creditAdded: 499 (amount credited to referrer)
 * }
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
    return decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID ? decoded : null;
  } catch {
    return null;
  }
}

function calculateDiscount(packagePrice, percentage = 10) {
  const discountAmount = Math.round((packagePrice * percentage) / 100);
  const finalPrice = packagePrice - discountAmount;
  return {
    originalPrice: packagePrice,
    discountPercentage: percentage,
    discountAmount,
    finalPrice
  };
}

function calculateCommission(packagePrice, percentage = 10) {
  return Math.round((packagePrice * percentage) / 100);
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

    const { newUserUid, newUserName, referralCode, packagePrice } = body;

    if (!newUserUid || !newUserName || !referralCode || !packagePrice) {
      return NextResponse.json(
        { error: "Missing required fields: newUserUid, newUserName, referralCode, packagePrice" },
        { status: 400 }
      );
    }

    const { adminDb } = await getAdminModules();

    // Verify referral code exists
    const codeDoc = await adminDb.collection("referralCodes").doc(referralCode).get();

    if (!codeDoc.exists) {
      return NextResponse.json(
        { error: "Invalid referral code" },
        { status: 400 }
      );
    }

    const codeData = codeDoc.data();
    const referrerUid = codeData.uid;

    // Get referrer data
    const referrerDoc = await adminDb.collection("users").doc(referrerUid).get();

    if (!referrerDoc.exists) {
      return NextResponse.json(
        { error: "Referrer not found" },
        { status: 404 }
      );
    }

    const referrerData = referrerDoc.data();

    // Get metadata for percentages
    const metadataDoc = await adminDb.collection("referralMetadata").doc("globalCounter").get();
    const discountPercentage = metadataDoc.exists ? (metadataDoc.data().discountPercentage || 10) : 10;
    const commissionPercentage = metadataDoc.exists ? (metadataDoc.data().commissionPercentage || 10) : 10;

    // Calculate discount and commission
    const discount = calculateDiscount(packagePrice, discountPercentage);
    const creditAmount = calculateCommission(packagePrice, commissionPercentage);

    // Use batch for atomic operations
    const batch = adminDb.batch();

    // Update new user document (store referral info)
    const newUserRef = adminDb.collection("users").doc(newUserUid);
    batch.update(newUserRef, {
      referredBy: referralCode,
      referredByUid: referrerUid,
      referralDiscountApplied: discount.discountAmount,
      lastUpdated: new Date().toISOString()
    });

    // Update referrer's credits
    const currentCredits = referrerData.referralCredits || 0;
    const currentHistory = referrerData.referralCreditsHistory || [];

    const historyEntry = {
      type: "earned",
      amount: creditAmount,
      fromUserUid: newUserUid,
      fromUserName: newUserName,
      packagePrice: packagePrice,
      description: `10% commission from ${newUserName}'s package`,
      createdAt: new Date().toISOString()
    };

    const referrerRef = adminDb.collection("users").doc(referrerUid);
    batch.update(referrerRef, {
      referralCredits: currentCredits + creditAmount,
      referralCreditsHistory: [...currentHistory, historyEntry],
      lastUpdated: new Date().toISOString()
    });

    // Update referral stats
    const statsRef = adminDb.collection("referralStats").doc(referrerUid);
    const statsDoc = await statsRef.get();

    const referredUserEntry = {
      uid: newUserUid,
      name: newUserName,
      packagePrice: packagePrice,
      creditEarned: creditAmount,
      referredAt: new Date().toISOString()
    };

    if (statsDoc.exists) {
      const statsData = statsDoc.data();
      batch.update(statsRef, {
        totalReferrals: (statsData.totalReferrals || 0) + 1,
        totalCreditsEarned: (statsData.totalCreditsEarned || 0) + creditAmount,
        availableCredits: (statsData.availableCredits || 0) + creditAmount,
        referredUsers: [...(statsData.referredUsers || []), referredUserEntry],
        lastUpdated: new Date().toISOString()
      });
    } else {
      batch.set(statsRef, {
        uid: referrerUid,
        totalReferrals: 1,
        totalCreditsEarned: creditAmount,
        totalCreditsRedeemed: 0,
        availableCredits: creditAmount,
        referredUsers: [referredUserEntry],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }

    // Update referral code usage
    const codeRef = adminDb.collection("referralCodes").doc(referralCode);
    batch.update(codeRef, {
      usageCount: (codeData.usageCount || 0) + 1,
      totalCreditsEarned: (codeData.totalCreditsEarned || 0) + creditAmount,
      lastUsed: new Date().toISOString()
    });

    // Update global metadata
    const metadataRef = adminDb.collection("referralMetadata").doc("globalCounter");
    if (metadataDoc.exists) {
      batch.update(metadataRef, {
        totalReferrals: (metadataDoc.data().totalReferrals || 0) + 1,
        lastUpdated: new Date().toISOString()
      });
    }

    // Commit all changes
    await batch.commit();

    return NextResponse.json({
      success: true,
      discount,
      creditAdded: creditAmount,
      referrerName: referrerData.name,
      referrerNewBalance: currentCredits + creditAmount
    });

  } catch (err) {
    console.error("[referral/apply-discount]", err);
    return NextResponse.json(
      { error: err.message || "Failed to apply discount" },
      { status: 500 }
    );
  }
}
