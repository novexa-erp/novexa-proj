import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.NOVEXA_GMAIL, pass: process.env.NOVEXA_GMAIL_APP_PASSWORD },
  });
}

// ── Generate sequential ticket ID: TKT + DDMMYY + 3-digit serial ────────────
// Format example: TKT140726001, TKT140726002 ...
// Uses Firestore transaction to ensure unique global serial
async function generateTicketId() {
  const now     = new Date();
  const dd      = String(now.getDate()).padStart(2, "0");
  const mm      = String(now.getMonth() + 1).padStart(2, "0");
  const yy      = String(now.getFullYear()).slice(-2);
  const datePart = `${dd}${mm}${yy}`;

  const counterRef = adminDb.collection("counters").doc("ticketSerial");

  const serial = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? (snap.data().lastSerial || 0) : 0;
    const next    = current + 1;
    tx.set(counterRef, { lastSerial: next }, { merge: true });
    return next;
  });

  const serialPart = String(serial).padStart(3, "0");
  return `TKT${datePart}${serialPart}`;
}

function buildUserConfirmHTML({ name, ticketId, subject, category }) {
  const now = new Date().toLocaleString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", hour12:true });
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:40px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.1);">
<tr><td style="height:5px;background:linear-gradient(90deg,#1d4ed8,#6366f1,#f59e0b);"></td></tr>
<tr><td style="padding:36px 40px 24px;background:linear-gradient(135deg,#0f172a,#1e3a8a,#1d4ed8);text-align:center;">
  <table cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 16px;">
    <tr><td width="64" height="64" align="center" valign="middle" style="width:64px;height:64px;background:rgba(52,211,153,0.18);border:2px solid rgba(52,211,153,0.5);border-radius:50%;font-size:28px;line-height:64px;text-align:center;">🎫</td></tr>
  </table>
  <div style="color:#fff;font-size:22px;font-weight:800;margin-bottom:6px;">Support Ticket Created</div>
  <div style="color:#bfdbfe;font-size:13px;">We've received your request</div>
</td></tr>
<tr><td style="padding:32px 40px;">
  <p style="margin:0 0 8px;font-size:17px;font-weight:800;color:#0f172a;">Hi ${name}, 👋</p>
  <p style="margin:0 0 24px;font-size:14px;color:#1e293b;line-height:1.7;">Your support ticket has been created. Our team will review it and respond as soon as possible.</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
    <tr>
      <td width="48%" style="padding-right:8px;">
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:14px 16px;">
          <div style="font-size:10px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">🎫 Ticket ID</div>
          <div style="font-size:18px;font-weight:900;color:#15803d;font-family:monospace;">${ticketId}</div>
        </div>
      </td>
      <td width="4%"></td>
      <td width="48%">
        <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:12px;padding:14px 16px;">
          <div style="font-size:10px;font-weight:800;color:#1e40af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">📅 Created</div>
          <div style="font-size:12px;font-weight:700;color:#1d4ed8;">${now}</div>
        </div>
      </td>
    </tr>
  </table>
  <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin-bottom:20px;">
    <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;margin-bottom:8px;">📋 Ticket Details</div>
    <div style="margin-bottom:6px;"><span style="font-size:12px;color:#94a3b8;">Category: </span><strong style="color:#0f172a;font-size:13px;">${category}</strong></div>
    <div><span style="font-size:12px;color:#94a3b8;">Subject: </span><strong style="color:#0f172a;font-size:13px;">${subject}</strong></div>
  </div>
  <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px 18px;">
    <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">⏱️ Expected response within <strong>24 hours</strong> on business days. For urgent help, reach us on <strong>WhatsApp</strong>.</p>
  </div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,#1d4ed8,#6366f1,#f59e0b);"></td></tr>
