/**
 * Fix Corrupt Referral Codes
 * 
 * This script finds and fixes referral codes with missing or invalid uid fields
 * 
 * Run: node scripts/fix-corrupt-referral-codes.js
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, "../novexa-firebase-adminsdk.json"), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixCorruptReferralCodes() {
  console.log("🔍 Scanning referralCodes collection for corrupt data...\n");

  try {
    const codesSnapshot = await db.collection("referralCodes").get();
    
    if (codesSnapshot.empty) {
      console.log("❌ No referral codes found in database");
      return;
    }

    let totalCodes = 0;
    let corruptCodes = 0;
    let fixedCodes = 0;
    let failedCodes = 0;

    const corruptList = [];

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
        corruptList.push({
          id: codeId,
          data: data,
          reason: !data.uid ? "missing uid" : 
                  typeof data.uid !== 'string' ? "uid is not string" : 
                  "uid is empty string"
        });
        
        console.log(`❌ Corrupt: ${codeId}`);
        console.log(`   Reason: ${corruptList[corruptList.length - 1].reason}`);
        console.log(`   Data:`, JSON.stringify(data, null, 2));
        console.log("");
      }
    }

    console.log("\n📊 Scan Results:");
    console.log(`   Total codes: ${totalCodes}`);
    console.log(`   Corrupt codes: ${corruptCodes}`);
    console.log(`   Valid codes: ${totalCodes - corruptCodes}\n`);

    if (corruptCodes === 0) {
      console.log("✅ All referral codes are valid!");
      return;
    }

    // Second pass: Attempt to fix corrupt codes
    console.log("🔧 Attempting to fix corrupt codes...\n");

    for (const corrupt of corruptList) {
      try {
        // Option 1: Check if userEmail exists and find user by email
        if (corrupt.data.userEmail) {
          const usersSnapshot = await db.collection("users")
            .where("email", "==", corrupt.data.userEmail)
            .limit(1)
            .get();

          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            const userId = userDoc.id;

            // Update the referral code with correct uid
            await db.collection("referralCodes").doc(corrupt.id).update({
              uid: userId
            });

            console.log(`✅ Fixed: ${corrupt.id}`);
            console.log(`   Updated uid to: ${userId}`);
            console.log(`   User email: ${corrupt.data.userEmail}\n`);
            fixedCodes++;
            continue;
          }
        }

        // Option 2: Check if userName exists and try to find user
        if (corrupt.data.userName) {
          const usersSnapshot = await db.collection("users")
            .where("name", "==", corrupt.data.userName)
            .limit(1)
            .get();

          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            const userId = userDoc.id;

            // Update the referral code with correct uid
            await db.collection("referralCodes").doc(corrupt.id).update({
              uid: userId
            });

            console.log(`✅ Fixed: ${corrupt.id}`);
            console.log(`   Updated uid to: ${userId}`);
            console.log(`   User name: ${corrupt.data.userName}\n`);
            fixedCodes++;
            continue;
          }
        }

        // If we couldn't fix it, mark as inactive
        await db.collection("referralCodes").doc(corrupt.id).update({
          isActive: false,
          _corruptionNote: `Auto-disabled: ${corrupt.reason}`,
          _disabledAt: new Date().toISOString()
        });

        console.log(`⚠️  Could not fix: ${corrupt.id}`);
        console.log(`   Marked as inactive instead\n`);
        failedCodes++;

      } catch (err) {
        console.error(`❌ Error fixing ${corrupt.id}:`, err.message);
        failedCodes++;
      }
    }

    console.log("\n🎯 Final Results:");
    console.log(`   Fixed codes: ${fixedCodes}`);
    console.log(`   Failed/Disabled codes: ${failedCodes}`);
    console.log(`   Total processed: ${corruptCodes}\n`);

    if (fixedCodes > 0) {
      console.log("✅ Corrupt referral codes have been fixed!");
    }
    if (failedCodes > 0) {
      console.log("⚠️  Some codes could not be fixed and were disabled.");
      console.log("   You may need to manually fix them in Firebase Console.");
    }

  } catch (err) {
    console.error("❌ Error during scan/fix:", err);
  } finally {
    // Exit the process
    process.exit(0);
  }
}

// Run the script
fixCorruptReferralCodes();
