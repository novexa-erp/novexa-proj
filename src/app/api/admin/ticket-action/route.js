import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.NOVEXA_GMAIL, pass: process.env.NOVEXA_GMAIL_APP_PASSWORD },
  });
}

async function verifyAdmin(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID ? decoded : null;
  } catch { return null; }
}

// ── Shared footer HTML ────────────────────────────────────────────────────────
function footerHTML() {
  return `
  <tr><td style="padding:0 44px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>
  <tr><td style="padding:26px 44px 28px;background:#f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="top" width="55%">
        <div style="font-size:19px;font-weight:900;color:#1d4ed8;letter-spacing:-0.5px;margin-bottom:2px;">Novexa</div>
        <div style="font-size:12px;color:#64748b;font-weight:600;margin-bottom:8px;">Smart Business Management Platform</div>
        <div style="font-size:11px;color:#94a3b8;line-height:1.7;">
          📍 Pakistan &nbsp;·&nbsp; 📞 +92 332 0262457<br/>
          🕐 Mon – Sat &nbsp;·&nbsp; 9 AM – 8 PM PKT
        </div>
      </td>
      <td valign="top" width="45%" align="right">
        <div style="font-size:11px;color:#94a3b8;line-height:1.8;text-align:right;">
          This is an automated notification<br/>from the Novexa Support System.<br/>
          <a href="https://wa.me/923320262457" style="color:#2563eb;text-decoration:none;font-weight:700;">
            Need help? Contact us →
          </a>
        </div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="height:4px;background:linear-gradient(90deg,#1d4ed8 0%,#6366f1 50%,#f59e0b 100%);"></td></tr>`;
}

