import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

async function getAdminModules() {
  const { adminAuth } = await import("@/lib/firebaseAdmin");
  return { adminAuth };
}

async function verifyAdmin(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;

  // Allow internal cron calls using CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && token === cronSecret) return { uid: "cron", cron: true };

  try {
    const { adminAuth } = await getAdminModules();
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID ? decoded : null;
  } catch { return null; }
}

// ── Expiry Warning Email HTML ─────────────────────────────────────────────────
function buildExpiryWarningHTML({ userName, plan, activeTo, daysLeft }) {
  const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Subscription";
  const fmtDate = (str) => {
    try {
      return new Date(str + "T00:00:00").toLocaleDateString("en-US", {
        day: "2-digit", month: "long", year: "numeric",
      });
    } catch { return str; }
  };

  const urgency =
    daysLeft === 0 ? { color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.3)", badge: "🚨 Expires TODAY", barColor: "#ef4444" }
    : daysLeft === 1 ? { color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.3)", badge: "⚠️ Last Day Tomorrow", barColor: "#f97316" }
    : { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", badge: `⏰ ${daysLeft} Days Remaining`, barColor: "#f59e0b" };

  const subject =
    daysLeft === 0 ? "Your Novexa subscription expires TODAY — Renew Now!"
    : daysLeft === 1 ? `Your Novexa subscription expires tomorrow — Act Now!`
    : `Your Novexa subscription expires in ${daysLeft} days`;

  const bodyText =
    daysLeft === 0
      ? `Your <strong>${planLabel} Plan</strong> expires <strong style="color:#ef4444;">today</strong>. Please renew immediately to avoid losing access to your business data.`
      : daysLeft === 1
      ? `Your <strong>${planLabel} Plan</strong> expires <strong style="color:#f97316;">tomorrow</strong> on <strong>${fmtDate(activeTo)}</strong>. Renew today to keep your business running without interruption.`
      : `Your <strong>${planLabel} Plan</strong> will expire in <strong style="color:#f59e0b;">${daysLeft} days</strong> on <strong>${fmtDate(activeTo)}</strong>. Renew now to avoid any service interruption.`;

  return {
    subject,
    html: `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Subscription Expiring — Novexa</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Top bar -->
  <tr><td style="height:5px;background:${urgency.barColor};"></td></tr>

  <!-- Header -->
  <tr><td style="padding:36px 40px 24px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">
        Novexa ERP — Subscription Alert
      </div>
    </div>
    <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:8px;">
      ${daysLeft === 0 ? "🚨" : "⚠️"} Your Subscription Is Expiring
    </div>
    <div style="font-size:13px;color:#94a3b8;">
      Hi <strong style="color:#e2e8f0;">${userName}</strong>, this is an important reminder about your account.
    </div>
  </td></tr>

  <!-- Urgency badge -->
  <tr><td style="padding:20px 40px 8px;">
    <span style="display:inline-block;padding:6px 16px;border-radius:20px;
      background:${urgency.bg};border:1px solid ${urgency.border};
      color:${urgency.color};font-size:12px;font-weight:800;letter-spacing:0.5px;">
      ${urgency.badge}
    </span>
  </td></tr>

  <!-- Main message -->
  <tr><td style="padding:12px 40px 24px;">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${urgency.color};
      border-radius:10px;padding:20px 24px;font-size:14px;color:#374151;line-height:1.7;">
      ${bodyText}
      <br/><br/>
      <span style="color:#6b7280;font-size:12px;">
        📅 Expiry Date: <strong style="color:#111;">${fmtDate(activeTo)}</strong>
      </span>
    </div>
  </td></tr>

  <!-- Plan info box -->
  <tr><td style="padding:0 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">
      <tr>
        <td style="padding:16px 20px;border-right:1px solid #bae6fd;">
          <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:5px;">Current Plan</div>
          <div style="font-size:15px;font-weight:800;color:#0369a1;">${planLabel} Plan</div>
        </td>
        <td style="padding:16px 20px;">
          <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:5px;">Expires On</div>
          <div style="font-size:15px;font-weight:800;color:#${daysLeft === 0 ? "ef4444" : "0369a1"};">${fmtDate(activeTo)}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CTA button -->
  <tr><td style="padding:0 40px 28px;text-align:center;">
    <a href="https://wa.me/923251507557?text=Hello%20Novexa%2C%20I%20want%20to%20renew%20my%20${encodeURIComponent(planLabel)}%20subscription."
      target="_blank"
      style="display:inline-block;padding:14px 36px;border-radius:10px;
        background:linear-gradient(135deg,#1d4ed8,#2563eb);
        color:#fff;font-size:14px;font-weight:800;text-decoration:none;
        box-shadow:0 4px 14px rgba(37,99,235,0.35);">
      🔄 Renew My Subscription
    </a>
    <div style="margin-top:10px;font-size:11px;color:#9ca3af;">
      Click above to contact Novexa on WhatsApp and renew instantly.
    </div>
  </td></tr>

  <!-- Warning note -->
  <tr><td style="padding:0 40px 24px;">
    <div style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);
      border-radius:8px;padding:12px 16px;font-size:11px;color:#b91c1c;line-height:1.6;">
      ⚠️ <strong>Important:</strong> After expiry, your account will be frozen and you will not be able to access
      invoices, inventory, customers, or any other data until renewal.
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
    <div style="font-size:13px;font-weight:700;color:#1d4ed8;">Novexa ERP</div>
    <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Smart Business Management Platform</div>
    <div style="font-size:10px;color:#d1d5db;margin-top:8px;">
      This is an automated reminder. Please do not reply to this email.
    </div>
  </td></tr>
  <tr><td style="height:4px;background:linear-gradient(to right,#1d4ed8,#3b82f6,${urgency.barColor});"></td></tr>
</table>
</td></tr>
</table>
</body></html>`,
  };
}

// ── POST /api/admin/send-expiry-warning ────────────────────────────────────────
// Body: { userEmail, userName, plan, activeTo, daysLeft }
// Called by the cron job — requires admin auth
export async function POST(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { userEmail, userName, plan, activeTo, daysLeft } = body;
    if (!userEmail) return NextResponse.json({ error: "Missing userEmail" }, { status: 400 });
    if (!activeTo)  return NextResponse.json({ error: "Missing activeTo"  }, { status: 400 });
    if (daysLeft === undefined || daysLeft === null)
      return NextResponse.json({ error: "Missing daysLeft" }, { status: 400 });

    const gmailUser = process.env.NOVEXA_GMAIL;
    const gmailPass = process.env.NOVEXA_GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass)
      return NextResponse.json({ error: "Gmail not configured." }, { status: 503 });

    const { subject, html } = buildExpiryWarningHTML({
      userName:  userName || userEmail,
      plan,
      activeTo,
      daysLeft,
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from:    `"Novexa ERP" <${gmailUser}>`,
      to:      userEmail,
      subject,
      html,
    });

    console.log(`[expiry-warning] Sent to ${userEmail} — ${daysLeft} days left`);
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[expiry-warning] Error:", err.message);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
