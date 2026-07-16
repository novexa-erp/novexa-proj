import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

async function getAdminModules() {
  const { adminAuth } = await import("@/lib/firebaseAdmin");
  return { adminAuth };
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(str) {
  if (!str) return "—";
  try { return new Date(str + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return str; }
}
function fmtDateShort(str) {
  if (!str) return "—";
  try { return new Date(str + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return str; }
}
function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.ceil((new Date(b + "T23:59:59") - new Date(a + "T00:00:00")) / 86400000);
}
function fmtPayment(m) {
  if (m === "online") return "Online (Card / Bank Transfer)";
  if (m === "cheque") return "Cheque";
  return "Cash";
}
function fmtPeriod(p) { return p === "yearly" ? "Yearly" : "Monthly"; }
function planLabel(p) { return p ? p.charAt(0).toUpperCase() + p.slice(1) : "Subscription"; }
function makeInvoiceNumber(uid, renewedAt) {
  const ts = renewedAt ? new Date(renewedAt) : new Date();
  const yy = String(ts.getFullYear()).slice(-2);
  const mm = String(ts.getMonth() + 1).padStart(2, "0");
  const dd = String(ts.getDate()).padStart(2, "0");
  return `REN-${yy}${mm}${dd}-${(uid || "").slice(-4).toUpperCase()}`;
}

const PLAN_PRICES = {
  starter:      { monthly: 2499,  yearly: 24990  },
  business:     { monthly: 4999,  yearly: 49990  },
  professional: { monthly: 9999,  yearly: 99990  },
  enterprise:   { monthly: 19999, yearly: 199990 },
};

// ── Build PDF using pdf-lib ───────────────────────────────────────────────────
async function buildInvoicePDF({ invoiceNumber, userName, userEmail, plan,
                                  billingPeriod, paymentMethod, periodStart, activeTo, renewedAt }) {
  const doc  = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const W    = 595;
  const H    = 842;

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);

  const prices    = PLAN_PRICES[plan] || PLAN_PRICES.starter;
  const amount    = billingPeriod === "yearly" ? prices.yearly : prices.monthly;
  const amtStr    = "Rs. " + amount.toLocaleString("en-PK");
  const label     = planLabel(plan);
  const totalDays = daysBetween(periodStart, activeTo);
  const issuedOn  = renewedAt
    ? new Date(renewedAt).toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })
    : fmtDate(new Date().toISOString().slice(0, 10));

  // ── Color helpers ──
  const C = {
    blue:  rgb(0.114, 0.306, 0.847),
    amber: rgb(0.961, 0.620, 0.043),
    green: rgb(0.086, 0.725, 0.506),
    dark:  rgb(0.067, 0.067, 0.067),
    gray:  rgb(0.420, 0.447, 0.502),
    bg:    rgb(0.969, 0.980, 1.000),
    white: rgb(1, 1, 1),
    line:  rgb(0.878, 0.898, 0.918),
    gbg:   rgb(0.941, 0.992, 0.969),
  };

  // ── Header ──
  page.drawRectangle({ x: 0, y: H - 105, width: W, height: 105, color: C.blue });
  page.drawRectangle({ x: 0, y: H - 5,   width: W / 2, height: 5, color: C.blue });
  page.drawRectangle({ x: W / 2, y: H - 5, width: W / 2, height: 5, color: C.amber });

  page.drawText("INVOICE",     { x: 40, y: H - 42, size: 26, font: bold, color: C.white });
  page.drawText("Novexa ERP",  { x: 40, y: H - 68, size: 13, font: bold, color: C.white });
  page.drawText("Smart Business Management", { x: 40, y: H - 84, size: 9, font: reg, color: rgb(0.58, 0.76, 0.99) });

  const invRight = W - bold.widthOfTextAtSize(invoiceNumber, 12) - 40;
  page.drawText(invoiceNumber, { x: invRight, y: H - 42, size: 12, font: bold, color: C.white });
  page.drawText("SUBSCRIPTION INVOICE", { x: W - 40 - reg.widthOfTextAtSize("SUBSCRIPTION INVOICE", 8), y: H - 58, size: 8, font: reg, color: rgb(0.58, 0.76, 0.99) });

  // PAID badge
  page.drawRectangle({ x: W - 100, y: H - 88, width: 62, height: 20, color: C.green });
  page.drawText("PAID", { x: W - 95, y: H - 82, size: 9, font: bold, color: C.white });

  // ── Bill To ──
  let y = H - 130;
  // Sanitize strings for WinAnsi encoding (remove non-latin chars)
  const safe = (s) => (s || "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

  page.drawText("BILL TO",          { x: 40, y, size: 8,  font: bold, color: C.gray });
  y -= 16;
  page.drawText(safe(userName).slice(0, 60),  { x: 40, y, size: 12, font: bold, color: C.dark });
  y -= 15;
  page.drawText(safe(userEmail).slice(0, 70), { x: 40, y, size: 9,  font: reg,  color: C.gray });

  // Right side — dates
  const rightX = 380;
  page.drawText("Invoice Date:",   { x: rightX, y: H - 130, size: 8, font: reg,  color: C.gray });
  page.drawText(issuedOn,          { x: rightX + 80, y: H - 130, size: 8, font: bold, color: C.dark });
  page.drawText("Billing Period:", { x: rightX, y: H - 146, size: 8, font: reg,  color: C.gray });
  page.drawText(fmtPeriod(billingPeriod), { x: rightX + 80, y: H - 146, size: 8, font: bold, color: C.dark });

  // ── Divider ──
  y = H - 190;
  page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 1, color: C.line });

  // ── Table header ──
  y -= 2;
  page.drawRectangle({ x: 40, y: y - 22, width: W - 80, height: 24, color: C.blue });
  page.drawText("Description", { x: 52, y: y - 15, size: 9, font: bold, color: C.white });
  page.drawText("Period",      { x: 290, y: y - 15, size: 9, font: bold, color: C.white });
  page.drawText("Amount",      { x: W - 110, y: y - 15, size: 9, font: bold, color: C.white });

  // ── Table row ──
  y -= 26;
  page.drawRectangle({ x: 40, y: y - 46, width: W - 80, height: 48, color: C.bg });
  const descLine1 = `${label} Plan - ${fmtPeriod(billingPeriod)} Renewal`;
  const descLine2 = `Subscription renewed for ${totalDays} days`;
  page.drawText(descLine1, { x: 52, y: y - 12, size: 10, font: bold, color: C.dark });
  page.drawText(descLine2, { x: 52, y: y - 28, size: 8,  font: reg,  color: C.gray });
  page.drawText(`${fmtDateShort(periodStart)} to`, { x: 290, y: y - 12, size: 8, font: reg, color: C.dark });
  page.drawText(fmtDateShort(activeTo),            { x: 290, y: y - 24, size: 8, font: reg, color: C.dark });
  page.drawText(amtStr, { x: W - 45 - bold.widthOfTextAtSize(amtStr, 10), y: y - 12, size: 10, font: bold, color: C.dark });

  // Row bottom line
  y -= 50;
  page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 0.5, color: C.line });

  // ── Totals ──
  const lx = 360;
  const rx = W - 44;
  y -= 18;
  page.drawText("Subtotal:", { x: lx, y, size: 9, font: reg, color: C.gray });
  page.drawText(amtStr, { x: rx - reg.widthOfTextAtSize(amtStr, 9), y, size: 9, font: reg, color: C.dark });

  y -= 4;
  page.drawLine({ start: { x: lx, y }, end: { x: W - 40, y }, thickness: 0.5, color: C.line });
  y -= 14;
  page.drawText("Total:", { x: lx, y, size: 11, font: bold, color: C.dark });
  page.drawText(amtStr, { x: rx - bold.widthOfTextAtSize(amtStr, 11), y, size: 11, font: bold, color: C.blue });

  y -= 18;
  page.drawRectangle({ x: lx - 8, y: y - 8, width: W - 40 - lx + 8, height: 26, color: C.gbg });
  page.drawText("Amount Paid:", { x: lx, y: y + 4, size: 9, font: bold, color: C.green });
  page.drawText(amtStr, { x: rx - bold.widthOfTextAtSize(amtStr, 9), y: y + 4, size: 9, font: bold, color: C.green });

  // ── Payment details ──
  y -= 55;
  page.drawRectangle({ x: 40, y: y - 42, width: W - 80, height: 52, color: C.bg });
  page.drawLine({ start: { x: 40, y: y + 8 }, end: { x: 40, y: y - 34 }, thickness: 3, color: C.blue });
  page.drawText("PAYMENT DETAILS", { x: 52, y: y, size: 7, font: bold, color: C.gray });
  page.drawText(`Payment received via ${fmtPayment(paymentMethod)} on ${issuedOn}.`,
    { x: 52, y: y - 15, size: 9, font: reg, color: C.dark });
  page.drawText(`Subscription: ${fmtDateShort(periodStart)} to ${fmtDateShort(activeTo)} (${totalDays} days)`,
    { x: 52, y: y - 30, size: 9, font: reg, color: C.dark });

  // ── Footer ──
  page.drawLine({ start: { x: 40, y: 68 }, end: { x: W - 40, y: 68 }, thickness: 0.5, color: C.line });
  page.drawText("Novexa ERP - Smart Business Management",
    { x: 40, y: 50, size: 9, font: bold, color: C.blue });
  page.drawText("This is a computer-generated invoice. No signature required.",
    { x: 40, y: 34, size: 7, font: reg, color: C.gray });

  // Bottom bars
  page.drawRectangle({ x: 0, y: 0, width: W / 2, height: 4, color: C.blue });
  page.drawRectangle({ x: W / 2, y: 0, width: W / 2, height: 4, color: C.amber });

  return await doc.save();
}

