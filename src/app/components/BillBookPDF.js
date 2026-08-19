"use client";

/**
 * BillBookPDF.js — Blank Bill Book PDF Templates
 * Rendered off-screen via html2canvas + jsPDF.
 * Does NOT create invoices, touch inventory, payments, or analytics.
 */

function padNum(n, length) {
  return String(n).padStart(length, "0");
}
export function buildBillNumber(prefix, serial, padLength) {
  return `${prefix}${padNum(serial, padLength)}`;
}

// ── Page dimensions (px @ 96 dpi) ────────────────────────────────────────────
// A4 portrait  = 794 × 1123 px
// A5 portrait  = 560 × 794  px
// We MUST keep all content within these heights — nothing must overflow.
export const PAGE_W = { A4: 794, A5: 560 };
export const PAGE_H = { A4: 1123, A5: 794 };

// ── Blank Bill Template ───────────────────────────────────────────────────────
export function BlankBillTemplate({ config, billNumber, pageSize = "A4" }) {
  const {
    showLogo = true,
    showBusinessName = true,
    showAddress = true,
    showPhone = true,
    showEmail = true,
    showWebsite = true,
    showNTN = false,
    showSTRN = false,
    businessName = "",
    address = "",
    phone = "",
    email = "",
    website = "",
    ntn = "",
    strn = "",
    logoDataUrl = "",
    docType = "Invoice",
    customDocType = "",
    template = "modern",
    primaryColor = "#1d4ed8",
    borderStyle = "solid",
    fontSize = "medium",
    showWatermark = false,
    watermarkText = "DRAFT",
    footerText = "",
    rowCount = 10,
    showDiscount = true,
    showTax = true,
    showUnit = true,
    showProductCode = false,
    showBillNo = true,
    showDate = true,
    showCustomerName = true,
    showCustomerPhone = true,
    showCustomerAddress = true,
    showPreviousBalance = true,
    showPaymentMethod = true,
    showAmountInWords = true,
    showCustomerSignature = true,
    showAuthorizedSignature = true,
    showTerms = true,
    showNotes = true,
    termsText = "",
    notesText = "",
  } = config || {};

  const docLabel = docType === "Custom" ? (customDocType || "Bill") : docType;
  const isA5     = pageSize === "A5";
  const W        = isA5 ? PAGE_W.A5 : PAGE_W.A4;
  const H        = isA5 ? PAGE_H.A5 : PAGE_H.A4;

  // Tighter font sizes so everything fits on one page
  const fz = fontSize === "small" ? 10 : fontSize === "large" ? 12 : 11;
  // Padding — keep tight so content doesn't overflow
  const padV = isA5 ? 20 : 24;
  const padH = isA5 ? 24 : 36;

  const colors = {
    modern:  { accent: primaryColor, headerBg: primaryColor, headerText: "#ffffff", altRow: "#f1f5f9", border: "#cbd5e1", labelText: "#374151", subText: "#4b5563" },
    classic: { accent: primaryColor, headerBg: "#1e293b",    headerText: "#ffffff", altRow: "#f3f4f6", border: "#d1d5db", labelText: "#374151", subText: "#4b5563" },
    minimal: { accent: primaryColor, headerBg: "#ffffff",    headerText: primaryColor, altRow: "#f9fafb", border: "#e5e7eb", labelText: "#374151", subText: "#4b5563" },
  };
  const C = colors[template] || colors.modern;

  const borderProp  = borderStyle === "dashed" ? `1px dashed ${C.border}` : borderStyle === "none" ? "none" : `1px solid ${C.border}`;
  const outerBorder = borderStyle === "thick"  ? `3px solid ${C.accent}` : borderProp;
  const pca         = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

  // Row height — reduce if more rows to stay within page
  const rowH = rowCount <= 10
    ? (isA5 ? 20 : 22)
    : rowCount <= 15
      ? (isA5 ? 17 : 19)
      : (isA5 ? 14 : 16);

  const cols = [
    { label: "#",           width: isA5 ? 22 : 28,  show: true },
    { label: "Code",        width: isA5 ? 44 : 55,  show: showProductCode },
    { label: "Description", width: "auto",           show: true },
    { label: "Unit",        width: isA5 ? 32 : 40,  show: showUnit },
    { label: "Qty",         width: isA5 ? 32 : 40,  show: true },
    { label: "Rate",        width: isA5 ? 50 : 64,  show: true },
    { label: "Disc",        width: isA5 ? 40 : 52,  show: showDiscount },
    { label: "Tax",         width: isA5 ? 40 : 52,  show: showTax },
    { label: "Amount",      width: isA5 ? 58 : 72,  show: true },
  ].filter(c => c.show);

  return (
    // Outer wrapper: EXACT page size — nothing renders outside this box
    <div style={{
      width: W,
      height: H,
      overflow: "hidden",       // ← critical: clips anything that overflows
      background: "#ffffff",
      color: "#111111",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      fontSize: fz,
      padding: `${padV}px ${padH}px`,
      boxSizing: "border-box",
      position: "relative",
      border: outerBorder,
      ...pca,
    }}>

      {/* ── Watermark — clipped inside overflow:hidden parent ── */}
      {showWatermark && (
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%) rotate(-35deg)",
          fontSize: isA5 ? 44 : 54,
          fontWeight: 900,
          color: C.accent,
          opacity: 0.07,
          letterSpacing: "4px",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
          textTransform: "uppercase",
          ...pca,
        }}>
          {watermarkText || docLabel.toUpperCase()}
        </div>
      )}

      {/* Top accent bar */}
      {template !== "minimal" && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: C.accent, ...pca }} />
      )}
      {template === "minimal" && (
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: C.accent, ...pca }} />
      )}

      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isA5 ? 10 : 14, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            {showLogo && logoDataUrl && (
              <img src={logoDataUrl} alt="Logo"
                style={{ width: isA5 ? 40 : 50, height: isA5 ? 40 : 50, objectFit: "contain", borderRadius: 5, flexShrink: 0 }} />
            )}
            <div>
              {showBusinessName && businessName && (
                <div style={{ fontWeight: 800, fontSize: fz + 5, color: "#111111", letterSpacing: "-0.3px", lineHeight: 1.2 }}>
                  {businessName}
                </div>
              )}
              {showAddress  && address  && <div style={{ fontSize: fz - 1, color: C.subText, marginTop: 2, maxWidth: isA5 ? 170 : 250 }}>{address}</div>}
              {showPhone    && phone    && <div style={{ fontSize: fz - 1, color: C.subText, marginTop: 1 }}>📞 {phone}</div>}
              {showEmail    && email    && <div style={{ fontSize: fz - 1, color: C.subText, marginTop: 1 }}>✉ {email}</div>}
              {showWebsite  && website  && <div style={{ fontSize: fz - 1, color: C.subText, marginTop: 1 }}>🌐 {website}</div>}
              {showNTN      && ntn      && <div style={{ fontSize: fz - 1, color: C.subText, marginTop: 1 }}>NTN: {ntn}</div>}
              {showSTRN     && strn     && <div style={{ fontSize: fz - 1, color: C.subText, marginTop: 1 }}>STRN: {strn}</div>}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: isA5 ? 18 : 22, fontWeight: 900, color: C.accent, letterSpacing: "1px", lineHeight: 1, textTransform: "uppercase", ...pca }}>
              {docLabel}
            </div>
            {showBillNo && (
              <table style={{ marginTop: 5, marginLeft: "auto", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ fontSize: fz, fontWeight: 700, color: "#111111", padding: "3px 10px", background: `${C.accent}12`, borderRadius: 4, border: `1.5px solid ${C.accent}35`, whiteSpace: "nowrap", textAlign: "center", ...pca }}>
                      # {billNumber || "______________________"}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
            {showDate && (
              <table style={{ marginTop: 5, marginLeft: "auto", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ fontSize: fz - 1, color: C.labelText, fontWeight: 600, whiteSpace: "nowrap", paddingRight: 4 }}>Date:</td>
                    <td style={{ width: isA5 ? 90 : 110, borderBottom: `1.5px solid ${C.border}` }}>&nbsp;</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 2, background: C.accent, opacity: 0.2, marginBottom: isA5 ? 8 : 12, flexShrink: 0, ...pca }} />

        {/* ── Customer Info ── */}
        <div style={{ marginBottom: isA5 ? 8 : 12, flexShrink: 0 }}>
          <div style={{ padding: isA5 ? "6px 10px" : "8px 14px", border: `1.5px solid ${C.border}`, borderRadius: 7, background: C.altRow, ...pca }}>
            <div style={{ fontSize: fz - 1, fontWeight: 800, color: C.accent, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, ...pca }}>Bill To</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {showCustomerName && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: fz - 1, color: C.labelText, fontWeight: 600, minWidth: 52 }}>Name:</span>
                  <span style={{ flex: 1, borderBottom: `1.5px solid ${C.border}` }}>&nbsp;</span>
                </div>
              )}
              {showCustomerPhone && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: fz - 1, color: C.labelText, fontWeight: 600, minWidth: 52 }}>Phone:</span>
                  <span style={{ flex: 1, borderBottom: `1.5px solid ${C.border}` }}>&nbsp;</span>
                </div>
              )}
              {showCustomerAddress && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: fz - 1, color: C.labelText, fontWeight: 600, minWidth: 52 }}>Address:</span>
                  <span style={{ flex: 1, borderBottom: `1.5px solid ${C.border}` }}>&nbsp;</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Items Table — flex-shrink:0 keeps it stable ── */}
        <div style={{ flexShrink: 0, marginBottom: isA5 ? 8 : 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: fz - 1 }}>
            <thead>
              <tr style={{ background: C.headerBg, ...pca }}>
                {cols.map((col) => (
                  <th key={col.label} style={{
                    padding: isA5 ? "5px 3px" : "6px 5px",
                    textAlign: col.label === "Description" ? "left" : "center",
                    color: C.headerText,
                    fontWeight: 700,
                    fontSize: fz - 1,
                    width: col.width !== "auto" ? col.width : undefined,
                    borderTop: "none",
                    borderRight: template === "minimal" ? `1px solid ${C.border}` : "none",
                    borderBottom: template === "minimal" ? `2px solid ${C.accent}` : "none",
                    borderLeft: template === "minimal" ? `1px solid ${C.border}` : "none",
                    letterSpacing: "0.02em",
                    ...pca,
                  }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }).map((_, i) => (
                <tr key={i} style={{ background: i % 2 === 1 ? C.altRow : "#ffffff", ...pca }}>
                  {cols.map((col) => (
                    <td key={col.label} style={{
                      padding: isA5 ? "0 3px" : "0 5px",
                      textAlign: "center",
                      borderTop: "none",
                      borderRight: `1px solid ${C.border}`,
                      borderBottom: `1px solid ${C.border}`,
                      borderLeft: `1px solid ${C.border}`,
                      height: rowH,
                      color: "#111111",
                      fontSize: fz - 1,
                      verticalAlign: "middle",
                    }}>
                      {col.label === "#" ? <span style={{ color: C.subText, fontWeight: 600, display: "block", textAlign: "center" }}>{i + 1}</span> : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Totals — pure table for pixel-perfect PDF alignment ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: isA5 ? 6 : 8 }}>
          <table style={{ width: isA5 ? 210 : 260, borderCollapse: "collapse" }}>
            <tbody>
              {[
                { label: "Subtotal",         show: true,                bold: false, accent: false },
                { label: "Discount",         show: showDiscount,        bold: false, accent: false },
                { label: "Tax / GST",        show: showTax,             bold: false, accent: false },
                { label: "Previous Balance", show: showPreviousBalance,  bold: false, accent: false },
                { label: "Grand Total",      show: true,                bold: true,  accent: true  },
                { label: "Paid Amount",      show: true,                bold: false, accent: false },
                { label: "Balance Due",      show: true,                bold: true,  accent: false },
              ].filter(r => r.show).map((row) => (
                <tr key={row.label} style={{ background: row.accent ? `${C.accent}15` : "transparent", ...pca }}>
                  <td style={{
                    padding: isA5 ? "3px 6px" : "4px 8px",
                    fontSize: row.bold ? fz : fz - 1,
                    fontWeight: row.bold ? 800 : 500,
                    color: row.accent ? C.accent : row.bold ? "#111111" : C.labelText,
                    borderTop: row.bold && !row.accent ? `1.5px solid ${C.border}` : "none",
                    borderRight: "none",
                    borderBottom: "none",
                    borderLeft: "none",
                    width: "60%",
                    ...pca,
                  }}>
                    {row.label}
                  </td>
                  <td style={{
                    padding: isA5 ? "3px 6px" : "4px 8px",
                    borderTop: row.bold && !row.accent ? `1.5px solid ${C.border}` : "none",
                    borderRight: "none",
                    borderBottom: `1.5px solid ${row.bold ? C.accent : C.border}`,
                    borderLeft: "none",
                    width: "40%",
                    textAlign: "right",
                    ...pca,
                  }}>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Amount in Words */}
        {showAmountInWords && (
          <div style={{ marginBottom: isA5 ? 6 : 8, padding: isA5 ? "5px 10px" : "6px 12px", border: `1.5px solid ${C.border}`, borderRadius: 5, background: C.altRow, display: "flex", alignItems: "center", gap: 8, flexShrink: 0, ...pca }}>
            <span style={{ fontSize: fz - 1, color: C.labelText, fontWeight: 700, whiteSpace: "nowrap" }}>Amount in Words:</span>
            <span style={{ flex: 1, borderBottom: `1.5px solid ${C.border}` }}>&nbsp;</span>
          </div>
        )}

        {/* Payment Method */}
        {showPaymentMethod && (
          <div style={{ marginBottom: isA5 ? 6 : 8, display: "flex", alignItems: "center", flexWrap: "wrap", gap: isA5 ? 6 : 10, flexShrink: 0 }}>
            <span style={{ fontSize: fz - 1, color: C.labelText, fontWeight: 700 }}>Payment Method:</span>
            {["Cash", "Card", "Bank Transfer", "Cheque", "Other"].map(m => (
              <span key={m} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: fz - 1, color: "#374151", fontWeight: 500 }}>
                <span style={{ display: "inline-block", width: 11, height: 11, borderTop: `1.5px solid #374151`, borderRight: `1.5px solid #374151`, borderBottom: `1.5px solid #374151`, borderLeft: `1.5px solid #374151`, borderRadius: "50%", flexShrink: 0 }} />
                {m}
              </span>
            ))}
          </div>
        )}

        {/* Terms & Notes */}
        {(showTerms || showNotes) && (
          <div style={{ display: "flex", gap: isA5 ? 8 : 12, marginBottom: isA5 ? 6 : 8, flexShrink: 0 }}>
            {showTerms && (
              <div style={{ flex: 1, padding: isA5 ? "5px 8px" : "7px 11px", border: `1.5px solid ${C.border}`, borderRadius: 5 }}>
                <div style={{ fontSize: fz - 1, fontWeight: 800, color: C.labelText, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Terms &amp; Conditions</div>
                <div style={{ fontSize: fz - 1, color: "#374151", lineHeight: 1.6, minHeight: isA5 ? 28 : 34 }}>
                  {termsText || <span style={{ color: "#9ca3af" }}>________________________________________<br />________________________________________</span>}
                </div>
              </div>
            )}
            {showNotes && (
              <div style={{ flex: 1, padding: isA5 ? "5px 8px" : "7px 11px", border: `1.5px solid ${C.border}`, borderRadius: 5 }}>
                <div style={{ fontSize: fz - 1, fontWeight: 800, color: C.labelText, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: fz - 1, color: "#374151", lineHeight: 1.6, minHeight: isA5 ? 28 : 34 }}>
                  {notesText || <span style={{ color: "#9ca3af" }}>________________________________________<br />________________________________________</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Signatures + Footer — absolutely pinned to page bottom */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
        }}>
          {/* Signatures */}
          {(showCustomerSignature || showAuthorizedSignature) && (
            <div style={{
              display: "flex",
              justifyContent: showCustomerSignature && showAuthorizedSignature ? "space-between" : "flex-end",
              marginBottom: isA5 ? 6 : 10,
              gap: isA5 ? 16 : 28,
            }}>
              {showCustomerSignature && (
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ height: isA5 ? 32 : 40, borderBottom: `2px solid #374151` }} />
                  <div style={{ fontSize: fz - 1, color: C.labelText, marginTop: 4, fontWeight: 700 }}>Customer Signature</div>
                </div>
              )}
              {showAuthorizedSignature && (
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ height: isA5 ? 32 : 40, borderBottom: `2px solid #374151` }} />
                  <div style={{ fontSize: fz - 1, color: C.labelText, marginTop: 4, fontWeight: 700 }}>Authorized Signature</div>
                </div>
              )}
            </div>
          )}

          {/* Footer — always at very bottom */}
          <div style={{
            borderTop: `1.5px solid ${C.border}`,
            paddingTop: isA5 ? 4 : 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            ...pca,
          }}>
            <span style={{ fontSize: fz - 2, color: C.subText, fontWeight: 500 }}>
              {footerText || ""}
            </span>
            <span style={{ fontSize: fz - 2, color: "#9ca3af", fontWeight: 500 }}>
              Generated by <strong style={{ color: C.accent, fontWeight: 700 }}>Novexa</strong>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
