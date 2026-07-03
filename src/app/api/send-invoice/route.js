import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminDb } from "@/lib/firebaseAdmin";

// ── helpers ──────────────────────────────────────────────────────────────────
function formatRs(n) {
  if (!n && n !== 0) return "Rs. 0";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}
function fmtDate(str) {
  if (!str) return "—";
  try {
    return new Date(str).toLocaleDateString("en-PK", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return str; }
}
function InvoiceNumber(id) {
  return "INV-" + (id || "").slice(-6).toUpperCase();
}
const STATUS_META = {
  Paid:    { color: "#16a34a", bg: "#dcfce7", label: "PAID" },
  Unpaid:  { color: "#dc2626", bg: "#fee2e2", label: "UNPAID" },
  Partial: { color: "#d97706", bg: "#fef3c7", label: "PARTIAL" },
  Pending: { color: "#dc2626", bg: "#fee2e2", label: "PENDING" },
};

// ── helpers ── date+time formatting ──────────────────────────────────────────
function fmtDateTime(str) {
  if (!str) return "—";
  try {
    return new Date(str).toLocaleString("en-PK", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return str; }
}

// ── Customer Invoice HTML email ───────────────────────────────────────────────
function buildInvoiceEmailHTML({ invoice, userDoc, isUpdate }) {
  const invNum        = InvoiceNumber(invoice.id);
  const status        = invoice.status || "Unpaid";
  const sm            = STATUS_META[status] || STATUS_META.Unpaid;
  const bizName       = userDoc?.business || userDoc?.name || "Business";
  const bizEmail      = userDoc?.email || "";
  const bizPhone      = userDoc?.phone || "";
  const bizAddr       = userDoc?.address || "";
  const subtotal      = Number(invoice.subtotal)   || 0;
  const discount      = Number(invoice.discount)   || 0;
  const afterDiscount = Number(invoice.amount)     || 0;
  const amountPaid    = Number(invoice.amountPaid) || 0;
  const goodsReturn   = Number(invoice.goodsReturn) || 0;
  const balance       = Number(invoice.balance)    || 0;

  // Separate previous balance row from regular items
  const allItems = invoice.items || [];
  const prevBalItem = allItems.find(it => (it.description || "").startsWith("Previous Balance · INV-"));
  const items = allItems.filter(it => !(it.description || "").startsWith("Previous Balance · INV-"));

  // Previous balance row (orange, italic — same style as PDF)
  const prevBalRow = prevBalItem ? `
    <tr style="background:#fffbeb;">
      <td style="padding:12px 16px;font-size:14px;color:#d97706;font-style:italic;font-weight:600;border-bottom:1px solid #e5e7eb;">
        ${prevBalItem.description}
      </td>
      <td style="padding:12px 16px;text-align:center;font-size:14px;color:#9ca3af;border-bottom:1px solid #e5e7eb;">—</td>
      <td style="padding:12px 16px;text-align:right;font-size:14px;color:#9ca3af;border-bottom:1px solid #e5e7eb;">—</td>
      <td style="padding:12px 16px;text-align:right;font-size:14px;font-weight:700;color:#d97706;border-bottom:1px solid #e5e7eb;">${formatRs(prevBalItem.unitPrice || prevBalItem.total)}</td>
    </tr>` : "";

  const itemRows = items.map((it, i) => `
    <tr style="background:${i % 2 === 0 ? "#f8faff" : "#ffffff"};">
      <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">
        ${it.description || "—"}
        ${it.variantLabel ? `<span style="display:block;font-size:11px;color:#9ca3af;margin-top:2px;">${it.variantLabel}</span>` : ""}
      </td>
      <td style="padding:12px 16px;text-align:center;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">${it.qty}</td>
      <td style="padding:12px 16px;text-align:right;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">${formatRs(it.unitPrice)}</td>
      <td style="padding:12px 16px;text-align:right;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;">${formatRs((Number(it.qty)||0)*(Number(it.unitPrice)||0))}</td>
    </tr>`).join("");

  // Payment history rows
  const payments = invoice.payments || [];
  const paymentHistorySection = payments.length > 0 ? `
  <tr><td style="padding:24px 40px 8px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">Payment History</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
      <thead><tr style="background:linear-gradient(to right,#16a34a,#22c55e);">
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;">Date &amp; Time</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Method</th>
        <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Amount Paid</th>
        <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Balance After</th>
      </tr></thead>
      <tbody>
        ${payments.map((p, i) => `
        <tr style="background:${i % 2 === 0 ? "#f0fdf4" : "#ffffff"};">
          <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${fmtDateTime(p.date || p.paidAt || p.createdAt)}</td>
          <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${p.method || p.paymentMethod || "—"}</td>
          <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;color:#16a34a;border-bottom:1px solid #e5e7eb;">${formatRs(p.amount)}</td>
          <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;color:#dc2626;border-bottom:1px solid #e5e7eb;">${formatRs(p.balanceAfter)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </td></tr>` : "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Invoice ${invNum}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="height:6px;background:linear-gradient(to right,#1d4ed8,#3b82f6,#f59e0b);"></td></tr>
<tr><td style="padding:36px 40px 28px;background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#2563eb 100%);">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>
      <div style="color:#bfdbfe;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">${isUpdate ? "Updated Invoice from" : "Invoice from"}</div>
      <div style="color:#fff;font-size:24px;font-weight:800;">${bizName}</div>
      ${bizAddr  ? `<div style="color:#93c5fd;font-size:13px;margin-top:4px;">${bizAddr}</div>`  : ""}
      ${bizPhone ? `<div style="color:#93c5fd;font-size:13px;">${bizPhone}</div>`                : ""}
      ${bizEmail ? `<div style="color:#93c5fd;font-size:13px;">${bizEmail}</div>`                : ""}
    </td>
    <td align="right" valign="top">
      <div style="font-size:32px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1;">INVOICE</div>
      <div style="color:#93c5fd;font-size:14px;font-weight:600;margin-top:4px;">${invNum}</div>
      ${isUpdate ? `<div style="margin-top:6px;display:inline-block;padding:3px 10px;background:rgba(255,255,255,0.2);border-radius:20px;font-size:10px;color:#fff;font-weight:600;">🔄 UPDATED</div>` : ""}
      <div style="margin-top:8px;display:inline-block;padding:5px 14px;background:${sm.bg};color:${sm.color};border-radius:20px;font-size:11px;font-weight:700;">● ${sm.label}</div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 40px;border-bottom:1px solid #e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="55%" valign="top">
      <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Bill To</div>
      <div style="font-size:17px;font-weight:700;color:#111827;">${invoice.customerName || invoice.customer || "—"}</div>
      ${invoice.address ? `<div style="font-size:13px;color:#6b7280;margin-top:3px;">${invoice.address}</div>` : ""}
      ${invoice.phone   ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">📞 ${invoice.phone}</div>`   : ""}
      ${invoice.email   ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">✉️ ${invoice.email}</div>`   : ""}
    </td>
    <td width="45%" align="right" valign="top">
      <table cellpadding="0" cellspacing="0" align="right">
        <tr><td style="padding:4px 0;font-size:12px;"><span style="color:#9ca3af;">Invoice Date: </span><span style="font-weight:600;color:#374151;">${fmtDate(invoice.invoiceDate)}</span></td></tr>
        ${invoice.dueDate ? `<tr><td style="padding:4px 0;font-size:12px;"><span style="color:#9ca3af;">Due Date: </span><span style="font-weight:600;color:#dc2626;">${fmtDate(invoice.dueDate)}</span></td></tr>` : ""}
      </table>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:24px 40px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
    <thead><tr style="background:linear-gradient(to right,#1d4ed8,#2563eb);">
      <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;">Description</th>
      <th style="padding:12px 16px;text-align:center;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;width:60px;">Qty</th>
      <th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Unit Price</th>
      <th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Total</th>
    </tr></thead>
    <tbody>${prevBalRow}${itemRows || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;">No items</td></tr>`}</tbody>
  </table>
</td></tr>
<tr><td style="padding:0 40px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td width="55%"></td><td width="45%">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e5e7eb;padding-top:16px;">
      <tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Subtotal</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#374151;">${formatRs(subtotal)}</td></tr>
      ${discount > 0 ? `<tr><td style="padding:6px 0;font-size:13px;color:#16a34a;">Discount</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#16a34a;">− ${formatRs(discount)}</td></tr>` : ""}
      <tr style="border-top:1px solid #e5e7eb;"><td style="padding:10px 0 6px;font-size:14px;font-weight:700;color:#111827;">Total</td><td style="padding:10px 0 6px;text-align:right;font-size:14px;font-weight:700;color:#1d4ed8;">${formatRs(afterDiscount)}</td></tr>
      ${amountPaid > 0 ? `<tr><td style="padding:6px 0;font-size:13px;color:#16a34a;">Amount Paid</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#16a34a;">${formatRs(amountPaid)}</td></tr>` : ""}
      ${goodsReturn > 0 ? `<tr><td style="padding:6px 0;font-size:13px;color:#dc2626;">Goods Return</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#dc2626;">− ${formatRs(goodsReturn)}</td></tr>` : ""}
      <tr><td colspan="2" style="padding-top:6px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:${sm.bg};border-radius:8px;"><tr>
        <td style="padding:12px 14px;font-size:15px;font-weight:800;color:${sm.color};">Balance Due</td>
        <td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:800;color:${sm.color};">${formatRs(balance)}</td>
      </tr></table></td></tr>
    </table>
  </td></tr></table>
</td></tr>
${paymentHistorySection}
${invoice.note ? `<tr><td style="padding:0 40px 28px;"><div style="background:#f8faff;border-left:4px solid #3b82f6;border-radius:6px;padding:14px 16px;"><div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Note</div><div style="font-size:13px;color:#374151;">${invoice.note}</div></div></td></tr>` : ""}
<tr><td style="padding:20px 40px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-top:1px solid #e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><div style="font-size:14px;font-weight:700;color:#1d4ed8;">📎 Invoice PDF Attached</div><div style="font-size:12px;color:#6b7280;margin-top:4px;">Your invoice is attached as a PDF.</div></td>
    <td align="right"><div style="padding:8px 18px;background:${status==="Paid"?"#dcfce7":"#1d4ed8"};color:${status==="Paid"?"#16a34a":"#fff"};border-radius:8px;font-size:13px;font-weight:700;white-space:nowrap;">${status==="Paid"?"✓ Fully Paid":`Balance: ${formatRs(balance)}`}</div></td>
  </tr></table>
</td></tr>
<tr><td style="padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
  <div style="font-size:13px;font-weight:700;color:#1d4ed8;margin-bottom:4px;">${bizName}</div>
  ${bizEmail ? `<div style="font-size:12px;color:#9ca3af;">${bizEmail}</div>` : ""}
  ${bizPhone ? `<div style="font-size:12px;color:#9ca3af;">${bizPhone}</div>` : ""}
  <div style="margin-top:14px;font-size:11px;color:#d1d5db;">Powered by <strong>Novexa</strong> — Smart Business Management</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(to right,#1d4ed8,#3b82f6,#f59e0b);"></td></tr>
</table></td></tr></table></body></html>`;
}

// ── Supplier Purchase Order HTML email ────────────────────────────────────────
function buildSupplierOrderEmailHTML({ order, supplier, userDoc, isUpdate }) {
  const poNum    = "PO-" + (order.id || "").slice(-4).toUpperCase();
  const status   = order.status || "Pending";
  const sm       = STATUS_META[status] || STATUS_META.Pending;
  const bizName  = userDoc?.business || userDoc?.name || "Business";
  const bizEmail = userDoc?.email || "";
  const bizPhone = userDoc?.phone || "";
  const bizAddr  = userDoc?.address || "";
  const VTYPES   = { kg:"kg", meter:"mtr", liter:"ltr", length:"ft", piece:"pcs" };

  function effQty(it) {
    if (!it.hasVariant || !it.variantType || it.variantType === "none") return Number(it.qty) || 1;
    return (Number(it.variantQty) || 0) * (Number(it.qty) || 1);
  }
  function qtyLabel(it) {
    if (!it.hasVariant || !it.variantType || it.variantType === "none") return `${it.qty || 1} pcs`;
    return `${effQty(it)} ${VTYPES[it.variantType] || it.variantType}`;
  }

  const items = order.items || [];
  const itemRows = items.map((it, i) => {
    const lineTotal = effQty(it) * (Number(it.unitPrice) || 0);
    return `<tr style="background:${i % 2 === 0 ? "#fffbeb" : "#ffffff"};">
      <td style="padding:11px 14px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">
        ${it.description || "—"}
        ${it.hasVariant && it.variantType && it.variantType !== "none"
          ? `<span style="display:block;font-size:11px;color:#9ca3af;margin-top:2px;">${it.variantQty} ${VTYPES[it.variantType]||it.variantType} × ${it.qty} units</span>` : ""}
      </td>
      <td style="padding:11px 14px;text-align:center;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${qtyLabel(it)}</td>
      <td style="padding:11px 14px;text-align:right;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${formatRs(it.unitPrice)}</td>
      <td style="padding:11px 14px;text-align:right;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;">${formatRs(lineTotal)}</td>
    </tr>`;
  }).join("");

  const origSubtotal = items.reduce((s, it) => s + effQty(it) * (Number(it.unitPrice) || 0), 0);
  const discountVal  = order.discountType === "percent"
    ? origSubtotal * (Number(order.discountValue) || 0) / 100
    : (Number(order.discountValue) || 0);
  const totalAmount  = Number(order.totalAmount) || Math.max(origSubtotal - discountVal, 0);
  const paidAmount   = Number(order.paidAmount)  || 0;
  const balance      = Number(order.balance)     != null ? Number(order.balance) : Math.max(totalAmount - paidAmount, 0);
  const supName      = supplier?.name  || order.supplierName  || order.customerName || "Supplier";
  const supPhone     = supplier?.phone || order.phone || "";
  const supEmail     = supplier?.email || order.email || "";
  const supCity      = supplier?.city  || "";
  const supShop      = supplier?.shopName || "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Purchase Order ${poNum}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;"><tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="height:6px;background:linear-gradient(to right,#f59e0b,#d97706,#92400e);"></td></tr>
<tr><td style="padding:36px 40px 28px;background:linear-gradient(135deg,#92400e 0%,#d97706 60%,#f59e0b 100%);">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>
      <div style="color:#fef3c7;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">${isUpdate ? "Updated Purchase Order from" : "Purchase Order from"}</div>
      <div style="color:#fff;font-size:24px;font-weight:800;">${bizName}</div>
      ${bizAddr  ? `<div style="color:#fde68a;font-size:13px;margin-top:4px;">${bizAddr}</div>`  : ""}
      ${bizPhone ? `<div style="color:#fde68a;font-size:13px;">${bizPhone}</div>`                : ""}
      ${bizEmail ? `<div style="color:#fde68a;font-size:13px;">${bizEmail}</div>`                : ""}
    </td>
    <td align="right" valign="top">
      <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1;">PURCHASE ORDER</div>
      <div style="color:#fde68a;font-size:14px;font-weight:600;margin-top:4px;">${poNum}</div>
      ${isUpdate ? `<div style="margin-top:6px;display:inline-block;padding:3px 10px;background:rgba(255,255,255,0.2);border-radius:20px;font-size:10px;color:#fff;font-weight:600;">🔄 UPDATED</div>` : ""}
      <div style="margin-top:8px;display:inline-block;padding:5px 14px;background:${sm.bg};color:${sm.color};border-radius:20px;font-size:11px;font-weight:700;">● ${sm.label}</div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 40px;border-bottom:1px solid #e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="55%" valign="top">
      <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">Supplier</div>
      <div style="font-size:17px;font-weight:700;color:#111827;">${supName}</div>
      ${supShop  ? `<div style="font-size:13px;color:#d97706;font-weight:600;margin-top:2px;">${supShop}</div>`  : ""}
      ${supPhone ? `<div style="font-size:13px;color:#6b7280;margin-top:3px;">📞 ${supPhone}</div>`              : ""}
      ${supEmail ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">✉️ ${supEmail}</div>`              : ""}
      ${supCity  ? `<div style="font-size:13px;color:#6b7280;margin-top:2px;">📍 ${supCity}</div>`               : ""}
    </td>
    <td width="45%" align="right" valign="top">
      <table cellpadding="0" cellspacing="0" align="right">
        <tr><td style="padding:4px 0;font-size:12px;"><span style="color:#9ca3af;">Order Date: </span><span style="font-weight:600;color:#374151;">${fmtDate(order.orderDate || order.createdAt)}</span></td></tr>
        ${order.dueDate ? `<tr><td style="padding:4px 0;font-size:12px;"><span style="color:#9ca3af;">Due Date: </span><span style="font-weight:600;color:#dc2626;">${fmtDate(order.dueDate)}</span></td></tr>` : ""}
        <tr><td style="padding:4px 0;font-size:12px;"><span style="color:#9ca3af;">Reference: </span><span style="font-weight:600;color:#374151;">${poNum}</span></td></tr>
      </table>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:24px 40px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
    <thead><tr style="background:linear-gradient(to right,#d97706,#f59e0b);">
      <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;">Item / Description</th>
      <th style="padding:12px 14px;text-align:center;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;width:70px;">Qty</th>
      <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Unit Price</th>
      <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Total</th>
    </tr></thead>
    <tbody>${itemRows || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;">No items</td></tr>`}</tbody>
  </table>
</td></tr>
<tr><td style="padding:0 40px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td width="55%"></td><td width="45%">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e5e7eb;padding-top:16px;">
      <tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Subtotal</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#374151;">${formatRs(origSubtotal)}</td></tr>
      ${discountVal > 0 ? `<tr><td style="padding:6px 0;font-size:13px;color:#16a34a;">Discount</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#16a34a;">− ${formatRs(discountVal)}</td></tr>` : ""}
      <tr style="border-top:1px solid #e5e7eb;"><td style="padding:10px 0 6px;font-size:14px;font-weight:700;color:#111827;">Order Total</td><td style="padding:10px 0 6px;text-align:right;font-size:14px;font-weight:700;color:#d97706;">${formatRs(totalAmount)}</td></tr>
      ${paidAmount > 0 ? `<tr><td style="padding:6px 0;font-size:13px;color:#16a34a;">Amount Paid</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#16a34a;">− ${formatRs(paidAmount)}</td></tr>` : ""}
      <tr><td colspan="2" style="padding-top:6px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:${sm.bg};border-radius:8px;"><tr>
        <td style="padding:12px 14px;font-size:15px;font-weight:800;color:${sm.color};">Balance Payable</td>
        <td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:800;color:${sm.color};">${formatRs(balance)}</td>
      </tr></table></td></tr>
    </table>
  </td></tr></table>
</td></tr>
${order.note ? `<tr><td style="padding:0 40px 28px;"><div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 16px;"><div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:4px;">Note / Remarks</div><div style="font-size:13px;color:#374151;">${order.note}</div></div></td></tr>` : ""}
<tr><td style="padding:20px 40px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border-top:1px solid #e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><div style="font-size:14px;font-weight:700;color:#d97706;">📎 Purchase Order PDF Attached</div><div style="font-size:12px;color:#6b7280;margin-top:4px;">Please review the attached PO and confirm accordingly.</div></td>
    <td align="right"><div style="padding:8px 18px;background:${status==="Paid"?"#dcfce7":"#d97706"};color:${status==="Paid"?"#16a34a":"#fff"};border-radius:8px;font-size:13px;font-weight:700;white-space:nowrap;">${status==="Paid"?"✓ Fully Paid":`Balance: ${formatRs(balance)}`}</div></td>
  </tr></table>
</td></tr>
<tr><td style="padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
  <div style="font-size:13px;font-weight:700;color:#d97706;margin-bottom:4px;">${bizName}</div>
  ${bizEmail ? `<div style="font-size:12px;color:#9ca3af;">${bizEmail}</div>` : ""}
  ${bizPhone ? `<div style="font-size:12px;color:#9ca3af;">${bizPhone}</div>` : ""}
  <div style="margin-top:14px;font-size:11px;color:#d1d5db;">Powered by <strong>Novexa</strong> — Smart Business Management</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(to right,#f59e0b,#d97706,#92400e);"></td></tr>
</table></td></tr></table></body></html>`;
}

// ── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json();
    const { invoice, userDoc, pdfBase64, uid, isSupplierOrder, supplier, isUpdate } = body;

    if (!invoice?.email) {
      return NextResponse.json(
        { error: "Customer email is required to send invoice." },
        { status: 400 }
      );
    }
    if (!uid) {
      return NextResponse.json({ error: "User ID (uid) is required." }, { status: 400 });
    }

    // ── Fetch sender Gmail credentials from Firestore ─────────────────────
    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const userData  = userSnap.data();
    const gmailUser = userData?.gmailSender;
    const gmailPass = userData?.gmailAppPassword;

    if (userData?.emailFeatureEnabled === false) {
      return NextResponse.json(
        { error: "Email feature is disabled for your account. Contact your administrator." },
        { status: 403 }
      );
    }
    if (!gmailUser || !gmailPass) {
      return NextResponse.json(
        { error: "Gmail sender not configured. Please set up your Gmail in Settings → Email Setup." },
        { status: 503 }
      );
    }

    // ── Nodemailer transporter ────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    const bizName  = userDoc?.business || userDoc?.name || userData?.business || userData?.name || gmailUser;
    const mergedUserDoc = { ...userData, ...userDoc };

    // ── Build email HTML based on type ───────────────────────────────────
    let htmlBody, subject, pdfFilename;

    if (isSupplierOrder) {
      const poNum   = "PO-" + (invoice.id || "").slice(-4).toUpperCase();
      htmlBody      = buildSupplierOrderEmailHTML({ order: invoice, supplier, userDoc: mergedUserDoc, isUpdate: !!isUpdate });
      subject       = isUpdate
        ? `Purchase Order ${poNum} Updated — ${bizName}`
        : `New Purchase Order ${poNum} from ${bizName}`;
      pdfFilename   = `${poNum}.pdf`;
    } else {
      const invNum  = InvoiceNumber(invoice.id);
      htmlBody      = buildInvoiceEmailHTML({ invoice, userDoc: mergedUserDoc, isUpdate: !!isUpdate });
      subject       = isUpdate
        ? `Invoice ${invNum} Updated — ${bizName}`
        : `Invoice ${invNum} from ${bizName}`;
      pdfFilename   = `${invNum}.pdf`;
    }

    const mailOptions = {
      from:    `"${bizName}" <${gmailUser}>`,
      to:      invoice.email,
      subject,
      html:    htmlBody,
    };

    if (pdfBase64) {
      mailOptions.attachments = [{
        filename:    pdfFilename,
        content:     Buffer.from(pdfBase64, "base64"),
        contentType: "application/pdf",
      }];
    }

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[send-invoice] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send email." },
      { status: 500 }
    );
  }
}
