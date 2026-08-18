/**
 * GET /api/cron/expiry-check
 *
 * Daily cron job — checks all users whose subscription expires in 1, 2, or 3 days
 * and sends them a warning email (one per day per user).
 *
 * Security: protected by CRON_SECRET env variable.
 * Vercel Cron: add to vercel.json (see bottom of this file for config).
 * Manual call: GET /api/cron/expiry-check  (with Authorization: Bearer <CRON_SECRET>)
 *
 * Deduplication: uses Firestore field "expiryWarningSentOn" (YYYY-MM-DD) so the
 * same user never gets two emails on the same calendar day.
 */

import { NextResponse } from "next/server";

async function getAdminDb() {
  const { adminDb } = await import("@/lib/firebaseAdmin");
  return adminDb;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function daysUntil(activeTo) {
  if (!activeTo) return null;
  const expiry = new Date(activeTo + "T23:59:59");
  const now    = new Date();
  return Math.ceil((expiry - now) / 86400000);
}

export async function GET(request) {
  // ── Auth: CRON_SECRET header check ───────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
    if (auth !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const adminDb = await getAdminDb();
    const today   = todayStr();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://novexaerp.com";

    // ── Fetch all non-admin, active users ────────────────────────────────
    const snap  = await adminDb.collection("users").get();
    const users = snap.docs
      .filter(d => d.id !== process.env.NEXT_PUBLIC_ADMIN_UID)
      .map(d => ({ uid: d.id, ...d.data() }));

    const results = { sent: [], skipped: [], errors: [] };

    for (const user of users) {
      try {
        // Only process users with activeTo and an email
        if (!user.activeTo || !user.email) { results.skipped.push({ uid: user.uid, reason: "no activeTo or email" }); continue; }

        // Skip frozen/deleted accounts
        if (user.status === "frozen" || user.deleted) { results.skipped.push({ uid: user.uid, reason: "frozen/deleted" }); continue; }

        const days = daysUntil(user.activeTo);

        // Only warn for 0, 1, 2, 3 days remaining
        if (days === null || days < 0 || days > 3) { results.skipped.push({ uid: user.uid, reason: `${days} days — out of range` }); continue; }

        // Deduplication: already sent today?
        if (user.expiryWarningSentOn === today) {
          results.skipped.push({ uid: user.uid, reason: "already sent today" });
          continue;
        }

        // ── Send warning email via internal API ───────────────────────
        const res = await fetch(`${baseUrl}/api/admin/send-expiry-warning`, {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            // Use CRON_SECRET as the admin token for internal calls, or
            // use the admin UID-based token if you prefer
            "Authorization": `Bearer ${process.env.CRON_SECRET || ""}`,
          },
          body: JSON.stringify({
            userEmail: user.email,
            userName:  user.name || user.businessName || user.email,
            plan:      user.plan || "starter",
            activeTo:  user.activeTo,
            daysLeft:  days,
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `HTTP ${res.status}`);
        }

        // ── Mark sent today in Firestore (prevents duplicate same-day emails) ──
        await adminDb.collection("users").doc(user.uid).update({
          expiryWarningSentOn: today,
        });

        results.sent.push({ uid: user.uid, email: user.email, daysLeft: days });
        console.log(`[expiry-check] ✅ Warning sent → ${user.email} (${days} days left)`);

      } catch (err) {
        results.errors.push({ uid: user.uid, error: err.message });
        console.error(`[expiry-check] ❌ Error for ${user.uid}:`, err.message);
      }
    }

    console.log(`[expiry-check] Done. Sent: ${results.sent.length}, Skipped: ${results.skipped.length}, Errors: ${results.errors.length}`);
    return NextResponse.json({ success: true, today, ...results });

  } catch (err) {
    console.error("[expiry-check] Fatal:", err.message);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
