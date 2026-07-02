"use client";
import { useRef, useState } from "react";
import { formatRs } from "./InvoiceModal";

// ── status color ──────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  Paid:    "#16a34a",
  Unpaid:  "#dc2626",
  Partial: "#d97706",
};

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDate(str) {
  if (!str) return "—";
  try { return new Date(str).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return str; }
}

function fmtDateTime(ts) {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
      + "  " + d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return "—"; }
}

function InvoiceNumber(id) {
  return "INV-" + (id || "").slice(-6).toUpperCase();
}

// ── The printable invoice template ───────────────────────────────────────────
export function InvoiceTemplateForEmail({ inv, userDoc }) {
  return <InvoiceTemplate inv={inv} userDoc={userDoc} payments={[]} />;
}

function InvoiceTemplate({ inv, userDoc, payments = [] }) {
  const isPrevBalItem = it => (it.description || "").startsWith("Previous Balance · INV-");

  // Separate items: prev balance entries, original real items, purchase additions (from payments)
  const prevBalItems  = (inv.items || []).filter(it => isPrevBalItem(it));
  const originalItems = (inv.items || []).filter(it => !isPrevBalItem(it));

  // Purchase history records (type=purchase)
  const purchaseRecords = payments.filter(p => p.type === "purchase");
  // Return records (type=return)
  const returnRecords   = payments.filter(p => p.type === "return");
  // Payment records (type=received)
  const paymentRecords  = payments.filter(p => p.type === "received" || (p.type !== "purchase" && p.type !== "return"));

  // Subtotal only from items on the invoice (full, for display)
  const subtotal = (inv.items || []).reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0
  );

  return (
    <div style={{
      width: 794, minHeight: 1123, background: "#fff", color: "#111",
      fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 13,
      padding: "48px 56px", boxSizing: "border-box", position: "relative",
    }}>

      {/* ── top accent line ── */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5,
        background: "linear-gradient(to right,#1d4ed8,#f59e0b)" }} />

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
        {/* left: logo + business */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {(inv.logoDataUrl || userDoc?.logoDataUrl) && (
            <img src={inv.logoDataUrl || userDoc?.logoDataUrl} alt="Logo"
              style={{ width: 60, height: 60, objectFit: "contain", borderRadius: 8 }} />
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: "#111", letterSpacing: "-0.3px" }}>
              {userDoc?.business || userDoc?.name || "Your Business"}
            </div>
            {userDoc?.industry && (
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{userDoc.industry}</div>
            )}
            {userDoc?.address && (
              <div style={{ fontSize: 11, color: "#6b7280" }}>{userDoc.address}</div>
            )}
            {userDoc?.phone && (
              <div style={{ fontSize: 11, color: "#6b7280" }}>{userDoc.phone}</div>
            )}
            {userDoc?.email && (
              <div style={{ fontSize: 11, color: "#6b7280" }}>{userDoc.email}</div>
            )}
            {userDoc?.website && (
              <div style={{ fontSize: 11, color: "#6b7280" }}>{userDoc.website}</div>
            )}
          </div>
        </div>

        {/* right: INVOICE label + number */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#1d4ed8", letterSpacing: "-1px", lineHeight: 1 }}>
            INVOICE
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6, fontWeight: 600 }}>
            {InvoiceNumber(inv.id)}
          </div>
          <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center",
            gap: 6, padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700,
            letterSpacing: "0.05em", textTransform: "uppercase",
            background: inv.status === "Paid" ? "#dcfce7" : inv.status === "Partial" ? "#fef3c7" : "#fee2e2",
            color: STATUS_COLOR[inv.status] || "#dc2626" }}>
            ● {inv.status || "Unpaid"}
          </div>
        </div>
      </div>

      {/* ── divider ── */}
      <div style={{ height: 1, background: "#e5e7eb", marginBottom: 28 }} />

      {/* ── Bill To / Dates ── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32, gap: 32 }}>
        {/* bill to */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: 8 }}>Bill To</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 4 }}>
            {inv.customerName || inv.customer || "—"}
          </div>
          {inv.address && <div style={{ color: "#374151", fontSize: 12, lineHeight: 1.5 }}>{inv.address}</div>}
          {inv.phone   && <div style={{ color: "#374151", fontSize: 12 }}>{inv.phone}</div>}
          {inv.email   && <div style={{ color: "#374151", fontSize: 12 }}>{inv.email}</div>}
        </div>

        {/* dates */}
        <div style={{ minWidth: 200 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: 8 }}>Details</div>
          {[
            { label: "Invoice Date", val: fmtDate(inv.invoiceDate) },
            { label: "Due Date",     val: fmtDate(inv.dueDate) || "—" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between",
              gap: 16, fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "#6b7280" }}>{r.label}</span>
              <span style={{ fontWeight: 600, color: "#111" }}>{r.val}</span>
            </div>
          ))}
         
          {inv.earlyDiscountDays && inv.earlyDiscountPercent && (
            <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, fontSize: 11,
              background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
              💡 Pay within {inv.earlyDiscountDays} days → {inv.earlyDiscountPercent}% extra off
            </div>
          )}
        </div>
      </div>

      {/* ── Items table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ background: "#1d4ed8", color: "#fff" }}>
            {["#", "Date & Time", "Product", "Variant", "Qty", "Rate", "Total"].map((h, i) => (
              <th key={h} style={{
                padding: "9px 8px",
                textAlign: i >= 5 ? "right" : i === 0 ? "center" : "left",
                fontSize: 9, fontWeight: 700, letterSpacing: "0.05em",
                textTransform: "uppercase", whiteSpace: "nowrap",
                ...(i === 0 ? { width: 24 } : {}),
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Previous Balance rows */}
          {prevBalItems.map((it, idx) => {
            const lineTotal = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
            return (
              <tr key={"pb" + idx} style={{ background: "#fffbeb" }}>
                <td style={{ padding: "7px 8px", textAlign: "center", color: "#9ca3af", fontSize: 10 }}>{idx + 1}</td>
                <td style={{ padding: "7px 8px", fontSize: 9, color: "#b45309", whiteSpace: "nowrap" }}>{fmtDateTime(inv.createdAt)}</td>
                <td style={{ padding: "7px 8px", fontSize: 11, color: "#b45309", fontStyle: "italic" }}>{it.description}</td>
                <td style={{ padding: "7px 8px", fontSize: 10, color: "#9ca3af" }}>—</td>
                <td style={{ padding: "7px 8px", fontSize: 10, color: "#9ca3af" }}>—</td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 11, color: "#b45309" }}>{it.qty}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 11, color: "#b45309", whiteSpace: "nowrap" }}>{formatRs(it.unitPrice)}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#b45309", whiteSpace: "nowrap" }}>{formatRs(lineTotal)}</td>
              </tr>
            );
          })}

          {/* Original real items */}
          {originalItems.map((it, idx) => {
            const additionalQty = purchaseRecords.reduce((sum, pr) => {
              const found = (pr.items || []).find(
                pi => pi.description === it.description && (pi.productId === it.productId || !pi.productId)
              );
              return sum + (found ? Number(found.qty) || 0 : 0);
            }, 0);
            const originalQty = Math.max(1, (Number(it.qty) || 1) - additionalQty);
            const lineTotal   = originalQty * (Number(it.unitPrice) || 0);
            const rowNum      = prevBalItems.length + idx + 1;

            // Variant info — from inventory variant or custom variantLabel
            const variantLabel = it.variantLabel || "";
            const variantUnit  = it.variantUnit  || "";

            return (
              <tr key={"it" + idx} style={{ background: idx % 2 === 0 ? "#f9fafb" : "#fff" }}>
                <td style={{ padding: "8px 8px", textAlign: "center", color: "#9ca3af", fontSize: 10 }}>{rowNum}</td>
                <td style={{ padding: "8px 8px", fontSize: 9, color: "#6b7280", whiteSpace: "nowrap" }}>{fmtDateTime(inv.createdAt)}</td>
                <td style={{ padding: "8px 8px", fontSize: 12, fontWeight: 600 }}>{it.description || "—"}</td>
                <td style={{ padding: "8px 8px", fontSize: 11, color: "#7c3aed", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {variantLabel || "—"}
                </td>
                {/* <td style={{ padding: "8px 8px", fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
                  {variantUnit ? `per ${variantUnit}` : "—"}
                </td> */}
                <td style={{ padding: "8px 8px", textAlign: "left", fontSize: 11 }}>{originalQty}</td>
                <td style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, whiteSpace: "nowrap" }}>{formatRs(it.unitPrice)}</td>
                <td style={{ padding: "8px 8px", textAlign: "right", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{formatRs(lineTotal)}</td>
              </tr>
            );
          })}

          {/* Additional purchase rows */}
          {purchaseRecords.map((pr, prIdx) =>
            (pr.items || []).map((it, itIdx) => {
              const lineTotal = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
              const rowNum    = prevBalItems.length + originalItems.length + prIdx + itIdx + 1;
              const variantLabel = it.variantLabel || "";
              const variantUnit  = it.variantUnit  || "";
              return (
                <tr key={"pr" + prIdx + "-" + itIdx} style={{ background: "#fffbeb" }}>
                  <td style={{ padding: "8px 8px", textAlign: "center", color: "#9ca3af", fontSize: 10 }}>{rowNum}</td>
                  <td style={{ padding: "8px 8px", fontSize: 9, color: "#b45309", whiteSpace: "nowrap" }}>{fmtDateTime(pr.createdAt)}</td>
                  <td style={{ padding: "8px 8px", fontSize: 12, fontWeight: 600, color: "#b45309" }}>
                    {it.description || "—"}
                    <span style={{ marginLeft: 5, fontSize: 8, padding: "1px 4px", borderRadius: 4,
                      background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>+ADD</span>
                  </td>
                  <td style={{ padding: "8px 8px", fontSize: 11, color: "#7c3aed", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {variantLabel || "—"}
                  </td>
                  <td style={{ padding: "8px 8px", fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
                    {variantUnit ? `per ${variantUnit}` : "—"}
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, color: "#b45309" }}>{it.qty}</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, color: "#b45309", whiteSpace: "nowrap" }}>{formatRs(it.unitPrice)}</td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#b45309", whiteSpace: "nowrap" }}>{formatRs(lineTotal)}</td>
                </tr>
              );
            })
          )}

        </tbody>
      </table>

      {/* ── Totals ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <div style={{ minWidth: 260 }}>
          {[
            { label: "Subtotal",    val: formatRs(subtotal),                    bold: false, color: "#374151" },
            { label: `Discount${inv.discountType === "percent" ? ` (${inv.discountValue || 0}%)` : ""}`,
              val: `- ${formatRs(inv.discount || 0)}`,                          bold: false, color: "#d97706" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between",
              gap: 24, padding: "5px 0", borderBottom: "1px solid #f3f4f6", fontSize: 13 }}>
              <span style={{ color: "#6b7280" }}>{r.label}</span>
              <span style={{ fontWeight: r.bold ? 700 : 500, color: r.color }}>{r.val}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 24,
            padding: "10px 0", borderBottom: "2px solid #1d4ed8", marginTop: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>Total</span>
            <span style={{ fontWeight: 800, fontSize: 16, color: "#1d4ed8" }}>{formatRs(inv.amount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "6px 0" }}>
            <span style={{ color: "#16a34a", fontWeight: 600, fontSize: 12 }}>Amount Paid</span>
            <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 13 }}>{formatRs(inv.amountPaid || 0)}</span>
          </div>
           <div style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "6px 0" }}>
            <span style={{ color: "red", fontWeight: 600, fontSize: 12 }}>Goods Return</span>
             <span style={{ color: "#dc2626", fontWeight: 800 }}>
                  - {formatRs(returnRecords.reduce((s, p) => s + (Number(p.returnAmount) || 0), 0))}
                </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 24,
            padding: "8px 12px", borderRadius: 8, marginTop: 4,
            background: Number(inv.balance) > 0 ? "#fee2e2" : "#dcfce7" }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: Number(inv.balance) > 0 ? "#dc2626" : "#16a34a" }}>
              Balance Due
            </span>
            <span style={{ fontWeight: 800, fontSize: 15, color: Number(inv.balance) > 0 ? "#dc2626" : "#16a34a" }}>
              {formatRs(inv.balance || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Return History ── */}
      {returnRecords.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "#dc2626", marginBottom: 8 }}>
            Goods Return History
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#dc2626", color: "#fff" }}>
                {["Date & Time", "Item", "Qty", "Rate", "Return Amount"].map((h, i) => (
                  <th key={h} style={{ padding: "7px 10px", textAlign: i >= 2 ? "right" : "left",
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {returnRecords.map((p, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? "#fef2f2" : "#fff" }}>
                  <td style={{ padding: "7px 10px", fontSize: 11, color: "#374151", whiteSpace: "nowrap" }}>
                    {fmtDateTime(p.createdAt)}
                  </td>
                  <td style={{ padding: "7px 10px", fontSize: 11, color: "#374151" }}>
                    {p.description || "—"}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, color: "#dc2626" }}>
                    {p.qty}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, color: "#dc2626", whiteSpace: "nowrap" }}>
                    {formatRs(p.rate)}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#dc2626", whiteSpace: "nowrap" }}>
                    - {formatRs(p.returnAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Payment History ── */}
      {paymentRecords.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "#16a34a", marginBottom: 8 }}>
            Payment History
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#16a34a", color: "#fff" }}>
                {["Date & Time", "Method", "Amount Paid", "Balance After"].map((h, i) => (
                  <th key={h} style={{ padding: "7px 10px", textAlign: i >= 2 ? "right" : "left",
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {h}
                  </th>
                ))}
              </tr>
              
            </thead>
            <tbody>
              {paymentRecords.map((p, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? "#f0fdf4" : "#fff" }}>
                  <td style={{ padding: "7px 10px", fontSize: 11, color: "#374151", whiteSpace: "nowrap" }}>
                    {fmtDateTime(p.createdAt)}
                  </td>
                  <td style={{ padding: "7px 10px", fontSize: 11, color: "#374151", textTransform: "capitalize" }}>
                    {p.method || "cash"}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap" }}>
                    {formatRs(p.paid ?? p.amount)}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                    color: Number(p.historyBalance ?? p.balance) > 0 ? "#dc2626" : "#16a34a" }}>
                    {p.historyBalance != null || p.balance != null
                      ? (Number(p.historyBalance ?? p.balance) > 0
                          ? formatRs(p.historyBalance ?? p.balance)
                          : "Cleared ✓")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Note ── only show if note doesn't contain "previous outstanding balance" auto-text */}
      {inv.note && !inv.note.toLowerCase().includes("previous outstanding balance") && (
        <div style={{ padding: "14px 16px", borderRadius: 10, marginBottom: 28,
          background: "#f9fafb", border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: 6 }}>Notes & Terms</div>
          <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{inv.note}</div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ position: "absolute", bottom: 36, left: 56, right: 56 }}>
        <div style={{ height: 1, background: "#e5e7eb", marginBottom: 14 }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af" }}>
          <span>Generated by Novexa ERP</span>
          <span>{InvoiceNumber(inv.id)}</span>
          <span>Thank you for your business!</span>
        </div>
      </div>
    </div>
  );
}

// ── InvoicePDF modal (view + download + share) ────────────────────────────────
export default function InvoicePDFModal({ inv, userDoc, onClose, payments = [] }) {
  const printRef   = useRef(null);
  const [loading,  setLoading]  = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  async function downloadPDF() {
    if (!printRef.current || loading) return;
    setLoading(true);
    try {
      // dynamic import — keeps bundle small
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

      // handle multi-page
      if (pdfH <= pdf.internal.pageSize.getHeight()) {
        pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
      } else {
        const pageH  = pdf.internal.pageSize.getHeight();
        let yPos     = 0;
        let remaining = pdfH;
        while (remaining > 0) {
          pdf.addImage(imgData, "JPEG", 0, -yPos, pdfW, pdfH);
          remaining -= pageH;
          yPos      += pageH;
          if (remaining > 0) pdf.addPage();
        }
      }

      const fname = `Invoice-${(inv.customerName || inv.customer || "client").replace(/\s+/g, "-")}-${(inv.id || "").slice(-6).toUpperCase()}.pdf`;
      pdf.save(fname);
    } catch (err) {
      alert("PDF generation failed: " + err.message);
    }
    setLoading(false);
  }

  function printInvoice() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank", "width=900,height=700");
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice</title>
      <style>body{margin:0;padding:0;background:#fff;}@media print{body{margin:0;}}</style>
      </head><body>${content}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  }

  async function shareWhatsApp() {
    const name = inv.customerName || inv.customer || "Customer";
    const num  = InvoiceNumber(inv.id);
    const bal  = formatRs(inv.balance || 0);
    const total = formatRs(inv.amount || 0);
    const text = encodeURIComponent(
      `Hi ${name},\n\nYour invoice *${num}* has been generated.\n\n` +
      `Total: *${total}*\nPaid: *${formatRs(inv.amountPaid || 0)}*\nBalance Due: *${bal}*\n\n` +
      `Status: *${inv.status || "Unpaid"}*\n\nPlease make payment at your earliest convenience.\n\nThank you!`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  async function copyLink() {
    const text = `Invoice ${InvoiceNumber(inv.id)} | ${inv.customerName || inv.customer} | Total: ${formatRs(inv.amount)} | Balance: ${formatRs(inv.balance || 0)}`;
    try {
      await navigator.clipboard.writeText(text);
      setShareMsg("Copied to clipboard!");
      setTimeout(() => setShareMsg(""), 2500);
    } catch {
      setShareMsg("Copy failed — try manually.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}>

      {/* action bar */}
      <div className="w-full max-w-[860px] my-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
          <h3 className="text-white font-bold text-base">
            Invoice Preview — {InvoiceNumber(inv.id)}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {/* share msg */}
            {shareMsg && (
              <span className="text-xs font-medium px-3 py-1.5 rounded-full"
                style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                ✓ {shareMsg}
              </span>
            )}
            <button onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#d1d5db" }}>
              📋 Copy Info
            </button>
            <button onClick={shareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25D366" }}>
              💬 WhatsApp
            </button>
            <button onClick={printInvoice}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", color: "#60A5FA" }}>
              🖨️ Print
            </button>
            <button onClick={downloadPDF} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000",
                opacity: loading ? 0.7 : 1, cursor: loading ? "wait" : "pointer" }}>
              {loading ? "Generating..." : "⬇️ Download PDF"}
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-lg">
              ✕
            </button>
          </div>
        </div>

        {/* invoice preview — white card */}
        <div className="overflow-hidden rounded-xl shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          <div ref={printRef}>
            <InvoiceTemplate inv={inv} userDoc={userDoc} payments={payments} />
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-3">
          Scroll down to see full invoice · Click &quot;Download PDF&quot; to save
        </p>
      </div>
    </div>
  );
}
