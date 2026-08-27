/**
 * /api/staff/manage
 *
 * POST  — Create a new staff account under the authenticated admin's UID.
 * PATCH — Update an existing staff member (fields, status, password).
 * DELETE — Soft-delete (deactivate) a staff member and disable their Firebase Auth account.
 *
 * All operations are scoped to `users/{adminUid}/staff/{staffUid}`.
 * Staff are also stored as top-level Firebase Auth users with a custom claim
 * `{ role: "staff", adminUid }` so that `check-subscription` and `session-heartbeat`
 * can resolve the parent admin.
 */
import { NextResponse } from "next/server";

async function getAdminModules() {
  const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");
  return { adminAuth, adminDb };
}

/** Verify the caller is a legitimate business admin (not super-admin, not staff). */
async function verifyBusinessAdmin(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return { error: "Unauthorized" };

  const { adminAuth, adminDb } = await getAdminModules();

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return { error: "Invalid token" };
  }

  // Super-admin cannot manage staff via this route
  if (decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID)
    return { error: "Super-admin cannot use this route" };

  // Staff cannot create other staff
  if (decoded.role === "staff" || decoded.adminUid)
    return { error: "Staff accounts cannot manage other staff" };

  // Verify admin's user doc exists and is active
  const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) return { error: "Admin account not found" };

  const userData = userSnap.data();
  if (userData.status === "frozen" || userData.status === "deleted")
    return { error: "Account frozen or deleted" };

  return { uid: decoded.uid, userData, adminAuth, adminDb };
}

// ── POST — Create staff ───────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const auth = await verifyBusinessAdmin(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { uid: adminUid, userData: adminData, adminAuth, adminDb } = auth;

    let body;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { name, email, password, role, allowedModules, permissions, isActive = true } = body;

    if (!name?.trim())     return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!email?.trim())    return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (!password)         return NextResponse.json({ error: "Password is required" }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    // Validate allowedModules — must be a subset of admin's plan modules
    const modules = Array.isArray(allowedModules) ? allowedModules : [];
    
    // Default permissions if not provided
    const defaultPermissions = {
      invoices:  { view: "own", create: false, edit: false, delete: false },
      customers: { view: "all", create: false, edit: false, delete: false },
      inventory: { view: "all", create: false, edit: false, delete: false },
      payments:  { view: "all", create: false, edit: false, delete: false },
      purchases: { view: "all", create: false, edit: false, delete: false },
    };
    const staffPermissions = permissions || defaultPermissions;

    // Create Firebase Auth user
    let staffRecord;
    try {
      staffRecord = await adminAuth.createUser({
        email:         email.trim().toLowerCase(),
        password,
        displayName:   name.trim(),
        emailVerified: true,
      });
    } catch (err) {
      if (err.code === "auth/email-already-exists")
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      throw err;
    }

    // Set custom claims so check-subscription can identify this as a staff account
    await adminAuth.setCustomUserClaims(staffRecord.uid, {
      role:     "staff",
      adminUid: adminUid,
    });

    const now = new Date().toISOString();

    // Write staff doc under admin's subcollection
    const staffDoc = {
      uid:            staffRecord.uid,
      adminUid,
      name:           name.trim(),
      email:          email.trim().toLowerCase(),
      role:           role?.trim() || "Staff",
      allowedModules: modules,
      permissions:    staffPermissions,
      isActive:       Boolean(isActive),
      createdAt:      now,
      updatedAt:      now,
    };

    await adminDb
      .collection("users").doc(adminUid)
      .collection("staff").doc(staffRecord.uid)
      .set(staffDoc);

    // Also write a lookup doc at the top level so heartbeat/check-subscription
    // can resolve adminUid from staffUid without scanning all users
    await adminDb.collection("staffLookup").doc(staffRecord.uid).set({
      adminUid,
      isActive: Boolean(isActive),
      createdAt: now,
    });

    return NextResponse.json({ success: true, uid: staffRecord.uid, staff: staffDoc });
  } catch (err) {
    console.error("[staff/manage POST]", err);
    return NextResponse.json({ error: err.message || "Failed to create staff" }, { status: 500 });
  }
}

// ── PATCH — Update staff ──────────────────────────────────────────────────────
export async function PATCH(request) {
  try {
    const auth = await verifyBusinessAdmin(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { uid: adminUid, adminAuth, adminDb } = auth;

    let body;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { staffUid, name, role, allowedModules, permissions, isActive, password } = body;
    if (!staffUid) return NextResponse.json({ error: "staffUid is required" }, { status: 400 });

    // Verify staff belongs to this admin
    const staffRef = adminDb
      .collection("users").doc(adminUid)
      .collection("staff").doc(staffUid);
    const staffSnap = await staffRef.get();
    if (!staffSnap.exists)
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

    const updates = { updatedAt: new Date().toISOString() };
    if (name            !== undefined) updates.name           = name.trim();
    if (role            !== undefined) updates.role           = role?.trim() || "Staff";
    if (allowedModules  !== undefined) updates.allowedModules = Array.isArray(allowedModules) ? allowedModules : [];
    if (permissions     !== undefined) updates.permissions    = permissions;
    if (isActive        !== undefined) updates.isActive       = Boolean(isActive);

    await staffRef.update(updates);

    // Update lookup doc isActive flag
    if (isActive !== undefined) {
      await adminDb.collection("staffLookup").doc(staffUid).update({
        isActive: Boolean(isActive),
      });
    }

    // Reset password if requested
    if (password) {
      if (password.length < 8)
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      await adminAuth.updateUser(staffUid, { password });
    }

    // Enable/disable Firebase Auth account to match isActive
    if (isActive !== undefined) {
      await adminAuth.updateUser(staffUid, { disabled: !Boolean(isActive) });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[staff/manage PATCH]", err);
    return NextResponse.json({ error: err.message || "Failed to update staff" }, { status: 500 });
  }
}

// ── DELETE — Remove staff ─────────────────────────────────────────────────────
export async function DELETE(request) {
  try {
    const auth = await verifyBusinessAdmin(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { uid: adminUid, adminAuth, adminDb } = auth;

    let body;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { staffUid } = body;
    if (!staffUid) return NextResponse.json({ error: "staffUid is required" }, { status: 400 });

    // Verify staff belongs to this admin
    const staffRef = adminDb
      .collection("users").doc(adminUid)
      .collection("staff").doc(staffUid);
    const staffSnap = await staffRef.get();
    if (!staffSnap.exists)
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

    // Soft-delete: mark deleted and disable Firebase Auth
    await staffRef.update({
      deleted:   true,
      isActive:  false,
      deletedAt: new Date().toISOString(),
    });

    // Remove from lookup
    await adminDb.collection("staffLookup").doc(staffUid).delete();

    // Disable Firebase Auth account (keep for audit trail, don't hard-delete)
    try {
      await adminAuth.updateUser(staffUid, { disabled: true });
    } catch { /* ignore if user doesn't exist */ }

    // Revoke all refresh tokens (force sign-out immediately)
    try {
      await adminAuth.revokeRefreshTokens(staffUid);
    } catch { /* ignore */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[staff/manage DELETE]", err);
    return NextResponse.json({ error: err.message || "Failed to delete staff" }, { status: 500 });
  }
}
