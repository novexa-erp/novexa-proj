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

    const { uid, name, phone, address, activeFrom, activeTo, activeToTime, status, newPassword, maxDevices, emailFeatureEnabled, plan, subscriptionType, billingPeriod, paymentMethod, extraLimits } = body;
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
        const allowed = ["invoicesPerMonth","invoicesPerCustomerPerMonth","customersPerMonth","suppliersPerMonth","ordersPerSupplierPerMonth"];
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

    // If unfreezing, clear the frozenAt / frozenReason
    if (status === "active") {
      update.frozenAt     = null;
      update.frozenReason = null;
    }

    await adminDb.collection("users").doc(uid).update(update);

    // Sync Auth if needed
    const authUpdate = {};
    if (name)        authUpdate.displayName = name.trim();
    if (newPassword) authUpdate.password    = newPassword;
    if (status === "frozen" || status === "deleted") authUpdate.disabled = true;
    if (status === "active") authUpdate.disabled = false;
    if (Object.keys(authUpdate).length) await adminAuth.updateUser(uid, authUpdate);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[update-user]", err);
    return NextResponse.json({ error: err.message || "Update failed" }, { status: 500 });
  }
}
