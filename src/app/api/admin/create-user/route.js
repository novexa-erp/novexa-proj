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

    const { name, email, password, phone, address, activeFrom, activeTo, activeToTime, maxDevices, plan, subscriptionType } = body;

    if (!name || !email || !password || !activeFrom || !activeTo)
      return NextResponse.json({ error: "Missing required fields: name, email, password, activeFrom, activeTo" }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

    const { adminAuth, adminDb } = await getAdminModules();

    const userRecord = await adminAuth.createUser({
      email:         email.trim().toLowerCase(),
      password,
      displayName:   name.trim(),
      emailVerified: true,
    });

    await adminDb.collection("users").doc(userRecord.uid).set({
      name:         name.trim(),
      email:        email.trim().toLowerCase(),
      phone:        phone?.trim() || "",
      address:      address?.trim() || "",
      activeFrom,
      activeTo,
      activeToTime: activeToTime?.trim() || "",   // "HH:MM" or ""
      maxDevices:   Number(maxDevices) || 1,
      plan:             plan || "starter",
      subscriptionType: subscriptionType || "active",
      status:           "active",
      createdAt:    new Date().toISOString(),
      createdBy:    admin.uid,
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (err) {
    console.error("[create-user]", err);
    if (err.code === "auth/email-already-exists")
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    return NextResponse.json({ error: err.message || "Failed to create user" }, { status: 500 });
  }
}
