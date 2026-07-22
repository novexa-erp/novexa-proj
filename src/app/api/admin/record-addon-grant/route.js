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

// ── POST — create an addonRequest history record for admin-granted add-ons ──
export async function POST(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { uid, userName, userEmail, lineItems, grandTotal, paymentMethod, purchasedAt, expiresAt } = body;

    if (!uid || !lineItems?.length)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const { adminDb } = await getAdminModules();

    // ── Generate ADM-DDMMYY-NN request number ────────────────────────────
    const today   = new Date();
    const dd      = String(today.getDate()).padStart(2, "0");
    const mm      = String(today.getMonth() + 1).padStart(2, "0");
    const yy      = String(today.getFullYear()).slice(-2);
    const dateStr = `${dd}${mm}${yy}`;

    // Same global counter as user requests — keeps all serials unique
    const counterRef = adminDb.collection("adminConfig").doc("addonCounter");
    let serial;
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      serial = snap.exists ? (snap.data().lastSerial + 1) : 0;
      tx.set(counterRef, { lastSerial: serial }, { merge: true });
    });

    const requestNumber = `ADM-${dateStr}-${String(serial).padStart(2, "0")}`;
    const now = new Date().toISOString();

    const recordData = {
      uid,
      requestNumber,
      source:        "admin",          // ← distinguishes from user requests
      grantedBy:     admin.uid,
      userName:      userName || userEmail || "",
      userEmail:     userEmail || "",
      lineItems:     lineItems.map(item => ({
        limitKey: item.limitKey || item.key || "",
        icon:     item.icon || "⚡",
        label:    item.label || "",
        qty:      Number(item.qty) || 0,
        total:    Number(item.total) || 0,
      })),
      grandTotal:    Number(grandTotal) || 0,
      paymentMethod: paymentMethod || "cash",
      status:        "approved",       // always approved — admin gave it directly
      processedAt:   now,
      processedBy:   admin.uid,
      createdAt:     purchasedAt || now,
      updatedAt:     now,
      extraLimitsExpiresAt: expiresAt || null,
    };

    // Save under user's addonRequests subcollection
    const docRef = await adminDb
      .collection("users").doc(uid)
      .collection("addonRequests")
      .add(recordData);

    const requestId = docRef.id;

    // Also save global reference
    await adminDb.collection("addonRequests").doc(requestId).set({
      ...recordData,
      requestId,
    });

    return NextResponse.json({ success: true, requestId, requestNumber });

  } catch (err) {
    console.error("[record-addon-grant] Error:", err.message);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