// ── Renewal email HTML ────────────────────────────────────────────────────────
function buildRenewalEmailHTML({ userName, plan, billingPeriod, paymentMethod,
                                  periodStart, activeTo, renewedAt, invoiceNumber }) {
  const totalDays = daysBetween(periodStart, activeTo);
  const label     = planLabel(plan);
  const icons     = { enterprise: "🏢", professional: "👑", business: "🚀" };
  const icon      = icons[plan] || "💎";
  const colors    = { enterprise: "#a855f7", professional: "#f59e0b", business: "#2563eb" };
  const color     = colors[plan] || "#10b981";
  const renewedOn = renewedAt
    ? new Date(renewedAt).toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
    : fmtDate(new Date().toISOString().slice(0, 10));

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Renewed — Novexa</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="height:6px;background:linear-gradient(to right,#1d4ed8,#3b82f6,#f59e0b);"></td></tr>
<tr><td style="padding:36px 40px 24px;background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#2563eb 100%);">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>
      <div style="color:#bfdbfe;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Subscription Confirmation</div>
      <div style="color:#fff;font-size:24px;font-weight:800;">&#10003; Your Plan Has Been Renewed!</div>
      <div style="color:#93c5fd;font-size:13px;margin-top:8px;">Hi <strong style="color:#fff;">${userName}</strong>, your Novexa subscription is now active.</div>
    </td>
    <td align="right" valign="top" style="padding-left:16px;">
      <div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);font-size:24px;line-height:48px;text-align:center;">${icon}</div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:20px 40px 8px;">
  <span style="display:inline-block;padding:5px 14px;border-radius:20px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10b981;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
    Renewed on ${renewedOn}
  </span>