</table></td></tr></table></body></html>`;
}

function buildAdminNotifHTML({ ticketId, name, email, business, category, subject, message }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:40px 16px;"><tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.1);">
<tr><td style="height:5px;background:linear-gradient(90deg,#dc2626,#f59e0b,#1d4ed8);"></td></tr>
<tr><td style="padding:28px 40px 20px;background:linear-gradient(135deg,#0f172a,#1e3a8a);">
  <div style="display:inline-block;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);border-radius:8px;padding:4px 12px;margin-bottom:10px;">
    <span style="color:#fca5a5;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">🔔 New Support Ticket</span>
  </div>
  <div style="color:#fff;font-size:22px;font-weight:800;">Ticket ${ticketId}</div>
</td></tr>
<tr><td style="padding:24px 40px 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
    <tr>
      <td width="48%" style="padding-right:8px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;">
          <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-bottom:3px;">👤 From</div>
          <div style="font-size:14px;font-weight:700;color:#0f172a;">${name}</div>
          <div style="font-size:12px;color:#3b82f6;">${email}</div>
          ${business ? `<div style="font-size:11px;color:#64748b;">${business}</div>` : ""}
        </div>
      </td>
      <td width="4%"></td>
      <td width="48%">
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 14px;">
          <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-bottom:3px;">🏷️ Category</div>
          <div style="font-size:14px;font-weight:700;color:#dc2626;">${category}</div>
        </div>
      </td>
    </tr>
  </table>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
    <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-bottom:6px;">📌 Subject</div>
    <div style="font-size:14px;font-weight:700;color:#0f172a;">${subject}</div>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
    <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-bottom:8px;">💬 Message</div>
    <div style="font-size:13px;color:#1e293b;line-height:1.7;white-space:pre-wrap;">${message}</div>
  </div>
  <a href="mailto:${email}?subject=Re: [${ticketId}] ${subject}" style="display:inline-block;padding:11px 24px;background:linear-gradient(135deg,#1d4ed8,#4f46e5);color:#fff;font-size:13px;font-weight:700;border-radius:8px;text-decoration:none;margin-bottom:28px;">Reply to ${name} →</a>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,#dc2626,#f59e0b,#1d4ed8);"></td></tr>
</table></td></tr></table></body></html>`;
}

export async function POST(request) {
  try {
    const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let decoded;
    try { decoded = await adminAuth.verifyIdToken(token); }
    catch { return NextResponse.json({ error: "Invalid token" }, { status: 401 }); }

    const uid = decoded.uid;
    const { name, email, business, category, subject, message, priority = "Medium" } = await request.json();

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const ticketId  = await generateTicketId();
    const createdAt = new Date().toISOString();

    const ticketData = {
      ticketId,
      uid,
      name,
      email,
      business:  business || "",
      category:  category || "Other",
      subject,
      message,
      priority,
      status:    "Open",
      createdAt,
      updatedAt: createdAt,
      messages:  [{ from: "user", text: message, createdAt }],
    };

    // Save to global tickets collection + user's subcollection
    await Promise.all([
      adminDb.collection("supportTickets").doc(ticketId).set(ticketData),
      adminDb.collection("users").doc(uid).collection("tickets").doc(ticketId).set(ticketData),
    ]);

    // Send emails
    const transporter = getTransporter();
    await Promise.all([
      transporter.sendMail({
        from:    `"Novexa Support" <${process.env.NOVEXA_GMAIL}>`,
        to:      email,
        subject: `✅ Support Ticket Created — ${ticketId}`,
        html:    buildUserConfirmHTML({ name, ticketId, subject, category }),
      }),
      transporter.sendMail({
        from:    `"Novexa Support System" <${process.env.NOVEXA_GMAIL}>`,
        to:      process.env.NOVEXA_GMAIL,
        replyTo: email,
        subject: `[${ticketId}] [${category}] ${subject}`,
        html:    buildAdminNotifHTML({ ticketId, name, email, business, category, subject, message }),
      }),
    ]);

    return NextResponse.json({ success: true, ticketId });
  } catch (err) {
    console.error("[support-ticket]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
