/**
 * /api/staff/resolve
 *
 * Called immediately after a successful Firebase login to determine:
 *   - Is this user a staff member?
 *   - What is their parent adminUid?
 *   - What modules are they allowed to access?
 *   - Is the parent admin's subscription still active?
 *
 * Returns:
 *   { isStaff: false }                          — regular admin login, proceed normally
 *   { isStaff: true, adminUid, allowedModules, staffDoc }  — staff login
 *   { error, allowed: false }                   — blocked/inactive
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

    // Super-admin — not a staff member
    if (decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID) {
      return NextResponse.json({ isStaff: false });
    }

    // Check custom claims for staff role
    const isStaffViaClaim = decoded.role === "staff" && decoded.adminUid;

    // Also check staffLookup collection as a fallback
    // (for accounts created before claims were set, or if claims are stale)
    let adminUid = isStaffViaClaim ? decoded.adminUid : null;

    if (!adminUid) {
      const lookupSnap = await adminDb.collection("staffLookup").doc(decoded.uid).get();
      if (!lookupSnap.exists) {
        // Not a staff member — regular admin login
        return NextResponse.json({ isStaff: false });
      }
      adminUid = lookupSnap.data().adminUid;
    }

    // Fetch staff document
    const staffSnap = await adminDb
      .collection("users").doc(adminUid)
      .collection("staff").doc(decoded.uid)
      .get();

    if (!staffSnap.exists) {
      return NextResponse.json({ error: "Staff record not found", allowed: false }, { status: 403 });
    }

    const staffData = staffSnap.data();

    // Check if staff is deleted or inactive
    if (staffData.deleted) {
      return NextResponse.json({ error: "This staff account has been removed.", allowed: false }, { status: 403 });
    }

    if (!staffData.isActive) {
      return NextResponse.json({ error: "Your account has been deactivated. Please contact your admin.", allowed: false }, { status: 403 });
    }

    // Check parent admin's subscription
    const adminSnap = await adminDb.collection("users").doc(adminUid).get();
    if (!adminSnap.exists) {
      return NextResponse.json({ error: "Admin account not found.", allowed: false }, { status: 403 });
    }

    const adminData = adminSnap.data();

    if (adminData.status === "frozen" || adminData.status === "deleted") {
      return NextResponse.json({
        error: "The admin account is currently suspended. Please contact your admin.",
        allowed: false,
      }, { status: 403 });
    }

    // Check admin subscription expiry
    if (adminData.activeTo) {
      const timeStr   = adminData.activeToTime || "23:59:59";
      const expiryStr = `${adminData.activeTo}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}`;
      const expiry    = new Date(expiryStr);
      if (new Date() > expiry) {
        return NextResponse.json({
          error: "The admin's subscription has expired. Please contact your admin.",
          allowed: false,
        }, { status: 403 });
      }
    }

    // Make sure custom claims are set (refresh if stale)
    if (!isStaffViaClaim) {
      await adminAuth.setCustomUserClaims(decoded.uid, {
        role:     "staff",
        adminUid: adminUid,
      });
    }

    return NextResponse.json({
      isStaff:        true,
      adminUid,
      allowedModules: staffData.allowedModules || [],
      staffDoc: {
        uid:         decoded.uid,
        name:        staffData.name,
        email:       staffData.email,
        role:        staffData.role,
        permissions: staffData.permissions || {
          invoices:  { view: "own", create: false, edit: false, delete: false },
          customers: { view: "all", create: false, edit: false, delete: false },
          inventory: { view: "all", create: false, edit: false, delete: false },
          payments:  { view: "all", create: false, edit: false, delete: false },
          purchases: { view: "all", create: false, edit: false, delete: false },
        },
      },
      adminPlan: adminData.plan || "starter",
    });
  } catch (err) {
    console.error("[staff/resolve]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
