"use client";
import { useState, useEffect, useRef } from "react";

// ── WhatsApp number formatter ─────────────────────────────────────────────────
function toWhatsAppNumber(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("92") && digits.length >= 12) return digits;
  if (digits.startsWith("03") && digits.length === 11) return "92" + digits.slice(1);
  if (digits.startsWith("3")  && digits.length === 10) return "92"  + digits;
  return digits;
}

// ── Build WhatsApp message (with optional invoice image link) ─────────────────
function buildWhatsAppMessage({ invoice, userDoc, isUpdate, imageUrl }) {
  const formatRs = (n) => "Rs. " + Number(n || 0).toLocaleString("en-PK");
  const invNum   = invoice?.invoiceNumber || ("INV-" + (invoice?.id || "").slice(-6).toUpperCase());
  const bizName  = userDoc?.business || userDoc?.name || "Business";
  const customer = invoice?.customerName || invoice?.customer || invoice?.supplierName || "Customer";
  const amount   = formatRs(invoice?.amount || invoice?.totalAmount);
  const paid     = formatRs(invoice?.amountPaid || invoice?.paidAmount || 0);
  const balance  = formatRs(invoice?.balance || 0);
  const status   = invoice?.status || "Unpaid";
  const date     = invoice?.invoiceDate || invoice?.orderDate || new Date().toISOString().slice(0, 10);

  const statusEmoji = status === "Paid" ? "✅" : status === "Partial" ? "⚡" : "❌";
  const header = isUpdate
    ? `🔄 *Invoice Update | ${bizName}*`
    : `🧾 *New Invoice | ${bizName}*`;

  const items = (invoice?.items || [])
    .filter(it => it.description && !(it.description || "").startsWith("Previous Balance"))
    .slice(0, 6)
    .map(it => `  • ${it.description}${it.variantLabel ? ` (${it.variantLabel})` : ""} × ${it.qty}`)
    .join("\n");

  const lines = [
    header,
    "",
    `👤 *Customer:* ${customer}`,
    `📋 *Invoice No:* ${invNum}`,
    `📅 *Date:* ${date}`,
    "",
    items ? `*Items:*\n${items}` : "",
    "",
    `💰 *Total Amount:* ${amount}`,
    Number(invoice?.amountPaid || invoice?.paidAmount) > 0 ? `✅ *Amount Paid:* ${paid}` : "",
    `📊 *Balance Due:* ${balance}`,
    `${statusEmoji} *Status:* ${status}`,
    invoice?.dueDate ? `⏰ *Due Date:* ${invoice.dueDate}` : "",
    "",
    imageUrl ? `🖼️ *Invoice Image:* ${imageUrl}` : "",
    "",
    `_Powered by Novexa_`,
  ].filter(l => l !== undefined && l !== null && l !== false).filter((l, i, arr) => {
    // collapse multiple consecutive empty strings to one
    if (l === "" && arr[i - 1] === "") return false;
    return true;
  });

  return lines.join("\n");
}

