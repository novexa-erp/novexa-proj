import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

async function getAdminModules() {
  const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");
  return { adminAuth, adminDb };
}

async function verifyUser(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const { adminAuth } = await getAdminModules();
    return await adminAuth.verifyIdToken(token);
  } catch { return null; }
}

function fmtRs(n) { return "Rs. " + Number(n || 0).toLocaleString("en-US"); }

// ── User confirmation email HTML ──────────────────────────────────────────────
function buildUserConfirmEmail({ userName, userEmail, lineItems, grandTotal, paymentMethod }) {
  const payLabel = paymentMethod === "easypaisa" ? "EasyPaisa"
    : paymentMethod === "jazzcash" ? "JazzCash" : "Meezan Bank";

  const rowsHtml = (lineItems || []).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? "#f8faff" : "#fff"};">
      <td style="padding:11px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">
        ${item.icon || "⚡"} ${item.label}
      </td>
      <td style="padding:11px 16px;text-align:center;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">
        +${Number(item.qty).toLocaleString()}
      </td>
      <td style="padding:11px 16px;text-align:right;font-size:14px;font-weight:700;color:#d97706;border-bottom:1px solid #e5e7eb;">
        ${fmtRs(item.total)}
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Add-on Request — Novexa</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="height:6px;background:linear-gradient(to right,#1d4ed8,#3b82f6,#f59e0b);"></td></tr>
<tr><td style="padding:36px 40px 24px;background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#2563eb 100%);">
  <div style="color:#bfdbfe;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Add-on Request Received</div>
  <div style="color:#fff;font-size:24px;font-weight:800;">⚡ Your Request Has Been Submitted!</div>
  <div style="color:#93c5fd;font-size:13px;margin-top:8px;">Hi <strong style="color:#fff;">${userName}</strong>, we've received your add-on request and payment.</div>
</td></tr>
<tr><td style="padding:24px 40px 16px;">
  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 20px;">
    <div style="font-size:13px;color:#1d4ed8;font-weight:700;margin-bottom:6px;">📋 What Happens Next?</div>
    <ol style="margin:0;padding-left:18px;font-size:13px;color:#374151;line-height:2;">
      <li>Our team will review your payment screenshot.</li>
      <li>Once payment is confirmed, your add-on quota will be activated.</li>
      <li>You'll receive a confirmation email as soon as it's done.</li>
    </ol>
  </div>
</td></tr>
<tr><td style="padding:0 40px 20px;">
  <div style="font-size:11px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">📦 Add-on Details</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
    <thead><tr style="background:linear-gradient(to right,#1d4ed8,#2563eb);">
      <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Add-on</th>
      <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;width:80px;">Quantity</th>
      <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Price</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</td></tr>
<tr><td style="padding:0 40px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td width="55%"></td><td width="45%">
    <div style="border-top:2px solid #e5e7eb;padding-top:12px;">
      <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:15px;font-weight:800;color:#111827;">
        <span>Total Paid</span><span style="color:#d97706;">${fmtRs(grandTotal)}</span>
      </div>
      <div style="font-size:12px;color:#6b7280;margin-top:4px;">via ${payLabel}</div>
    </div>
  </td></tr></table>
</td></tr>
<tr><td style="padding:0 40px 24px;">
  <div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:14px 18px;">
    <div style="font-size:12px;font-weight:700;color:#d97706;margin-bottom:4px;">⏰ Processing Time</div>
    <div style="font-size:12px;color:#6b7280;line-height:1.6;">
      Your add-on request is being reviewed. Our team will process and confirm your payment,
      then activate your add-ons <strong style="color:#374151;">as soon as possible</strong>.
      You will receive another email once everything is activated.
    </div>
  </div>
