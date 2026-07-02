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

// Helper: get all docs from a subcollection
async function getSubcollection(adminDb, uid, col) {
  const snap = await adminDb.collection("users").doc(uid).collection(col).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Helper: serialize Firestore timestamps → ISO strings
function serialize(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (obj._seconds !== undefined) return new Date(obj._seconds * 1000).toISOString();
  if (obj.toDate) return obj.toDate().toISOString();
  if (Array.isArray(obj)) return obj.map(serialize);
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = serialize(v);
  return out;
}

export async function GET(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const { adminAuth, adminDb } = await getAdminModules();

    // ── User profile ──────────────────────────────────────────────────────────
    const snap = await adminDb.collection("users").doc(uid).get();
    if (!snap.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const userData = serialize({ uid, ...snap.data() });

    // ── Auth record ───────────────────────────────────────────────────────────
    let authRecord = null;
    try {
      const rec = await adminAuth.getUser(uid);
      authRecord = {
        emailVerified:  rec.emailVerified,
        disabled:       rec.disabled,
        creationTime:   rec.metadata.creationTime,
        lastSignInTime: rec.metadata.lastSignInTime,
      };
    } catch { /* ok */ }

    // ── Activity logs ─────────────────────────────────────────────────────────
    const logsSnap = await adminDb
      .collection("users").doc(uid)
      .collection("activityLogs")
      .orderBy("timestamp", "desc").limit(20).get();
    const activityLogs = logsSnap.docs.map(d => serialize({ id: d.id, ...d.data() }));

    // ── Business subcollections ───────────────────────────────────────────────
    const [customers, invoices, products, payments, suppliers] = await Promise.all([
      getSubcollection(adminDb, uid, "customers"),
      getSubcollection(adminDb, uid, "invoices"),
      getSubcollection(adminDb, uid, "products"),
      getSubcollection(adminDb, uid, "payments"),
      getSubcollection(adminDb, uid, "suppliers"),
    ]);

    // ── Supplier orders + receipts + returns (nested) ────────────────────────
    const orders   = [];
    const receipts = [];
    const supplierReturns = [];
    await Promise.all(
      suppliers.map(async sup => {
        const [ordSnap, recSnap, retSnap] = await Promise.all([
          adminDb.collection("users").doc(uid).collection("suppliers").doc(sup.id).collection("orders").get(),
          adminDb.collection("users").doc(uid).collection("suppliers").doc(sup.id).collection("receipts").get(),
          adminDb.collection("users").doc(uid).collection("suppliers").doc(sup.id).collection("returns").get(),
        ]);
        ordSnap.docs.forEach(d => orders.push(serialize({
          id: d.id,
          _supplierId: sup.id,
          _supplierName: sup.name || "Unknown Supplier",
          ...d.data(),
        })));
        recSnap.docs.forEach(d => receipts.push(serialize({
          id: d.id,
          _supplierId: sup.id,
          ...d.data(),
        })));
        retSnap.docs.forEach(d => supplierReturns.push(serialize({
          id: d.id,
          _supplierId: sup.id,
          ...d.data(),
        })));
      })
    );

    return NextResponse.json({
      user:            userData,
      authRecord,
      activityLogs,
      customers:       serialize(customers),
      invoices:        serialize(invoices),
      products:        serialize(products),
      payments:        serialize(payments),
      suppliers:       serialize(suppliers),
      orders,
      receipts,
      supplierReturns,
    });
  } catch (err) {
    console.error("[user-full-detail]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
