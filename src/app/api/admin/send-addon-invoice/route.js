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
  try { return new Date(str).toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return str; }
}
function fmtDateShort(str) {
  if (!str) return "—";
  try { return new Date(str).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return str; }
}
function fmtPayment(m) {
  if (m === "online") return "Online (Card / Bank Transfer)";
  if (m === "cheque") return "Cheque";
  return "Cash";
}
function makeInvoiceNumber(uid, purchasedAt) {
  const ts = purchasedAt ? new Date(purchasedAt) : new Date();
  const yy = String(ts.getFullYear()).slice(-2);
  const mm = String(ts.getMonth() + 1).padStart(2, "0");
  const dd = String(ts.getDate()).padStart(2, "0");
  return `ADD-${yy}${mm}${dd}-${(uid || "").slice(-4).toUpperCase()}`;
}

const ADDON_LABELS = {
  invoicesPerMonth:            { label: "+Extra Invoices / Month",               icon: "🧾" },
  invoicesPerCustomerPerMonth: { label: "+Extra Invoices per Customer / Month",  icon: "👥" },
  customersPerMonth:           { label: "+Extra Customers / Month",              icon: "👤" },
  suppliersPerMonth:           { label: "+Extra Suppliers / Month",              icon: "🏭" },
  ordersPerSupplierPerMonth:   { label: "+Extra Orders per Supplier / Month",    icon: "🛒" },
};

