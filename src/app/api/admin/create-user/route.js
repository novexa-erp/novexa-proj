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

    const { name, email, password, phone, address, activeFrom, activeTo, activeToTime, maxDevices, plan, subscriptionType, billingPeriod, paymentMethod, referralCode } = body;

    if (!name || !email || !password || !activeFrom || !activeTo)
      return NextResponse.json({ error: "Missing required fields: name, email, password, activeFrom, activeTo" }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    const { adminAuth, adminDb } = await getAdminModules();

    // ── Verify referral code if provided ──
    let referrerUid = null;
    let referrerData = null;
    let discountApplied = false;
    let packagePriceInfo = null;
    let validReferralCode = null; // Store validated code

    if (referralCode && typeof referralCode === 'string') {
      const trimmedCode = referralCode.trim();
      
      // Verify code is not empty after trimming
      if (trimmedCode.length > 0) {
        try {
          // Verify the referral code
          const codeDoc = await adminDb.collection("referralCodes").doc(trimmedCode).get();
        
        if (codeDoc.exists) {
          const codeData = codeDoc.data();
          
          // Check if code is active and has valid uid
          if (codeData.isActive && codeData.uid && typeof codeData.uid === 'string' && codeData.uid.trim().length > 0) {
            // Get referrer's data
            const referrerDoc = await adminDb.collection("users").doc(codeData.uid).get();
            
            if (referrerDoc.exists) {
              const refData = referrerDoc.data();
              
              // Check if referrer's package is active
              if (refData.status === "active") {
                referrerUid = codeData.uid;
                referrerData = refData;
                discountApplied = true;
                validReferralCode = trimmedCode; // Store valid code
                
                // Store package price info for later credit calculation
                // This will be used after user creation
                packagePriceInfo = {
                  plan: plan || "starter",
                  billingPeriod: billingPeriod || "monthly"
                };
              }
            }
          }
        }
        } catch (refErr) {
          console.error("[create-user] Referral verification failed:", refErr);
          // Don't fail user creation if referral verification fails
        }
      }
    }

    const userRecord = await adminAuth.createUser({
      email:         email.trim().toLowerCase(),
      password,
      displayName:   name.trim(),
      emailVerified: true,
    });

    const userDoc = {
      name:         name.trim(),
      email:        email.trim().toLowerCase(),
      phone:        phone?.trim() || "",
      address:      address?.trim() || "",
      activeFrom,
      activeTo,
      activeToTime: activeToTime?.trim() || "",   // "HH:MM" or ""
      maxDevices:   Number(maxDevices) || 1,
      plan:             plan || "starter",
      subscriptionType: subscriptionType || "active",
      billingPeriod:    billingPeriod || "monthly",
      paymentMethod:    paymentMethod || "cash",
      status:           "active",
      createdAt:    new Date().toISOString(),
      createdBy:    admin.uid,
      referralCredits: 0,
      referralCreditsHistory: []
    };

    // Add referral info if code was valid
    if (referrerUid && validReferralCode) {
      userDoc.referredBy = validReferralCode;
      userDoc.referredByUid = referrerUid;
      userDoc.referralDiscountApplied = discountApplied;
      userDoc.discountPercentage = 10; // Always 10%
    }

    await adminDb.collection("users").doc(userRecord.uid).set(userDoc);

    // ── Generate referral code for new active user ──
    let referralCodeGenerated = false;
    let generatedCode = null;
    
    try {
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
        uid: userRecord.uid,
        userName: name.trim(),
        userEmail: email.trim().toLowerCase(),
        serialNumber,
        generatedAt: new Date().toISOString(),
        isActive: true,
        usageCount: 0,
        totalCreditsEarned: 0
      });
      
      // Update user document with referral code
      batch.update(adminDb.collection("users").doc(userRecord.uid), {
        referralCode: generatedCode
      });
      
      // Initialize referral stats
      const statsRef = adminDb.collection("referralStats").doc(userRecord.uid);
      batch.set(statsRef, {
        uid: userRecord.uid,
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
    } catch (refErr) {
      console.error("[create-user] Referral code generation failed:", refErr);
      // Don't fail user creation if referral code generation fails
    }

    // ── Credit referrer if user was referred ──
    let creditAmount = 0;
    let creditAdded = false;

    if (referrerUid && typeof referrerUid === 'string' && referrerUid.trim().length > 0 && discountApplied) {
      try {
        // Get REFERRER's current package price (not new user's package!)
        const referrerDoc = await adminDb.collection("users").doc(referrerUid).get();
        
        if (!referrerDoc.exists) {
          console.warn('[create-user] Referrer document not found:', referrerUid);
          throw new Error('Referrer not found');
        }

        const referrerData = referrerDoc.data();
        const referrerPlan = referrerData.plan || 'starter';
        const referrerBillingPeriod = referrerData.billingPeriod || 'monthly';

        console.log('[create-user] Referrer info:', {
          uid: referrerUid,
          plan: referrerPlan,
          billingPeriod: referrerBillingPeriod
        });

        // Get plan prices from adminConfig
        const plansDoc = await adminDb.collection("adminConfig").doc("plans").get();
        let referrerPackagePrice = 0;

        if (plansDoc.exists) {
          const plansList = plansDoc.data().list || [];
          const referrerPlanObj = plansList.find(p => p.id === referrerPlan);
          
          if (referrerPlanObj) {
            // Get the actual price based on REFERRER's billing period
            if (referrerBillingPeriod === "yearly") {
              referrerPackagePrice = referrerPlanObj.afterYearlyPrice || referrerPlanObj.yearlyPrice || 0;
            } else {
              referrerPackagePrice = referrerPlanObj.afterMonthlyPrice || referrerPlanObj.monthlyPrice || 0;
            }
          }
        }

        // Fallback to default prices if not found in config
        if (!referrerPackagePrice) {
          const defaultPrices = {
            starter: { monthly: 1777, yearly: 17770 },
            business: { monthly: 3333, yearly: 33330 },
            professional: { monthly: 5499, yearly: 54990 },
            enterprise: { monthly: 0, yearly: 0 }
          };
          
          const planDefault = defaultPrices[referrerPlan] || defaultPrices.starter;
          referrerPackagePrice = referrerBillingPeriod === "yearly" 
            ? planDefault.yearly 
            : planDefault.monthly;
        }

        console.log('[create-user] Referrer package price:', referrerPackagePrice);

        // Calculate 10% commission based on REFERRER's package price
        if (referrerPackagePrice > 0) {
          creditAmount = Math.round((referrerPackagePrice * 10) / 100);

          console.log('[create-user] Credit to be added:', creditAmount);

          // Use batch for atomic credit addition
          const creditBatch = adminDb.batch();

          // Get referrer's current data
          const referrerRef = adminDb.collection("users").doc(referrerUid);

          const currentCredits = referrerData.referralCredits || 0;
          const currentHistory = referrerData.referralCreditsHistory || [];

          // Create credit history entry
          const historyEntry = {
            type: "earned",
            amount: creditAmount,
            fromUserUid: userRecord.uid,
            fromUserName: name.trim(),
            referrerPackagePrice: referrerPackagePrice,
            referrerPlan: referrerPlan,
            description: `10% commission based on your ${referrerPlan} package (${name.trim()} joined)`,
            createdAt: new Date().toISOString()
          };

            // Update referrer's credits
            creditBatch.update(referrerRef, {
              referralCredits: currentCredits + creditAmount,
              referralCreditsHistory: [...currentHistory, historyEntry],
              lastUpdated: new Date().toISOString()
            });

            // Update referral stats
            const statsRef = adminDb.collection("referralStats").doc(referrerUid);
            const statsDoc = await statsRef.get();

            const referredUserEntry = {
              uid: userRecord.uid,
              name: name.trim(),
              email: email.trim().toLowerCase(),
              referrerPackagePrice: referrerPackagePrice,
              creditEarned: creditAmount,
              referredAt: new Date().toISOString()
            };

            if (statsDoc.exists) {
              const statsData = statsDoc.data();
              creditBatch.update(statsRef, {
                totalReferrals: (statsData.totalReferrals || 0) + 1,
                totalCreditsEarned: (statsData.totalCreditsEarned || 0) + creditAmount,
                availableCredits: (statsData.availableCredits || 0) + creditAmount,
                referredUsers: [...(statsData.referredUsers || []), referredUserEntry],
                lastUpdated: new Date().toISOString()
              });
            } else {
              creditBatch.set(statsRef, {
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
            if (validReferralCode && typeof validReferralCode === 'string' && validReferralCode.trim().length > 0) {
              const codeRef = adminDb.collection("referralCodes").doc(validReferralCode);
              const codeDoc = await codeRef.get();
              
              if (codeDoc.exists) {
                const codeData = codeDoc.data();
                creditBatch.update(codeRef, {
                  usageCount: (codeData.usageCount || 0) + 1,
                  totalCreditsEarned: (codeData.totalCreditsEarned || 0) + creditAmount,
                  lastUsed: new Date().toISOString()
                });
              }
            }

            // Update global metadata
            const metadataRef = adminDb.collection("referralMetadata").doc("globalCounter");
            const metadataDoc = await metadataRef.get();
            
            if (metadataDoc.exists) {
              creditBatch.update(metadataRef, {
                totalReferrals: (metadataDoc.data().totalReferrals || 0) + 1,
                lastUpdated: new Date().toISOString()
              });
            }

            await creditBatch.commit();
            creditAdded = true;
          }
        } catch (creditErr) {
        console.error("[create-user] Referrer credit failed:", creditErr);
        // Don't fail user creation if credit addition fails
      }
    }

    const response = { success: true, uid: userRecord.uid };
    if (referralCodeGenerated) {
      response.referralCode = generatedCode;
      response.referralCodeGenerated = true;
    }
    if (creditAdded) {
      response.referralCreditAdded = true;
      response.creditAmount = creditAmount;
      response.referrerUid = referrerUid;
    }
    if (discountApplied) {
      response.referralDiscountApplied = true;
      response.referredBy = validReferralCode;
      response.discountPercentage = 10; // Always 10%
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("[create-user]", err);
    if (err.code === "auth/email-already-exists")
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    return NextResponse.json({ error: err.message || "Failed to create user" }, { status: 500 });
  }
}
