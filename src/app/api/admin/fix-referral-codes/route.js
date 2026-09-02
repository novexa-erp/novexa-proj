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
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { adminDb } = await getAdminModules();

    console.log("[fix-referral-codes] Starting scan...");

    const codesSnapshot = await adminDb.collection("referralCodes").get();
    
    if (codesSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No referral codes found in database",
        totalCodes: 0,
        corruptCodes: 0,
        fixedCodes: 0,
        disabledCodes: 0
      });
    }

    let totalCodes = 0;
    let corruptCodes = 0;
    let fixedCodes = 0;
    let disabledCodes = 0;

    const corruptList = [];
    const results = [];

    // First pass: Identify corrupt codes
    for (const doc of codesSnapshot.docs) {
      totalCodes++;
      const data = doc.data();
      const codeId = doc.id;

      // Check if uid is missing or invalid
      const isCorrupt = !data.uid || 
                       typeof data.uid !== 'string' || 
                       data.uid.trim().length === 0;

      if (isCorrupt) {
        corruptCodes++;
        const reason = !data.uid ? "missing uid" : 
                      typeof data.uid !== 'string' ? "uid is not string" : 
                      "uid is empty string";
        
        corruptList.push({
          id: codeId,
          data: data,
          reason: reason
        });
        
        console.log(`[fix-referral-codes] Corrupt: ${codeId} - ${reason}`);
      }
    }

    console.log(`[fix-referral-codes] Found ${corruptCodes} corrupt codes out of ${totalCodes} total`);

    // Second pass: Attempt to fix corrupt codes
    for (const corrupt of corruptList) {
      try {
        let fixed = false;

        // Option 1: Check if userEmail exists and find user by email
        if (corrupt.data.userEmail) {
          const usersSnapshot = await adminDb.collection("users")
            .where("email", "==", corrupt.data.userEmail)
            .limit(1)
            .get();

          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            const userId = userDoc.id;

            // Update the referral code with correct uid
            await adminDb.collection("referralCodes").doc(corrupt.id).update({
              uid: userId,
              _fixedAt: new Date().toISOString(),
              _fixedBy: "auto-fix-script"
            });

            results.push({
              code: corrupt.id,
              status: "fixed",
              method: "email",
              uid: userId
            });

            console.log(`[fix-referral-codes] Fixed: ${corrupt.id} via email`);
            fixedCodes++;
            fixed = true;
          }
        }

        // Option 2: Check if userName exists and try to find user
        if (!fixed && corrupt.data.userName) {
          const usersSnapshot = await adminDb.collection("users")
            .where("name", "==", corrupt.data.userName)
            .limit(1)
            .get();

          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            const userId = userDoc.id;

            // Update the referral code with correct uid
            await adminDb.collection("referralCodes").doc(corrupt.id).update({
              uid: userId,
              _fixedAt: new Date().toISOString(),
              _fixedBy: "auto-fix-script"
            });

            results.push({
              code: corrupt.id,
              status: "fixed",
              method: "name",
              uid: userId
            });

            console.log(`[fix-referral-codes] Fixed: ${corrupt.id} via name`);
            fixedCodes++;
            fixed = true;
          }
        }

        // If we couldn't fix it, mark as inactive
        if (!fixed) {
          await adminDb.collection("referralCodes").doc(corrupt.id).update({
            isActive: false,
            _corruptionNote: `Auto-disabled: ${corrupt.reason}`,
            _disabledAt: new Date().toISOString()
          });

          results.push({
            code: corrupt.id,
            status: "disabled",
            reason: corrupt.reason
          });

          console.log(`[fix-referral-codes] Disabled: ${corrupt.id}`);
          disabledCodes++;
        }

      } catch (err) {
        console.error(`[fix-referral-codes] Error fixing ${corrupt.id}:`, err);
        results.push({
          code: corrupt.id,
          status: "error",
          error: err.message
        });
      }
    }

    const summary = {
      success: true,
      message: corruptCodes === 0 
        ? "All referral codes are valid!" 
        : `Fixed ${fixedCodes} codes, disabled ${disabledCodes} codes`,
      totalCodes,
      corruptCodes,
      fixedCodes,
      disabledCodes,
      validCodes: totalCodes - corruptCodes,
      results
    };

    console.log("[fix-referral-codes] Completed:", summary);

    return NextResponse.json(summary);

  } catch (err) {
    console.error("[fix-referral-codes] Error:", err);
    return NextResponse.json(
      { 
        success: false,
        error: err.message || "Failed to fix referral codes" 
      },
      { status: 500 }
    );
  }
}
