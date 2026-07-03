"use client";
import { useState, useEffect } from "react";

export default function EmailConfirmationDialog({ show, onConfirm, onCancel, recipientEmail, documentType = "invoice" }) {
  const [visible,  setVisible]  = useState(false);
  const [sending,  setSending]  = useState(false);

  useEffect(() => {
    if (show) setVisible(true);
    else { setVisible(false); setSending(false); }
  }, [show]);

  // Keep dialog open while sending — only close after onConfirm resolves
  const handleConfirm = async () => {
    setSending(true);
    try {
      await onConfirm();
    } finally {
      setSending(false);
    }
  };

  const handleCancel = () => {
    if (sending) return; // block cancel while sending
    setVisible(false);
    setTimeout(() => onCancel(), 150);
  };

  if (!show) return null;

  const label =
    documentType === "return" ? "return invoice" :
    documentType === "order"  ? "purchase order" :
    "invoice";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>

      <div className={`w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl transition-all duration-200 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
        style={{ background: "#0d1117", border: "1px solid rgba(37,99,235,0.3)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(37,99,235,0.12),rgba(37,99,235,0.04))" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.35)" }}>
            {sending
              ? <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              : <span className="text-xl">📧</span>
            }
          </div>
          <div>
            <p className="text-white font-black text-base leading-tight">
              {sending ? "Sending Email..." : "Send Email?"}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">
              {sending ? "Please wait, do not close" : "Confirm email delivery"}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-gray-400 text-sm leading-relaxed">
            Do you want to email this <span className="text-white font-semibold">{label}</span> to the customer?
          </p>

          {recipientEmail && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)" }}>
                <span className="text-sm">@</span>
              </div>
              <div className="min-w-0">
                <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-0.5">Recipient</p>
                <p className="text-white text-sm font-semibold truncate">{recipientEmail}</p>
              </div>
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

          {/* Buttons */}
          <div className="flex gap-3 mt-1">
            <button onClick={handleCancel} disabled={sending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: sending ? "#4b5563" : "#9ca3af",
                cursor: sending ? "not-allowed" : "pointer",
              }}>
              No, Don't Send
            </button>
            <button onClick={handleConfirm} disabled={sending}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: sending ? "rgba(37,99,235,0.4)" : "linear-gradient(135deg,#2563EB,#1d4ed8)",
                color: "#fff",
                boxShadow: sending ? "none" : "0 4px 16px rgba(37,99,235,0.3)",
                cursor: sending ? "not-allowed" : "pointer",
                opacity: sending ? 0.7 : 1,
              }}>
              {sending ? "Sending..." : "Yes, Send Email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
