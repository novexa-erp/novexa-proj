/**
 * GET /api/admin/get-user-sessions?uid=xxx
 * Returns all sessions (active + recent inactive) for a user.
 * Admin-only endpoint.
 */
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

    const { adminDb } = await getAdminModules();

    const snap = await adminDb
      .collection("users").doc(uid)
      .collection("sessions")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ success: true, sessions });
  } catch (err) {
    console.error("[get-user-sessions]", err.message);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
