/**
 * One-time migration endpoint to create top-level user docs for existing staff
 * 
 * This allows existing staff accounts to have their own sessions subcollection
 * under users/{staffUid}/sessions
 * 
 * Usage: POST /api/admin/migrate-staff-users (super-admin only)
 */
import { NextResponse } from "next/server";

async function getAdminModules() {
  const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");
  return { adminAuth, adminDb };
}

export async function POST(request) {
  try {
    const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { adminAuth, adminDb } = await getAdminModules();

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Only super-admin can run migration
    if (decoded.uid !== process.env.NEXT_PUBLIC_ADMIN_UID) {
      return NextResponse.json({ error: "Unauthorized - Super admin only" }, { status: 403 });
    }

    console.log("[migrate-staff-users] Starting migration...");

    const usersSnapshot = await adminDb.collection("users").get();
    let migrated = 0;
    let skipped = 0;
    let errors = [];

    for (const userDoc of usersSnapshot.docs) {
      const adminUid = userDoc.id;
      
      // Get all staff under this admin
      const staffSnapshot = await adminDb
        .collection("users").doc(adminUid)
        .collection("staff")
        .get();

      for (const staffDoc of staffSnapshot.docs) {
        const staffData = staffDoc.data();
        const staffUid = staffDoc.id;

        try {
          // Check if top-level user doc already exists
          const topLevelDoc = await adminDb.collection("users").doc(staffUid).get();
          
          if (topLevelDoc.exists() && topLevelDoc.data().type === "staff_account") {
            console.log(`[migrate-staff-users] Skipping ${staffUid} - already migrated`);
            skipped++;
            continue;
          }

          // Create top-level user doc
          await adminDb.collection("users").doc(staffUid).set({
            email: staffData.email,
            name: staffData.name,
            role: "staff",
            adminUid: staffData.adminUid || adminUid,
            createdAt: staffData.createdAt || new Date().toISOString(),
            type: "staff_account",
            migratedAt: new Date().toISOString(),
          });

          console.log(`[migrate-staff-users] ✅ Migrated staff: ${staffData.email} (${staffUid})`);
          migrated++;
        } catch (err) {
          console.error(`[migrate-staff-users] ❌ Error migrating ${staffUid}:`, err.message);
          errors.push({ staffUid, error: err.message });
        }
      }
    }

    return NextResponse.json({
      success: true,
      migrated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Migration complete. ${migrated} staff accounts migrated, ${skipped} skipped.`,
    });
  } catch (err) {
    console.error("[migrate-staff-users] ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
