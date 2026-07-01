/**
 * Called every 8s from the dashboard.
 * - Verifies session is still active
 * - Auto-freezes expired subscriptions and kicks the user out
 * Returns: { valid: true } or { valid: false, reason }
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

    if (!token || !sessionId)
      return NextResponse.json({ valid: false, reason: "missing_params" });

    const { adminAuth, adminDb } = await getAdminModules();

    let decoded;
    try { decoded = await adminAuth.verifyIdToken(token); }
    catch { return NextResponse.json({ valid: false, reason: "invalid_token" }); }

    // Admin always valid
    if (decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID)
      return NextResponse.json({ valid: true });

    // Check user doc first
    const userRef  = adminDb.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists)
      return NextResponse.json({ valid: false, reason: "account_not_found" });

    const userData = userSnap.data();

    // Already frozen or deleted
    if (userData.status === "frozen" || userData.status === "deleted")
      return NextResponse.json({ valid: false, reason: "account_frozen" });

    // Auto-freeze if subscription expired
    const now = new Date();

    if (userData.activeTo) {
      // If activeToTime set (e.g. "18:00"), use that; otherwise end of day 23:59:59
      const timeStr    = userData.activeToTime || "23:59:59";
      const expiryStr  = `${userData.activeTo}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}`;
      const expiryDate = new Date(expiryStr);

      if (now > expiryDate) {
        // Write frozen status to Firestore
        await userRef.update({
          status:       "frozen",
          frozenAt:     new Date().toISOString(),
          frozenReason: "subscription_expired",
        });
        // Also kill all active sessions
        const sessionsSnap = await userRef.collection("sessions")
          .where("active", "==", true).get();
        if (!sessionsSnap.empty) {
          const batch = adminDb.batch();
          sessionsSnap.docs.forEach(d =>
            batch.update(d.ref, {
              active:     false,
              evictedAt:  new Date().toISOString(),
              evictedBy:  "subscription_expired",
            })
          );
          await batch.commit();
        }
        return NextResponse.json({ valid: false, reason: "subscription_expired" });
      }
    }

    // Check session doc
    const sessionRef  = userRef.collection("sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists)
      return NextResponse.json({ valid: false, reason: "session_not_found" });

    if (!sessionSnap.data().active)
      return NextResponse.json({ valid: false, reason: "session_evicted" });

    // All good - update lastSeen
    await sessionRef.update({ lastSeen: new Date().toISOString() });

    return NextResponse.json({ valid: true });

  } catch (err) {
    console.error("[session-heartbeat]", err);
    // Network blip - don't kick out
    return NextResponse.json({ valid: true });
  }
}
