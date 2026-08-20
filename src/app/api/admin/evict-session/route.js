/**
 * POST /api/admin/evict-session
 * Body: { uid, sessionId }
 * Force-evicts a specific session for a user. Admin-only.
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

export async function POST(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { uid, sessionId } = body;
    if (!uid || !sessionId) return NextResponse.json({ error: "Missing uid or sessionId" }, { status: 400 });

    const { adminDb } = await getAdminModules();

    await adminDb
      .collection("users").doc(uid)
      .collection("sessions").doc(sessionId)
      .update({
        active:    false,
        evictedAt: new Date().toISOString(),
        evictedBy: "admin_force_evict",
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[evict-session]", err.message);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
