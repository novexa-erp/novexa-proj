import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

async function getAdminModules() {
  const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");
  return { adminAuth, adminDb };
}

async function verifyAdmin(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const { adminAuth } = await getAdminModules();
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID ? decoded : null;
  } catch { return null; }
}

function fmtRs(n) { return "Rs. " + Number(n || 0).toLocaleString("en-US"); }
function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return iso; }
}

// ── Approval email HTML ───────────────────────────────────────────────────────
function buildApprovalEmail({ userName, lineItems, grandTotal, expiresAt, adminNote }) {
  const rowsHtml = (lineItems || []).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? "#f0fdf4" : "#fff"};">
      <td style="padding:11px 16px;font-size:14px;color:#374151;border-bottom:1px solid #dcfce7;">
        ${item.icon || "⚡"} ${item.label}
      </td>
      <td style="padding:11px 16px;text-align:center;font-size:14px;font-weight:700;color:#059669;border-bottom:1px solid #dcfce7;">
        +${Number(item.qty).toLocaleString()}
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Add-on Approved — Novexa</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="height:6px;background:linear-gradient(to right,#10b981,#34d399,#1d4ed8);"></td></tr>
<tr><td style="padding:36px 40px 28px;background:linear-gradient(135deg,#064e3b 0%,#065f46 60%,#047857 100%);">
  <div style="color:#a7f3d0;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Payment Approved</div>
  <div style="color:#fff;font-size:24px;font-weight:800;">✅ Your Add-ons Are Now Active!</div>
  <div style="color:#a7f3d0;font-size:13px;margin-top:8px;">
    Hi <strong style="color:#fff;">${userName}</strong>, your payment has been verified and your add-on quota is now live.
  </div>
</td></tr>
<tr><td style="padding:24px 40px 8px;">
  <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:16px 20px;">
    <div style="display:flex;gap:20px;flex-wrap:wrap;">
      <div>
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Total Paid</div>
        <div style="font-size:18px;font-weight:800;color:#059669;">${fmtRs(grandTotal)}</div>
      </div>
      <div>
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Valid Until</div>
        <div style="font-size:18px;font-weight:800;color:#d97706;">${fmtDate(expiresAt)}</div>
      </div>
    </div>
    <div style="margin-top:10px;font-size:12px;color:#6b7280;">
      Add-on expires exactly 1 month from approval date. After expiry, plan's default limits apply.
    </div>
  </div>
</td></tr>
<tr><td style="padding:8px 40px 20px;">
  <div style="font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">⚡ Activated Add-ons</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #dcfce7;">
    <thead><tr style="background:linear-gradient(to right,#10b981,#34d399);">
      <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Add-on</th>
      <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;width:100px;">Quota Added</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</td></tr>
${adminNote ? `<tr><td style="padding:0 40px 20px;">
  <div style="background:#f8faff;border:1px solid #dbeafe;border-radius:8px;padding:12px 16px;">
    <div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:4px;">📝 Note from Novexa Team</div>
    <div style="font-size:13px;color:#374151;">${adminNote}</div>
  </div>
</td></tr>` : ""}
<tr><td style="padding:0 40px 24px;">
  <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:14px 18px;">
    <div style="font-size:12px;font-weight:700;color:#10b981;margin-bottom:3px;">🚀 You're All Set!</div>
    <div style="font-size:12px;color:#6b7280;line-height:1.6;">
      Your additional quota is now active in your Novexa dashboard. Log in to start using your expanded limits.
    </div>
  </div>
