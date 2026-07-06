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
    if (typeof str?.toDate === "function") return str.toDate().toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" });
    const secs = str?._seconds ?? str?.seconds;
    if (secs != null) return new Date(secs * 1000).toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" });
    const d = new Date(str);
    if (!isNaN(d)) return d.toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" });
    return "—";
  } catch { return String(str); }
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
    if (typeof str?.toDate === "function") return str.toDate().toLocaleString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", hour12:true });
    const secs = str?._seconds ?? str?.seconds;
    if (secs != null) return new Date(secs * 1000).toLocaleString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", hour12:true });
    const d = new Date(str);
    if (!isNaN(d)) return d.toLocaleString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", hour12:true });
    return "—";
  } catch { return String(str); }
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
  const amountPaid      = Number(invoice.amountPaid)     || 0;
  // Calculate goodsReturn from payments array (return records) — same as PDF
  const allPayments     = invoice.payments || [];
  const returnRecords   = allPayments.filter(p => p.type === "return");
  const paymentRecords  = allPayments.filter(p => p.type === "received" || (p.type !== "purchase" && p.type !== "return"));
  const goodsReturn     = returnRecords.reduce((s, p) => s + (Number(p.returnAmount) || 0), 0);
  // Previous balance — DISPLAY ONLY, never added to calculations
  // _resolvedPrevBalance = live sum of all other customer invoices' outstanding balance
  // This is always shown in the email so the customer knows their total outstanding position
  const allItems        = invoice.items || [];
  const prevBalItem     = allItems.find(it => (it.description || "").startsWith("Previous Balance"));
  // Always use the live-resolved server value (sum of other invoices' balances).
  // Fall back to stored item value only if server resolve didn't run.
  const prevCarryAmount = invoice._resolvedPrevBalance != null
    ? Number(invoice._resolvedPrevBalance)
    : (prevBalItem ? (Number(prevBalItem.unitPrice) || Number(prevBalItem.total) || 0) : 0);
  // Current invoice real items only (excluding any stored previous balance carry-forward row)
  const currentItems    = allItems.filter(it => !(it.description || "").startsWith("Previous Balance"));
  // Subtotal = only real items (NO previous balance)
  const subtotal        = currentItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
  const discount        = Number(invoice.discount) || 0;
  const afterDiscount   = subtotal > 0
    ? (invoice.discountType === "percent"
        ? Math.max(subtotal - subtotal * (Number(invoice.discountValue) || 0) / 100, 0)
        : Math.max(subtotal - discount, 0))
    : (Number(invoice.amount) || 0);
  // Balance = ONLY current invoice — previous balance NOT included anywhere
  const balance         = Math.max(0, afterDiscount - amountPaid - goodsReturn);
  // totalBalance = same as balance (prev balance is display-only, not added)
  const totalBalance    = balance;

  // Separate previous balance row from regular items (currentItems already computed above)
  const items = currentItems;

  // Previous balance row (orange, italic — shows customer's total outstanding from all other invoices)
  // Only shown when prevCarryAmount > 0 (display only, never affects any totals)
  const prevBalRow = prevCarryAmount > 0 ? `
    <tr style="background:#fffbeb;">
      <td style="padding:12px 16px;font-size:14px;color:#d97706;font-style:italic;font-weight:600;border-bottom:1px solid #e5e7eb;">
        Previous Balance
      </td>
      <td style="padding:12px 16px;text-align:center;font-size:14px;color:#9ca3af;border-bottom:1px solid #e5e7eb;">—</td>
      <td style="padding:12px 16px;text-align:right;font-size:14px;color:#9ca3af;border-bottom:1px solid #e5e7eb;">—</td>
      <td style="padding:12px 16px;text-align:right;font-size:14px;font-weight:700;color:#d97706;border-bottom:1px solid #e5e7eb;">${formatRs(prevCarryAmount)}</td>
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
  const payments = paymentRecords;
  const hasReceivedBy = payments.some(p => p.receiverName && p.receiverName.trim());
  const hasPaidBy     = payments.some(p => p.payerName   && p.payerName.trim());
  const paymentHistorySection = payments.length > 0 ? `
  <tr><td style="padding:24px 40px 8px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">Payment History</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
      <thead><tr style="background:linear-gradient(to right,#16a34a,#22c55e);">
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;">Date &amp; Time</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Method</th>
        <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Amount Paid</th>
        <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Balance After</th>
        ${hasPaidBy     ? `<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Paid By</th>`      : ""}
        ${hasReceivedBy ? `<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Received By</th>` : ""}
      </tr></thead>
      <tbody>
        ${payments.map((p, i) => `
        <tr style="background:${i % 2 === 0 ? "#f0fdf4" : "#ffffff"};">
          <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${fmtDateTime(p.date || p.paidAt || p.createdAt)}</td>
          <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${p.method || p.paymentMethod || "—"}</td>
          <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;color:#16a34a;border-bottom:1px solid #e5e7eb;">${formatRs(p.paid ?? p.amount)}</td>
          <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;color:#dc2626;border-bottom:1px solid #e5e7eb;">${formatRs(p.balance ?? p.balanceAfter)}</td>
          ${hasPaidBy     ? `<td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${p.payerName    || "—"}</td>` : ""}
          ${hasReceivedBy ? `<td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${p.receiverName || "—"}</td>` : ""}
        </tr>`).join("")}
      </tbody>
    </table>
  </td></tr>` : "";

  // Goods Return History section
  const returnHistorySection = returnRecords.length > 0 ? `
  <tr><td style="padding:8px 40px 24px;">
    <div style="font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">Goods Return History</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #fecaca;">
      <thead><tr style="background:linear-gradient(to right,#dc2626,#ef4444);">
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;">Date &amp; Time</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Item</th>
        <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Qty</th>
        <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Rate</th>
        <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;">Return Amount</th>
      </tr></thead>
      <tbody>
        ${returnRecords.map((p, i) => `
        <tr style="background:${i % 2 === 0 ? "#fef2f2" : "#ffffff"};">
          <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #fecaca;">${fmtDateTime(p.date || p.createdAt)}</td>
          <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #fecaca;">${p.description || "—"}</td>
          <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;color:#dc2626;border-bottom:1px solid #fecaca;">${p.qty || "—"}</td>
          <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;color:#dc2626;border-bottom:1px solid #fecaca;">${formatRs(p.rate)}</td>
          <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:700;color:#dc2626;border-bottom:1px solid #fecaca;">− ${formatRs(p.returnAmount)}</td>
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
      ${amountPaid > 0 ? `
      ${payments.length > 1
        ? payments.map(p => `<tr><td style="padding:4px 0;font-size:13px;color:#16a34a;">Amount Paid (${fmtDate(p.date || p.paidAt || p.createdAt)})</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#16a34a;">${formatRs(p.paid ?? p.amount)}</td></tr>`).join("")
        : `<tr><td style="padding:6px 0;font-size:13px;color:#16a34a;">Amount Paid</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#16a34a;">${formatRs(amountPaid)}</td></tr>`
      }` : ""}
      ${goodsReturn > 0 ? `<tr><td style="padding:6px 0;font-size:13px;color:#dc2626;">Goods Return</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#dc2626;">− ${formatRs(goodsReturn)}</td></tr>` : ""}
      <tr><td colspan="2" style="padding-top:10px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #dbeafe;border-radius:8px;">
          <tr>
            <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#1d4ed8;">Total Balance</td>
            <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:700;color:#1d4ed8;">${formatRs(balance)}</td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr></table>
</td></tr>
${paymentHistorySection}
${returnHistorySection}
${invoice.note ? `<tr><td style="padding:0 40px 28px;"><div style="background:#f8faff;border-left:4px solid #3b82f6;border-radius:6px;padding:14px 16px;"><div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Note</div><div style="font-size:13px;color:#374151;">${invoice.note}</div></div></td></tr>` : ""}
<tr><td style="padding:20px 40px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-top:1px solid #e5e7eb;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><div style="font-size:14px;font-weight:700;color:#1d4ed8;">📎 Invoice PDF Attached</div><div style="font-size:12px;color:#6b7280;margin-top:4px;">Your invoice is attached as a PDF.</div></td>
    <td align="right"><div style="padding:8px 18px;background:${status==="Paid"?"#dcfce7":"#1d4ed8"};color:${status==="Paid"?"#16a34a":"#fff"};border-radius:8px;font-size:13px;font-weight:700;white-space:nowrap;">${balance === 0 ? "✓ Fully Paid" : `Balance: ${formatRs(balance)}`}</div></td>
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
function buildSupplierOrderEmailHTML({ order, supplier, userDoc, isUpdate, receipts = [], returns = [], payments = [] }) {
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
  function fmtTS(val) {
    if (!val) return "—";
    try {
      // Firestore Timestamp object (client-side, has toDate method)
      if (typeof val?.toDate === "function") return val.toDate().toLocaleString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", hour12:true });
      // Firestore serialized: { _seconds } or { seconds } (both forms appear in JSON)
      const secs = val?._seconds ?? val?.seconds;
      if (secs != null) return new Date(secs * 1000).toLocaleString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", hour12:true });
      // ISO string or plain date string
      const d = new Date(val);
      if (!isNaN(d)) return d.toLocaleString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", hour12:true });
      return "—";
    } catch { return "—"; }
  }

  const items = order.items || [];
  // Smart unit price column header
  const variantTypes = [...new Set(items.map(it => it.variantType || "none").filter(v => v !== "none"))];
  const VMAP = { kg:"Per kg", meter:"Per mtr", liter:"Per ltr", length:"Per ft", piece:"Per pcs" };
  const unitPriceHeader = variantTypes.length === 1
    ? (VMAP[variantTypes[0]] || "Unit Price")
    : items.every(it => !it.hasVariant || !it.variantType || it.variantType === "none")
      ? "Per Unit" : "Unit Price";

  const itemRows = items.map((it, i) => {
    const lineTotal = effQty(it) * (Number(it.unitPrice) || 0);
    const isVariant = it.hasVariant && it.variantType && it.variantType !== "none";
    const unitLabel = isVariant ? (VTYPES[it.variantType] || it.variantType) : "unit";
    return `<tr style="background:${i % 2 === 0 ? "#fffbeb" : "#ffffff"};">
      <td style="padding:10px 12px;font-size:11px;color:#4b5563;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${fmtTS(order.createdAt || order.orderDate)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><span style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:9px;font-weight:700;background:#fffbeb;color:#b45309;border:1px solid #fde68a;">Order</span></td>
      <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">
        ${it.description || "—"}
        ${isVariant ? `<span style="display:block;font-size:10px;color:#9ca3af;margin-top:2px;">${it.variantQty} ${unitLabel} × ${it.qty} units</span>` : ""}
      </td>
      <td style="padding:10px 12px;text-align:center;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${qtyLabel(it)}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${isVariant ? `${formatRs(it.unitPrice)}/${unitLabel}` : formatRs(it.unitPrice)}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;">${formatRs(lineTotal)}</td>
    </tr>`;
  }).join("");

  // ── Receipt rows (additional purchases) ──────────────────────────────────
  const receiptRows = (receipts || []).flatMap((r) =>
    (r.items || []).map((it) => {
      const eQty = effQty(it);
      const isVariant = it.hasVariant && it.variantType && it.variantType !== "none";
      const unitLabel = isVariant ? (VTYPES[it.variantType] || it.variantType) : "pcs";
      const tot = eQty * (Number(it.unitPrice) || 0);
      return `<tr style="background:#f0fdf4;">
        <td style="padding:10px 12px;font-size:11px;color:#4b5563;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${fmtTS(r.createdAt)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><span style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:9px;font-weight:700;background:#dcfce7;color:#15803d;border:1px solid #86efac;">Purchased</span></td>
        <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">
          ${it.description || "—"}
          ${isVariant ? `<span style="display:block;font-size:10px;color:#9ca3af;margin-top:2px;">${it.variantQty} ${unitLabel} × ${it.qty} units</span>` : ""}
        </td>
        <td style="padding:10px 12px;text-align:center;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${eQty} ${unitLabel}</td>
        <td style="padding:10px 12px;text-align:right;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${isVariant ? `${formatRs(it.unitPrice)}/${unitLabel}` : formatRs(it.unitPrice)}</td>
        <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:#15803d;border-bottom:1px solid #e5e7eb;">+ ${formatRs(tot)}</td>
      </tr>`;
    })
  ).join("");

  // ── Return rows ───────────────────────────────────────────────────────────
  const returnRows = (returns || []).flatMap((r) =>
    (r.items || []).map((it) => {
      const isVariant = it.variantType && it.variantType !== "none";
      const unit      = isVariant ? (VTYPES[it.variantType] || it.variantType) : "pcs";
      // effectiveQty stored by new modal; fallback to qty for old records
      const eQty      = Number(it.effectiveQty) || (isVariant
        ? (Number(it.variantQty) || 0) * (Number(it.qty) || 0)
        : Number(it.qty) || 0);
      const tot       = eQty * (Number(it.unitPrice) || 0);
      const qtyCell   = isVariant && it.variantQty
        ? `${it.variantQty} ${unit} × ${it.qty} = ${eQty} ${unit}`
        : `${eQty} ${unit}`;
      return `<tr style="background:#fef2f2;">
        <td style="padding:10px 12px;font-size:11px;color:#4b5563;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${fmtTS(r.createdAt)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><span style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:9px;font-weight:700;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;">Return</span></td>
        <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${it.description || "—"}</td>
        <td style="padding:10px 12px;text-align:center;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;">${qtyCell}</td>
        <td style="padding:10px 12px;text-align:right;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;">${isVariant ? `${formatRs(it.unitPrice)}/${unit}` : formatRs(it.unitPrice)}</td>
        <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600;color:#dc2626;border-bottom:1px solid #e5e7eb;">− ${formatRs(tot)}</td>
      </tr>`;
    })
  ).join("");

  const origSubtotal = items.reduce((s, it) => s + effQty(it) * (Number(it.unitPrice) || 0), 0);
  const totalReceipts = (receipts || []).reduce((s, r) =>
    s + (r.items || []).reduce((rs, it) => rs + effQty(it) * (Number(it.unitPrice) || 0), 0), 0);
  const totalReturns = (returns || []).reduce((s, r) =>
    s + (r.items || []).reduce((rs, it) => {
      const eQty = Number(it.effectiveQty) || (it.variantType && it.variantType !== "none"
        ? (Number(it.variantQty) || 0) * (Number(it.qty) || 0)
        : Number(it.qty) || 0);
      return rs + eQty * (Number(it.unitPrice) || 0);
    }, 0), 0);
  const discountVal  = order.discountType === "percent"
    ? origSubtotal * (Number(order.discountValue) || 0) / 100
    : (Number(order.discountValue) || 0);
  // totalAmount = original order amount (frozen) + all additional receipts
  const totalAmount  = (Number(order.totalAmount) || Math.max(origSubtotal - discountVal, 0)) + totalReceipts;
  const paidAmount   = Number(order.paidAmount)  || 0;
  const balance      = Number(order.balance)     != null ? Number(order.balance) : Math.max(totalAmount - paidAmount, 0);
  const supName      = supplier?.name  || order.supplierName  || order.customerName || "Supplier";
  const supPhone     = supplier?.phone || order.phone || "";
  const supEmail     = supplier?.email || order.email || "";
  const supCity      = supplier?.city  || "";
  const supShop      = supplier?.shopName || "";

  // ── Payment history section ─────────────────────────────────────────────
  const hasPaidBy     = (payments || []).some(p => p.payerName?.trim());
  const hasReceivedBy = (payments || []).some(p => p.receiverName?.trim());
  const paymentHistorySection = (payments || []).length > 0 ? `
  <tr><td style="padding:8px 40px 24px;">
    <div style="font-size:11px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">💸 Payment History</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #fde68a;">
      <thead><tr style="background:linear-gradient(to right,#d97706,#f59e0b);">
        <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;">Date &amp; Time</th>
        <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;">Method</th>
        <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;">Amount Paid</th>
        <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;">Balance After</th>
        ${hasPaidBy     ? `<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;">Paid By</th>`      : ""}
        ${hasReceivedBy ? `<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;">Received By</th>` : ""}
      </tr></thead>
      <tbody>
        ${(payments || []).map((p, i) => `
        <tr style="background:${i % 2 === 0 ? "#fffbeb" : "#ffffff"};">
          <td style="padding:10px 12px;font-size:12px;color:#374151;border-bottom:1px solid #fde68a;">${fmtDateTime(p.createdAt || p.payDate)}</td>
          <td style="padding:10px 12px;font-size:12px;color:#374151;border-bottom:1px solid #fde68a;">${p.method || "cash"}</td>
          <td style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#16a34a;border-bottom:1px solid #fde68a;">${formatRs(p.amount)}</td>
          <td style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#dc2626;border-bottom:1px solid #fde68a;">${formatRs(p.balanceAfter ?? p.balance)}</td>
          ${hasPaidBy     ? `<td style="padding:10px 12px;font-size:12px;color:#374151;border-bottom:1px solid #fde68a;">${p.payerName    || "—"}</td>` : ""}
          ${hasReceivedBy ? `<td style="padding:10px 12px;font-size:12px;color:#374151;border-bottom:1px solid #fde68a;">${p.receiverName || "—"}</td>` : ""}
        </tr>`).join("")}
      </tbody>
    </table>
  </td></tr>` : "";

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
      <th style="padding:10px 11px;text-align:left;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;width:115px;">Date &amp; Time</th>
      <th style="padding:10px 11px;text-align:left;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;width:70px;">Type</th>
      <th style="padding:10px 11px;text-align:left;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;">Item / Description</th>
      <th style="padding:10px 11px;text-align:center;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;width:65px;">Qty</th>
      <th style="padding:10px 11px;text-align:right;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;">${unitPriceHeader}</th>
      <th style="padding:10px 11px;text-align:right;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;">Total</th>
    </tr></thead>
    <tbody>${itemRows}${receiptRows}${returnRows}${!itemRows && !receiptRows ? `<tr><td colspan="6" style="padding:16px;text-align:center;color:#9ca3af;">No items</td></tr>` : ""}</tbody>
  </table>
</td></tr>
<tr><td style="padding:0 40px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td width="55%"></td><td width="45%">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e5e7eb;padding-top:16px;">
      <tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Subtotal (Order)</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#374151;">${formatRs(origSubtotal)}</td></tr>
      ${totalReceipts > 0 ? `<tr><td style="padding:3px 0;font-size:13px;color:#15803d;">+ Additional Purchasing</td><td style="padding:3px 0;text-align:right;font-size:13px;font-weight:600;color:#15803d;">+ ${formatRs(totalReceipts)}</td></tr>` : ""}
      ${discountVal > 0 ? `<tr><td style="padding:6px 0;font-size:13px;color:#16a34a;">Discount</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#16a34a;">− ${formatRs(discountVal)}</td></tr>` : ""}
      <tr style="border-top:1px solid #e5e7eb;"><td style="padding:10px 0 6px;font-size:14px;font-weight:700;color:#111827;">Order Total</td><td style="padding:10px 0 6px;text-align:right;font-size:14px;font-weight:700;color:#d97706;">${formatRs(totalAmount)}</td></tr>
      ${(payments || []).length > 0
        ? (payments || []).map(p => `<tr><td style="padding:3px 0;font-size:12px;color:#16a34a;">Paid (${fmtDateTime(p.createdAt || p.payDate)})</td><td style="padding:3px 0;text-align:right;font-size:12px;color:#16a34a;">− ${formatRs(p.amount)}</td></tr>`).join("")
        : paidAmount > 0 ? `<tr><td style="padding:6px 0;font-size:13px;color:#16a34a;">Amount Paid</td><td style="padding:6px 0;text-align:right;font-size:13px;color:#16a34a;">− ${formatRs(paidAmount)}</td></tr>` : ""}
      ${totalReturns > 0 ? `<tr><td style="padding:4px 0;font-size:13px;color:#dc2626;">📦 Goods Return</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#dc2626;">− ${formatRs(totalReturns)}</td></tr>` : ""}
      <tr><td colspan="2" style="padding-top:6px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:${sm.bg};border-radius:8px;"><tr>
        <td style="padding:12px 14px;font-size:15px;font-weight:800;color:${sm.color};">Balance Payable</td>
        <td style="padding:12px 14px;text-align:right;font-size:15px;font-weight:800;color:${sm.color};">${formatRs(balance)}</td>
      </tr></table></td></tr>
    </table>
  </td></tr></table>
</td></tr>
${paymentHistorySection}
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
    const { invoice, userDoc, pdfBase64, uid, isSupplierOrder, supplier, isUpdate, receipts, returns, payments } = body;

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

    // ── Fetch fresh invoice data + resolve live Previous Balance ─────────
    if (!isSupplierOrder && invoice.id) {
      try {
        const custId = invoice.customerId;
        let freshData = null;

        // 1. Fetch fresh invoice doc
        if (custId) {
          const snap = await adminDb
            .collection("users").doc(uid)
            .collection("customers").doc(custId)
            .collection("invoices").doc(invoice.id)
            .get();
          if (snap.exists) freshData = snap.data();
        }
        if (!freshData) {
          const snap = await adminDb
            .collection("users").doc(uid)
            .collection("invoices").doc(invoice.id)
            .get();
          if (snap.exists) freshData = snap.data();
        }

        if (freshData) {
          invoice.items         = freshData.items         ?? invoice.items;
          invoice.subtotal      = freshData.subtotal      ?? invoice.subtotal;
          invoice.amount        = freshData.amount        ?? invoice.amount;
          invoice.actualAmount  = freshData.actualAmount  ?? invoice.actualAmount;
          invoice.amountPaid    = freshData.amountPaid    ?? invoice.amountPaid;
          invoice.balance       = freshData.balance       ?? invoice.balance;
          invoice.discount      = freshData.discount      ?? invoice.discount;
          invoice.discountType  = freshData.discountType  ?? invoice.discountType;
          invoice.discountValue = freshData.discountValue ?? invoice.discountValue;
          invoice.status        = freshData.status        ?? invoice.status;
        }

        // 2. Always calculate customer's total outstanding balance across ALL other invoices.
        //    This is shown in the "Previous Balance" display row in the email — for info only.
        //    It does NOT affect any invoice totals/calculations.
        const resolvedCustId = custId || freshData?.customerId;

        if (resolvedCustId) {
          // Customer invoices sub-collection
          const allSnap = await adminDb
            .collection("users").doc(uid)
            .collection("customers").doc(resolvedCustId)
            .collection("invoices")
            .get();

          let prevSum = 0;
          for (const d of allSnap.docs) {
            if (d.id === invoice.id) continue; // skip current invoice
            const rd = d.data();
            if (rd.deleted) continue; // skip soft-deleted invoices

            // Calculate balance the same way CustomersView.getActualBalance does:
            // actualAmount (real items, no prev-balance carry-forward) - amountPaid - goods returns
            const isPrevBalItem = desc => (desc || "").startsWith("Previous Balance");
            const actualAmt = rd.actualAmount != null
              ? Number(rd.actualAmount)
              : (rd.items || [])
                  .filter(it => !isPrevBalItem(it.description))
                  .reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);

            // Sum goods returns from the payments sub-collection for this invoice
            // These are stored as type="return" with returnAmount field
            let returnTotal = 0;
            try {
              const retSnap = await adminDb
                .collection("users").doc(uid)
                .collection("payments")
                .where("invoiceId", "==", d.id)
                .where("type", "==", "return")
                .get();
              returnTotal = retSnap.docs.reduce((s, pd) => s + (Number(pd.data().returnAmount) || 0), 0);
            } catch (_) {}

            const rdBalance = Math.max(0, actualAmt - (Number(rd.amountPaid) || 0) - returnTotal);
            if (rdBalance > 0) prevSum += rdBalance;
          }
          // Store resolved value — used in buildInvoiceEmailHTML for display only (never added to totals)
          invoice._resolvedPrevBalance = prevSum;
        } else if (!resolvedCustId && invoice.customerId == null) {
          // Direct invoice (not linked to a customer) — check top-level invoices collection
          // for invoices with same customerName/email
          // (Optional: skip for direct invoices since they have no customerId linkage)
          invoice._resolvedPrevBalance = 0;
        }

      } catch (fetchErr) {
        console.warn("[send-invoice] Fresh fetch error:", fetchErr.message);
      }
    }
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
      htmlBody      = buildSupplierOrderEmailHTML({ order: invoice, supplier, userDoc: mergedUserDoc, isUpdate: !!isUpdate, receipts: receipts || [], returns: returns || [], payments: payments || [] });
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
