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

const STATUS_INFO = {
  "open":        { label: "Open",        emoji: "🔓", color: "#3b82f6" },
  "in-progress": { label: "In Progress", emoji: "⚙️",  color: "#f59e0b" },
  "resolved":    { label: "Resolved",    emoji: "✅",  color: "#22c55e" },
  "closed":      { label: "Closed",      emoji: "🔒", color: "#6b7280" },
};

function buildStatusUpdateHTML({ name, ticketNo, subject, oldStatus, newStatus, replyText }) {
  const info = STATUS_INFO[newStatus] || STATUS_INFO["open"];
  const now  = new Date().toLocaleString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", hour12:true });

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#eef2f7;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);max-width:560px;width:100%;">
<tr><td style="height:5px;background:linear-gradient(90deg,#1d4ed8,#6366f1,#f59e0b);"></td></tr>
<tr><td style="padding:32px 40px 24px;background:linear-gradient(135deg,#0f172a,#1e3a8a,#1d4ed8);text-align:center;">
  <div style="font-size:36px;margin-bottom:10px;">${info.emoji}</div>
  <div style="color:#fff;font-size:22px;font-weight:900;margin-bottom:4px;">Ticket ${newStatus === "resolved" ? "Resolved" : "Updated"}</div>
  <div style="color:#bfdbfe;font-size:13px;">Your support ticket has been updated</div>
</td></tr>
<tr><td style="padding:28px 40px 0;">
  <p style="margin:0 0 6px;font-size:17px;font-weight:800;color:#0f172a;">Hi ${name},</p>
  <p style="margin:0 0 22px;font-size:14px;color:#1e293b;line-height:1.7;">
    Your ticket <strong style="color:#1d4ed8;">${ticketNo}</strong> has been updated.
  </p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
    <tr>
      <td width="48%" style="padding-right:8px;">
        <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:12px 16px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Was</div>
          <div style="font-size:13px;font-weight:700;color:#94a3b8;">${STATUS_INFO[oldStatus]?.label || oldStatus}</div>
        </div>
      </td>
      <td width="4%" align="center" style="font-size:18px;color:#6b7280;">→</td>
      <td width="48%" style="padding-left:8px;">
        <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:12px 16px;">
          <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Now</div>
          <div style="font-size:13px;font-weight:800;color:${info.color};">${info.emoji} ${info.label}</div>
        </div>
      </td>
    </tr>
  </table>
  ${replyText ? `
  <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px 18px;margin-bottom:18px;">
    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">💬 Message from Support</div>
    <div style="font-size:14px;color:#1e293b;line-height:1.7;white-space:pre-wrap;">${replyText}</div>
  </div>` : ""}
  <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px 18px;margin-bottom:28px;">
    <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">
      📌 Subject: <strong>${subject}</strong><br/>
      🕐 Updated at: ${now}
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
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { ticketId, status, priority, replyText } = await request.json();
    if (!ticketId) return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });

    const ticketRef  = adminDb.collection("tickets").doc(ticketId);
    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    const ticket   = ticketSnap.data();
    const oldStatus = ticket.status;
    const now       = new Date().toISOString();

    const updateData = { updatedAt: now };
    if (status)   updateData.status   = status;
    if (priority) updateData.priority = priority;

    // Append admin reply to messages array
    if (replyText?.trim()) {
      updateData.messages = [
        ...(ticket.messages || []),
        { from: "admin", text: replyText.trim(), timestamp: now, name: "Novexa Support" },
      ];
    }

    await ticketRef.update(updateData);

    // Update user subcollection too
    if (ticket.uid && status) {
      try {
        await adminDb.collection("users").doc(ticket.uid)
          .collection("tickets").doc(ticketId)
          .update({ status, updatedAt: now });
      } catch { /* ok if missing */ }
    }

    // ── Send email notification to user ──────────────────────────────────────
    if (ticket.email && (status || replyText)) {
      const transporter = getTransporter();
      const newStatus   = status || ticket.status;
      await transporter.sendMail({
        from:    `"Novexa Support" <${process.env.NOVEXA_GMAIL}>`,
        to:      ticket.email,
        subject: `${STATUS_INFO[newStatus]?.emoji || "📬"} Ticket ${ticket.ticketNo} Update — Novexa Support`,
        html:    buildStatusUpdateHTML({
          name:      ticket.name,
          ticketNo:  ticket.ticketNo,
          subject:   ticket.subject,
          oldStatus,
          newStatus,
          replyText: replyText?.trim() || "",
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[tickets/update]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
