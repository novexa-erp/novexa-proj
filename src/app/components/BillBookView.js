"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection, addDoc, getDocs, doc, deleteDoc, updateDoc,
  serverTimestamp, query, orderBy, getDoc, setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import SweetAlert from "./SweetAlert";
import { BlankBillTemplate, buildBillNumber } from "./BillBookPDF";
import InvoicePDFModal from "./InvoicePDF";
import EmailConfirmationDialog from "./EmailConfirmationDialog";
import { generateInvoicePdfBase64, sendInvoiceEmail } from "@/lib/emailUtils";

// ── shared styles ─────────────────────────────────────────────────────────────
const base = {
  width: "100%", outline: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(255,255,255,0.09)",
  borderRadius: 10, padding: "9px 13px",
  color: "#fff", fontSize: 13,
  transition: "border-color .2s, background .2s",
};
const focusStyle = {
  background: "rgba(37,99,235,0.07)",
  border: "1.5px solid rgba(37,99,235,0.5)",
  boxShadow: "0 0 0 3px rgba(37,99,235,0.08)",
};
const lbl = {
  display: "block", color: "#9ca3af", fontSize: 11,
  fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.07em", marginBottom: 5,
};
const cardStyle = {
  background: "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  padding: "20px",
};
const sectionHead = {
  fontSize: 11, fontWeight: 700, color: "#F59E0B",
  textTransform: "uppercase", letterSpacing: "0.08em",
  marginBottom: 14,
};

function SInput({ label, value, onChange, placeholder, type = "text", min, max, disabled }) {
  const [f, setF] = useState(false);
  return (
    <div>
      {label && <label style={lbl}>{label}</label>}
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} min={min} max={max}
        disabled={disabled}
        onFocus={() => setF(true)} onBlur={() => setF(false)}
        style={{ ...base, ...(f && !disabled ? focusStyle : {}), opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "text" }}
      />
    </div>
  );
}

function SSelect({ label, value, onChange, children, disabled }) {
  const [f, setF] = useState(false);
  return (
    <div>
      {label && <label style={lbl}>{label}</label>}
      <select value={value} onChange={onChange} disabled={disabled}
        onFocus={() => setF(true)} onBlur={() => setF(false)}
        style={{ ...base, ...(f && !disabled ? focusStyle : {}), cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
        {children}
      </select>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: checked ? "#2563EB" : "rgba(255,255,255,0.12)",
          position: "relative", transition: "background .2s", flexShrink: 0,
        }}>
        <div style={{
          position: "absolute", top: 3, left: checked ? 18 : 3,
          width: 14, height: 14, borderRadius: "50%",
          background: "#fff", transition: "left .2s",
        }} />
      </div>
      {label && <span style={{ fontSize: 12, color: "#d1d5db" }}>{label}</span>}
    </label>
  );
}

// ── Default config ────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  // Company info visibility
  showLogo: true, showBusinessName: true, showAddress: true,
  showPhone: true, showEmail: true, showWebsite: false,
  showNTN: false, showSTRN: false,
  // Document type
  docType: "Invoice", customDocType: "",
  // Paper & layout
  paperSize: "A4",          // A4 | A5 | A4_2UP
  orientation: "portrait",
  copies: "original",       // original | duplicate | triplicate
  quantity: 10,
  // Bill number
  prefix: "INV-", startNumber: 1, padLength: 4,
  manualBillNumber: "", useManualNumber: false,
  reserveNumbers: false,
  // Table
  rowCount: 10,
  showDiscount: true, showTax: true, showUnit: true, showProductCode: false,
  // Fields
  showBillNo: true, showDate: true,
  showCustomerName: true, showCustomerPhone: true, showCustomerAddress: true,
  showPreviousBalance: true, showPaymentMethod: true,
  showAmountInWords: true, showCustomerSignature: true,
  showAuthorizedSignature: true, showTerms: true, showNotes: true,
  termsText: "", notesText: "",
  // Design
  template: "modern", primaryColor: "#1d4ed8",
  borderStyle: "solid", fontSize: "medium",
  showWatermark: false, watermarkText: "DRAFT", footerText: "",
};

const DOC_TYPES = ["Invoice","Cash Memo","Sales Receipt","Delivery Challan","Quotation","Custom Bill"];
const COPY_LABELS = { original: "Original Only", duplicate: "Original + Duplicate", triplicate: "Original + Duplicate + Triplicate" };
const COPY_COUNT  = { original: 1, duplicate: 2, triplicate: 3 };
const PAPER_LABELS = { A4: "A4 Full Page", A5: "A5 Half Page", A4_2UP: "A4 – Two Bills Per Page" };
const TEMPLATE_LABELS = { modern: "Modern", classic: "Classic", minimal: "Minimal" };