</td></tr>
<tr><td style="padding:8px 40px 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1.5px solid ${color}44;">
    <tr><td colspan="2" style="padding:14px 20px;background:${color}22;border-bottom:1px solid ${color}33;">
      <strong style="font-size:13px;color:${color};text-transform:uppercase;letter-spacing:1px;">${icon} ${label} Plan &mdash; ${fmtPeriod(billingPeriod)}</strong>
    </td></tr>
    <tr>
      <td width="50%" style="padding:16px 20px;border-right:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">New Period Starts</div>
        <div style="font-size:15px;font-weight:800;color:#111827;">${fmtDate(periodStart)}</div>
      </td>
      <td width="50%" style="padding:16px 20px;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Expires On</div>
        <div style="font-size:15px;font-weight:800;color:#111827;">${fmtDate(activeTo)}</div>
      </td>
    </tr>
    <tr>
      <td width="50%" style="padding:16px 20px;border-right:1px solid #f1f5f9;">
        <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Total Days</div>
        <div style="font-size:15px;font-weight:800;color:#2563eb;">${totalDays} Days</div>
      </td>
      <td width="50%" style="padding:16px 20px;">
        <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Payment Method</div>
        <div style="font-size:13px;font-weight:700;color:#374151;">${fmtPayment(paymentMethod)}</div>
      </td>
    </tr>
  </table>