</td></tr>
<tr><td style="padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
  <div style="font-size:13px;font-weight:700;color:#10b981;">Novexa ERP</div>
  <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Smart Business Management Platform</div>
  <div style="font-size:10px;color:#d1d5db;margin-top:10px;">Automated email — please do not reply.</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(to right,#10b981,#34d399,#1d4ed8);"></td></tr>
</table></td></tr></table>
</body></html>`;
}

// ── Rejection email HTML ──────────────────────────────────────────────────────
function buildRejectionEmail({ userName, adminNote, grandTotal }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Add-on Request Update — Novexa</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="height:6px;background:linear-gradient(to right,#ef4444,#f97316,#fbbf24);"></td></tr>
<tr><td style="padding:36px 40px 28px;background:linear-gradient(135deg,#7f1d1d 0%,#991b1b 60%,#b91c1c 100%);">
  <div style="color:#fecaca;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Request Update</div>
  <div style="color:#fff;font-size:22px;font-weight:800;">❌ Add-on Request Not Processed</div>
  <div style="color:#fecaca;font-size:13px;margin-top:8px;">
    Hi <strong style="color:#fff;">${userName}</strong>, we were unable to process your add-on request at this time.
  </div>
</td></tr>
<tr><td style="padding:28px 40px;">
  <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:20px;">
    <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:8px;">📋 Request Details</div>
    <div style="font-size:13px;color:#374151;margin-bottom:8px;">Requested Amount: <strong style="color:#dc2626;">${fmtRs(grandTotal)}</strong></div>
    ${adminNote ? `<div style="margin-top:12px;padding:12px 14px;background:#fff;border:1px solid #fecaca;border-radius:8px;">
      <div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:4px;">Reason:</div>
      <div style="font-size:13px;color:#374151;">${adminNote}</div>
    </div>` : ""}
  </div>
</td></tr>
<tr><td style="padding:0 40px 24px;">
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;">
    <div style="font-size:12px;font-weight:700;color:#1d4ed8;margin-bottom:4px;">💬 Need Help?</div>
    <div style="font-size:12px;color:#6b7280;line-height:1.6;">
      If you believe this was a mistake or need clarification, please contact our support team.
      We're happy to help resolve any issues.
    </div>
  </div>
</td></tr>
<tr><td style="padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
  <div style="font-size:13px;font-weight:700;color:#dc2626;">Novexa ERP</div>
  <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Smart Business Management Platform</div>
  <div style="font-size:10px;color:#d1d5db;margin-top:10px;">Automated email — please do not reply.</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(to right,#ef4444,#f97316,#fbbf24);"></td></tr>
</table></td></tr></table>
</body></html>`;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { uid, requestId, action, adminNote } = body;
    // action: "approve" | "reject"

    if (!uid || !requestId || !action)
      return NextResponse.json({ error: "Missing uid, requestId or action" }, { status: 400 });
    if (!["approve", "reject"].includes(action))
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    const { adminDb } = await getAdminModules();

    // Fetch the request
    const reqRef  = adminDb.collection("users").doc(uid).collection("addonRequests").doc(requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const reqData = reqSnap.data();
    if (reqData.status !== "pending")
      return NextResponse.json({ error: "Request already processed" }, { status: 400 });

    const now     = new Date().toISOString();
    const newStatus = action === "approve" ? "approved" : "rejected";

    // Update request status
    const updatePayload = { status: newStatus, adminNote: adminNote || "", processedAt: now, processedBy: admin.uid };
    await reqRef.update(updatePayload);

    // Also update global reference
    try {
      await adminDb.collection("addonRequests").doc(requestId).update(updatePayload);
    } catch { /* ignore if not exists */ }

    if (action === "approve") {
      // ── Apply the extraLimits to the user ───────────────────────────────
      const userRef  = adminDb.collection("users").doc(uid);
      const userSnap = await userRef.get();
      const userData = userSnap.exists ? userSnap.data() : {};

      const existing = userData.extraLimits || {};
      const newLimits = { ...existing };
      const ALLOWED_KEYS = ["invoicesPerMonth","invoicesPerCustomerPerMonth","customersPerMonth","suppliersPerMonth","ordersPerSupplierPerMonth"];

      (reqData.lineItems || []).forEach(item => {
        if (ALLOWED_KEYS.includes(item.limitKey)) {
          newLimits[item.limitKey] = (Number(newLimits[item.limitKey]) || 0) + (Number(item.qty) || 0);
        }
      });

      const expiresDate = new Date();
      expiresDate.setMonth(expiresDate.getMonth() + 1);
      const expiresAt = expiresDate.toISOString();

      await userRef.update({
        extraLimits:             newLimits,
        extraLimitsExpiresAt:    expiresAt,
        extraLimitsPurchasedAt:  now,
        extraLimitsPaymentMethod: reqData.paymentMethod || "easypaisa",
        updatedAt:               now,
        updatedBy:               admin.uid,
      });

      // Send approval email
      const gmailUser = process.env.NOVEXA_GMAIL;
      const gmailPass = process.env.NOVEXA_GMAIL_APP_PASSWORD;
      if (gmailUser && gmailPass && reqData.userEmail) {
        try {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: gmailUser, pass: gmailPass },
          });
          await transporter.sendMail({
            from:    `"Novexa ERP" <${gmailUser}>`,
            to:      reqData.userEmail,
            subject: `✅ Your Add-on Request Has Been Approved — Novexa ERP`,
            html:    buildApprovalEmail({
              userName:  reqData.userName || reqData.userEmail,
              lineItems: reqData.lineItems,
              grandTotal: reqData.grandTotal,
              expiresAt,
              adminNote: adminNote || "",
            }),
          });
        } catch (e) { console.error("[addon-approve] Approval email failed:", e.message); }
      }

      return NextResponse.json({ success: true, action: "approved", expiresAt });
    } else {
      // Send rejection email
      const gmailUser = process.env.NOVEXA_GMAIL;
      const gmailPass = process.env.NOVEXA_GMAIL_APP_PASSWORD;
      if (gmailUser && gmailPass && reqData.userEmail) {
        try {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: gmailUser, pass: gmailPass },
          });
          await transporter.sendMail({
            from:    `"Novexa ERP" <${gmailUser}>`,
            to:      reqData.userEmail,
            subject: `❌ Add-on Request Update — Novexa ERP`,
            html:    buildRejectionEmail({
              userName:   reqData.userName || reqData.userEmail,
              adminNote:  adminNote || "",
              grandTotal: reqData.grandTotal,
            }),
          });
        } catch (e) { console.error("[addon-approve] Rejection email failed:", e.message); }
      }

      return NextResponse.json({ success: true, action: "rejected" });
    }
  } catch (err) {
    console.error("[addon-approve] Error:", err.message);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
