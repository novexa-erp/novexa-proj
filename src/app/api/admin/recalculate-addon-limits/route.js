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

// ── POST — recalculate extraLimits from all approved addonRequests ───────────
// This fixes any data inconsistency where extraLimits got overwritten incorrectly.
// It sums up ALL approved requests and sets the correct total.
export async function POST(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { uid } = body;
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const { adminDb } = await getAdminModules();

    // Fetch ALL approved addonRequests for this user
    const snap = await adminDb
      .collection("users").doc(uid)
      .collection("addonRequests")
      .where("status", "==", "approved")
      .get();

    const ALLOWED_KEYS = [
      "invoicesPerMonth",
      "invoicesPerCustomerPerMonth",
      "customersPerMonth",
      "suppliersPerMonth",
      "ordersPerSupplierPerMonth",
      "extraUsers",
    ];

    // Sum all approved line items
    const totals = {};
    ALLOWED_KEYS.forEach(k => { totals[k] = 0; });

    snap.docs.forEach(doc => {
      const data = doc.data();
      (data.lineItems || []).forEach(item => {
        const key = item.limitKey || item.key || "";
        if (ALLOWED_KEYS.includes(key)) {
          totals[key] = (totals[key] || 0) + (Number(item.qty) || 0);
        }
      });
    });

    // Find the latest expiry among all approved requests
    let latestExpiry = null;
    snap.docs.forEach(doc => {
      const data = doc.data();
      const exp  = data.extraLimitsExpiresAt || data.processedAt;
      if (exp) {
        const expDate = new Date(exp?.toDate ? exp.toDate() : exp);
        // Add 1 month to processedAt if it's not an expiry date
        const isExpiry = data.extraLimitsExpiresAt;
        const finalExp = isExpiry
          ? expDate
          : (() => { const d = new Date(expDate); d.setMonth(d.getMonth() + 1); return d; })();
        if (!latestExpiry || finalExp > latestExpiry) latestExpiry = finalExp;
      }
    });

    // Also check maxDevices for extraUsers
    const userSnap = await adminDb.collection("users").doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};

    // extraUsers delta: what should maxDevices be?
    const baseMaxDevices = 1; // default minimum
    // Current maxDevices from non-addon source (plan default)
    // We keep it at least baseMaxDevices + totals.extraUsers
    const extraUsersUpdate = {};
    if (totals.extraUsers > 0) {
      // Only update if current maxDevices is less than what it should be
      const currentMax = Number(userData.maxDevices) || 1;
      const expectedMax = baseMaxDevices + totals.extraUsers;
      if (currentMax < expectedMax) {
        extraUsersUpdate.maxDevices = expectedMax;
      }
    }

    const now = new Date().toISOString();

    await adminDb.collection("users").doc(uid).update({
      extraLimits:            totals,
      extraLimitsExpiresAt:   latestExpiry ? latestExpiry.toISOString() : null,
      updatedAt:              now,
      updatedBy:              admin.uid,
      ...extraUsersUpdate,
    });

    return NextResponse.json({
      success: true,
      recalculated: totals,
      expiresAt: latestExpiry ? latestExpiry.toISOString() : null,
      approvedRequestsCount: snap.docs.length,
    });

  } catch (err) {
    console.error("[recalculate-addon-limits] Error:", err.message);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