// ── Render one BlankBillTemplate to a canvas via html2canvas ─────────────────
async function renderBillToCanvas(enrichedConfig, billNo, pageSize, html2canvas, React, createRoot) {
  // DOM dimensions — must match PAGE_W / PAGE_H from BillBookPDF exactly
  const domW = pageSize === "A5" ? 560 : 794;
  const domH = pageSize === "A5" ? 794 : 1123;

  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed",
    "top:-9999px",
    "left:-9999px",
    `width:${domW}px`,
    `height:${domH}px`,
    "background:#fff",
    "z-index:9999",
    "overflow:hidden",
    "box-sizing:border-box",
  ].join(";");
  document.body.appendChild(container);

  let root = null;
  try {
    root = createRoot(container);
    await new Promise(resolve => {
      root.render(React.createElement(BlankBillTemplate, { config: enrichedConfig, billNumber: billNo, pageSize }));
      // Three rAF cycles — ensures fonts + backgrounds are fully painted
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    const canvas = await html2canvas(container, {
      scale: 2,                 // 2× for sharpness
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width:        domW,
      height:       domH,
      windowWidth:  domW,
      windowHeight: domH,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
    });
    return { canvas, domW, domH };
  } finally {
    try { root?.unmount(); } catch (_) {}
    try { document.body.removeChild(container); } catch (_) {}
  }
}

// ── PDF generation util ───────────────────────────────────────────────────────
async function generateBillBookPDF(config, userDoc, billNumbers) {
  const [html2canvasMod, jsPDFMod, reactDomMod, reactMod] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
    import("react-dom/client"),
    import("react"),
  ]);
  const html2canvas    = html2canvasMod.default;
  const jsPDF          = jsPDFMod.default;
  const { createRoot } = reactDomMod;
  const React          = reactMod.default;

  const isA5   = config.paperSize === "A5";
  const is2UP  = config.paperSize === "A4_2UP";
  const isLand = config.orientation === "landscape" && !is2UP;
  const copies = COPY_COUNT[config.copies] || 1;

  // PDF page size in mm
  const pdfW = isLand ? 297 : (isA5 ? 148 : 210);
  const pdfH = isLand ? 210 : (isA5 ? 210 : 297);

  // jsPDF — unit px so we can pass pixel coords directly, then convert
  // Use 'mm' with hotFix: pass exact mm values derived from canvas aspect ratio
  const pdf = new jsPDF({
    orientation: isLand ? "landscape" : "portrait",
    unit: "mm",
    format: isA5 ? "a5" : "a4",
    compress: true,
  });
  // Remove any default margins jsPDF might add
  pdf.setProperties({ title: `BillBook-${billNumbers[0]}` });

  const copyLabels = ["ORIGINAL", "DUPLICATE", "TRIPLICATE"];
  const pageSize   = isA5 ? "A5" : "A4";

  const baseEnriched = {
    ...config,
    businessName: userDoc?.business || userDoc?.name || "",
    address:      userDoc?.address  || "",
    phone:        userDoc?.phone    || "",
    email:        userDoc?.email    || "",
    website:      userDoc?.website  || "",
    ntn:          userDoc?.ntn      || "",
    strn:         userDoc?.strn     || "",
    logoDataUrl:  config.showLogo ? (userDoc?.logoDataUrl || "") : "",
  };

  const renders = [];
  for (const billNo of billNumbers) {
    for (let ci = 0; ci < copies; ci++) {
      renders.push({
        billNo,
        enrichedConfig: {
          ...baseEnriched,
          showWatermark: copies > 1 ? true : config.showWatermark,
          watermarkText: copies > 1 ? copyLabels[ci] : config.watermarkText,
        },
      });
    }
  }

  let pageAdded = false;

  if (is2UP) {
    for (let i = 0; i < renders.length; i += 2) {
      if (pageAdded) pdf.addPage();
      pageAdded = true;
      const halfH = pdfH / 2;

      for (let slot = 0; slot < 2; slot++) {
        const r = renders[i + slot];
        if (!r) break;
        const { canvas } = await renderBillToCanvas(r.enrichedConfig, r.billNo, pageSize, html2canvas, React, createRoot);
        // Fit image exactly to half-page width and half-page height
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, slot * halfH, pdfW, halfH);
      }
    }
  } else {
    for (const r of renders) {
      const { canvas, domW, domH } = await renderBillToCanvas(r.enrichedConfig, r.billNo, pageSize, html2canvas, React, createRoot);
      if (pageAdded) pdf.addPage();
      pageAdded = true;

      // Calculate exact mm dimensions preserving aspect ratio
      // canvas is domW*2 × domH*2 pixels (scale:2)
      // We want it to fill the page exactly: x=0, y=0, w=pdfW, h=pdfH
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,      // x — start from left edge, no margin
        0,      // y — start from top edge, no margin
        pdfW,   // width in mm = full page width
        pdfH,   // height in mm = full page height
        undefined,
        "FAST"
      );
    }
  }

  return pdf;
}

// ── Generate bill numbers array ───────────────────────────────────────────────
function makeBillNumbers(config) {
  if (config.useManualNumber) return [config.manualBillNumber || "BILL-0001"];
  const nums = [];
  for (let i = 0; i < Math.max(1, Number(config.quantity) || 1); i++) {
    nums.push(buildBillNumber(config.prefix, Number(config.startNumber) + i, Number(config.padLength) || 4));
  }
  return nums;
}