// ── Build PDF ─────────────────────────────────────────────────────────────────
async function buildAddonInvoicePDF({
  invoiceNumber, userName, userEmail,
  lineItems,      // [{ label, qty, unitPrice, total }]
  grandTotal,
  paymentMethod,
  purchasedAt,
  expiresAt,
}) {
  const doc  = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const W = 595;
  const H = 842;

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);
  const safe = (s) => (s || "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

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
    amberBg: rgb(1.0, 0.980, 0.941),
  };

  // Header
  page.drawRectangle({ x: 0, y: H - 105, width: W, height: 105, color: C.amber });
  page.drawRectangle({ x: 0, y: H - 5,   width: W / 2, height: 5, color: C.blue });
  page.drawRectangle({ x: W / 2, y: H - 5, width: W / 2, height: 5, color: C.amber });

  page.drawText("INVOICE",           { x: 40, y: H - 42, size: 26, font: bold, color: C.white });
  page.drawText("Novexa ERP",        { x: 40, y: H - 68, size: 13, font: bold, color: C.white });
  page.drawText("Add-on Quota Invoice", { x: 40, y: H - 84, size: 9, font: reg, color: rgb(1, 0.94, 0.8) });

  const invRight = W - bold.widthOfTextAtSize(invoiceNumber, 12) - 40;
  page.drawText(invoiceNumber, { x: invRight, y: H - 42, size: 12, font: bold, color: C.white });
  page.drawText("ADD-ON INVOICE", { x: W - 40 - reg.widthOfTextAtSize("ADD-ON INVOICE", 8), y: H - 58, size: 8, font: reg, color: rgb(1, 0.94, 0.8) });

  // PAID badge
  page.drawRectangle({ x: W - 100, y: H - 88, width: 62, height: 20, color: C.green });
  page.drawText("PAID", { x: W - 95, y: H - 82, size: 9, font: bold, color: C.white });

  // Bill To
  let y = H - 130;
  page.drawText("BILL TO", { x: 40, y, size: 8, font: bold, color: C.gray });
  y -= 16;
  page.drawText(safe(userName).slice(0, 60),  { x: 40, y, size: 12, font: bold, color: C.dark });
  y -= 15;
  page.drawText(safe(userEmail).slice(0, 70), { x: 40, y, size: 9,  font: reg,  color: C.gray });

  // Right: dates
  const rightX = 350;
  const issuedOn = purchasedAt ? new Date(purchasedAt).toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" }) : fmtDate(new Date().toISOString());
  page.drawText("Invoice Date:", { x: rightX, y: H - 130, size: 8, font: reg,  color: C.gray });
  page.drawText(issuedOn,        { x: rightX + 80, y: H - 130, size: 8, font: bold, color: C.dark });
  page.drawText("Valid Until:",  { x: rightX, y: H - 146, size: 8, font: reg,  color: C.gray });
  page.drawText(fmtDateShort(expiresAt), { x: rightX + 80, y: H - 146, size: 8, font: bold, color: rgb(0.8, 0.4, 0) });
  page.drawText("Payment:",      { x: rightX, y: H - 162, size: 8, font: reg,  color: C.gray });
  page.drawText(fmtPayment(paymentMethod).slice(0, 30), { x: rightX + 80, y: H - 162, size: 8, font: bold, color: C.dark });

  // Divider
  y = H - 190;
  page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 1, color: C.line });

  // Table header
  y -= 2;
  page.drawRectangle({ x: 40, y: y - 22, width: W - 80, height: 24, color: C.amber });
  page.drawText("Description",  { x: 52,       y: y - 15, size: 9, font: bold, color: C.white });
  page.drawText("Qty",          { x: 340,       y: y - 15, size: 9, font: bold, color: C.white });
  page.drawText("Unit Price",   { x: 390,       y: y - 15, size: 9, font: bold, color: C.white });
  page.drawText("Total",        { x: W - 80,    y: y - 15, size: 9, font: bold, color: C.white });
  y -= 26;

  // Table rows
  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    const rowH = 36;
    const bgColor = i % 2 === 0 ? C.amberBg : C.white;
    page.drawRectangle({ x: 40, y: y - rowH, width: W - 80, height: rowH + 2, color: bgColor });
    page.drawText(safe(item.label).slice(0, 60),          { x: 52,   y: y - 14, size: 9,  font: bold, color: C.dark });
    page.drawText(`x${item.qty}`,                          { x: 340,  y: y - 14, size: 9,  font: reg,  color: C.gray });
    page.drawText(`Rs. ${Number(item.unitPrice).toLocaleString("en-PK")}`, { x: 390, y: y - 14, size: 9, font: reg, color: C.dark });
    page.drawText(`Rs. ${Number(item.total).toLocaleString("en-PK")}`,     { x: W - 80, y: y - 14, size: 9, font: bold, color: C.dark });
    page.drawLine({ start: { x: 40, y: y - rowH }, end: { x: W - 40, y: y - rowH }, thickness: 0.5, color: C.line });
    y -= rowH + 2;
  }

  // Totals
  const lx = 360;
  const rx = W - 44;
  y -= 10;
  const totalStr = `Rs. ${Number(grandTotal).toLocaleString("en-PK")}`;
  page.drawLine({ start: { x: lx, y }, end: { x: W - 40, y }, thickness: 0.5, color: C.line });
  y -= 14;
  page.drawText("Total:", { x: lx, y, size: 11, font: bold, color: C.dark });
  page.drawText(totalStr, { x: rx - bold.widthOfTextAtSize(totalStr, 11), y, size: 11, font: bold, color: C.amber });

  y -= 20;
  page.drawRectangle({ x: lx - 8, y: y - 8, width: W - 40 - lx + 8, height: 26, color: C.gbg });
  page.drawText("Amount Paid:", { x: lx, y: y + 4, size: 9, font: bold, color: C.green });
  page.drawText(totalStr, { x: rx - bold.widthOfTextAtSize(totalStr, 9), y: y + 4, size: 9, font: bold, color: C.green });

  // Validity box
  y -= 55;
  page.drawRectangle({ x: 40, y: y - 52, width: W - 80, height: 62, color: C.amberBg });
  page.drawLine({ start: { x: 40, y: y + 8 }, end: { x: 40, y: y - 44 }, thickness: 3, color: C.amber });
  page.drawText("ADD-ON VALIDITY", { x: 52, y: y, size: 7, font: bold, color: C.gray });
  page.drawText(`Purchased On: ${issuedOn}`,              { x: 52, y: y - 16, size: 9, font: reg, color: C.dark });
  page.drawText(`Valid Until:  ${fmtDate(expiresAt)}`,    { x: 52, y: y - 31, size: 9, font: reg, color: rgb(0.8, 0.4, 0) });
  page.drawText("Add-on expires exactly 1 month from purchase date.", { x: 52, y: y - 46, size: 8, font: reg, color: C.gray });

  // Footer
  page.drawLine({ start: { x: 40, y: 68 }, end: { x: W - 40, y: 68 }, thickness: 0.5, color: C.line });
  page.drawText("Novexa ERP - Smart Business Management", { x: 40, y: 50, size: 9, font: bold, color: C.amber });
  page.drawText("This is a computer-generated invoice. No signature required.", { x: 40, y: 34, size: 7, font: reg, color: C.gray });

  page.drawRectangle({ x: 0, y: 0, width: W / 2, height: 4, color: C.blue });
  page.drawRectangle({ x: W / 2, y: 0, width: W / 2, height: 4, color: C.amber });

  return await doc.save();
}

