"use client";
import { useState, useEffect, useRef } from "react";

// ── WhatsApp number formatter ─────────────────────────────────────────────────
// Converts local PK number (03xxxxxxxxx) → international (923xxxxxxxxx)
function toWhatsAppNumber(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // Already international format (e.g. 923001234567)
  if (digits.startsWith("92") && digits.length >= 12) return digits;
  // Local PK format: 03xxxxxxxxx → 923xxxxxxxxx
  if (digits.startsWith("03") && digits.length === 11) return "92" + digits.slice(1);
  // +92 already stripped by replace(/\D/g)
  if (digits.startsWith("3") && digits.length === 10) return "92" + digits;

  // For non-PK numbers — return as-is (no country code prefix added)
  return digits;
}

// ── Build WhatsApp invoice message ───────────────────────────────────────────
function buildWhatsAppMessage({ invoice, userDoc, isUpdate }) {
  const formatRs = (n) => "Rs. " + Number(n || 0).toLocaleString("en-PK");
  const invNum   = "INV-" + (invoice?.id || "").slice(-6).toUpperCase();
  const bizName  = userDoc?.business || userDoc?.name || "Business";
  const customer = invoice?.customerName || invoice?.customer || "Customer";
  const amount   = formatRs(invoice?.amount);
  const paid     = formatRs(invoice?.amountPaid || 0);
  const balance  = formatRs(invoice?.balance || 0);
  const status   = invoice?.status || "Unpaid";
  const date     = invoice?.invoiceDate || new Date().toISOString().slice(0, 10);

  const statusEmoji = status === "Paid" ? "✅" : status === "Partial" ? "⚡" : "❌";
  const header = isUpdate
    ? `🔄 *Invoice Update | ${bizName}*`
    : `🧾 *New Invoice | ${bizName}*`;

  // Build items list
  const items = (invoice?.items || [])
    .filter(it => it.description && !(it.description || "").startsWith("Previous Balance"))
    .slice(0, 6) // limit to avoid message too long
    .map(it => `  • ${it.description}${it.variantLabel ? ` (${it.variantLabel})` : ""} × ${it.qty}`)
    .join("\n");

  const message = [
    header,
    "",
    `👤 *Customer:* ${customer}`,
    `📋 *Invoice No:* ${invNum}`,
    `📅 *Date:* ${date}`,
    "",
    items ? `*Items:*\n${items}` : "",
    "",
    `💰 *Total Amount:* ${amount}`,
    Number(invoice?.amountPaid) > 0 ? `✅ *Amount Paid:* ${paid}` : "",
    `📊 *Balance Due:* ${balance}`,
    `${statusEmoji} *Status:* ${status}`,
    invoice?.dueDate ? `⏰ *Due Date:* ${invoice.dueDate}` : "",
    "",
    `_Powered by Novexa_`,
  ]
    .filter(Boolean)
    .join("\n");

  return message;
}

export default function EmailConfirmationDialog({
  show,
  onConfirm,
  onCancel,
  recipientEmail,
  recipientPhone,   // customer phone number for WhatsApp
  invoice,          // full invoice object (for WhatsApp message)
  userDoc,          // business info (for WhatsApp message)
  isUpdate,
  documentType = "invoice",
}) {
  const [visible,  setVisible]  = useState(false);
  const [sending,  setSending]  = useState(false);
  const sendingRef = useRef(false);

  // WhatsApp availability check
  const waNumber  = toWhatsAppNumber(recipientPhone);
  const hasWA     = !!waNumber;
  const hasEmail  = !!(recipientEmail && recipientEmail.trim());

  useEffect(() => {
    if (show) {
      setVisible(true);
      setSending(false);
      sendingRef.current = false;
    } else {
      if (!sendingRef.current) {
        setVisible(false);
      }
    }
  }, [show]);

  const handleEmailConfirm = async () => {
    setSending(true);
    sendingRef.current = true;
    try {
      await onConfirm();
    } catch (e) {
      console.error("[EmailConfirmationDialog]", e);
    } finally {
      sendingRef.current = false;
      setSending(false);
      setVisible(false);
    }
  };

  const handleWhatsApp = () => {
    if (!waNumber) return;
    const msg     = buildWhatsAppMessage({ invoice, userDoc, isUpdate });
    const encoded = encodeURIComponent(msg);
    const url     = `https://wa.me/${waNumber}?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
    // Close dialog after opening WhatsApp
    setVisible(false);
    setTimeout(() => onCancel("whatsapp"), 150);
  };

  const handleCancel = () => {
    if (sendingRef.current) return;
    setVisible(false);
    setTimeout(() => onCancel("skip"), 150);
  };

  if (!show && !sending && !visible) return null;

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
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(37,99,235,0.12),rgba(37,99,235,0.04))" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.35)" }}>
            {sending
              ? <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              : <span className="text-xl">📤</span>
            }
          </div>
          <div>
            <p className="text-white font-black text-base leading-tight">
              {sending ? "Sending Email..." : "Invoice Bhejein?"}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">
              {sending ? "Please wait, do not close" : `Customer ko ${label} bhejne ka tarika chunein`}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">

          {/* Recipient info row */}
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

          {/* Sending progress bar */}
          {sending && (
            <div className="rounded-xl overflow-hidden h-1.5"
              style={{ background: "rgba(37,99,235,0.15)" }}>
              <div className="h-full rounded-full animate-pulse"
                style={{ background: "linear-gradient(90deg,#2563EB,#60a5fa)", width: "100%" }} />
            </div>
          )}

          {/* ── Action Buttons ── */}
          <div className="flex flex-col gap-2.5 mt-1">

            {/* WhatsApp button — show if phone available */}
            {hasWA && !sending && (
              <button
                onClick={handleWhatsApp}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg,#25d366,#128c7e)",
                  color: "#fff",
                  boxShadow: "0 4px 16px rgba(37,211,102,0.3)",
                }}>
                <span className="text-base">💬</span>
                WhatsApp Par Bhejein
              </button>
            )}

            {/* Email button — show if email available */}
            {hasEmail && (
              <button
                onClick={handleEmailConfirm}
                disabled={sending}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                style={{
                  background: sending ? "rgba(37,99,235,0.4)" : "linear-gradient(135deg,#2563EB,#1d4ed8)",
                  color: "#fff",
                  boxShadow: sending ? "none" : "0 4px 16px rgba(37,99,235,0.3)",
                  cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.7 : 1,
                }}>
                <span className="text-base">{sending ? "" : "📧"}</span>
                {sending ? "Sending..." : "Email Par Bhejein"}
              </button>
            )}

            {/* Skip button */}
            {!sending && (
              <button
                onClick={handleCancel}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#9ca3af",
                  cursor: "pointer",
                }}>
                Nahi, Skip Karein
              </button>
            )}
          </div>

          {/* Info text when neither email nor phone available */}
          {!hasEmail && !hasWA && !sending && (
            <div className="text-center py-2">
              <p className="text-gray-500 text-xs">
                Customer ka email ya phone number nahi mila.<br />
                Invoice save ho gaya hai.
              </p>
              <button
                onClick={handleCancel}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#9ca3af",
                }}>
                Theek Hai, Close Karein
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
