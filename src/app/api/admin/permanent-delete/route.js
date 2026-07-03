import { NextResponse } from "next/server";

async function getAdminModules() {
  const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");
  return { adminAuth, adminDb };
}

/**
 * Verifies the request token.
 * - If the token belongs to the super admin → full access.
 * - If the token belongs to a regular user  → can only delete their own data (uid must match).
 * Returns { uid: string, isAdmin: boolean } or null if invalid.
 */
async function verifyToken(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const { adminAuth } = await getAdminModules();
    const decoded = await adminAuth.verifyIdToken(token);
    const isAdmin = decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID;
    return { uid: decoded.uid, isAdmin };
  } catch { return null; }
}

/**
 * POST /api/admin/permanent-delete
 *
 * Permanently deletes one item (and its cascades) from Firestore.
 * Accepts both the super-admin token AND the user's own token (user can only
 * delete items from their own uid — enforced below).
 *
 * Body:
 *   uid        — user's UID
 *   itemId     — document ID to delete
 *   collection — "invoices" | "customers" | "products" | "payments" | "suppliers" | "orders"
 *   supplierId — required when collection === "orders"
 */
export async function POST(request) {
  try {
    const caller = await verifyToken(request);
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { uid, itemId, collection: col, supplierId } = body;

    if (!uid || !itemId || !col) {
      return NextResponse.json({ error: "Missing uid, itemId, or collection" }, { status: 400 });
    }

    // Non-admin users can only delete their own data
    if (!caller.isAdmin && caller.uid !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { adminDb } = await getAdminModules();
    const userRef = adminDb.collection("users").doc(uid);

    if (col === "orders") {
      if (!supplierId) return NextResponse.json({ error: "Missing supplierId for orders" }, { status: 400 });
      await userRef.collection("suppliers").doc(supplierId).collection("orders").doc(itemId).delete();

    } else if (col === "customers") {
      // Delete customer + their subcollection invoices
      const custRef = userRef.collection("customers").doc(itemId);
      const subInvSnap = await custRef.collection("invoices").get();
      await Promise.all(subInvSnap.docs.map(d => d.ref.delete()));
      await custRef.delete();

      // Delete top-level invoices that belong to this customer
      const invSnap = await userRef.collection("invoices").where("customerId", "==", itemId).get();
      await Promise.all(invSnap.docs.map(d => d.ref.delete()));

      // Delete payments that belong to this customer
      const paySnap = await userRef.collection("payments").where("customerId", "==", itemId).get();
      await Promise.all(paySnap.docs.map(d => d.ref.delete()));

    } else if (col === "suppliers") {
      // Delete supplier + their orders subcollection
      const suppRef = userRef.collection("suppliers").doc(itemId);
      const ordSnap = await suppRef.collection("orders").get();
      await Promise.all(ordSnap.docs.map(d => d.ref.delete()));
      const recSnap = await suppRef.collection("receipts").get();
      await Promise.all(recSnap.docs.map(d => d.ref.delete()));
      const retSnap = await suppRef.collection("returns").get();
      await Promise.all(retSnap.docs.map(d => d.ref.delete()));
      await suppRef.delete();

    } else if (col === "invoices") {
      // Delete top-level invoice
      const invDoc = await userRef.collection("invoices").doc(itemId).get();
      const customerId = invDoc.data()?.customerId;
      await userRef.collection("invoices").doc(itemId).delete();
      // Also remove from customer's subcollection if it exists
      if (customerId) {
        await userRef.collection("customers").doc(customerId).collection("invoices").doc(itemId).delete().catch(() => {});
      }

    } else {
      // products, payments, and any other top-level collection
      await userRef.collection(col).doc(itemId).delete();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[permanent-delete]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
