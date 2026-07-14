import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.NOVEXA_GMAIL, pass: process.env.NOVEXA_GMAIL_APP_PASSWORD },
  });
}

// ── Generate ticket number ────────────────────────────────────────────────────
async function generateTicketNumber() {
  const counterRef = adminDb.collection("_meta").doc("ticketCounter");
  const result = await adminDb.runTransaction(async (tx) => {
    const doc = await tx.get(counterRef);
    const next = (doc.exists ? (doc.data().count || 1000) : 1000) + 1;
    tx.set(counterRef, { count: next }, { merge: true });
    return next;
  });
  return `#${result}`;
}

// ── Confirmation email to user ────────────────────────────────────────────────
function buildTicketConfirmHTML({ name, ticketNo, subject, category }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#eef2f7;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);max-width:560px;width:100%;">
<tr><td style="height:5px;background:linear-gradient(90deg,#1d4ed8,#6366f1,#f59e0b);"></td></tr>
<tr><td style="padding:36px 40px 28px;background:linear-gradient(135deg,#0f172a,#1e3a8a,#1d4ed8);text-align:center;">
  <table align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
    <tr><td width="64" height="64" align="center" valign="middle" style="width:64px;height:64px;background:rgba(52,211,153,0.18);border:2px solid rgba(52,211,153,0.5);border-radius:50%;font-size:28px;line-height:64px;text-align:center;">🎫</td></tr>
  </table>
  <div style="color:#fff;font-size:24px;font-weight:900;margin-bottom:6px;">Ticket Created!</div>
  <div style="color:#bfdbfe;font-size:14px;">Your support request has been received</div>
</td></tr>
<tr><td style="padding:32px 40px 0;">
  <p style="margin:0 0 8px;font-size:18px;font-weight:800;color:#0f172a;">Hi ${name},</p>
  <p style="margin:0 0 24px;font-size:14px;color:#1e293b;line-height:1.7;">
    Thank you for reaching out to <strong style="color:#1d4ed8;">Novexa Support</strong>.
    Your ticket has been created and our team will respond shortly.
  </p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="48%" style="padding-right:8px;">
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:14px 16px;">
          <div style="font-size:10px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">🎫 Ticket No.</div>
          <div style="font-size:22px;font-weight:900;color:#15803d;font-family:'Courier New',monospace;">${ticketNo}</div>
        </div>
      </td>
      <td width="4%"></td>
      <td width="48%">
        <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:12px;padding:14px 16px;">
          <div style="font-size:10px;font-weight:800;color:#1e40af;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">📋 Category</div>
          <div style="font-size:13px;font-weight:700;color:#1d4ed8;">${category || "General"}</div>
        </div>
      </td>
    </tr>
  </table>
</td></tr>
<tr><td style="padding:20px 40px 0;">
  <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:14px 18px;">
    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">📌 Subject</div>
    <div style="font-size:14px;font-weight:700;color:#0f172a;">${subject}</div>
  </div>
</td></tr>
<tr><td style="padding:20px 40px 32px;">
  <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px 18px;">
    <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
      ⏱️ Expected response: <strong>within 24 hours</strong> on business days.<br/>
      You can check your ticket status from <strong>Help &amp; Support</strong> in your dashboard.
    </p>
  </div>
</td></tr>
<tr><td style="padding:0 40px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>
<tr><td style="padding:20px 40px;background:#f8fafc;text-align:center;">
  <div style="font-size:15px;font-weight:900;color:#1d4ed8;">Novexa Support</div>
  <div style="font-size:11px;color:#94a3b8;margin-top:3px;">Smart Business Management Platform</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,#1d4ed8,#6366f1,#f59e0b);"></td></tr>
</table></td></tr></table>
</body></html>`;
}

export async function POST(request) {
  try {
    const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
    let uid = null;
    let userRecord = null;

    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
        const snap = await adminDb.collection("users").doc(uid).get();
        if (snap.exists) userRecord = snap.data();
      } catch { /* guest submit ok */ }
    }

    const { name, email, company, subject, category, message } = await request.json();
    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const ticketNo = await generateTicketNumber();
    const now      = new Date().toISOString();

    const ticketData = {
      ticketNo,
      uid:       uid || null,
      name:      name.trim(),
      email:     email.trim(),
      company:   company || userRecord?.business || "",
      subject:   subject.trim(),
      category:  category || "General",
      message:   message.trim(),
      status:    "open",           // open | in-progress | resolved | closed
      priority:  "medium",         // low | medium | high
      messages:  [{
        from:      "user",
        text:      message.trim(),
        timestamp: now,
        name:      name.trim(),
      }],
      createdAt:  now,
      updatedAt:  now,
    };

    // ── Save to global tickets collection ────────────────────────────────────
    const globalRef = await adminDb.collection("tickets").add(ticketData);

    // ── Save reference in user's subcollection ───────────────────────────────
    if (uid) {
      await adminDb.collection("users").doc(uid)
        .collection("tickets").doc(globalRef.id)
        .set({ ticketId: globalRef.id, ticketNo, subject, status: "open", createdAt: now });
    }

    // ── Send confirmation email to user ──────────────────────────────────────
    const transporter = getTransporter();
    await transporter.sendMail({
      from:    `"Novexa Support" <${process.env.NOVEXA_GMAIL}>`,
      to:      email,
      subject: `✅ Ticket ${ticketNo} Created — Novexa Support`,
      html:    buildTicketConfirmHTML({ name, ticketNo, subject, category }),
    });

    return NextResponse.json({ success: true, ticketId: globalRef.id, ticketNo });
  } catch (err) {
    console.error("[tickets/create]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