// ── Email HTML ────────────────────────────────────────────────────────────────
function buildAddonEmailHTML({ userName, lineItems, grandTotal, paymentMethod,
                                purchasedAt, expiresAt, invoiceNumber }) {
  const purchasedOn = purchasedAt
    ? new Date(purchasedAt).toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
    : "—";

  const itemRows = lineItems.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? "#fffbeb" : "#fff"};">
      <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">${item.icon || ""} ${item.label}</td>
      <td style="padding:12px 16px;text-align:center;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">×${item.qty}</td>
      <td style="padding:12px 16px;text-align:right;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">Rs. ${Number(item.unitPrice).toLocaleString("en-PK")}</td>
      <td style="padding:12px 16px;text-align:right;font-size:14px;font-weight:700;color:#d97706;border-bottom:1px solid #e5e7eb;">Rs. ${Number(item.total).toLocaleString("en-PK")}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Add-on Invoice — Novexa</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="height:6px;background:linear-gradient(to right,#f59e0b,#fbbf24,#1d4ed8);"></td></tr>
<tr><td style="padding:36px 40px 28px;background:linear-gradient(135deg,#78350f 0%,#92400e 60%,#b45309 100%);">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>
      <div style="color:#fde68a;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Add-on Purchase Confirmation</div>
      <div style="color:#fff;font-size:24px;font-weight:800;">⚡ Extra Quota Activated!</div>
      <div style="color:#fde68a;font-size:13px;margin-top:8px;">Hi <strong style="color:#fff;">${userName}</strong>, your add-on quota is now active.</div>
    </td>
    <td align="right" valign="top" style="padding-left:16px;">
      <div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);font-size:24px;line-height:48px;text-align:center;">⚡</div>
    </td>
  </tr></table>
</td></tr>

<tr><td style="padding:20px 40px 8px;">
  <span style="display:inline-block;padding:5px 14px;border-radius:20px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#d97706;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
    Purchased on ${purchasedOn}
  </span>
</td></tr>

<tr><td style="padding:8px 40px 8px;">
  <div style="padding:14px 18px;border-radius:12px;background:#fffbeb;border:1.5px solid #fde68a;">
    <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">⏰ Validity Period</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;">
      <div>
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Activated On</div>
        <div style="font-size:14px;font-weight:800;color:#111827;">${purchasedAt ? new Date(purchasedAt).toLocaleDateString("en-US",{day:"2-digit",month:"long",year:"numeric"}) : "—"}</div>
      </div>
      <div>
        <div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Expires On</div>
        <div style="font-size:14px;font-weight:800;color:#d97706;">${expiresAt ? new Date(expiresAt).toLocaleDateString("en-US",{day:"2-digit",month:"long",year:"numeric"}) : "—"}</div>
      </div>
    </div>
    <div style="margin-top:8px;font-size:12px;color:#6b7280;">Add-on expires exactly 1 month from purchase date. After expiry, plan's default limits apply.</div>
  </div>
</td></tr>

<tr><td style="padding:8px 40px 20px;">
  <div style="font-size:11px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">📋 Add-on Details</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
    <thead><tr style="background:linear-gradient(to right,#d97706,#f59e0b);">
      <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;">Description</th>
      <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;width:50px;">Qty</th>
      <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Unit Price</th>
      <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Total</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