// ── Status change email ───────────────────────────────────────────────────────
function buildStatusEmailHTML({ name, ticketId, subject, newStatus, adminMessage }) {
  const STATUS_MAP = {
    "Open": {
      color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", barColor: "#2563eb", icon: "🔵",
      headline: "Your Ticket Has Been Reopened",
      body: "We have reopened your support ticket. Our team will review your case again and get back to you as soon as possible. We sincerely apologize for any inconvenience caused and appreciate your continued patience.",
    },
    "In Progress": {
      color: "#d97706", bg: "#fffbeb", border: "#fde68a", barColor: "#f59e0b", icon: "⚡",
      headline: "We Are Actively Working on Your Request",
      body: "Great news — your support ticket is now being actively reviewed by our dedicated support team. We are looking into the details of your issue and will provide you with a comprehensive update shortly. Thank you for your patience.",
    },
    "Resolved": {
      color: "#16a34a", bg: "#f0fdf4", border: "#86efac", barColor: "#22c55e", icon: "✅",
      headline: "Your Issue Has Been Successfully Resolved",
      body: "We are pleased to inform you that your support ticket has been resolved. We hope the solution fully addresses your concern. If the issue persists or you have any follow-up questions, please do not hesitate to reach out — we are always here to help.",
    },
    "Closed": {
      color: "#475569", bg: "#f8fafc", border: "#e2e8f0", barColor: "#94a3b8", icon: "🔒",
      headline: "Your Support Ticket Has Been Closed",
      body: "Your support ticket has been officially closed. If you feel your concern was not fully addressed, or if you encounter the same issue in the future, please open a new ticket or contact us directly via WhatsApp. We value your feedback and are committed to improving your experience.",
    },
  };
  const s = STATUS_MAP[newStatus] || STATUS_MAP["Open"];

  const now = new Date().toLocaleString("en-PK", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Ticket Update — Novexa</title></head>
<body style="margin:0;padding:0;background:#e8edf4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#e8edf4;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">
  <tr><td style="height:5px;background:linear-gradient(90deg,#1d4ed8 0%,#6366f1 50%,#f59e0b 100%);"></td></tr>
  <tr><td style="padding:32px 44px 24px;background:linear-gradient(160deg,#0f172a 0%,#1e3a8a 55%,#1d4ed8 100%);">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="display:inline-block;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:4px 12px;margin-bottom:10px;">
          <span style="color:#bfdbfe;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">🎫 Ticket Update</span>
        </div>
        <div style="color:#fff;font-size:22px;font-weight:900;font-family:monospace;letter-spacing:-0.5px;">${ticketId}</div>
        <div style="color:#93c5fd;font-size:13px;margin-top:4px;">${subject}</div>
      </td>
      <td align="right" valign="top" style="font-size:11px;color:#64748b;">${now}</td>
    </tr></table>
  </td></tr>
  <tr><td style="height:3px;background:${s.barColor};"></td></tr>
  <tr><td style="padding:36px 44px 30px;">
    <p style="margin:0 0 6px;font-size:20px;font-weight:800;color:#0f172a;">Hi ${name},</p>
    <p style="margin:0 0 28px;font-size:14px;color:#334155;line-height:1.7;">We have an important update regarding your support request with <strong style="color:#1d4ed8;">Novexa</strong>.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:${s.bg};border:2px solid ${s.border};border-radius:16px;padding:26px;text-align:center;">
        <div style="font-size:38px;margin-bottom:10px;">${s.icon}</div>
        <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Current Status</div>
        <div style="font-size:24px;font-weight:900;color:${s.color};">${newStatus}</div>
      </td></tr>
    </table>

    <div style="background:#f8fafc;border-left:4px solid ${s.color};border-radius:0 14px 14px 0;padding:20px 22px;margin-bottom:22px;">
      <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📋 What This Means for You</div>
      <h3 style="margin:0 0 10px;font-size:15px;font-weight:800;color:#0f172a;">${s.headline}</h3>
      <p style="margin:0;font-size:13px;color:#334155;line-height:1.8;">${s.body}</p>
    </div>

    ${adminMessage ? `
    <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:14px;padding:20px 22px;margin-bottom:22px;">
      <div style="font-size:11px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">💬 Message from Our Support Team</div>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.85;white-space:pre-wrap;">${adminMessage}</p>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid #bbf7d0;">
        <span style="font-size:12px;color:#16a34a;font-weight:700;">— Novexa Support Team</span>
      </div>
    </div>` : ""}

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin-bottom:28px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="width:50%;padding-right:12px;">
          <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Ticket ID</div>
          <div style="font-size:14px;font-weight:800;color:#1d4ed8;font-family:monospace;">${ticketId}</div>
        </td>
        <td style="width:50%;padding-left:12px;border-left:1px solid #e2e8f0;">
          <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Subject</div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;">${subject}</div>
        </td>
      </tr></table>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="48%" style="padding-right:8px;">
          <a href="https://wa.me/923320262457" style="display:block;padding:13px 10px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-size:13px;font-weight:800;border-radius:10px;text-decoration:none;text-align:center;">
            💬 Chat on WhatsApp
          </a>
        </td>
        <td width="4%"></td>
        <td width="48%">
          <a href="mailto:novexaerp@gmail.com" style="display:block;padding:13px 10px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:13px;font-weight:800;border-radius:10px;text-decoration:none;text-align:center;">
            📧 Reply via Email
          </a>
        </td>
      </tr>
    </table>
  </td></tr>
  ${footerHTML()}
</table>
</td></tr></table>
</body></html>`;
}

// ── Reply email ───────────────────────────────────────────────────────────────
function buildReplyEmailHTML({ name, ticketId, subject, replyText }) {
  const now = new Date().toLocaleString("en-PK", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Reply from Novexa Support</title></head>
<body style="margin:0;padding:0;background:#e8edf4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#e8edf4;padding:40px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">
  <tr><td style="height:5px;background:linear-gradient(90deg,#1d4ed8 0%,#6366f1 50%,#f59e0b 100%);"></td></tr>
  <tr><td style="padding:32px 44px 24px;background:linear-gradient(160deg,#0f172a 0%,#1e3a8a 55%,#1d4ed8 100%);">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="display:inline-block;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:4px 12px;margin-bottom:10px;">
          <span style="color:#bfdbfe;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">📨 Support Reply</span>
        </div>
        <div style="color:#fff;font-size:22px;font-weight:900;font-family:monospace;letter-spacing:-0.5px;">${ticketId}</div>
        <div style="color:#93c5fd;font-size:13px;margin-top:4px;">${subject}</div>
      </td>
      <td align="right" valign="top" style="font-size:11px;color:#64748b;">${now}</td>
    </tr></table>
  </td></tr>
  <tr><td style="height:3px;background:#2563eb;"></td></tr>
  <tr><td style="padding:36px 44px 30px;">
    <p style="margin:0 0 6px;font-size:20px;font-weight:800;color:#0f172a;">Hi ${name},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#334155;line-height:1.7;">
      Our support team has reviewed your request and sent you a response. Please find the details below.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin-bottom:16px;">
      <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Regarding</div>
      <div style="font-size:13px;font-weight:700;color:#0f172a;">${subject}</div>
    </div>

    <div style="background:#eff6ff;border-left:4px solid #2563eb;border-radius:0 14px 14px 0;padding:20px 22px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:800;color:#1e40af;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">💬 Message from Our Support Team</div>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.85;white-space:pre-wrap;">${replyText}</p>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid #bfdbfe;">
        <span style="font-size:12px;color:#3b82f6;font-weight:700;">— Novexa Support Team</span>
      </div>
    </div>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 18px;margin-bottom:28px;">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.7;">
        💡 <strong>Need further assistance?</strong> You can reply to this email or reach us instantly on WhatsApp. Our team is available Monday to Saturday, 9 AM – 8 PM PKT.
      </p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="48%" style="padding-right:8px;">
          <a href="https://wa.me/923320262457" style="display:block;padding:13px 10px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-size:13px;font-weight:800;border-radius:10px;text-decoration:none;text-align:center;">
            💬 Chat on WhatsApp
          </a>
        </td>
        <td width="4%"></td>
        <td width="48%">
          <a href="mailto:novexaerp@gmail.com" style="display:block;padding:13px 10px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:13px;font-weight:800;border-radius:10px;text-decoration:none;text-align:center;">
            📧 Reply via Email
          </a>
        </td>
      </tr>
    </table>
  </td></tr>
  ${footerHTML()}
</table>
</td></tr></table>
</body></html>`;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { ticketId, action, replyText, newStatus, resolveNote } = await request.json();
    if (!ticketId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const ticketSnap = await adminDb.collection("supportTickets").doc(ticketId).get();
    if (!ticketSnap.exists) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    const ticket = ticketSnap.data();

    const now         = new Date().toISOString();
    const transporter = getTransporter();

    if (action === "reply") {
      if (!replyText?.trim()) return NextResponse.json({ error: "Reply text required" }, { status: 400 });

      const newMsg = { from: "admin", text: replyText.trim(), createdAt: now };
      const update = {
        messages:  [...(ticket.messages || []), newMsg],
        updatedAt: now,
        status:    ticket.status === "Open" ? "In Progress" : ticket.status,
      };

      await Promise.all([
        adminDb.collection("supportTickets").doc(ticketId).update(update),
        adminDb.collection("users").doc(ticket.uid).collection("tickets").doc(ticketId).update(update),
      ]);

      await transporter.sendMail({
        from:    `"Novexa Support" <${process.env.NOVEXA_GMAIL}>`,
        to:      ticket.email,
        subject: `Re: [${ticketId}] ${ticket.subject}`,
        html:    buildReplyEmailHTML({ name: ticket.name, ticketId, subject: ticket.subject, replyText: replyText.trim() }),
      });

      return NextResponse.json({ success: true });
    }

    if (action === "status") {
      if (!newStatus) return NextResponse.json({ error: "newStatus required" }, { status: 400 });
      const update = { status: newStatus, updatedAt: now };

      // If resolveNote provided, add it as an admin message in conversation
      if (resolveNote?.trim()) {
        const resolveMsg = { from: "admin", text: resolveNote.trim(), createdAt: now };
        update.messages = [...(ticket.messages || []), resolveMsg];
      }

      await Promise.all([
        adminDb.collection("supportTickets").doc(ticketId).update(update),
        adminDb.collection("users").doc(ticket.uid).collection("tickets").doc(ticketId).update(update),
      ]);

      await transporter.sendMail({
        from:    `"Novexa Support" <${process.env.NOVEXA_GMAIL}>`,
        to:      ticket.email,
        subject: `[${ticketId}] Your Ticket Status Has Been Updated — ${newStatus}`,
        html:    buildStatusEmailHTML({
          name: ticket.name,
          ticketId,
          subject: ticket.subject,
          newStatus,
          adminMessage: resolveNote?.trim() || null,
        }),
      });

      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      await Promise.all([
        adminDb.collection("supportTickets").doc(ticketId).delete(),
        adminDb.collection("users").doc(ticket.uid).collection("tickets").doc(ticketId).delete(),
      ]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[ticket-action]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
