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

export async function POST(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { uid, name, phone, address, activeFrom, activeTo, activeToTime, status, newPassword, maxDevices, emailFeatureEnabled, plan, subscriptionType, billingPeriod, paymentMethod, extraLimits, extraLimitsExpiresAt, extraLimitsPurchasedAt, extraLimitsPaymentMethod } = body;
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const { adminAuth, adminDb } = await getAdminModules();

    const update = { updatedAt: new Date().toISOString(), updatedBy: admin.uid };
    if (name)                    update.name         = name.trim();
    if (phone  !== undefined)    update.phone        = phone?.trim() || "";
    if (address !== undefined)   update.address      = address?.trim() || "";
    if (activeFrom)              update.activeFrom   = activeFrom;
    if (activeTo)                update.activeTo     = activeTo;
    if (activeToTime !== undefined) update.activeToTime = activeToTime?.trim() || "";
    if (status)                  update.status       = status;
    if (maxDevices !== undefined) update.maxDevices  = Number(maxDevices) || 1;
    if (emailFeatureEnabled !== undefined) update.emailFeatureEnabled = Boolean(emailFeatureEnabled);
    if (plan !== undefined) update.plan = plan;
    if (subscriptionType !== undefined) update.subscriptionType = subscriptionType;
    if (billingPeriod !== undefined) update.billingPeriod = billingPeriod;
    if (paymentMethod !== undefined) update.paymentMethod = paymentMethod;

    // Extra limits (admin-granted monthly add-ons per user)
    if (extraLimits !== undefined) {
      if (extraLimits === null) {
        update.extraLimits = null;
      } else {
        // Only store numeric or null values for each known key
        const allowed = ["invoicesPerMonth","invoicesPerCustomerPerMonth","customersPerMonth","suppliersPerMonth","ordersPerSupplierPerMonth","extraUsers"];
        const cleaned = {};
        allowed.forEach(k => {
          if (extraLimits[k] !== undefined) {
            cleaned[k] = extraLimits[k] === null || extraLimits[k] === "" ? 0 : Number(extraLimits[k]) || 0;
          }
        });
        update.extraLimits = cleaned;
      }
    }

    // Renewal tracking fields
    const { lastRenewedAt, lastRenewedBy } = body;
    if (lastRenewedAt) update.lastRenewedAt = lastRenewedAt;
    if (lastRenewedBy) update.lastRenewedBy = lastRenewedBy;

    // Add-on expiry / purchase tracking
    // For extraLimitsExpiresAt — always keep the LATER date (never shorten existing expiry)
    if (extraLimitsExpiresAt !== undefined) {
      if (extraLimitsExpiresAt) {
        // Read existing expiry and keep whichever is later
        try {
          const userSnap = await adminDb.collection("users").doc(uid).get();
          const existingExpiry = userSnap.exists ? userSnap.data().extraLimitsExpiresAt : null;
          if (existingExpiry && new Date(existingExpiry) > new Date(extraLimitsExpiresAt)) {
            update.extraLimitsExpiresAt = existingExpiry; // keep the later one
          } else {
            update.extraLimitsExpiresAt = extraLimitsExpiresAt;
          }
        } catch {
          update.extraLimitsExpiresAt = extraLimitsExpiresAt;
        }
      } else {
        update.extraLimitsExpiresAt = extraLimitsExpiresAt;
      }
    }
    if (extraLimitsPurchasedAt  !== undefined) update.extraLimitsPurchasedAt  = extraLimitsPurchasedAt;
    if (extraLimitsPaymentMethod !== undefined) update.extraLimitsPaymentMethod = extraLimitsPaymentMethod;

    // If unfreezing, clear the frozenAt / frozenReason
    if (status === "active") {
      update.frozenAt     = null;
      update.frozenReason = null;
    }

    await adminDb.collection("users").doc(uid).update(update);

    // ── Generate referral code if user is being activated and doesn't have one ──
    let referralCodeGenerated = false;
    let generatedCode = null;
    
    if (status === "active") {
      try {
        // Check if user already has a referral code
        const userDoc = await adminDb.collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        if (!userData.referralCode) {
          // User is being activated and doesn't have a referral code — generate one
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
          
          generatedCode = `NOV-REF-${serial}${day}${month}${year}`;
          
          // Use batch for atomic operations
          const batch = adminDb.batch();
          
          // Store in referralCodes collection
          const codeRef = adminDb.collection("referralCodes").doc(generatedCode);
          batch.set(codeRef, {
            code: generatedCode,
            uid,
            userName: userData.name || name || "",
            userEmail: userData.email || "",
            serialNumber,
            generatedAt: new Date().toISOString(),
            isActive: true,
            usageCount: 0,
            totalCreditsEarned: 0
          });
          
          // Update user document with referral code
          batch.update(adminDb.collection("users").doc(uid), {
            referralCode: generatedCode,
            referralCredits: 0,
            referralCreditsHistory: []
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
          
          await batch.commit();
          referralCodeGenerated = true;
        }
      } catch (refErr) {
        console.error("[update-user] Referral code generation failed:", refErr);
        // Don't fail the entire update if referral code generation fails
      }
    }

    // Sync Auth if needed — gracefully handle missing Auth record
    const authUpdate = {};
    if (name)        authUpdate.displayName = name.trim();
    if (newPassword) authUpdate.password    = newPassword;
    if (status === "frozen" || status === "deleted") authUpdate.disabled = true;
    if (status === "active") authUpdate.disabled = false;
    if (Object.keys(authUpdate).length) {
      try {
        await adminAuth.updateUser(uid, authUpdate);
      } catch (authErr) {
        if (authErr.code !== "auth/user-not-found") throw authErr;
        // Auth record was deleted directly — Firestore update already succeeded, that's fine
      }
    }

    const response = { success: true };
    if (referralCodeGenerated) {
      response.referralCode = generatedCode;
      response.referralCodeGenerated = true;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("[update-user]", err);
    return NextResponse.json({ error: err.message || "Update failed" }, { status: 500 });
  }
}