// ── Open WhatsApp with message ────────────────────────────────────────────────
function openWhatsApp(waNumber, message) {
  const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function EmailConfirmationDialog({
  show,
  onConfirm,           // async fn — called when user wants to send email
  onCancel,            // fn(reason: "whatsapp"|"both"|"skip") — called on non-email actions
  recipientEmail,
  recipientPhone,
  invoice,
  userDoc,
  isUpdate,
  documentType = "invoice",
  // Optional: caller can pre-generate image and pass it to avoid re-rendering
  // If not passed, dialog generates it lazily when WhatsApp / Both is clicked
  getInvoiceImageFn,   // async () => imageDataUri — injected by parent
}) {
  const [visible,     setVisible]     = useState(false);
  const [sending,     setSending]     = useState(false);   // email in progress
  const [uploading,   setUploading]   = useState(false);   // cloudinary upload in progress
  const [statusText,  setStatusText]  = useState("");
  const sendingRef  = useRef(false);

  const waNumber = toWhatsAppNumber(recipientPhone);
  const hasWA    = !!waNumber;
  const hasEmail = !!(recipientEmail && recipientEmail.trim());
  const busy     = sending || uploading;

  useEffect(() => {
    if (show) {
      setVisible(true);
      setSending(false);
      setUploading(false);
      setStatusText("");
      sendingRef.current = false;
    } else {
      if (!sendingRef.current) setVisible(false);
    }
  }, [show]);

  // ── Email only ───────────────────────────────────────────────────────────────
  const handleEmail = async () => {
    if (busy) return;
    setSending(true);
    sendingRef.current = true;
    setStatusText("Email bhej rahe hain...");
    try {
      await onConfirm();
    } catch (e) {
      console.error("[EmailConfirmationDialog]", e);
    } finally {
      sendingRef.current = false;
      setSending(false);
      setStatusText("");
      setVisible(false);
    }
  };

  // ── WhatsApp only ────────────────────────────────────────────────────────────
  const handleWhatsApp = async () => {
    if (!waNumber || busy) return;
    let imageUrl = null;

    if (getInvoiceImageFn) {
      setUploading(true);
      setStatusText("Invoice image tayyar ho rahi hai...");
      try {
        const dataUri = await getInvoiceImageFn();
        if (dataUri) {
          setStatusText("Image upload ho rahi hai...");
          const { uploadInvoiceImage } = await import("@/lib/emailUtils");
          imageUrl = await uploadInvoiceImage(dataUri, invoice?.id);
        }
      } catch (_) { /* silently skip link if upload fails */ }
      setUploading(false);
      setStatusText("");
    }

    const msg = buildWhatsAppMessage({ invoice, userDoc, isUpdate, imageUrl });
    openWhatsApp(waNumber, msg);
    setVisible(false);
    setTimeout(() => onCancel("whatsapp"), 150);
  };

  // ── Both: Email + WhatsApp ───────────────────────────────────────────────────
  const handleBoth = async () => {
    if (busy) return;
    setSending(true);
    sendingRef.current = true;
    setStatusText("Email bhej rahe hain...");

    let imageUrl = null;

    // 1. Send email first
    try {
      await onConfirm();
    } catch (e) {
      console.error("[EmailConfirmationDialog both]", e);
    }

    // 2. Upload image for WhatsApp
    if (getInvoiceImageFn && waNumber) {
      setSending(false);
      setUploading(true);
      setStatusText("WhatsApp ke liye image tayyar ho rahi hai...");
      try {
        const dataUri = await getInvoiceImageFn();
        if (dataUri) {
          setStatusText("Image upload ho rahi hai...");
          const { uploadInvoiceImage } = await import("@/lib/emailUtils");
          imageUrl = await uploadInvoiceImage(dataUri, invoice?.id);
        }
      } catch (_) { /* skip link silently */ }
      setUploading(false);
      setStatusText("");
    }

    sendingRef.current = false;
    setSending(false);

    // 3. Open WhatsApp
    if (waNumber) {
      const msg = buildWhatsAppMessage({ invoice, userDoc, isUpdate, imageUrl });
      openWhatsApp(waNumber, msg);
    }

    setVisible(false);
    setTimeout(() => onCancel("both"), 150);
  };

  // ── Skip ─────────────────────────────────────────────────────────────────────
  const handleCancel = () => {
    if (busy) return;
    setVisible(false);
    setTimeout(() => onCancel("skip"), 150);
  };

  if (!show && !busy && !visible) return null;

  const label =
    documentType === "return" ? "return invoice" :
    documentType === "order"  ? "purchase order" :
    "invoice";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>

      <div
        className={`w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl transition-all duration-200 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
        style={{ background: "#0d1117", border: "1px solid rgba(37,99,235,0.3)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(37,99,235,0.12),rgba(37,99,235,0.04))" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.35)" }}>
            {busy
              ? <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              : <span className="text-xl">📤</span>
            }
          </div>
          <div>
            <p className="text-white font-black text-base leading-tight">
              {busy ? statusText || "Please wait..." : `${label === "invoice" ? "Invoice" : label === "purchase order" ? "Order" : "Document"} Bhejein?`}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">
              {busy ? "Please wait karein, band mat karein" : `Bhejne ka tarika chunein`}
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 flex flex-col gap-4">

          {/* Recipient info */}
          {(hasEmail || hasWA) && (
            <div className="flex flex-col gap-2">
              {hasEmail && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                  style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)" }}>
                    <span className="text-xs">📧</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-blue-400 text-[9px] font-bold uppercase tracking-widest">Email</p>
                    <p className="text-white text-xs font-semibold truncate">{recipientEmail}</p>
                  </div>
                </div>
              )}
              {hasWA && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                  style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.25)" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.3)" }}>
                    <span className="text-xs">💬</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#25d366" }}>WhatsApp</p>
                    <p className="text-white text-xs font-semibold truncate">{recipientPhone}</p>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "rgba(37,211,102,0.15)", color: "#25d366", border: "1px solid rgba(37,211,102,0.3)" }}>
                    Available
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Progress bar while busy */}
          {busy && (
            <div className="rounded-xl overflow-hidden h-1.5"
              style={{ background: "rgba(37,99,235,0.15)" }}>
              <div className="h-full rounded-full animate-pulse"
                style={{ background: "linear-gradient(90deg,#2563EB,#25d366)", width: "100%" }} />
            </div>
          )}

          {/* ── Buttons ── */}
          {!busy && (
            <div className="flex flex-col gap-2.5 mt-1">

              {/* WhatsApp — phone only */}
              {hasWA && !hasEmail && (
                <button onClick={handleWhatsApp}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff", boxShadow: "0 4px 16px rgba(37,211,102,0.3)" }}>
                  <span className="text-base">💬</span>
                  WhatsApp Par Bhejein
                </button>
              )}

              {/* Email — email only */}
              {hasEmail && !hasWA && (
                <button onClick={handleEmail}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", color: "#fff", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}>
                  <span className="text-base">📧</span>
                  Email Par Bhejein
                </button>
              )}

              {/* Both available — show 3 options */}
              {hasWA && hasEmail && (
                <>
                  {/* WhatsApp */}
                  <button onClick={handleWhatsApp}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff", boxShadow: "0 4px 16px rgba(37,211,102,0.3)" }}>
                    <span className="text-base">💬</span>
                    WhatsApp Par Bhejein
                  </button>

                  {/* Email */}
                  <button onClick={handleEmail}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", color: "#fff", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}>
                    <span className="text-base">📧</span>
                    Email Par Bhejein
                  </button>

                  {/* Both */}
                  <button onClick={handleBoth}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                    style={{
                      background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                      color: "#fff",
                      boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
                    }}>
                    <span className="text-base">📧💬</span>
                    Dono Par Bhejein
                  </button>
                </>
              )}

              {/* Skip */}
              <button onClick={handleCancel}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af", cursor: "pointer" }}>
                Nahi, Skip Karein
              </button>
            </div>
          )}

          {/* No contact available */}
          {!hasEmail && !hasWA && !busy && (
            <div className="text-center py-2">
              <p className="text-gray-500 text-xs">
                Customer ka email ya phone number nahi mila.<br />
                Invoice save ho gaya hai.
              </p>
              <button onClick={handleCancel}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                Theek Hai, Close Karein
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