</td></tr>

<tr><td style="padding:0 40px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td width="55%"></td><td width="45%">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #fde68a;padding-top:14px;">
      <tr style="border-top:1px solid #fde68a;"><td style="padding:10px 0 6px;font-size:14px;font-weight:700;color:#111827;">Total</td><td style="padding:10px 0 6px;text-align:right;font-size:14px;font-weight:700;color:#d97706;">Rs. ${Number(grandTotal).toLocaleString("en-PK")}</td></tr>
      <tr><td colspan="2" style="padding-top:8px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
          <tr><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#16a34a;">✓ Amount Paid (${fmtPayment(paymentMethod)})</td>
              <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:700;color:#16a34a;">Rs. ${Number(grandTotal).toLocaleString("en-PK")}</td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr></table>
</td></tr>

<tr><td style="padding:0 40px 24px;">
  <div style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:8px;padding:12px 16px;">
    <div style="font-size:12px;font-weight:700;color:#d97706;margin-bottom:3px;">📎 PDF Invoice Attached</div>
    <div style="font-size:11px;color:#6b7280;">Invoice <strong>${invoiceNumber}</strong> is attached as a PDF. Open it in any PDF viewer to print your receipt.</div>
  </div>
</td></tr>

<tr><td style="padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
  <div style="font-size:13px;font-weight:700;color:#d97706;">Novexa ERP</div>
  <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Smart Business Management Platform</div>
  <div style="font-size:10px;color:#d1d5db;margin-top:10px;">Automated email — please do not reply.</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(to right,#f59e0b,#fbbf24,#1d4ed8);"></td></tr>
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

    const { uid, userName, userEmail, lineItems, grandTotal,
            paymentMethod, purchasedAt, expiresAt } = body;

    if (!userEmail)   return NextResponse.json({ error: "Missing userEmail"  }, { status: 400 });
    if (!lineItems?.length) return NextResponse.json({ error: "Missing lineItems" }, { status: 400 });

    const gmailUser = process.env.NOVEXA_GMAIL;
    const gmailPass = process.env.NOVEXA_GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass)
      return NextResponse.json({ error: "Gmail not configured." }, { status: 503 });

    const invoiceNumber = makeInvoiceNumber(uid, purchasedAt);

    console.log(`[addon-invoice] Generating PDF: ${invoiceNumber} for ${userEmail}`);

    let pdfBytes;
    try {
      pdfBytes = await buildAddonInvoicePDF({
        invoiceNumber,
        userName:    userName || userEmail,
        userEmail,
        lineItems,
        grandTotal,
        paymentMethod,
        purchasedAt,
        expiresAt,
      });
      console.log(`[addon-invoice] PDF OK, ${pdfBytes.length} bytes`);
    } catch (pdfErr) {
      console.error("[addon-invoice] PDF failed:", pdfErr.message);
      return NextResponse.json({ error: `PDF error: ${pdfErr.message}` }, { status: 500 });
    }

    const html = buildAddonEmailHTML({
      userName:    userName || userEmail,
      lineItems,
      grandTotal,
      paymentMethod,
      purchasedAt,
      expiresAt,
      invoiceNumber,
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    console.log(`[addon-invoice] Sending to ${userEmail}...`);
    try {
      await transporter.sendMail({
        from:    `"Novexa ERP" <${gmailUser}>`,
        to:      userEmail,
        subject: `Add-on Quota Activated — Invoice ${invoiceNumber}`,
        html,
        attachments: [{
          filename:    `${invoiceNumber}.pdf`,
          content:     Buffer.from(pdfBytes),
          contentType: "application/pdf",
        }],
      });
    } catch (mailErr) {
      console.error("[addon-invoice] sendMail failed:", mailErr.message);
      return NextResponse.json({ error: `Email failed: ${mailErr.message}` }, { status: 500 });
    }

    console.log(`[addon-invoice] Sent successfully: ${invoiceNumber}`);
    return NextResponse.json({ success: true, invoiceNumber });

  } catch (err) {
    console.error("[addon-invoice] Unexpected error:", err.message, err.stack);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
