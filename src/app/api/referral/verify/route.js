import { NextResponse } from "next/server";

/**
 * POST /api/referral/verify
 * Verify if a referral code is valid and return referrer info
 * 
 * Body: { code: "NOV-REF-01020926" }
 * Returns: { 
 *   valid: true, 
 *   referrerName, 
 *   referrerEmail, 
 *   referrerPlan,
 *   usageCount 
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

function parseReferralCode(code) {
  if (!code || typeof code !== 'string') return null;
  
  // Match format: NOV-REF-SSDMMYY
  const match = code.match(/^NOV-REF-(\d{2,})(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;
  
  const serial = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const month = parseInt(match[3], 10);
  const year = parseInt(match[4], 10);
  
  // Basic validation
  if (day < 1 || day > 31) return null;
  if (month < 1 || month > 12) return null;
  
  return { serial, day, month, year, isValid: true };
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

    const { code } = body;

    // Validate code exists and is non-empty
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json({
        valid: false,
        error: "Referral code is required"
      }, { status: 400 });
    }

    // Validate format
    const parsed = parseReferralCode(code);
    if (!parsed) {
      return NextResponse.json({
        valid: false,
        error: "Invalid referral code format"
      });
    }

    const { adminDb } = await getAdminModules();

    // Check if code exists in database
    const codeDoc = await adminDb.collection("referralCodes").doc(code.trim()).get();

    if (!codeDoc.exists) {
      return NextResponse.json({
        valid: false,
        error: "Referral code not found"
      });
    }

    const codeData = codeDoc.data();

    // Check if code is active
    if (!codeData.isActive) {
      return NextResponse.json({
        valid: false,
        error: "This referral code is no longer active"
      });
    }

    // Validate referrer UID exists and is valid
    if (!codeData.uid || typeof codeData.uid !== 'string' || codeData.uid.trim().length === 0) {
      console.error("[referral/verify] Invalid uid in referral code:", code, codeData);
      return NextResponse.json({
        valid: false,
        error: "Referral code data is corrupted"
      });
    }

    // Check if user is trying to use their own code
    if (codeData.uid === user.uid) {
      return NextResponse.json({
        valid: false,
        error: "You cannot use your own referral code"
      });
    }

    // Get referrer's user data to verify their account is active
    const referrerDoc = await adminDb.collection("users").doc(codeData.uid).get();

    if (!referrerDoc.exists) {
      return NextResponse.json({
        valid: false,
        error: "Referrer account not found"
      });
    }

    const referrerData = referrerDoc.data();

    // Check if referrer's package is active
    if (referrerData.status !== "active") {
      return NextResponse.json({
        valid: false,
        error: "Referrer's account is not active"
      });
    }

    // Return valid response with referrer info
    return NextResponse.json({
      valid: true,
      code: code,
      referrerUid: codeData.uid,
      referrerName: referrerData.name || codeData.userName,
      referrerEmail: referrerData.email || codeData.userEmail,
      referrerPlan: referrerData.plan || "starter",
      usageCount: codeData.usageCount || 0,
      serialNumber: codeData.serialNumber
    });

  } catch (err) {
    console.error("[referral/verify]", err);
    return NextResponse.json(
      { error: err.message || "Failed to verify referral code" },
      { status: 500 }
    );
  }
}
