import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

export async function POST(request) {
  try {
    const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let decoded;
    try { decoded = await adminAuth.verifyIdToken(token); }
    catch { return NextResponse.json({ error: "Invalid token" }, { status: 401 }); }

    const uid = decoded.uid;
    const { otp } = await request.json();

    if (!otp) return NextResponse.json({ error: "OTP is required." }, { status: 400 });

    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const userData  = userSnap.data();
    const pending   = userData._pendingOTP;

    if (!pending || !pending.code) {
      return NextResponse.json({ error: "No OTP found. Please request a new one." }, { status: 400 });
    }

    // ── Check expiry ──────────────────────────────────────────────────────────
    const expiresAt = new Date(pending.expiresAt);
    if (Date.now() > expiresAt.getTime()) {
      await adminDb.collection("users").doc(uid).update({ _pendingOTP: null });
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    // ── Check code ────────────────────────────────────────────────────────────
    if (pending.code !== otp.trim()) {
      return NextResponse.json({ error: "Incorrect OTP. Please try again." }, { status: 400 });
    }

    // ── Mark as verified ──────────────────────────────────────────────────────
    await adminDb.collection("users").doc(uid).update({
      _pendingOTP: {
        ...pending,
        verified:   true,
        verifiedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, purpose: pending.purpose });
  } catch (err) {
    console.error("[verify-otp] ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
