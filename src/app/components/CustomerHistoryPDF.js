"use client";
import { useRef, useState } from "react";

// ── helpers ───────────────────────────────────────────────────────────────────
function formatRs(n) {
  if (!n && n !== 0) return "Rs. 0";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}
function fmtDateTime(ts) {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-PK", {
      day: "2-digit", month: "short", year: "numeric",
    }) + "  " + d.toLocaleTimeString("en-PK", {
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return "—"; }
}
function fmtDate(ts) {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}
function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── STATUS badge colors (for print, inline styles only) ──────────────────────
const STATUS_BG    = { Paid: "#dcfce7", Unpaid: "#fee2e2", Partial: "#fef3c7", completed: "#dcfce7" };
const STATUS_COLOR = { Paid: "#16a34a", Unpaid: "#dc2626", Partial: "#d97706", completed: "#16a34a" };

// ── The printable History Report template ─────────────────────────────────────
function HistoryTemplate({ customer, invoices, payments, userDoc }) {
  // Build merged, sorted timeline
  const timeline = [];
  invoices.forEach(inv => {
    const date = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt || 0);
    timeline.push({ type: "invoice", date, data: inv });
  });
  payments.forEach(pay => {
    const date = pay.createdAt?.toDate ? pay.createdAt.toDate() : new Date(pay.createdAt || 0);
    timeline.push({ type: "payment", date, data: pay });
  });
  timeline.sort((a, b) => b.date - a.date);

  // Helper: exclude "Previous Balance · INV-" carry-forward items from invoice amount
  function actualInvAmount(inv) {
    if (inv.originalAmount != null) return Number(inv.originalAmount);
    if (inv.actualAmount != null) return Number(inv.actualAmount);
    const items = inv.items || [];
    const actual = items
      .filter(it => !(it.description || "").startsWith("Previous Balance · INV-"))
      .reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
    return actual || Number(inv.amount) || 0;
  }

  // Find invoice IDs whose balance has been carried forward — exclude from totals
  const carriedForwardIds = new Set();
  invoices.forEach(inv => {
    (inv.items || []).forEach(it => {
      const desc = it.description || "";
      if (desc.startsWith("Previous Balance · INV-")) {
        const suffix = desc.replace("Previous Balance · INV-", "").trim().slice(0, 4).toUpperCase();
        const matched = invoices.find(i => (i.id || "").slice(-4).toUpperCase() === suffix);
        if (matched) carriedForwardIds.add(matched.id);
      }
    });
  });

  const totalInvoiced   = invoices.reduce((s, i) => carriedForwardIds.has(i.id) ? s : s + actualInvAmount(i), 0);
  const totalPaid       = invoices.reduce((s, i) => s + (Number(i.amountPaid) || 0), 0);
  const totalBalance    = invoices.reduce((s, i) => carriedForwardIds.has(i.id) ? s : s + (Number(i.balance) || 0), 0);
  const paymentCount    = payments.filter(p => p.type !== "purchase" && p.type !== "return").length;
  const purchaseCount   = payments.filter(p => p.type === "purchase").length;
  const returnCount     = payments.filter(p => p.type === "return").length;
  const totalReturned   = payments.filter(p => p.type === "return").reduce((s, p) => s + (Number(p.returnAmount) || 0), 0);

  const generatedOn = new Date().toLocaleDateString("en-PK", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div style={{
      width: 794, minHeight: 1123, background: "#fff", color: "#111",
      fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 13,
      padding: "48px 52px", boxSizing: "border-box", position: "relative",
    }}>

      {/* ── Top accent bar ── */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5,
        background: "linear-gradient(to right, #1d4ed8, #8b5cf6, #f59e0b)" }} />

      {/* ── Header: Company + Report title ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        {/* Left: logo + company */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {(userDoc?.logoDataUrl) && (
            <img src={userDoc.logoDataUrl} alt="Logo"
              style={{ width: 58, height: 58, objectFit: "contain", borderRadius: 8 }} />
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: "#111", letterSpacing: "-0.3px" }}>
              {userDoc?.business || userDoc?.name || "Your Business"}
            </div>
            {userDoc?.address && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{userDoc.address}</div>}
            {userDoc?.phone   && <div style={{ fontSize: 11, color: "#6b7280" }}>{userDoc.phone}</div>}
            {userDoc?.email   && <div style={{ fontSize: 11, color: "#6b7280" }}>{userDoc.email}</div>}
            {userDoc?.website && <div style={{ fontSize: 11, color: "#6b7280" }}>{userDoc.website}</div>}
          </div>
        </div>

        {/* Right: Report label */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#7c3aed", letterSpacing: "-1px", lineHeight: 1 }}>
            HISTORY REPORT
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>Generated: {generatedOn}</div>
          <div style={{ marginTop: 8, display: "inline-block", padding: "4px 14px", borderRadius: 20,
            fontSize: 11, fontWeight: 700, background: "#ede9fe", color: "#7c3aed", letterSpacing: "0.04em" }}>
            CUSTOMER STATEMENT
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: "#e5e7eb", marginBottom: 24 }} />

      {/* ── Customer Info Block ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 28, padding: "16px 20px",
        background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 10 }}>
        {/* Avatar */}
        <div style={{ width: 50, height: 50, borderRadius: 12, flexShrink: 0,
          background: "linear-gradient(135deg, #2563EB, #7c3aed)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 900, color: "#fff" }}>
          {initials(customer.name)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#111" }}>{customer.name}</div>
          {customer.shopName && <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600 }}>{customer.shopName}</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", marginTop: 5, fontSize: 11, color: "#4b5563" }}>
            {customer.phone   && <span>📞 {customer.phone}</span>}
            {customer.email   && <span>✉️ {customer.email}</span>}
            {customer.city    && <span>📍 {customer.city}</span>}
            {customer.address && <span>🏠 {customer.address}</span>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.06em", marginBottom: 4 }}>Customer Since</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{fmtDate(customer.createdAt)}</div>
        </div>
      </div>

      {/* ── Summary Stats Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7, marginBottom: 28 }}>
        {[
          { label: "Total Invoiced", value: formatRs(totalInvoiced), icon: "💼", bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
          { label: "Total Paid",     value: formatRs(totalPaid),     icon: "✅", bg: "#f0fdf4", border: "#86efac", color: "#15803d" },
          { label: "Balance Due",    value: formatRs(totalBalance),  icon: "⏳",
            bg: totalBalance > 0 ? "#fef2f2" : "#f0fdf4",
            border: totalBalance > 0 ? "#fca5a5" : "#86efac",
            color: totalBalance > 0 ? "#dc2626" : "#15803d" },
          { label: "Payments Made",  value: paymentCount,            icon: "💰", bg: "#f5f3ff", border: "#c4b5fd", color: "#6d28d9" },
          { label: "Purchases",      value: purchaseCount,           icon: "🛍️", bg: "#fffbeb", border: "#fde68a", color: "#b45309" },
          { label: "Goods Return",   value: returnCount > 0 ? `${returnCount} · ${formatRs(totalReturned)}` : "0",
            icon: "↩️", bg: "#fef2f2", border: "#fca5a5", color: "#dc2626" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "9px 10px", borderRadius: 10,
            background: s.bg, border: `1px solid ${s.border}` }}>
            <div style={{ fontSize: 14, marginBottom: 3 }}>{s.icon}</div>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.07em", color: "#9ca3af", marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Activity Timeline Table ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.08em", color: "#7c3aed", marginBottom: 10 }}>
          Transaction History
        </div>

        {timeline.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af",
            fontSize: 13, border: "1px dashed #e5e7eb", borderRadius: 10 }}>
            No transactions found for this customer.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#7c3aed", color: "#fff" }}>
                {["#", "Date & Time", "Type", "Reference", "Amount", "Purchase", "Return", "Paid", "Balance", "Status"].map((h, i) => (
                  <th key={h} style={{
                    padding: "9px 7px",
                    textAlign: i === 0 ? "center" : i >= 4 ? "right" : "left",
                    fontSize: 9, fontWeight: 700,
                    letterSpacing: "0.04em", textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    ...(i === 0 ? { width: 20 } : {}),
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeline.map((item, idx) => {
                const isInv      = item.type === "invoice";
                const isPurchase = !isInv && item.data?.type === "purchase";
                const isReturn   = !isInv && item.data?.type === "return";
                const isPayment  = !isInv && !isPurchase && !isReturn;
                const d          = item.data;
                const ref        = isInv
                  ? "INV-" + (d.id || "").slice(-4).toUpperCase()
                  : (d.invoiceNumber || ("INV-" + (d.invoiceId || "").slice(-4).toUpperCase()) || "—");

                const isPrevBal = (desc) => (desc || "").startsWith("Previous Balance · INV-");

                // ── Amount column (prev balance before this transaction) ──
                let amount = null;
                if (isInv) {
                  amount = d.originalAmount != null
                    ? Number(d.originalAmount)
                    : (d.actualAmount != null
                        ? Number(d.actualAmount)
                        : (d.items || [])
                            .filter(it => !isPrevBal(it.description))
                            .reduce((s, it) => s + (Number(it.qty)||0)*(Number(it.unitPrice)||0), 0)
                          || Number(d.amount) || 0);
                } else if (isPurchase) {
                  amount = d.amount != null ? Number(d.amount) : null;
                } else if (isReturn) {
                  // Amount = balance BEFORE return
                  amount = d.balanceBefore != null ? Number(d.balanceBefore) : null;
                } else {
                  // Payment: balance before = historyBalance + paid
                  amount = d.historyBalance != null
                    ? Number(d.historyBalance) + Number(d.paid || 0)
                    : (d.balance != null ? Number(d.balance) + Number(d.paid || 0) : Number(d.amount) || 0);
                }

                // ── Purchase column ──
                const purchaseVal = isPurchase ? Number(d.purchaseAmount || 0) : null;

                // ── Return column ──
                const returnVal = isReturn ? Number(d.returnAmount || 0) : null;

                // ── Paid column ──
                const paidVal = isInv
                  ? (d.originalAmountPaid != null ? Number(d.originalAmountPaid) : 0)
                  : (isPurchase || isReturn)
                    ? null
                    : (d.paid != null ? Number(d.paid) : null);

                // ── Balance column ──
                const balVal = isInv
                  ? Math.max(0, (amount || 0) - (d.originalAmountPaid != null ? Number(d.originalAmountPaid) : 0))
                  : (d.historyBalance != null ? Number(d.historyBalance) : (d.balance != null ? Number(d.balance) : null));

                // ── Status column ──
                const rowStatus = isInv
                  ? (d.originalStatus || (paidVal === 0 ? "Unpaid" : paidVal >= (amount||0) ? "Paid" : "Partial"))
                  : (d.status && d.status !== "completed" ? d.status : null);
                const sBg    = rowStatus ? (STATUS_BG[rowStatus]    || "#f3f4f6") : null;
                const sColor = rowStatus ? (STATUS_COLOR[rowStatus] || "#374151") : null;

                // ── Row background + type badge ──
                const typeBg    = isInv ? "#eff6ff" : isPurchase ? "#fffbeb" : isReturn ? "#fef2f2" : "#f0fdf4";
                const typeColor = isInv ? "#1d4ed8" : isPurchase ? "#b45309" : isReturn ? "#dc2626" : "#15803d";
                const typeBdr   = isInv ? "#bfdbfe" : isPurchase ? "#fde68a" : isReturn ? "#fca5a5" : "#86efac";
                const typeLabel = isInv ? "🧾 Invoice" : isPurchase ? "🛍️ Purchase" : isReturn ? "↩️ Return" : "💰 Payment";

                return (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? "#f9fafb" : "#fff" }}>
                    <td style={{ padding: "8px 8px", textAlign: "center", color: "#9ca3af", fontSize: 11 }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: "8px 8px", fontSize: 10, color: "#374151", whiteSpace: "nowrap" }}>
                      {fmtDateTime(item.date)}
                    </td>
                    <td style={{ padding: "8px 8px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 7px", borderRadius: 12, fontSize: 9, fontWeight: 700,
                        background: typeBg, color: typeColor, border: `1px solid ${typeBdr}` }}>
                        {typeLabel}
                      </div>
                    </td>
                    <td style={{ padding: "8px 8px", fontSize: 10, fontWeight: 600, color: "#111" }}>
                      {ref}
                      {isPayment && d.method && (
                        <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 400, marginTop: 1 }}>
                          via {d.method}
                        </div>
                      )}
                      {isPurchase && d.items?.length > 0 && (
                        <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 400, marginTop: 1 }}>
                          {d.items.map(it => `${it.description} ×${it.qty}`).join(", ")}
                        </div>
                      )}
                    </td>
                    {/* AMOUNT — prev balance before transaction */}
                    <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#111", whiteSpace: "nowrap" }}>
                      {amount != null ? formatRs(amount) : <span style={{ color: "#9ca3af" }}>—</span>}
                    </td>
                    {/* PURCHASE — only for purchase rows */}
                    <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 12, fontWeight: 700,
                      color: purchaseVal != null && purchaseVal > 0 ? "#b45309" : "#9ca3af", whiteSpace: "nowrap" }}>
                      {purchaseVal != null && purchaseVal > 0 ? formatRs(purchaseVal) : "—"}
                    </td>
                    {/* RETURN — only for return rows */}
                    <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 12, fontWeight: 700,
                      color: returnVal != null && returnVal > 0 ? "#dc2626" : "#9ca3af", whiteSpace: "nowrap" }}>
                      {returnVal != null && returnVal > 0 ? `- ${formatRs(returnVal)}` : "—"}
                    </td>
                    {/* PAID — invoice/payment */}
                    <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 12, fontWeight: 600,
                      color: paidVal != null && paidVal > 0 ? "#16a34a" : "#9ca3af", whiteSpace: "nowrap" }}>
                      {paidVal != null ? (paidVal > 0 ? formatRs(paidVal) : "—") : "—"}
                    </td>
                    {/* BALANCE */}
                    <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 12, fontWeight: 700,
                      color: balVal != null ? (balVal > 0 ? "#dc2626" : "#16a34a") : "#9ca3af", whiteSpace: "nowrap" }}>
                      {balVal != null
                        ? (balVal > 0 ? formatRs(balVal) : <span style={{ color: "#16a34a" }}>Cleared ✓</span>)
                        : "—"}
                    </td>
                    {/* STATUS */}
                    <td style={{ padding: "8px 7px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {rowStatus ? (
                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 12,
                          fontSize: 10, fontWeight: 700, background: sBg, color: sColor,
                          border: `1px solid ${sColor}40` }}>
                          {rowStatus}
                        </span>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>



      {/* ── Footer ── */}
      <div style={{ position: "absolute", bottom: 36, left: 52, right: 52 }}>
        <div style={{ height: 1, background: "linear-gradient(to right, #1d4ed8, #8b5cf6, #f59e0b)", marginBottom: 14 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
          <div>
            <div style={{ color: "#7c3aed", fontWeight: 800, fontSize: 13, letterSpacing: "-0.3px" }}>
              Novexa ERP
            </div>
            <div style={{ color: "#9ca3af", fontSize: 10, marginTop: 1 }}>
              Smart Business Management
            </div>
          </div>
          <div style={{ color: "#9ca3af", fontSize: 10, textAlign: "center" }}>
            Customer History Report · {customer.name}
          </div>
          <div style={{ textAlign: "right", color: "#9ca3af", fontSize: 10 }}>
            <div>Generated on {generatedOn}</div>
            <div style={{ marginTop: 1 }}>Powered by Novexa ERP</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Preview + Download + Print + WhatsApp ──────────────────────────────
export default function CustomerHistoryPDFModal({ customer, invoices, payments, userDoc, onClose }) {
  const printRef  = useRef(null);
  const [loading, setLoading] = useState(false);
  const [copied,  setCopied]  = useState(false);

  async function downloadPDF() {
    if (!printRef.current || loading) return;
    setLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF       = (await import("jspdf")).default;

      const canvas = await html2canvas(printRef.current, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff",
        logging: false, width: 794,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf     = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pdfW    = pdf.internal.pageSize.getWidth();
      const pdfH    = (canvas.height / canvas.width) * pdfW;
      const pageH   = pdf.internal.pageSize.getHeight();

      if (pdfH <= pageH) {
        pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
      } else {
        let yPos = 0, remaining = pdfH;
        while (remaining > 0) {
          pdf.addImage(imgData, "JPEG", 0, -yPos, pdfW, pdfH);
          remaining -= pageH;
          yPos      += pageH;
          if (remaining > 0) pdf.addPage();
        }
      }

      const fname = `History-${(customer.name || "Customer").replace(/\s+/g, "-")}-${new Date().toISOString().slice(0,10)}.pdf`;
      pdf.save(fname);
    } catch (err) {
      alert("PDF generation failed: " + err.message);
    }
    setLoading(false);
  }

  function printReport() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank", "width=900,height=700");
    w.document.write(`<!DOCTYPE html><html><head><title>Customer History</title>
      <style>body{margin:0;padding:0;background:#fff;}@media print{body{margin:0;}}</style>
      </head><body>${content}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  }

  function shareWhatsApp() {
    const totalInvoiced = invoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const totalPaid     = invoices.reduce((s, i) => s + (Number(i.amountPaid) || 0), 0);
    const totalBalance  = invoices.reduce((s, i) => s + (Number(i.balance) || 0), 0);
    const text = encodeURIComponent(
      `Hi ${customer.name},\n\nHere is your account summary:\n\n` +
      `📦 Total Invoiced: *${formatRs(totalInvoiced)}*\n` +
      `✅ Total Paid: *${formatRs(totalPaid)}*\n` +
      `⏳ Balance Due: *${formatRs(totalBalance)}*\n` +
      `💰 Payments Made: *${payments.length}*\n\n` +
      `Thank you for your business!\n\n— ${userDoc?.business || userDoc?.name || "Your Business"}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  async function copyText() {
    const totalBalance = invoices.reduce((s, i) => s + (Number(i.balance) || 0), 0);
    const text = `Customer: ${customer.name} | Balance Due: ${formatRs(totalBalance)} | Invoices: ${invoices.length} | Payments: ${payments.length}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-[860px] my-4">

        {/* Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
          <h3 className="text-white font-bold text-base">
            📊 History Report — {customer.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {copied && (
              <span className="text-xs font-medium px-3 py-1.5 rounded-full"
                style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                ✓ Copied!
              </span>
            )}
            <button onClick={copyText}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#d1d5db" }}>
              📋 Copy Summary
            </button>
            <button onClick={shareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25D366" }}>
              💬 WhatsApp
            </button>
            <button onClick={printReport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
              🖨️ Print
            </button>
            <button onClick={downloadPDF} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#7c3aed)", color: "#fff",
                opacity: loading ? 0.7 : 1, cursor: loading ? "wait" : "pointer" }}>
              {loading ? "⏳ Generating..." : "⬇️ Download PDF"}
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-lg">
              ✕
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="overflow-hidden rounded-xl shadow-2xl" style={{ border: "1px solid rgba(139,92,246,0.3)" }}>
          <div ref={printRef}>
            <HistoryTemplate
              customer={customer}
              invoices={invoices}
              payments={payments}
              userDoc={userDoc}
            />
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-3">
          Scroll to see full report · Click &quot;Download PDF&quot; to save
        </p>
      </div>
    </div>
  );
}
