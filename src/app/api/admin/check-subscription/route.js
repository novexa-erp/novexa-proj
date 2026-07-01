import { NextResponse } from "next/server";

async function getAdminModules() {
  const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");
  return { adminAuth, adminDb };
}

// Parse user-agent into readable browser + device
function parseUA(ua) {
  if (!ua) return { browser: "Unknown", device: "Unknown" };

  // Browser detection
  let browser = "Unknown";
  if (ua.includes("Edg/"))         browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  // Browser version
  const verMap = { "Edg/": "Edge", "Chrome/": "Chrome", "Firefox/": "Firefox", "Safari/": "Safari", "OPR/": "Opera" };
  for (const [key] of Object.entries(verMap)) {
    if (ua.includes(key)) {
      const match = ua.match(new RegExp(key.replace("/", "\\/") + "([\\d.]+)"));
      if (match) { browser += " " + match[1].split(".")[0]; break; }
    }
  }

  // Device/OS detection
  let device = "Desktop";
  if (/iPhone/.test(ua))                    device = "iPhone";
  else if (/iPad/.test(ua))                 device = "iPad";
  else if (/Android.*Mobile/.test(ua))      device = "Android Phone";
  else if (/Android/.test(ua))              device = "Android Tablet";
  else if (/Windows Phone/.test(ua))        device = "Windows Phone";
  else if (/Windows NT/.test(ua))           device = "Windows PC";
  else if (/Macintosh/.test(ua))            device = "Mac";
  else if (/Linux/.test(ua))                device = "Linux";

  return { browser, device };
}

export async function POST(request) {
  try {
    const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { adminAuth, adminDb } = await getAdminModules();

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Admin always has access — skip subscription check
    if (decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID) {
      return NextResponse.json({ status: "active", allowed: true });
    }

    const snap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!snap.exists) {
      return NextResponse.json({ status: "not_found", allowed: false });
    }

    const data = snap.data();

    if (data.status === "frozen" || data.status === "deleted") {
      return NextResponse.json({ status: data.status, allowed: false });
    }

    const nowDt    = new Date();
    const todayStr = nowDt.toISOString().slice(0, 10);

    if (data.activeTo) {
      const timeStr    = data.activeToTime || "23:59:59";
      const expiryStr  = `${data.activeTo}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}`;
      const expiryDate = new Date(expiryStr);

      if (nowDt > expiryDate) {
        await adminDb.collection("users").doc(decoded.uid).update({
          status:       "frozen",
          frozenAt:     new Date().toISOString(),
          frozenReason: "subscription_expired",
        });
        return NextResponse.json({ status: "frozen", allowed: false, reason: "subscription_expired" });
      }
    }

    if (data.activeFrom && todayStr < data.activeFrom) {
      return NextResponse.json({ status: "not_started", allowed: false, reason: "subscription_not_started" });
    }

    // ── Log activity on successful login ──────────────────────────────────────
    const ua  = request.headers.get("user-agent") || "";
    const ip  = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
             || request.headers.get("x-real-ip")
             || "Unknown";
    const { browser, device } = parseUA(ua);
    const now = new Date().toISOString();

    // Update last login info on user doc
    await adminDb.collection("users").doc(decoded.uid).update({
      lastLogin:      now,
      lastLoginIP:    ip,
      lastBrowser:    browser,
      lastDevice:     device,
      lastActiveAt:   now,
    });

    // Also push to activityLogs subcollection (keep last 20 entries)
    const logRef = adminDb
      .collection("users").doc(decoded.uid)
      .collection("activityLogs");

    await logRef.add({
      type:      "login",
      timestamp: now,
      ip,
      browser,
      device,
      ua: ua.slice(0, 200), // truncate long UAs
    });

    // Trim to last 20 logs
    const oldLogs = await logRef.orderBy("timestamp", "asc").get();
    if (oldLogs.size > 20) {
      const toDelete = oldLogs.docs.slice(0, oldLogs.size - 20);
      const batch = adminDb.batch();
      toDelete.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    return NextResponse.json({ status: "active", allowed: true });
  } catch (err) {
    console.error("[check-subscription]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
