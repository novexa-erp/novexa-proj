/**
 * Called once on login.
 * Creates a new session, evicts oldest if maxDevices exceeded.
 * Returns: { sessionId, allowed: true }
 *
 * NOTE: No composite index needed — we filter only on `active` field,
 * then sort in JS to avoid Firestore index requirement.
 */
import { NextResponse } from "next/server";
import { randomUUID }   from "crypto";

async function getAdminModules() {
  const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");
  return { adminAuth, adminDb };
}

function parseUA(ua = "") {
  let browser = "Unknown";
  if      (ua.includes("Edg/"))     browser = "Edge "    + (ua.match(/Edg\/([\d]+)/)?.[1]     || "");
  else if (ua.includes("OPR/"))     browser = "Opera "   + (ua.match(/OPR\/([\d]+)/)?.[1]     || "");
  else if (ua.includes("Chrome/"))  browser = "Chrome "  + (ua.match(/Chrome\/([\d]+)/)?.[1]  || "");
  else if (ua.includes("Firefox/")) browser = "Firefox " + (ua.match(/Firefox\/([\d]+)/)?.[1] || "");
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  let device = "Desktop";
  if      (/iPhone/.test(ua))          device = "iPhone";
  else if (/iPad/.test(ua))            device = "iPad";
  else if (/Android.*Mobile/.test(ua)) device = "Android Phone";
  else if (/Android/.test(ua))         device = "Android Tablet";
  else if (/Windows NT/.test(ua))      device = "Windows PC";
  else if (/Macintosh/.test(ua))       device = "Mac";
  else if (/Linux/.test(ua))           device = "Linux";

  return { browser: browser.trim(), device };
}

export async function POST(request) {
  try {
    const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { adminAuth, adminDb } = await getAdminModules();

    let decoded;
    try { decoded = await adminAuth.verifyIdToken(token); }
    catch { return NextResponse.json({ error: "Invalid token" }, { status: 401 }); }

    // Admin has no session limits
    if (decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID)
      return NextResponse.json({ allowed: true, sessionId: "admin" });

    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists) return NextResponse.json({ allowed: false, reason: "not_found" });

    const userData   = userSnap.data();
    const maxDevices = Number(userData.maxDevices) || 1;

    const ua  = request.headers.get("user-agent") || "";
    const ip  = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
             || request.headers.get("x-real-ip") || "Unknown";
    const { browser, device } = parseUA(ua);
    const now   = new Date().toISOString();
    const newId = randomUUID();

    const sessionsRef = adminDb
      .collection("users").doc(decoded.uid)
      .collection("sessions");

    // ── Fetch active sessions WITHOUT composite index ──────────────────────────
    // Only filter on `active` field — sort in JS to avoid needing a Firestore index
    const activeSnap = await sessionsRef.where("active", "==", true).get();

    // Sort oldest first (by createdAt string — ISO strings sort lexicographically)
    const activeDocs = activeSnap.docs
      .map(d => ({ ref: d.ref, createdAt: d.data().createdAt || "" }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const batch = adminDb.batch();

    // Evict oldest sessions if at or over capacity
    if (activeDocs.length >= maxDevices) {
      const toEvict = activeDocs.slice(0, activeDocs.length - maxDevices + 1);
      toEvict.forEach(({ ref }) => {
        batch.update(ref, {
          active:    false,
          evictedAt: now,
          evictedBy: "new_login_exceeded_limit",
        });
      });
    }

    // Create the new session doc
    batch.set(sessionsRef.doc(newId), {
      sessionId: newId,
      active:    true,
      createdAt: now,
      lastSeen:  now,
      ip,
      browser,
      device,
      ua: ua.slice(0, 200),
    });

    // Update user's last login info
    batch.update(adminDb.collection("users").doc(decoded.uid), {
      lastLogin:    now,
      lastLoginIP:  ip,
      lastBrowser:  browser,
      lastDevice:   device,
      lastActiveAt: now,
    });

    await batch.commit();

    console.log(`[session-login] uid=${decoded.uid} newSession=${newId} evicted=${Math.max(0, activeDocs.length - maxDevices + 1)} maxDevices=${maxDevices}`);

    return NextResponse.json({ allowed: true, sessionId: newId });
  } catch (err) {
    console.error("[session-login] ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