</td></tr>
<tr><td style="padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
  <div style="font-size:13px;font-weight:700;color:#1d4ed8;">Novexa ERP</div>
  <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Smart Business Management Platform</div>
  <div style="font-size:10px;color:#d1d5db;margin-top:10px;">Automated email — please do not reply.</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(to right,#1d4ed8,#3b82f6,#f59e0b);"></td></tr>
</table></td></tr></table>
</body></html>`;
}

// ── Admin notification email HTML ─────────────────────────────────────────────
function buildAdminNotifyEmail({ userName, userEmail, lineItems, grandTotal, paymentMethod, requestId }) {
  const payLabel = paymentMethod === "easypaisa" ? "EasyPaisa"
    : paymentMethod === "jazzcash" ? "JazzCash" : "Meezan Bank";

  const rowsHtml = (lineItems || []).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? "#fffbeb" : "#fff"};">
      <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #fef3c7;">
        ${item.icon || "⚡"} ${item.label}
      </td>
      <td style="padding:10px 14px;text-align:center;font-size:13px;color:#374151;border-bottom:1px solid #fef3c7;">
        +${Number(item.qty).toLocaleString()}
      </td>
      <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:700;color:#d97706;border-bottom:1px solid #fef3c7;">
        ${fmtRs(item.total)}
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>New Add-on Request — Admin Alert</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="height:6px;background:linear-gradient(to right,#f59e0b,#fbbf24,#1d4ed8);"></td></tr>
<tr><td style="padding:36px 40px 24px;background:linear-gradient(135deg,#78350f 0%,#92400e 60%,#b45309 100%);">
  <div style="color:#fde68a;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Admin Action Required</div>
  <div style="color:#fff;font-size:22px;font-weight:800;">🔔 New Add-on Request!</div>
  <div style="color:#fde68a;font-size:13px;margin-top:8px;">
    <strong style="color:#fff;">${userName}</strong> (${userEmail}) ne add-on request ki hai aur payment screenshot bheja hai.
  </div>
</td></tr>
<tr><td style="padding:24px 40px 16px;">
  <div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:16px 20px;">
    <div style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📋 Request Details</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">User</div>
        <div style="font-size:14px;font-weight:700;color:#111827;">${userName}</div>
        <div style="font-size:12px;color:#6b7280;">${userEmail}</div>
      </div>
      <div>
        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Payment Method</div>
        <div style="font-size:14px;font-weight:700;color:#d97706;">${payLabel}</div>
        <div style="font-size:12px;color:#6b7280;">Total: ${fmtRs(grandTotal)}</div>
      </div>
    </div>
    <div style="margin-top:10px;">
      <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">Request ID</div>
      <div style="font-size:12px;font-family:monospace;color:#374151;">${requestId}</div>
    </div>
  </div>
</td></tr>
<tr><td style="padding:0 40px 20px;">
  <div style="font-size:11px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">📦 Requested Add-ons</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #fde68a;">
    <thead><tr style="background:linear-gradient(to right,#d97706,#f59e0b);">
      <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Add-on</th>
      <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;width:80px;">Qty</th>
      <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Amount</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr style="background:#fffbeb;">
      <td colspan="2" style="padding:12px 14px;font-size:14px;font-weight:800;color:#111827;border-top:2px solid #fde68a;">Grand Total</td>
      <td style="padding:12px 14px;text-align:right;font-size:14px;font-weight:800;color:#d97706;border-top:2px solid #fde68a;">${fmtRs(grandTotal)}</td>
    </tr></tfoot>
  </table>
</td></tr>
<tr><td style="padding:0 40px 24px;">
  <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:14px 18px;">
    <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:4px;">⚡ Action Required</div>
    <div style="font-size:12px;color:#6b7280;line-height:1.6;">
      Please log in to the <strong>Novexa Admin Panel</strong>, go to the user's profile,
      review the payment screenshot, and <strong>approve or reject</strong> this add-on request.
      The user will be notified via email once you take action.
    </div>
  </div>
</td></tr>
<tr><td style="padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
  <div style="font-size:13px;font-weight:700;color:#d97706;">Novexa ERP — Admin Panel</div>
  <div style="font-size:10px;color:#d1d5db;margin-top:10px;">Automated admin alert — do not reply.</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(to right,#f59e0b,#fbbf24,#1d4ed8);"></td></tr>
</table></td></tr></table>
</body></html>`;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const decoded = await verifyUser(request);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { uid, lineItems, grandTotal, paymentMethod, paymentScreenshot, userName, userEmail } = body;

    if (!uid || decoded.uid !== uid)
      return NextResponse.json({ error: "UID mismatch" }, { status: 403 });
    if (!lineItems?.length)
      return NextResponse.json({ error: "No add-ons selected" }, { status: 400 });
    if (!paymentScreenshot)
      return NextResponse.json({ error: "Payment screenshot required" }, { status: 400 });

    const { adminDb } = await getAdminModules();

    // ── Save to Firestore under users/{uid}/addonRequests ─────────────────
    const requestData = {
      uid,
      userName:    userName || userEmail || "",
      userEmail:   userEmail || "",
      lineItems:   lineItems.map(item => ({
        limitKey: item.limitKey || "",
        icon:     item.icon || "⚡",
        label:    item.label || "",
        qty:      Number(item.qty) || 0,
        total:    Number(item.total) || 0,
      })),
      grandTotal:      Number(grandTotal) || 0,
      paymentMethod:   paymentMethod || "easypaisa",
      paymentScreenshot,
      status:          "pending",
      createdAt:       new Date().toISOString(),
      updatedAt:       new Date().toISOString(),
    };

    const docRef = await adminDb
      .collection("users").doc(uid)
      .collection("addonRequests")
      .add(requestData);

    const requestId = docRef.id;

    // Also save a global reference for admin panel quick access
    await adminDb.collection("addonRequests").doc(requestId).set({
      ...requestData,
      requestId,
    });

    // ── Send emails ───────────────────────────────────────────────────────
    const gmailUser = process.env.NOVEXA_GMAIL;
    const gmailPass = process.env.NOVEXA_GMAIL_APP_PASSWORD;
    const adminUid  = process.env.NEXT_PUBLIC_ADMIN_UID;

    if (gmailUser && gmailPass) {
      let adminEmail = gmailUser; // fallback to system email
      try {
        const adminDoc = await adminDb.collection("users").doc(adminUid).get();
        if (adminDoc.exists && adminDoc.data().email) adminEmail = adminDoc.data().email;
      } catch { /* use fallback */ }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
      });

      // Email to user
      try {
        await transporter.sendMail({
          from:    `"Novexa ERP" <${gmailUser}>`,
          to:      userEmail,
          subject: `Your Add-on Request Has Been Received — Novexa ERP`,
          html:    buildUserConfirmEmail({ userName: userName || userEmail, userEmail, lineItems, grandTotal, paymentMethod }),
        });
      } catch (e) { console.error("[addon-request] User email failed:", e.message); }

      // Email to admin
      try {
        await transporter.sendMail({
          from:    `"Novexa ERP System" <${gmailUser}>`,
          to:      adminEmail,
          subject: `🔔 New Add-on Request from ${userName || userEmail} — Rs. ${Number(grandTotal).toLocaleString()}`,
          html:    buildAdminNotifyEmail({ userName: userName || userEmail, userEmail, lineItems, grandTotal, paymentMethod, requestId }),
        });
      } catch (e) { console.error("[addon-request] Admin email failed:", e.message); }
    }

    return NextResponse.json({ success: true, requestId });

  } catch (err) {
    console.error("[addon-request] Error:", err.message);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
