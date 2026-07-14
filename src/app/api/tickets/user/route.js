import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

export async function GET(request) {
  try {
    const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let uid;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
    } catch { return NextResponse.json({ error: "Invalid token" }, { status: 401 }); }

    // Fetch from global tickets collection filtered by uid
    const snap = await adminDb.collection("tickets")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .get();

    const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ tickets });
  } catch (err) {
    console.error("[tickets/user]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