// ── Live Preview Bill (shown in config panel) ─────────────────────────────────
function LivePreview({ config, userDoc }) {
  const enriched = {
    ...config,
    businessName: userDoc?.business || userDoc?.name || "Your Business",
    address:      userDoc?.address  || "",
    phone:        userDoc?.phone    || "",
    email:        userDoc?.email    || "",
    website:      userDoc?.website  || "",
    ntn:          userDoc?.ntn      || "",
    strn:         userDoc?.strn     || "",
    logoDataUrl:  config.showLogo ? (userDoc?.logoDataUrl || "") : "",
  };
  const billNums  = makeBillNumbers(config);
  const pageSize  = config.paperSize === "A5" ? "A5" : "A4";
  const scalePct  = config.paperSize === "A5" ? 0.44 : 0.35;

  return (
    <div style={{ overflow: "hidden", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "#1a1f2e" }}>
      <div style={{ padding: "8px 14px", background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>📄 Live Preview — {pageSize}</span>
        <span style={{ fontSize: 10, color: "#6b7280" }}>#{billNums[0]}</span>
      </div>
      <div style={{ overflow: "auto", maxHeight: 440, padding: 12 }}>
        <div style={{ transformOrigin: "top left", transform: `scale(${scalePct})`, width: `${100 / scalePct}%` }}>
          <BlankBillTemplate config={enriched} billNumber={billNums[0]} pageSize={pageSize} />
        </div>
        <div style={{ height: config.paperSize === "A5" ? 248 : 394 }} />
      </div>
    </div>
  );
}

// ── Generate Bill Book Tab ────────────────────────────────────────────────────
function GenerateTab({ uid, userDoc, onGenerated, initialConfig }) {
  const [config, setConfig]         = useState(() => initialConfig ? { ...DEFAULT_CONFIG, ...initialConfig } : DEFAULT_CONFIG);
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingTpl,  setSavingTpl]  = useState(false);
  const [tplName,    setTplName]    = useState("");
  const [showTplInput, setShowTplInput] = useState(false);
  const [alert, setAlert]           = useState({ show: false, type: "", title: "", message: "" });

  const set = useCallback((key, val) => setConfig(c => ({ ...c, [key]: val })), []);

  const billNumbers = makeBillNumbers(config);
  const firstBill   = billNumbers[0];

  // ── Download PDF ─────────────────────────────────────────────────────────────
  async function handleDownload() {
    if (generating) return;
    setGenerating(true);
    try {
      const pdf = await generateBillBookPDF(config, userDoc, billNumbers);
      pdf.save(`BillBook-${firstBill}-${config.docType}.pdf`);

      // Save generation history (no invoice records)
      await addDoc(collection(db, "users", uid, "billBookHistory"), {
        docType:      config.docType === "Custom Bill" ? (config.customDocType || "Custom") : config.docType,
        startBill:    billNumbers[0],
        endBill:      billNumbers[billNumbers.length - 1],
        quantity:     billNumbers.length,
        templateName: tplName || "Unnamed",
        generatedAt:  serverTimestamp(),
        generatedBy:  userDoc?.name || userDoc?.email || "User",
      });

      // Reserve bill numbers in Firestore if user opted in
      if (config.reserveNumbers) {
        const seqRef = doc(db, "users", uid, "settings", "billBookSequence");
        await setDoc(seqRef, {
          lastNumber: Number(config.startNumber) + billNumbers.length - 1,
          prefix:     config.prefix,
          padLength:  config.padLength,
          updatedAt:  serverTimestamp(),
        }, { merge: true });
      }

      onGenerated && onGenerated();
      setAlert({ show: true, type: "success", title: "PDF Downloaded! 📥", message: `${billNumbers.length} blank bill(s) generated successfully.` });
    } catch (err) {
      console.error("[BillBook PDF]", err);
      setAlert({ show: true, type: "error", title: "Generation Failed", message: `Error: ${err?.message || String(err)}` });
    }
    setGenerating(false);
  }

  // ── Print ─────────────────────────────────────────────────────────────────────
  async function handlePrint() {
    if (generating) return;
    setGenerating(true);
    try {
      const [reactDomMod, reactMod] = await Promise.all([
        import("react-dom/client"),
        import("react"),
      ]);
      const { createRoot } = reactDomMod;
      const React           = reactMod.default;

      const isA5    = config.paperSize === "A5";
      const copies  = COPY_COUNT[config.copies] || 1;
      const copyLabels = ["ORIGINAL", "DUPLICATE", "TRIPLICATE"];
      const pageSize   = isA5 ? "A5" : "A4";

      const baseEnriched = {
        ...config,
        businessName: userDoc?.business || userDoc?.name || "",
        address:      userDoc?.address  || "",
        phone:        userDoc?.phone    || "",
        email:        userDoc?.email    || "",
        website:      userDoc?.website  || "",
        ntn:          userDoc?.ntn      || "",
        strn:         userDoc?.strn     || "",
        logoDataUrl:  config.showLogo ? (userDoc?.logoDataUrl || "") : "",
      };

      // Build all bill+copy combos
      const renders = [];
      for (const billNo of billNumbers) {
        for (let ci = 0; ci < copies; ci++) {
          renders.push({
            billNo,
            enrichedConfig: {
              ...baseEnriched,
              showWatermark: copies > 1 ? true : config.showWatermark,
              watermarkText: copies > 1 ? copyLabels[ci] : config.watermarkText,
            },
          });
        }
      }

      // Render all bills into a hidden container, then print via iframe
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;background:#fff;z-index:9999;";
      document.body.appendChild(wrapper);

      // Render all bills sequentially into wrapper
      const billHTMLParts = [];
      for (const r of renders) {
        const tmp = document.createElement("div");
        tmp.style.cssText = `width:${isA5 ? 560 : 794}px;background:#fff;page-break-after:always;`;
        wrapper.appendChild(tmp);

        await new Promise(resolve => {
          const root = createRoot(tmp);
          root.render(React.createElement(BlankBillTemplate, { config: r.enrichedConfig, billNumber: r.billNo, pageSize }));
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });

        billHTMLParts.push(tmp.outerHTML);
        try { wrapper.removeChild(tmp); } catch(_) {}
      }
      document.body.removeChild(wrapper);

      // Build a full print-ready HTML document
      const paperCSS = isA5
        ? "@page { size: A5 portrait; margin: 0; }"
        : config.orientation === "landscape"
          ? "@page { size: A4 landscape; margin: 0; }"
          : "@page { size: A4 portrait; margin: 0; }";

      const printHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  ${paperCSS}
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .bill-page { page-break-after: always; background: #fff; }
  .bill-page:last-child { page-break-after: avoid; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .bill-page { page-break-after: always; }
    .bill-page:last-child { page-break-after: avoid; }
  }
</style>
</head>
<body>
${billHTMLParts.map(h => `<div class="bill-page">${h}</div>`).join("\n")}
</body>
</html>`;

      // Print via a hidden iframe (much more reliable than window.open)
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;";
      document.body.appendChild(iframe);

      iframe.contentDocument.open();
      iframe.contentDocument.write(printHTML);
      iframe.contentDocument.close();

      // Wait for iframe resources to load then print
      await new Promise(resolve => setTimeout(resolve, 600));
      iframe.contentWindow.focus();
      iframe.contentWindow.print();

      // Cleanup after print dialog closes
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch(_) {}
      }, 3000);

    } catch (err) {
      console.error("[BillBook Print]", err);
      setAlert({ show: true, type: "error", title: "Print Failed", message: `Error: ${err?.message || String(err)}` });
    }
    setGenerating(false);
  }

  // ── Save as Template ──────────────────────────────────────────────────────────
  async function handleSaveTemplate() {
    if (!tplName.trim()) { setShowTplInput(true); return; }
    setSavingTpl(true);
    try {
      await addDoc(collection(db, "users", uid, "billBookTemplates"), {
        name:      tplName.trim(),
        config,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setAlert({ show: true, type: "success", title: "Template Saved! ✓", message: `"${tplName}" template save ho gaya.` });
      setShowTplInput(false);
    } catch {
      setAlert({ show: true, type: "error", title: "Save Failed", message: "Template save nahi ho saka." });
    }
    setSavingTpl(false);
  }

  return (
    <div>
      <SweetAlert show={alert.show} type={alert.type} title={alert.title} message={alert.message}
        onClose={() => setAlert(a => ({ ...a, show: false }))} />

      {/* ── Action Buttons Row ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setShowPreview(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: showPreview ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(37,99,235,0.3)", color: "#60a5fa" }}>
          👁 {showPreview ? "Hide Preview" : "Show Preview"}
        </button>
        <button onClick={handleDownload} disabled={generating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000", opacity: generating ? 0.7 : 1 }}>
          {generating ? "⏳ Generating..." : "📥 Download PDF"}
        </button>
        <button onClick={handlePrint} disabled={generating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.3)", color: "#60a5fa", opacity: generating ? 0.7 : 1 }}>
          🖨️ Print
        </button>
        <button onClick={() => setShowTplInput(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd" }}>
          💾 Save Template
        </button>
        <button onClick={() => setConfig(DEFAULT_CONFIG)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
          ↺ Reset
        </button>
      </div>

      {/* Template name input */}
      {showTplInput && (
        <div style={{ ...cardStyle, marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <SInput label="Template Name" value={tplName}
              onChange={e => setTplName(e.target.value)} placeholder='e.g. "Shop Invoice A4"' />
          </div>
          <button onClick={handleSaveTemplate} disabled={savingTpl || !tplName.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#fff", opacity: savingTpl || !tplName.trim() ? 0.6 : 1, flexShrink: 0 }}>
            {savingTpl ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      <div className={showPreview ? "grid lg:grid-cols-2 gap-6" : "grid gap-6"}>
        {/* ── Left: Config panels ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: showPreview ? undefined : 740 }}>

          {/* Company Info */}
          <div style={cardStyle}>
            <p style={sectionHead}>🏢 Company Information</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
              {[
                { key: "showLogo",         label: "Logo"          },
                { key: "showBusinessName", label: "Business Name" },
                { key: "showAddress",      label: "Address"       },
                { key: "showPhone",        label: "Phone"         },
                { key: "showEmail",        label: "Email"         },
                { key: "showWebsite",      label: "Website"       },
                { key: "showNTN",          label: "NTN"           },
                { key: "showSTRN",         label: "STRN"          },
              ].map(f => (
                <Toggle key={f.key} checked={config[f.key]} onChange={v => set(f.key, v)} label={f.label} />
              ))}
            </div>
            <p style={{ fontSize: 10, color: "#6b7280", marginTop: 10 }}>
              ℹ️ Info is auto-loaded from Business Settings — editing it here won't change your saved settings.
            </p>
          </div>

          {/* Document Type */}
          <div style={cardStyle}>
            <p style={sectionHead}>📄 Document Type</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {DOC_TYPES.map(t => (
                <button key={t} onClick={() => set("docType", t)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: config.docType === t ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                    border: config.docType === t ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    color: config.docType === t ? "#F59E0B" : "#9ca3af",
                  }}>{t}</button>
              ))}
            </div>
            {config.docType === "Custom Bill" && (
              <div style={{ marginTop: 10 }}>
                <SInput label="Custom Name" value={config.customDocType}
                  onChange={e => set("customDocType", e.target.value)} placeholder='e.g. "Delivery Note"' />
              </div>
            )}
          </div>

          {/* Paper & Layout */}
          <div style={cardStyle}>
            <p style={sectionHead}>📐 Paper & Layout</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <SSelect label="Paper Size" value={config.paperSize} onChange={e => set("paperSize", e.target.value)}>
                {Object.entries(PAPER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </SSelect>
              <SSelect label="Orientation" value={config.orientation} onChange={e => set("orientation", e.target.value)}
                disabled={config.paperSize === "A4_2UP"}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </SSelect>
              <SSelect label="Copies" value={config.copies} onChange={e => set("copies", e.target.value)}>
                {Object.entries(COPY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </SSelect>
              <SInput label="Quantity (Bills)" type="number" min={1} max={500}
                value={config.quantity} onChange={e => set("quantity", Math.min(500, Math.max(1, Number(e.target.value))))} />
            </div>
          </div>

          {/* Bill Number Settings */}
          <div style={cardStyle}>
            <p style={sectionHead}>🔢 Bill Number Settings</p>
            <div style={{ marginBottom: 10 }}>
              <Toggle checked={config.useManualNumber} onChange={v => set("useManualNumber", v)} label="Manual bill number" />
            </div>
            {config.useManualNumber ? (
              <SInput label="Manual Bill Number" value={config.manualBillNumber}
                onChange={e => set("manualBillNumber", e.target.value)} placeholder="e.g. BILL-0001" />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <SInput label="Prefix" value={config.prefix}
                  onChange={e => set("prefix", e.target.value)} placeholder="INV-" />
                <SInput label="Starting Number" type="number" min={1}
                  value={config.startNumber} onChange={e => set("startNumber", Math.max(1, Number(e.target.value)))} />
                <SInput label="Padding Length" type="number" min={1} max={8}
                  value={config.padLength} onChange={e => set("padLength", Math.min(8, Math.max(1, Number(e.target.value))))} />
                <div>
                  <label style={lbl}>Preview</label>
                  <div style={{ ...base, color: "#F59E0B", fontWeight: 700, fontFamily: "monospace", cursor: "default" }}>
                    {firstBill}
                  </div>
                </div>
              </div>
            )}
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10 }}>
              <Toggle checked={config.reserveNumbers} onChange={v => set("reserveNumbers", v)}
                label='Reserve bill numbers in Firestore (saves "billBookSequence" — does not touch invoice counter)' />
            </div>
          </div>

          {/* Product Table Settings */}
          <div style={cardStyle}>
            <p style={sectionHead}>📋 Product Table</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <SSelect label="Empty Rows" value={config.rowCount} onChange={e => set("rowCount", Number(e.target.value))}>
                {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} rows</option>)}
              </SSelect>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { key: "showDiscount",    label: "Discount column"      },
                { key: "showTax",         label: "Tax column"           },
                { key: "showUnit",        label: "Unit column"          },
                { key: "showProductCode", label: "Product Code column"  },
              ].map(f => (
                <Toggle key={f.key} checked={config[f.key]} onChange={v => set(f.key, v)} label={f.label} />
              ))}
            </div>
          </div>

          {/* Blank Bill Fields */}
          <div style={cardStyle}>
            <p style={sectionHead}>📝 Blank Bill Fields</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { key: "showBillNo",               label: "Bill Number"          },
                { key: "showDate",                 label: "Date"                 },
                { key: "showCustomerName",         label: "Customer Name"        },
                { key: "showCustomerPhone",        label: "Customer Phone"       },
                { key: "showCustomerAddress",      label: "Customer Address"     },
                { key: "showPreviousBalance",      label: "Previous Balance"     },
                { key: "showPaymentMethod",        label: "Payment Method"       },
                { key: "showAmountInWords",        label: "Amount in Words"      },
                { key: "showCustomerSignature",    label: "Customer Signature"   },
                { key: "showAuthorizedSignature",  label: "Authorized Signature" },
                { key: "showTerms",                label: "Terms & Conditions"   },
                { key: "showNotes",                label: "Notes"                },
              ].map(f => (
                <Toggle key={f.key} checked={config[f.key]} onChange={v => set(f.key, v)} label={f.label} />
              ))}
            </div>
            {config.showTerms && (
              <div style={{ marginTop: 10 }}>
                <label style={lbl}>Terms & Conditions Text (optional)</label>
                <textarea value={config.termsText} onChange={e => set("termsText", e.target.value)}
                  rows={2} placeholder="Leave blank for empty lines..."
                  style={{ ...base, resize: "vertical" }} />
              </div>
            )}
            {config.showNotes && (
              <div style={{ marginTop: 10 }}>
                <label style={lbl}>Notes Text (optional)</label>
                <textarea value={config.notesText} onChange={e => set("notesText", e.target.value)}
                  rows={2} placeholder="Leave blank for empty lines..."
                  style={{ ...base, resize: "vertical" }} />
              </div>
            )}
          </div>

          {/* Design Options */}
          <div style={cardStyle}>
            <p style={sectionHead}>🎨 Design Options</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {/* Template */}
              <div>
                <label style={lbl}>Template</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {Object.entries(TEMPLATE_LABELS).map(([v, l]) => (
                    <button key={v} onClick={() => set("template", v)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: config.template === v ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.04)",
                        border: config.template === v ? "1px solid rgba(37,99,235,0.5)" : "1px solid rgba(255,255,255,0.08)",
                        color: config.template === v ? "#60a5fa" : "#9ca3af",
                      }}>{l}</button>
                  ))}
                </div>
              </div>
              {/* Primary color */}
              <div>
                <label style={lbl}>Primary Color</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="color" value={config.primaryColor}
                    onChange={e => set("primaryColor", e.target.value)}
                    style={{ width: 44, height: 38, borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", padding: 2 }} />
                  <div style={{ ...base, flex: 1, fontFamily: "monospace", color: "#d1d5db" }}>
                    {config.primaryColor}
                  </div>
                </div>
                {/* Color presets */}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {["#1d4ed8","#059669","#dc2626","#d97706","#7c3aed","#0891b2","#111827"].map(c => (
                    <button key={c} onClick={() => set("primaryColor", c)}
                      style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: config.primaryColor === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer" }} />
                  ))}
                </div>
              </div>
              <SSelect label="Border Style" value={config.borderStyle} onChange={e => set("borderStyle", e.target.value)}>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="thick">Thick Accent</option>
                <option value="none">None</option>
              </SSelect>
              <SSelect label="Font Size" value={config.fontSize} onChange={e => set("fontSize", e.target.value)}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </SSelect>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <Toggle checked={config.showWatermark} onChange={v => set("showWatermark", v)} label="Show Watermark" />
            </div>
            {config.showWatermark && (
              <div style={{ marginTop: 10 }}>
                <SInput label="Watermark Text" value={config.watermarkText}
                  onChange={e => set("watermarkText", e.target.value)} placeholder="DRAFT" />
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <SInput label="Footer Text (optional)" value={config.footerText}
                onChange={e => set("footerText", e.target.value)} placeholder="e.g. Thank you for your business!" />
            </div>
          </div>

        </div>

        {/* ── Right: Live Preview ── */}
        {showPreview && (
        <div>
          <div style={{ position: "sticky", top: 20 }}>
            <LivePreview config={config} userDoc={userDoc} />
            <p style={{ fontSize: 11, color: "#6b7280", textAlign: "center", marginTop: 8 }}>
              Preview is scaled down. Actual PDF will be full quality.
            </p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ── Saved Templates Tab ───────────────────────────────────────────────────────
function SavedTemplatesTab({ uid, userDoc, onLoadTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [deleting,  setDeleting]  = useState(null);
  const [alert,     setAlert]     = useState({ show: false, type: "", title: "", message: "" });

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    getDocs(query(collection(db, "users", uid, "billBookTemplates"), orderBy("createdAt", "desc")))
      .then(snap => {
        setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [uid]);

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, "users", uid, "billBookTemplates", id));
      setTemplates(p => p.filter(t => t.id !== id));
      setAlert({ show: true, type: "success", title: "Deleted ✓", message: `"${name}" delete ho gaya.` });
    } catch {
      setAlert({ show: true, type: "error", title: "Error", message: "Delete nahi ho saka." });
    }
    setDeleting(null);
  }

  function fmtDt(ts) {
    if (!ts) return "—";
    try { const d = ts?.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return "—"; }
  }

  return (
    <div>
      <SweetAlert show={alert.show} type={alert.type} title={alert.title} message={alert.message}
        onClose={() => setAlert(a => ({ ...a, show: false }))} />

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>Loading templates...</div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Koi saved template nahi hai.</p>
          <p style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>Generate tab se template save karein.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {templates.map(tpl => (
            <div key={tpl.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  📋 {tpl.name}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 11, color: "#9ca3af" }}>
                  <span>📄 {tpl.config?.docType || "—"}</span>
                  <span>📐 {PAPER_LABELS[tpl.config?.paperSize] || tpl.config?.paperSize || "A4"}</span>
                  <span>🎨 {TEMPLATE_LABELS[tpl.config?.template] || tpl.config?.template || "Modern"}</span>
                  <span>🗓 {fmtDt(tpl.createdAt)}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => onLoadTemplate(tpl.config)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#F59E0B" }}>
                  Load
                </button>
                <button onClick={() => handleDelete(tpl.id, tpl.name)} disabled={deleting === tpl.id}
                  className="px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", opacity: deleting === tpl.id ? 0.5 : 1 }}>
                  {deleting === tpl.id ? "..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Generation History Tab ────────────────────────────────────────────────────
function HistoryTab({ uid }) {
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [alert,    setAlert]    = useState({ show: false, type: "", title: "", message: "" });

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    getDocs(query(collection(db, "users", uid, "billBookHistory"), orderBy("generatedAt", "desc")))
      .then(snap => {
        setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [uid]);

  async function handleDelete(id) {
    setDeleting(id);
    try {
      await deleteDoc(doc(db, "users", uid, "billBookHistory", id));
      setHistory(p => p.filter(h => h.id !== id));
    } catch {
      setAlert({ show: true, type: "error", title: "Error", message: "Delete nahi ho saka." });
    }
    setDeleting(null);
  }

  function fmtDt(ts) {
    if (!ts) return "—";
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
        + " " + d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch { return "—"; }
  }

  return (
    <div>
      <SweetAlert show={alert.show} type={alert.type} title={alert.title} message={alert.message}
        onClose={() => setAlert(a => ({ ...a, show: false }))} />

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>Loading history...</div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📜</div>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Abhi tak koi bill book generate nahi ki.</p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 16 }}>
            ℹ️ History sirf generation records rakhti hai — koi invoice, stock ya accounting entry nahi banti.
          </p>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto auto", gap: 8, padding: "6px 12px", borderRadius: 8, marginBottom: 8, background: "rgba(255,255,255,0.03)" }}>
            {["Doc Type","Start Bill","End Bill","Qty","Generated By","Date"].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map(h => (
              <div key={h.id} style={{ ...cardStyle, padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto auto", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>
                  📄 {h.docType || "—"}
                </span>
                <span style={{ fontSize: 12, color: "#F59E0B", fontFamily: "monospace" }}>{h.startBill || "—"}</span>
                <span style={{ fontSize: 12, color: "#F59E0B", fontFamily: "monospace" }}>{h.endBill || "—"}</span>
                <span style={{ fontSize: 12, color: "#d1d5db", textAlign: "center" }}>{h.quantity || 1}</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{h.generatedBy || "—"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "#6b7280" }}>{fmtDt(h.generatedAt)}</span>
                  <button onClick={() => handleDelete(h.id)} disabled={deleting === h.id}
                    style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", cursor: "pointer", fontSize: 12, flexShrink: 0, opacity: deleting === h.id ? 0.5 : 1 }}>
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Digital Register Tab ─────────────────────────────────────────────────────
const STATUS_STYLE_REG = {
  Paid:    { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
  Unpaid:  { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  Partial: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
  Deleted: { color: "#9ca3af", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.2)" },
};

function formatRsReg(n) {
  if (!n && n !== 0) return "Rs. 0";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}

function fmtDateReg(ts, fallback) {
  if (!ts && !fallback) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : new Date(fallback);
    return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return fallback || "—"; }
}

function DigitalRegisterTab({ uid, userDoc }) {
  const [allInvoices, setAllInvoices]   = useState([]);
  const [loading,     setLoading]       = useState(true);
  const [search,      setSearch]        = useState("");
  const [filterType,  setFilterType]    = useState("all");   // all | direct | customer
  const [filterStatus,setFilterStatus]  = useState("all");   // all | Paid | Unpaid | Partial | deleted
  const [pdfInvoice,  setPdfInvoice]    = useState(null);    // invoice to view in PDF modal
  const [alert,       setAlert]         = useState({ show: false, type: "", title: "", message: "" });
  const [emailConfirm,setEmailConfirm]  = useState({ show: false, invoice: null });

  // ── Fetch all invoices (direct + every customer's invoices) ─────────────────
  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    async function fetchAll() {
      try {
        // 1. Direct invoices (including soft-deleted)
        const directSnap = await getDocs(
          query(collection(db, "users", uid, "invoices"), orderBy("createdAt", "desc"))
        );
        const direct = directSnap.docs.map(d => ({
          id: d.id, ...d.data(),
          _source: "direct",
          _customerId: d.data().customerId || null,
          _customerName: null,
        }));

        // 2. All customers
        const custSnap = await getDocs(
          query(collection(db, "users", uid, "customers"), orderBy("createdAt", "desc"))
        );
        const customers = custSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 3. Each customer's invoices
        const custInvPromises = customers.map(async (cust) => {
          const snap = await getDocs(
            query(collection(db, "users", uid, "customers", cust.id, "invoices"), orderBy("createdAt", "desc"))
          );
          return snap.docs.map(d => ({
            id: d.id, ...d.data(),
            _source: "customer",
            _customerId: cust.id,
            _customerName: cust.name || cust.businessName || "",
          }));
        });
        const custInvArrays = await Promise.all(custInvPromises);
        const custInvs = custInvArrays.flat();

        // 4. Merge — avoid duplicates (customer-linked direct invoices already appear in customer subcol)
        // Direct invoices that have customerId set are already in custInvs, so exclude them from direct
        const directIds = new Set(direct.filter(i => !i.customerId).map(i => i.id));
        const custInvIds = new Set(custInvs.map(i => i.id));

        // Keep: pure direct (no customerId) + all customer invoices
        const merged = [
          ...direct.filter(i => !i.customerId),
          ...custInvs,
        ];

        // Sort by createdAt desc
        merged.sort((a, b) => {
          const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.invoiceDate || 0);
          const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.invoiceDate || 0);
          return tb - ta;
        });

        setAllInvoices(merged);
      } catch (err) {
        console.error("[DigitalRegister] fetch error:", err);
      }
      setLoading(false);
    }

    fetchAll();
  }, [uid]);

  // ── Compute effective status (live, not from stored field) ──────────────────
  function getEffectiveStatus(inv) {
    if (inv.deleted) return "Deleted";
    const isPrevBal = it => (it.description || "").startsWith("Previous Balance · INV-");
    const actual = inv.actualAmount != null
      ? Number(inv.actualAmount)
      : (inv.items || []).filter(it => !isPrevBal(it))
          .reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0)
        || Number(inv.amount) || 0;
    const paid   = Number(inv.amountPaid) || 0;
    const bal    = Math.max(0, actual - paid);
    if (bal === 0 && actual > 0) return "Paid";
    if (paid > 0) return "Partial";
    return "Unpaid";
  }

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = allInvoices.filter(inv => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      (inv.customerName || inv.customer || "").toLowerCase().includes(q) ||
      (inv._customerName || "").toLowerCase().includes(q) ||
      (inv.invoiceNumber || "").toLowerCase().includes(q) ||
      inv.id.toLowerCase().includes(q);

    const effStatus = getEffectiveStatus(inv);
    const matchStatus = filterStatus === "all" || effStatus.toLowerCase() === filterStatus.toLowerCase();
    const matchType   = filterType === "all" ||
      (filterType === "direct" && inv._source === "direct") ||
      (filterType === "customer" && inv._source === "customer");

    return matchSearch && matchStatus && matchType;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────────
  // Helper: get real invoice amount excluding "Previous Balance" carry-forward lines and subtracting returns
  function getStatActualAmt(inv) {
    const isPrevBal = it => (it.description || "").startsWith("Previous Balance · INV-");
    const itemsTotal = (inv.items || [])
      .filter(it => !isPrevBal(it))
      .reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
    const base = itemsTotal > 0 ? itemsTotal : (inv.actualAmount != null ? Number(inv.actualAmount) : Number(inv.amount) || 0);
    const totalReturns = (inv._pastReturns || []).reduce((s, r) => s + (Number(r.returnAmount) || 0), 0);
    return Math.max(0, base - totalReturns);
  }

  const activeInvoices = allInvoices.filter(i => !i.deleted);
  const totalInvoices  = activeInvoices.length;
  const totalAmount    = activeInvoices.reduce((s, i) => s + getStatActualAmt(i), 0);
  const totalCollected = activeInvoices.reduce((s, i) => s + (Number(i.amountPaid) || 0), 0);
  const totalBalance   = activeInvoices.reduce((s, i) => s + Math.max(0, getStatActualAmt(i) - (Number(i.amountPaid) || 0)), 0);

  // ── Send email handler ───────────────────────────────────────────────────────
  async function handleSendEmail(inv) {
    const hasContact = !!(inv.email?.trim() || inv.phone?.trim());
    if (!hasContact) {
      setAlert({ show: true, type: "warning", title: "No Contact Info", message: "Is invoice mein email ya phone nahi hai." });
      return;
    }
    setEmailConfirm({ show: true, invoice: inv });
  }

  // ── WhatsApp handler ─────────────────────────────────────────────────────────
  function handleWhatsApp(inv) {
    const phone = (inv.phone || "").replace(/\D/g, "");
    const invNum = inv.invoiceNumber || `INV-${inv.id.slice(-4).toUpperCase()}`;
    const bal    = Number(inv.balance) || 0;
    const msg    = `Assalam o Alaikum ${inv.customerName || inv.customer || ""},\n\nAapki invoice *${invNum}* ki details:\nTotal: ${formatRsReg(inv.amount)}\nPaid: ${formatRsReg(inv.amountPaid)}\nBalance: ${formatRsReg(bal)}\n\nShukriya!`;
    const url    = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 300 }}>
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-4 border-t-amber-500 border-r-purple-500 border-b-blue-500 border-l-pink-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">📒</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SweetAlert show={alert.show} type={alert.type} title={alert.title} message={alert.message}
        onClose={() => setAlert(a => ({ ...a, show: false }))} />

      {/* ── Header info ── */}
      <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
        <p style={{ color: "#34d399", fontSize: 12, fontWeight: 600 }}>
          📒 Digital Register — saari invoices (normal + customer) yahan permanent record hain. Delete karne ke baad bhi yahan dikhengi.
        </p>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total Invoices", val: totalInvoices,          icon: "🧾", color: "#F59E0B" },
          { label: "Total Amount",   val: formatRsReg(totalAmount),   icon: "💰", color: "#a78bfa" },
          { label: "Collected",      val: formatRsReg(totalCollected), icon: "💵", color: "#34d399" },
          { label: "Outstanding",    val: formatRsReg(totalBalance),   icon: "⏳", color: "#f87171" },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{s.label}</p>
            <p style={{ color: s.color, fontWeight: 800, fontSize: 15 }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* ── Search & Filters ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
          <input
            type="text"
            placeholder="Invoice number ya customer name likhein..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...base, paddingLeft: 36, width: "100%" }}
          />
        </div>

        {/* Status filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {[
            { id: "all",     label: "All",      icon: "📋" },
            { id: "Unpaid",  label: "Unpaid",   icon: "❌" },
            { id: "Partial", label: "Partial",  icon: "⚡" },
            { id: "Paid",    label: "Paid",     icon: "✅" },
            { id: "Deleted", label: "Deleted",  icon: "🗑️" },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterStatus(f.id)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: filterStatus === f.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                border: filterStatus === f.id ? "1px solid rgba(245,158,11,0.45)" : "1px solid rgba(255,255,255,0.08)",
                color: filterStatus === f.id ? "#F59E0B" : "#9ca3af",
              }}>
              {f.icon} {f.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {[
            { id: "all",      label: "All Types"  },
            { id: "direct",   label: "Direct"     },
            { id: "customer", label: "Customer"   },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterType(f.id)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: filterType === f.id ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.04)",
                border: filterType === f.id ? "1px solid rgba(96,165,250,0.35)" : "1px solid rgba(255,255,255,0.08)",
                color: filterType === f.id ? "#60a5fa" : "#9ca3af",
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 110px 110px 110px 100px 180px", gap: 8, padding: "10px 16px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {["Invoice #","Customer","Amount","Paid","Balance","Status","Actions"].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{search ? "🔍" : "📒"}</div>
            <p style={{ color: "#9ca3af", fontSize: 14 }}>
              {search ? `"${search}" se koi invoice nahi mili.` : "Koi invoice nahi mili."}
            </p>
          </div>
        ) : (
          filtered.map((inv) => {
            const effStatus = getEffectiveStatus(inv);
            const st        = STATUS_STYLE_REG[effStatus] || STATUS_STYLE_REG["Unpaid"];
            const invNum    = inv.invoiceNumber || `INV-${inv.id.slice(-4).toUpperCase()}`;
            const custName  = inv.customerName || inv.customer || inv._customerName || "—";
            const dateStr   = fmtDateReg(inv.createdAt, inv.invoiceDate);
            const isDeleted = inv.deleted;

            return (
              <div key={`${inv._source}-${inv.id}`}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: isDeleted ? 0.65 : 1,
                  display: "grid", gridTemplateColumns: "140px 1fr 110px 110px 110px 100px 180px",
                  gap: 8, padding: "12px 16px", alignItems: "center" }}>

                {/* Invoice number + date + badges */}
                <div>
                  <p style={{ color: "#F59E0B", fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{invNum}</p>
                  <p style={{ color: "#6b7280", fontSize: 10 }}>{dateStr}</p>
                  <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                    {isDeleted && (
                      <span style={{ fontSize: 9, color: "#6b7280", background: "rgba(156,163,175,0.1)", border: "1px solid rgba(156,163,175,0.2)", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                        DELETED
                      </span>
                    )}
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                      color: inv._source === "customer" ? "#a78bfa" : "#60a5fa",
                      background: inv._source === "customer" ? "rgba(167,139,250,0.08)" : "rgba(96,165,250,0.08)",
                      border: `1px solid ${inv._source === "customer" ? "rgba(167,139,250,0.2)" : "rgba(96,165,250,0.2)"}` }}>
                      {inv._source === "customer" ? "CUST" : "DIRECT"}
                    </span>
                  </div>
                </div>

                {/* Customer name + phone */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{custName}</p>
                  {inv.phone && <p style={{ color: "#6b7280", fontSize: 10 }}>{inv.phone}</p>}
                </div>

                {/* Amount */}
                <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, textAlign: "right" }}>{formatRsReg(inv.amount)}</p>

                {/* Paid */}
                <p style={{ color: "#34d399", fontSize: 13, fontWeight: 600, textAlign: "right" }}>{formatRsReg(inv.amountPaid || 0)}</p>

                {/* Balance */}
                <p style={{ color: Number(inv.balance) > 0 ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600, textAlign: "right" }}>
                  {formatRsReg(inv.balance || 0)}
                </p>

                {/* Status badge */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: st.bg, color: st.color, border: `1px solid ${st.border}`, whiteSpace: "nowrap" }}>
                    {effStatus}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button onClick={() => setPdfInvoice(inv)} title="View / Print"
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
                    👁 View
                  </button>
                  {!isDeleted && inv.phone?.trim() && (
                    <button onClick={() => handleWhatsApp(inv)} title="WhatsApp"
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)", color: "#34d399" }}>
                      💬
                    </button>
                  )}
                  {!isDeleted && inv.email?.trim() && (
                    <button onClick={() => handleSendEmail(inv)} title="Email"
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa" }}>
                      📧
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Total count */}
      {filtered.length > 0 && (
        <p style={{ textAlign: "center", fontSize: 11, color: "#6b7280" }}>
          {filtered.length} invoice{filtered.length !== 1 ? "s" : ""} mili — register mein total {allInvoices.length} records hain
        </p>
      )}

      {/* ── PDF View Modal ── */}
      {pdfInvoice && (
        <InvoicePDFModal
          inv={pdfInvoice}
          uid={uid}
          userDoc={userDoc}
          onClose={() => setPdfInvoice(null)}
          payments={[]}
        />
      )}

      {/* ── Email Confirmation ── */}
      <EmailConfirmationDialog
        show={emailConfirm.show}
        recipientEmail={emailConfirm.invoice?.email}
        recipientPhone={emailConfirm.invoice?.phone}
        invoice={emailConfirm.invoice}
        userDoc={userDoc}
        isUpdate={true}
        documentType="invoice"
        getInvoiceImageFn={emailConfirm.invoice ? async () => {
          const { generateInvoiceImageBase64 } = await import("@/lib/emailUtils");
          return generateInvoiceImageBase64(emailConfirm.invoice, userDoc, []);
        } : undefined}
        onConfirm={async () => {
          if (emailConfirm.invoice) {
            try {
              const pdfBase64 = await generateInvoicePdfBase64(emailConfirm.invoice, userDoc, []);
              const result    = await sendInvoiceEmail(emailConfirm.invoice, userDoc, pdfBase64, uid, true, []);
              if (result.success) {
                setAlert({ show: true, type: "success", title: "Email Bhej Di! 📧", message: `Invoice ${emailConfirm.invoice.email} par bhej di gayi.` });
              } else {
                setAlert({ show: true, type: "warning", title: "Email Failed", message: `Email nahi bhej saki: ${result.error}` });
              }
            } catch (e) {
              setAlert({ show: true, type: "error", title: "Email Failed", message: "Kuch masla hua email bhejte waqt." });
            }
          }
          setEmailConfirm({ show: false, invoice: null });
        }}
        onCancel={(reason) => {
          if (reason === "whatsapp" || reason === "both") {
            setAlert({ show: true, type: "success", title: "WhatsApp! 💬", message: "WhatsApp khul gaya — message bhej dein." });
          }
          setEmailConfirm({ show: false, invoice: null });
        }}
      />
    </div>
  );
}

// ── Main BillBookView component ───────────────────────────────────────────────
const SUB_TABS = [
  { id: "register",  icon: "📒", label: "Digital Register"   },
  { id: "generate",  icon: "⚡", label: "Generate Bill Book" },
  { id: "templates", icon: "📋", label: "Saved Templates"    },
  { id: "history",   icon: "📜", label: "Generation History" },
];

export default function BillBookView({ uid, userDoc }) {
  const [activeTab, setActiveTab]   = useState("generate");
  const [historyKey, setHistoryKey] = useState(0);
  const [loadedConfig, setLoadedConfig] = useState(null);

  function handleLoadTemplate(cfg) {
    setLoadedConfig(cfg);
    setActiveTab("generate");
  }

  return (
    <div style={{ minHeight: "60vh" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          📖 Bill Book
        </h1>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>
          Generate blank printable bill books — no invoice, stock or accounting entry is created.
        </p>
      </div>

      {/* ── Sub-tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: activeTab === tab.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
              border: activeTab === tab.id ? "1px solid rgba(245,158,11,0.45)" : "1px solid rgba(255,255,255,0.08)",
              color: activeTab === tab.id ? "#F59E0B" : "#9ca3af",
            }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === "generate" && (
        <GenerateTab
          key={loadedConfig ? JSON.stringify(loadedConfig).slice(0, 40) : "default"}
          uid={uid}
          userDoc={userDoc}
          initialConfig={loadedConfig}
          onGenerated={() => setHistoryKey(k => k + 1)}
        />
      )}
      {activeTab === "register" && (
        <DigitalRegisterTab uid={uid} userDoc={userDoc} />
      )}
      {activeTab === "templates" && (
        <SavedTemplatesTab uid={uid} userDoc={userDoc} onLoadTemplate={handleLoadTemplate} />
      )}
      {activeTab === "history" && (
        <HistoryTab key={historyKey} uid={uid} />
      )}
    </div>
  );
}
