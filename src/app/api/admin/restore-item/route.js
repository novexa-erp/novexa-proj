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

    const body = await request.json();
    const { uid, itemId, collection: col, supplierId, restoreToTrash } = body;
    if (!uid || !itemId || !col) {
      return NextResponse.json({ error: "Missing uid, itemId, or collection" }, { status: 400 });
    }

    const { adminDb } = await getAdminModules();
    const now = new Date().toISOString();

    // restoreToTrash=true  → admin restoring to user's trash (deleted:true, adminTrash:false)
    // restoreToTrash=false → full restore (deleted:false) — not used from admin panel currently
    const updates = restoreToTrash
      ? { adminTrash: false, adminTrashedAt: null, adminRestoredAt: now, deleted: true }
      : { deleted: false, deletedAt: null, adminTrash: false, restoredAt: now };

    const userRef = adminDb.collection("users").doc(uid);

    if (col === "orders") {
      if (!supplierId) return NextResponse.json({ error: "Missing supplierId for orders" }, { status: 400 });
      await userRef.collection("suppliers").doc(supplierId).collection("orders").doc(itemId).update(updates);

    } else if (col === "customers") {
      await userRef.collection("customers").doc(itemId).update(updates);
      const custInvSnap = await userRef.collection("customers").doc(itemId).collection("invoices").get();
      await Promise.all(custInvSnap.docs.map(d => d.ref.update(updates)));
      const invSnap = await userRef.collection("invoices").where("customerId", "==", itemId).get();
      await Promise.all(invSnap.docs.map(d => d.ref.update(updates)));
      const paySnap = await userRef.collection("payments").where("customerId", "==", itemId).get();
      await Promise.all(paySnap.docs.map(d => d.ref.update(updates)));

    } else if (col === "suppliers") {
      await userRef.collection("suppliers").doc(itemId).update(updates);
      const ordSnap = await userRef.collection("suppliers").doc(itemId).collection("orders").get();
      await Promise.all(ordSnap.docs.map(d => d.ref.update(updates)));

    } else if (col === "invoices") {
      await userRef.collection("invoices").doc(itemId).update(updates);
      const invDoc = await userRef.collection("invoices").doc(itemId).get();
      const customerId = invDoc.data()?.customerId;
      if (customerId) {
        await userRef.collection("customers").doc(customerId).collection("invoices").doc(itemId).update(updates).catch(() => {});
      }

    } else {
      await userRef.collection(col).doc(itemId).update(updates);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[restore-item]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
