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

    const { uid } = body;
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    if (uid === process.env.NEXT_PUBLIC_ADMIN_UID)
      return NextResponse.json({ error: "Cannot delete admin account" }, { status: 403 });

    const { adminAuth, adminDb } = await getAdminModules();

    await adminAuth.updateUser(uid, { disabled: true });
    await adminDb.collection("users").doc(uid).update({
      status:    "deleted",
      deletedAt: new Date().toISOString(),
      deletedBy: admin.uid,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[delete-user]", err);
    return NextResponse.json({ error: err.message || "Delete failed" }, { status: 500 });
  }
}