</td></tr>
<tr><td style="padding:0 40px 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #dbeafe;border-radius:10px;">
  <tr><td style="padding:16px 20px;font-size:13px;color:#374151;line-height:1.8;">
    Your <strong>${label} Plan</strong> has been renewed from
    <strong style="color:#1d4ed8;">${fmtDate(periodStart)}</strong> through
    <strong style="color:#1d4ed8;">${fmtDate(activeTo)}</strong>
    &mdash; <strong style="color:#10b981;">${totalDays} days</strong> total.<br/><br/>
    Payment via <strong>${fmtPayment(paymentMethod)}</strong> has been recorded.
    Invoice <strong>${invoiceNumber}</strong> is attached as a PDF.
  </td></tr>
  </table>
</td></tr>
<tr><td style="padding:0 40px 24px;">
  <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:12px 16px;">
    <div style="font-size:12px;font-weight:700;color:#10b981;margin-bottom:3px;">&#128206; PDF Invoice Attached</div>
    <div style="font-size:11px;color:#6b7280;">Invoice <strong>${invoiceNumber}</strong> is attached. Open it in any PDF viewer to print your receipt.</div>
  </div>
</td></tr>
<tr><td style="padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
  <div style="font-size:13px;font-weight:700;color:#1d4ed8;">Novexa ERP</div>
  <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Smart Business Management Platform</div>
  <div style="font-size:10px;color:#d1d5db;margin-top:10px;">Automated email — please do not reply.</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(to right,#1d4ed8,#3b82f6,#f59e0b);"></td></tr>
</table>
</td></tr>
</table>
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

    const { uid, userName, userEmail, plan, billingPeriod,
            paymentMethod, activeFrom, activeTo, renewedAt, periodStart } = body;

    if (!userEmail) return NextResponse.json({ error: "Missing userEmail" }, { status: 400 });
    if (!activeTo)  return NextResponse.json({ error: "Missing activeTo"  }, { status: 400 });

    const gmailUser = process.env.NOVEXA_GMAIL;
    const gmailPass = process.env.NOVEXA_GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass)
      return NextResponse.json({ error: "Gmail not configured." }, { status: 503 });

    const effectivePeriodStart = periodStart || activeFrom || activeTo;
    const invoiceNumber = makeInvoiceNumber(uid, renewedAt);
    const label = planLabel(plan);

    console.log(`[renewal-email] Generating PDF: ${invoiceNumber} for ${userEmail}`);

    // ── Generate PDF ──────────────────────────────────────────────────────
    let pdfBytes;
    try {
      pdfBytes = await buildInvoicePDF({
        invoiceNumber,
        userName:    userName || userEmail,
        userEmail,
        plan,
        billingPeriod,
        paymentMethod,
        periodStart: effectivePeriodStart,
        activeTo,
        renewedAt,
      });
      console.log(`[renewal-email] PDF OK, ${pdfBytes.length} bytes`);
    } catch (pdfErr) {
      console.error("[renewal-email] PDF failed:", pdfErr.message);
      return NextResponse.json({ error: `PDF error: ${pdfErr.message}` }, { status: 500 });
    }

    // ── Build email ───────────────────────────────────────────────────────
    const html = buildRenewalEmailHTML({
      userName:    userName || userEmail,
      plan,
      billingPeriod,
      paymentMethod,
      periodStart: effectivePeriodStart,
      activeTo,
      renewedAt,
      invoiceNumber,
    });

    // ── Send ──────────────────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    console.log(`[renewal-email] Sending to ${userEmail}...`);
    try {
      await transporter.sendMail({
        from:    `"Novexa ERP" <${gmailUser}>`,
        to:      userEmail,
        subject: `Your ${label} Plan Has Been Renewed - Invoice ${invoiceNumber}`,
        html,
        attachments: [{
          filename:    `${invoiceNumber}.pdf`,
          content:     Buffer.from(pdfBytes),
          contentType: "application/pdf",
        }],
      });
    } catch (mailErr) {
      console.error("[renewal-email] sendMail failed:", mailErr.message);
      return NextResponse.json({ error: `Email failed: ${mailErr.message}` }, { status: 500 });
    }

    console.log(`[renewal-email] Sent successfully: ${invoiceNumber}`);
    return NextResponse.json({ success: true, invoiceNumber });

  } catch (err) {
    console.error("[renewal-email] Unexpected error:", err.message, err.stack);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
