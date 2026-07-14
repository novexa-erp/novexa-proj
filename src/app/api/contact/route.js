import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// ── Novexa system mailer ──────────────────────────────────────────────────────
function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.NOVEXA_GMAIL,
      pass: process.env.NOVEXA_GMAIL_APP_PASSWORD,
    },
  });
}

// ── Email to NOVEXA (admin notification) ─────────────────────────────────────
function buildAdminEmailHTML({ name, email, category, subject, message }) {
  const now = new Date().toLocaleString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const categoryColors = {
    "Subscription / Renewal": { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    "Account Issue":           { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
    "Billing Query":           { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
    "Feature Request":         { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    "Bug Report":              { bg: "#fdf4ff", color: "#9333ea", border: "#e9d5ff" },
    "Other":                   { bg: "#f8fafc", color: "#475569", border: "#e2e8f0" },
  };
  const cat = categoryColors[category] || categoryColors["Other"];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>New Support Request — Novexa</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">

  <!-- Top bar -->
  <tr><td style="height:5px;background:linear-gradient(90deg,#1d4ed8 0%,#6366f1 50%,#f59e0b 100%);"></td></tr>

  <!-- Header -->
  <tr><td style="padding:32px 40px 24px;background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 55%,#1d4ed8 100%);">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="display:inline-block;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);border-radius:8px;padding:5px 12px;margin-bottom:12px;">
          <span style="color:#fca5a5;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">🔔 New Support Request</span>
        </div>
        <div style="color:#ffffff;font-size:24px;font-weight:800;line-height:1.2;">Novexa Support</div>
        <div style="color:#93c5fd;font-size:13px;margin-top:4px;">Incoming message from a user</div>
      </td>
      <td align="right" valign="top">
        <div style="color:#64748b;font-size:11px;text-align:right;">Received<br/>
          <span style="color:#94a3b8;font-weight:600;">${now}</span>
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- Sender info pills -->
  <tr><td style="padding:28px 40px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" style="padding-right:8px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">👤 From</div>
            <div style="font-size:15px;font-weight:700;color:#0f172a;">${name}</div>
            <div style="font-size:12px;color:#3b82f6;margin-top:2px;">${email}</div>
          </div>
        </td>
        <td width="50%" style="padding-left:8px;">
          <div style="background:${cat.bg};border:1px solid ${cat.border};border-radius:12px;padding:14px 16px;">
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">🏷️ Category</div>
            <div style="font-size:14px;font-weight:700;color:${cat.color};">${category || "General"}</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Subject -->
  <tr><td style="padding:16px 40px 0;">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;">
      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">📌 Subject</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;">${subject}</div>
    </div>
  </td></tr>

  <!-- Message -->
  <tr><td style="padding:16px 40px 32px;">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;">
      <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">💬 Message</div>
      <div style="font-size:14px;color:#1e293b;line-height:1.8;white-space:pre-wrap;">${message}</div>
    </div>
  </td></tr>

  <!-- Reply CTA -->
  <tr><td style="padding:0 40px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:18px 20px;">
        <div style="font-size:13px;font-weight:700;color:#1d4ed8;margin-bottom:6px;">💡 Quick Reply</div>
        <div style="font-size:12px;color:#3730a3;">Reply directly to this email or click below to compose:</div>
        <div style="margin-top:12px;">
          <a href="mailto:${email}?subject=Re: ${subject}" 
            style="display:inline-block;padding:10px 22px;background:linear-gradient(135deg,#1d4ed8,#4f46e5);color:#fff;font-size:13px;font-weight:700;border-radius:8px;text-decoration:none;">
            Reply to ${name} →
          </a>
        </div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 40px;background:#f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="font-size:13px;font-weight:700;color:#1d4ed8;">Novexa Admin</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px;">This is an automated notification from the support system.</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- Bottom bar -->
  <tr><td style="height:4px;background:linear-gradient(90deg,#1d4ed8 0%,#6366f1 50%,#f59e0b 100%);"></td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Confirmation email to USER ────────────────────────────────────────────────
function buildUserConfirmationHTML({ name, category, subject, message }) {
  const ticketId = "TKT-" + Date.now().toString().slice(-6).toUpperCase();
  const now = new Date().toLocaleString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  const steps = [
    ["1", "Our team reviews your message", "Usually within a few hours"],
    ["2", "We respond via email or WhatsApp", "Within 24 hours on business days"],
    ["3", "Issue resolved &amp; ticket closed", "We follow up to confirm resolution"],
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>We received your message — Novexa</title>
</head>
<body style="margin:0;padding:0;background:#e8edf4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#e8edf4;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);">

  <!-- Top bar -->
  <tr><td style="height:5px;background:linear-gradient(90deg,#1d4ed8 0%,#6366f1 50%,#f59e0b 100%);"></td></tr>

  <!-- Header -->
  <tr><td style="padding:40px 40px 32px;background:linear-gradient(160deg,#0f172a 0%,#1e3a8a 50%,#1d4ed8 100%);text-align:center;">
    <!-- Icon using table for proper centering in all email clients -->
    <table cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 18px;">
      <tr><td width="68" height="68" align="center" valign="middle"
        style="width:68px;height:68px;background:rgba(52,211,153,0.18);border:2px solid rgba(52,211,153,0.5);border-radius:50%;font-size:30px;line-height:68px;text-align:center;">
        ✅
      </td></tr>
    </table>
    <div style="color:#ffffff;font-size:26px;font-weight:800;margin-bottom:8px;line-height:1.2;">Message Received!</div>
    <div style="color:#bfdbfe;font-size:14px;font-weight:500;">We&apos;ll get back to you as soon as possible</div>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:36px 40px 0;">
    <p style="margin:0 0 10px;font-size:19px;font-weight:800;color:#0f172a;">Hi ${name}, 👋</p>
    <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.8;">
      Thank you for reaching out to <strong style="color:#1d4ed8;">Novexa Support</strong>.
      We have received your message and our team will review it shortly.
      You can expect a response <strong style="color:#0f172a;">within 24 hours</strong> during business days.
    </p>
  </td></tr>

  <!-- Ticket + Date pills -->
  <tr><td style="padding:20px 40px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="48%" style="padding-right:8px;">
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:14px 16px;">
            <div style="font-size:10px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:5px;">🎫 Ticket ID</div>
            <div style="font-size:18px;font-weight:900;color:#15803d;font-family:'Courier New',monospace;">${ticketId}</div>
          </div>
        </td>
        <td width="4%"></td>
        <td width="48%">
          <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:12px;padding:14px 16px;">
            <div style="font-size:10px;font-weight:800;color:#1e40af;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:5px;">📅 Submitted</div>
            <div style="font-size:13px;font-weight:700;color:#1d4ed8;">${now}</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Message summary -->
  <tr><td style="padding:20px 40px 0;">
    <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <div style="padding:11px 18px;background:#f1f5f9;border-bottom:1.5px solid #e2e8f0;">
        <span style="font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px;">📋 Your Message Summary</span>
      </div>
      <div style="padding:18px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;width:35%;">
              <span style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Category</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;">
              <span style="font-size:13px;font-weight:700;color:#0f172a;">${category || "General"}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
              <span style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Subject</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;">
              <span style="font-size:13px;font-weight:700;color:#0f172a;">${subject}</span>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top:14px;">
              <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Message</div>
              <div style="font-size:13px;color:#1e293b;line-height:1.75;white-space:pre-wrap;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;">${message}</div>
            </td>
          </tr>
        </table>
      </div>
    </div>
  </td></tr>

  <!-- What happens next -->
  <tr><td style="padding:20px 40px 0;">
    <div style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:14px;padding:20px 22px;">
      <div style="font-size:11px;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:14px;">⏭️ What Happens Next?</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${steps.map(([num, title, sub]) => `
        <tr>
          <td width="34" valign="top" style="padding:0 10px 12px 0;">
            <table cellpadding="0" cellspacing="0">
              <tr><td width="28" height="28" align="center" valign="middle"
                style="width:28px;height:28px;background:#f59e0b;border-radius:50%;font-size:12px;font-weight:900;color:#fff;line-height:28px;text-align:center;">
                ${num}
              </td></tr>
            </table>
          </td>
          <td style="padding-bottom:12px;">
            <div style="font-size:13px;font-weight:700;color:#1c1917;">${title}</div>
            <div style="font-size:12px;color:#78716c;margin-top:2px;">${sub}</div>
          </td>
        </tr>`).join("")}
      </table>
    </div>
  </td></tr>

  <!-- Need faster help -->
  <tr><td style="padding:20px 40px 32px;">
    <p style="margin:0 0 12px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px;">Need faster help?</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="48%" style="padding-right:8px;">
          <a href="https://wa.me/923320262457" style="display:block;padding:14px 10px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;text-decoration:none;text-align:center;">
            <div style="font-size:22px;margin-bottom:5px;">💬</div>
            <div style="font-size:13px;font-weight:800;color:#15803d;">WhatsApp Us</div>
            <div style="font-size:11px;color:#16a34a;margin-top:2px;font-weight:600;">Fastest response</div>
          </a>
        </td>
        <td width="4%"></td>
        <td width="48%">
          <a href="tel:+923320262457" style="display:block;padding:14px 10px;background:#eff6ff;border:1.5px solid #93c5fd;border-radius:12px;text-decoration:none;text-align:center;">
            <div style="font-size:22px;margin-bottom:5px;">📞</div>
            <div style="font-size:13px;font-weight:800;color:#1d4ed8;">Call Us</div>
            <div style="font-size:11px;color:#2563eb;margin-top:2px;font-weight:600;">Mon–Sat, 9AM–8PM</div>
          </a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 40px;background:#f8fafc;text-align:center;">
    <div style="font-size:16px;font-weight:900;color:#1d4ed8;margin-bottom:4px;">Novexa</div>
    <div style="font-size:12px;color:#64748b;font-weight:500;">Smart Business Management Platform</div>
    <div style="margin-top:10px;font-size:11px;color:#94a3b8;">
      Please do not reply to this email &nbsp;·&nbsp;
      <a href="https://wa.me/923320262457" style="color:#2563eb;text-decoration:none;font-weight:600;">Contact us on WhatsApp</a>
    </div>
  </td></tr>

  <!-- Bottom bar -->
  <tr><td style="height:4px;background:linear-gradient(90deg,#1d4ed8 0%,#6366f1 50%,#f59e0b 100%);"></td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { name, email, category, subject, message } = await request.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const transporter = getTransporter();

    // Send both emails in parallel
    await Promise.all([
      // 1. Notification to Novexa — with headers to avoid self-spam
      transporter.sendMail({
        from:     `"Novexa Support System" <${process.env.NOVEXA_GMAIL}>`,
        to:       process.env.NOVEXA_GMAIL,
        replyTo:  email,
        subject:  `[Support] ${category ? `[${category}] ` : ""}${subject}`,
        html:     buildAdminEmailHTML({ name, email, category, subject, message }),
        headers: {
          "X-Priority":        "1",
          "X-MS-Exchange-Organization-SCL": "-1",
          "Precedence":        "bulk",
        },
      }),

      // 2. Confirmation to user
      transporter.sendMail({
        from:    `"Novexa Support" <${process.env.NOVEXA_GMAIL}>`,
        to:      email,
        subject: `✅ We received your message — Novexa Support`,
        html:    buildUserConfirmationHTML({ name, category, subject, message }),
        headers: {
          "X-Priority": "3",
          "Importance": "normal",
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[contact] ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
