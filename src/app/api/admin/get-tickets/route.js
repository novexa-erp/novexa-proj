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
    const uid = searchParams.get("uid"); // optional — if provided, filter by user

    let snap;
    if (uid) {
      // Get tickets for a specific user
      snap = await adminDb
        .collection("users").doc(uid).collection("tickets")
        .orderBy("createdAt", "desc")
        .get();
    } else {
      // Get all tickets (global inbox)
      snap = await adminDb
        .collection("supportTickets")
        .orderBy("createdAt", "desc")
        .get();
    }

    const tickets = snap.docs.map(d => serialize({ id: d.id, ...d.data() }));
    return NextResponse.json({ tickets });
  } catch (err) {
    console.error("[get-tickets]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
