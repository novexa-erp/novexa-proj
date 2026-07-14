import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

async function verifyAdmin(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID ? decoded : null;
  } catch { return null; }
}

export async function GET(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status   = searchParams.get("status");   // filter by status
    const uid      = searchParams.get("uid");       // filter by user

    let query = adminDb.collection("tickets").orderBy("createdAt", "desc");
    if (status && status !== "all") query = query.where("status", "==", status);
    if (uid) query = query.where("uid", "==", uid);

    const snap    = await query.limit(200).get();
    const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ tickets });
  } catch (err) {
    console.error("[tickets/list]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
