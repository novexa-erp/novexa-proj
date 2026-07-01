/**
 * Called on logout — marks session as inactive.
 */
import { NextResponse } from "next/server";

async function getAdminModules() {
  const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");
  return { adminAuth, adminDb };
}

export async function POST(request) {
  try {
    const token     = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
    const sessionId = request.headers.get("x-session-id") || "";
    if (!token || !sessionId) return NextResponse.json({ success: false });

    const { adminAuth, adminDb } = await getAdminModules();
    let decoded;
    try { decoded = await adminAuth.verifyIdToken(token); }
    catch { return NextResponse.json({ success: false }); }

    if (decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID)
      return NextResponse.json({ success: true });

    await adminDb
      .collection("users").doc(decoded.uid)
      .collection("sessions").doc(sessionId)
      .update({ active: false, loggedOutAt: new Date().toISOString() });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[session-logout]", err);
    return NextResponse.json({ success: false });
  }
}
