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

    const { adminDb } = await getAdminModules();
    const snap = await adminDb.collection("users").orderBy("createdAt", "desc").get();
    const users = snap.docs
      .filter(d => d.id !== process.env.NEXT_PUBLIC_ADMIN_UID)
      .map(d => ({ uid: d.id, ...d.data() }));
    return NextResponse.json({ users });
  } catch (err) {
    console.error("[list-users]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
