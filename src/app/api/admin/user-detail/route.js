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

export async function GET(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

    const { adminAuth, adminDb } = await getAdminModules();

    // Get Firestore user doc
    const snap = await adminDb.collection("users").doc(uid).get();
    if (!snap.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const userData = { uid, ...snap.data() };

    // Get Firebase Auth record (emailVerified, creation time, last sign in)
    let authRecord = null;
    try {
      const rec = await adminAuth.getUser(uid);
      authRecord = {
        emailVerified:    rec.emailVerified,
        disabled:         rec.disabled,
        creationTime:     rec.metadata.creationTime,
        lastSignInTime:   rec.metadata.lastSignInTime,
        lastRefreshTime:  rec.metadata.lastRefreshTime || null,
      };
    } catch { /* ignore if auth record missing */ }

    // Get activity logs subcollection (last 20, newest first)
    const logsSnap = await adminDb
      .collection("users").doc(uid)
      .collection("activityLogs")
      .orderBy("timestamp", "desc")
      .limit(20)
      .get();

    const activityLogs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ user: userData, authRecord, activityLogs });
  } catch (err) {
    console.error("[user-detail]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
