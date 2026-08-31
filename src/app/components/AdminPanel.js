"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import AdminUserDetail from "./AdminUserDetail";
import SupportInbox from "./SupportInbox";
import PackageManager from "./PackageManager";
import AdminAddonRequests from "./AdminAddonRequests";
import { encryptJson, encryptedFileName, decryptFile, isEncryptedFile, NOVEXA_DEFAULT_KEY } from "@/lib/backupCrypto";

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID;

/* ── helpers ──────────────────────────────────────────────────────────────── */
function todayStr() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}
function daysLeft(activeTo, activeToTime) {
  if (!activeTo) return null;
  const timeStr = activeToTime || "23:59:59";
  const expStr  = `${activeTo}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}`;
  return Math.ceil((new Date(expStr) - new Date()) / 86400000);
}

/* ── Digital Clock ────────────────────────────────────────────────────────── */
function DigitalClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh  = String(time.getHours()).padStart(2, "0");
  const mm  = String(time.getMinutes()).padStart(2, "0");
  const ss  = String(time.getSeconds()).padStart(2, "0");
  const ampm = time.getHours() >= 12 ? "PM" : "AM";
  const hh12 = String(time.getHours() % 12 || 12).padStart(2, "0");

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0"
      style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
      <span className="text-blue-400 text-[10px]">🕐</span>
      <span className="font-mono font-bold tracking-widest"
        style={{ color: "#60a5fa", fontSize: 13, letterSpacing: "0.12em" }}>
        {hh12}:{mm}
        <span className="animate-pulse">:</span>
        {ss}
      </span>
      <span className="text-blue-500 text-[10px] font-bold">{ampm}</span>
    </div>
  );
}

const STATUS_STYLE = {
  active:      { color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)",  label: "Active"   },
  frozen:      { color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)",  label: "Frozen"   },
  deleted:     { color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", label: "Deleted"  },
  not_started: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  label: "Pending"  },
};

const inputStyle = {
  width: "100%", outline: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(255,255,255,0.09)",
  borderRadius: 10, padding: "9px 13px",
  color: "#fff", fontSize: 13,
};
const labelStyle = {
  display: "block", color: "#9ca3af", fontSize: 11,
  fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.07em", marginBottom: 5,
};

/* ── Reusable Input ───────────────────────────────────────────────────────── */
function SInput({ label, type = "text", value, onChange, placeholder, required, min, max }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} required={required} min={min} max={max}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          ...inputStyle,
          ...(focused ? { border: "1.5px solid rgba(37,99,235,0.6)", background: "rgba(37,99,235,0.07)", boxShadow: "0 0 0 3px rgba(37,99,235,0.1)" } : {}),
        }}
      />
    </div>
  );
}

/* ── Toast ────────────────────────────────────────────────────────────────── */
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold"
          style={{
            background: t.type === "success" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
            border: `1px solid ${t.type === "success" ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)"}`,
            color: t.type === "success" ? "#34d399" : "#f87171",
            backdropFilter: "blur(16px)",
            minWidth: 260,
            animation: "slideUp 0.3s ease",
          }}>
          <span className="text-base">{t.type === "success" ? "✓" : "✕"}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Confirm Dialog ───────────────────────────────────────────────────────── */
function ConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <p className="text-4xl">⚠️</p>
        <h3 className="text-white font-bold text-lg">{title}</h3>
        <p className="text-gray-300 text-sm">{message}</p>
        <div className="flex gap-3 mt-1">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
            style={{ background: confirmColor || "rgba(239,68,68,0.15)", border: `1px solid ${confirmColor ? confirmColor.replace("0.15","0.4") : "rgba(239,68,68,0.4)"}`, color: "#fff" }}>
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── User Form Modal ──────────────────────────────────────────────────────── */
const EMPTY_FORM = { name: "", email: "", password: "", phone: "", address: "", activeFrom: "", activeTo: "", activeToTime: "", maxDevices: "1", plan: "starter", subscriptionType: "active", billingPeriod: "monthly", paymentMethod: "cash" };

// Plan default maxDevices — jab plan select ho, yeh automatically set hota hai
const PLAN_DEFAULT_DEVICES = {
  starter:      1,
  business:     5,
  professional: 15,
  enterprise:   50,
};

const PLAN_OPTIONS = [
  { id: "starter",      label: "💎 Starter",      desc: "1 device · 100 invoices · Basic features",        color: "#10B981" },
  { id: "business",     label: "🚀 Business",      desc: "5 devices · Unlimited invoices · Analytics",      color: "#2563EB" },
  { id: "professional", label: "👑 Professional",  desc: "15 devices · All features · Multi-branch",        color: "#F59E0B" },
  { id: "enterprise",   label: "🏢 Enterprise",    desc: "50 devices · Custom setup · Full access",         color: "#A855F7" },
];

// Pure helper — compute end date given a start date string and billing period
// Used for NEW subscriptions (activeFrom → activeTo), applies -1 day so period is inclusive
function calcEndDateStatic(fromDateStr, period) {
  if (!fromDateStr) return "";
  const d = new Date(fromDateStr + "T00:00:00");
  if (period === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
    d.setDate(d.getDate() - 1);
  } else {
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

// Renewal helper — extend an existing end date by 1 month/year (no -1 day)
// e.g. Aug 14 + 1 month = Sep 14
function calcRenewalEndDate(currentEndStr, period) {
  if (!currentEndStr) return "";
  const d = new Date(currentEndStr + "T00:00:00");
  if (period === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

// Trial renewal helper — extend by 7 days
function calcTrialRenewalEndDate(currentEndStr) {
  if (!currentEndStr) return "";
  const d = new Date(currentEndStr + "T00:00:00");
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

// Get display start of next period (currentEnd + 1 day) — for UI display only
function calcRenewalDisplayStart(currentEndStr) {
  if (!currentEndStr) return "";
  const d = new Date(currentEndStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Registration Invoice Dialog ────────────────────────────────────────────────
function RegInvoiceDialog({ data, getToken, onToast, onClose }) {
  const [emailSending, setEmailSending] = useState(false);
  const [emailDone,    setEmailDone]    = useState(false);

  function planLabel(p) { return p ? p.charAt(0).toUpperCase() + p.slice(1) : "Starter"; }
  function fmtPayment(m) {
    if (m === "online") return "Online Transfer";
    if (m === "cheque") return "Cheque";
    return "Cash";
  }

  // Build WhatsApp message
  function buildWhatsAppText() {
    const isTrial = data.subscriptionType === "trial";
    const plan    = planLabel(data.plan);
    const lines = [
      `Assalam-o-Alaikum ${data.name}! 👋`,
      ``,
      `Novexa ERP mein aapka account create kar diya gaya hai. 🎉`,
      ``,
      `📋 *Account Details:*`,
      `• Naam: ${data.name}`,
      `• Email: ${data.email}`,
      data.password ? `• Password: ${data.password}` : null,
      `• Plan: *${plan} Plan*${isTrial ? " (Free Trial)" : ""}`,
      `• Active: ${data.activeFrom} to ${data.activeTo}`,
      isTrial ? null : `• Payment: ${fmtPayment(data.paymentMethod)}`,
      ``,
      `🌐 Login karein: https://novexaerp.com`,
      ``,
      `Koi bhi masla ho to humse rabta karein. Shukriya! 🙏`,
    ].filter(l => l !== null);
    return encodeURIComponent(lines.join("\n"));
  }

  async function handleEmail() {
    setEmailSending(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/send-registration-invoice", {
        method:  "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          uid:              data.uid,
          userName:         data.name,
          userEmail:        data.email,
          password:         data.password,
          plan:             data.plan,
          billingPeriod:    data.billingPeriod,
          paymentMethod:    data.paymentMethod,
          activeFrom:       data.activeFrom,
          activeTo:         data.activeTo,
          subscriptionType: data.subscriptionType,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Email failed");
      setEmailDone(true);
      onToast(`Invoice email sent to ${data.email} ✓`);
    } catch (err) {
      onToast(err.message || "Email send failed", "error");
    } finally {
      setEmailSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(16,185,129,0.12),rgba(37,99,235,0.08))" }}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-2xl">🎉</span>
              <h3 className="text-white font-black text-lg">User Registered!</h3>
            </div>
            <p className="text-gray-300 text-xs">{data.name} ka account successfully bana diya</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-all">✕</button>
        </div>

        {/* User Info */}
        <div className="px-6 py-4 flex flex-col gap-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-20">Name</span>
            <span className="text-white text-sm font-semibold">{data.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-20">Email</span>
            <span className="text-blue-300 text-sm font-mono">{data.email}</span>
          </div>
          {data.password && (
            <div className="flex items-center gap-2">
              <span className="text-gray-300 text-xs w-20">Password</span>
              <span className="text-amber-300 text-sm font-mono">{data.password}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-20">Plan</span>
            <span className="text-emerald-300 text-sm font-semibold">
              {planLabel(data.plan)}{data.subscriptionType === "trial" ? " (Trial)" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-20">Active</span>
            <span className="text-gray-300 text-xs">{data.activeFrom} → {data.activeTo}</span>
          </div>
        </div>

        {/* Question */}
        <div className="px-6 py-4">
          <p className="text-gray-300 text-sm font-semibold mb-4 text-center">
            Invoice kahan bhejna hay? 📤
          </p>
          <div className="flex flex-col gap-3">
            {/* WhatsApp */}
            <a
              href={`https://wa.me/?text=${buildWhatsAppText()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff", boxShadow: "0 4px 16px rgba(37,211,102,0.3)" }}>
              <span className="text-xl">💬</span>
              WhatsApp par bhejo
            </a>

            {/* Email */}
            <button
              onClick={handleEmail}
              disabled={emailSending || emailDone}
              className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-60 disabled:scale-100"
              style={{ background: emailDone ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff", boxShadow: emailDone ? "0 4px 16px rgba(16,185,129,0.3)" : "0 4px 16px rgba(37,99,235,0.3)" }}>
              <span className="text-xl">{emailDone ? "✓" : "📧"}</span>
              {emailSending ? "Bhej raha hai..." : emailDone ? "Email bhej di gaye!" : "Email par bhejo (PDF invoice)"}
            </button>

            {/* Skip */}
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/5"
              style={{ color: "#6b7280", border: "1px solid rgba(255,255,255,0.07)" }}>
              Skip — baad mein bhejna hai
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── User Invoice Dialog (View / Print / Email / WhatsApp) ──────────────────────
function UserInvoiceDialog({ data, getToken, onToast, onClose }) {
  const [loading,      setLoading]      = useState(false);
  const [pdfBase64,    setPdfBase64]    = useState(null);
  const [invoiceNum,   setInvoiceNum]   = useState(null);
  const [amount,       setAmount]       = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailDone,    setEmailDone]    = useState(false);
  const [waLoading,    setWaLoading]    = useState(false);
  const [error,        setError]        = useState(null);

  function planLabel(p) { return p ? p.charAt(0).toUpperCase() + p.slice(1) : "Starter"; }
  function fmtPayment(m) {
    if (m === "online") return "Online Transfer";
    if (m === "cheque") return "Cheque";
    return "Cash";
  }

  // Fetch PDF on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const res   = await fetch("/api/admin/get-reg-invoice-pdf", {
          method:  "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({
            uid:              data.uid,
            userName:         data.name,
            userEmail:        data.email,
            plan:             data.plan,
            billingPeriod:    data.billingPeriod,
            paymentMethod:    data.paymentMethod,
            activeFrom:       data.activeFrom,
            activeTo:         data.activeTo,
            subscriptionType: data.subscriptionType,
            uploadToCloudinary: false,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to load invoice");
        setPdfBase64(result.pdfBase64);
        setInvoiceNum(result.invoiceNumber);
        setAmount(result.amount);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.uid]);

  // Print / Download PDF
  function handlePrint() {
    if (!pdfBase64) return;
    const byteChars = atob(pdfBase64);
    const bytes     = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, "_blank");
    if (win) {
      win.addEventListener("load", () => win.print());
    } else {
      // Fallback: download
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${invoiceNum || "invoice"}.pdf`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Email
  async function handleEmail() {
    setEmailSending(true);
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/send-registration-invoice", {
        method:  "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          uid:              data.uid,
          userName:         data.name,
          userEmail:        data.email,
          plan:             data.plan,
          billingPeriod:    data.billingPeriod,
          paymentMethod:    data.paymentMethod,
          activeFrom:       data.activeFrom,
          activeTo:         data.activeTo,
          subscriptionType: data.subscriptionType,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Email failed");
      setEmailDone(true);
      onToast(`Invoice email sent to ${data.email} ✓`);
    } catch (e) {
      onToast(e.message || "Email send failed", "error");
    } finally {
      setEmailSending(false);
    }
  }

  // WhatsApp — upload to Cloudinary first then open WA
  async function handleWhatsApp() {
    setWaLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/get-reg-invoice-pdf", {
        method:  "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          uid:              data.uid,
          userName:         data.name,
          userEmail:        data.email,
          plan:             data.plan,
          billingPeriod:    data.billingPeriod,
          paymentMethod:    data.paymentMethod,
          activeFrom:       data.activeFrom,
          activeTo:         data.activeTo,
          subscriptionType: data.subscriptionType,
          uploadToCloudinary: true,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed");

      const isTrial  = data.subscriptionType === "trial";
      const plan     = planLabel(data.plan);
      const invoiceLink = result.cloudinaryUrl || "";

      const lines = [
        `Assalam-o-Alaikum ${data.name}! 👋`,
        ``,
        `Novexa ERP ka Registration Invoice attached hai.`,
        ``,
        `📋 *Invoice Details:*`,
        `• Invoice #: ${result.invoiceNumber}`,
        `• Plan: *${plan} Plan*${isTrial ? " (Free Trial)" : ""}`,
        `• Active: ${data.activeFrom} → ${data.activeTo}`,
        isTrial ? null : `• Amount: Rs. ${(result.amount || 0).toLocaleString("en-PK")}`,
        isTrial ? null : `• Payment: ${fmtPayment(data.paymentMethod)}`,
        ``,
        invoiceLink ? `📄 Invoice PDF: ${invoiceLink}` : null,
        ``,
        `🌐 Login: https://novexaerp.com`,
        ``,
        `Shukriya! 🙏`,
      ].filter(l => l !== null);

      const waUrl = `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
      window.open(waUrl, "_blank");
    } catch (e) {
      onToast(e.message || "WhatsApp share failed", "error");
    } finally {
      setWaLoading(false);
    }
  }

  const isTrial = data.subscriptionType === "trial";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(245,158,11,0.10),rgba(37,99,235,0.06))" }}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl">📄</span>
              <h3 className="text-white font-black text-lg">Registration Invoice</h3>
            </div>
            <p className="text-gray-300 text-xs">{data.name} · {data.email}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-all">✕</button>
        </div>

        {/* Invoice Preview */}
        <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-6">
              <div className="w-5 h-5 rounded-full border-2 border-t-amber-400 border-transparent animate-spin" />
              <span className="text-gray-300 text-sm">Invoice generate ho rahi hai...</span>
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : pdfBase64 ? (
            <div>
              {/* Invoice summary card */}
              <div className="rounded-xl p-4 flex flex-col gap-2"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-xs uppercase tracking-widest font-bold">Invoice #</span>
                  <span className="text-amber-300 text-sm font-mono font-bold">{invoiceNum}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-xs uppercase tracking-widest font-bold">Plan</span>
                  <span className="text-white text-sm font-semibold">{planLabel(data.plan)}{isTrial ? " (Trial)" : ""}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-xs uppercase tracking-widest font-bold">Period</span>
                  <span className="text-gray-300 text-xs">{data.activeFrom} → {data.activeTo}</span>
                </div>
                {!isTrial && amount !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-xs uppercase tracking-widest font-bold">Amount</span>
                    <span className="text-emerald-400 text-sm font-bold">Rs. {(amount || 0).toLocaleString("en-PK")}</span>
                  </div>
                )}
              </div>

              {/* Embedded PDF preview */}
              <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <iframe
                  src={`data:application/pdf;base64,${pdfBase64}`}
                  className="w-full"
                  style={{ height: "260px" }}
                  title="Invoice Preview"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 flex flex-col gap-2.5">
          {/* Print / Download */}
          <button
            onClick={handlePrint}
            disabled={!pdfBase64 || loading}
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-40 disabled:scale-100"
            style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.1))", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24" }}>
            <span className="text-lg">🖨️</span>
            Print / Download PDF
          </button>

          {/* Email */}
          <button
            onClick={handleEmail}
            disabled={!pdfBase64 || loading || emailSending}
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-40 disabled:scale-100"
            style={{
              background: emailDone ? "linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.1))" : "linear-gradient(135deg,rgba(37,99,235,0.2),rgba(37,99,235,0.1))",
              border: emailDone ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(37,99,235,0.4)",
              color: emailDone ? "#34d399" : "#60a5fa",
            }}>
            <span className="text-lg">{emailDone ? "✓" : "📧"}</span>
            {emailSending ? "Email is being sent. Please wait..." : emailDone ? "Email sent successfully!" : `Email par bhejo (${data.email})`}
          </button>

          {/* WhatsApp */}
          <button
            onClick={handleWhatsApp}
            disabled={!pdfBase64 || loading || waLoading}
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-40 disabled:scale-100"
            style={{ background: "linear-gradient(135deg,rgba(37,211,102,0.2),rgba(18,140,126,0.1))", border: "1px solid rgba(37,211,102,0.4)", color: "#4ade80" }}>
            <span className="text-lg">💬</span>
            {waLoading ? "Sending via WhatsApp. Please wait..." : "Sent successfully via WhatsApp!"}
          </button>

          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/5"
            style={{ color: "#6b7280", border: "1px solid rgba(255,255,255,0.07)" }}>
            Band karo
          </button>
        </div>
      </div>
    </div>
  );
}

function UserFormModal({ initial, onClose, onSave, saving, getToken, onToast, onRenewSuccess }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name || "", email: initial.email || "",
    password: "", phone: initial.phone || "",
    address: initial.address || "",
    activeFrom: initial.activeFrom || "", activeTo: initial.activeTo || "",
    activeToTime: initial.activeToTime || "",
    maxDevices: String(initial.maxDevices || "1"),
    plan: initial.plan || "starter",
    subscriptionType: initial.subscriptionType || "active",
    billingPeriod: initial.billingPeriod || "monthly",
    paymentMethod: initial.paymentMethod || "cash",
  } : { ...EMPTY_FORM });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const isEdit = !!initial;

  // ── Extra limits state (edit mode only) ──────────────────────────────────
  const EXTRA_FIELDS_LIST = [
    { key: "invoicesPerMonth",            label: "Extra Invoices / Month",               icon: "🧾" },
    { key: "invoicesPerCustomerPerMonth", label: "Extra Invoices per Customer / Month",  icon: "👥" },
    { key: "customersPerMonth",           label: "Extra Customers / Month",               icon: "👤" },
    { key: "suppliersPerMonth",           label: "Extra Suppliers / Month",               icon: "🏭" },
    { key: "ordersPerSupplierPerMonth",   label: "Extra Orders per Supplier / Month",    icon: "🛒" },
    { key: "extraUsers",                  label: "Extra User Seats",                      icon: "🧑‍💼" },
  ];

  // existingLimits = what is already saved on the user
  // stored in state so it updates after each save (without closing modal)
  const [existingLimits, setExistingLimits] = useState({
    invoicesPerMonth:            Number(initial?.extraLimits?.invoicesPerMonth            || 0),
    invoicesPerCustomerPerMonth: Number(initial?.extraLimits?.invoicesPerCustomerPerMonth || 0),
    customersPerMonth:           Number(initial?.extraLimits?.customersPerMonth           || 0),
    suppliersPerMonth:           Number(initial?.extraLimits?.suppliersPerMonth           || 0),
    ordersPerSupplierPerMonth:   Number(initial?.extraLimits?.ordersPerSupplierPerMonth   || 0),
    extraUsers:                  Number(initial?.extraLimits?.extraUsers                  || 0),
  });

  // On mount, re-fetch fresh extraLimits from Firestore (initial prop may be stale)
  useEffect(() => {
    if (!isEdit || !initial?.uid) return;
    import("firebase/firestore").then(({ getDoc, doc: fsDoc }) => {
      import("@/lib/firebase").then(({ db: fdb }) => {
        getDoc(fsDoc(fdb, "users", initial.uid)).then(snap => {
          if (snap.exists()) {
            const lim = snap.data().extraLimits || {};
            setExistingLimits({
              invoicesPerMonth:            Number(lim.invoicesPerMonth            || 0),
              invoicesPerCustomerPerMonth: Number(lim.invoicesPerCustomerPerMonth || 0),
              customersPerMonth:           Number(lim.customersPerMonth           || 0),
              suppliersPerMonth:           Number(lim.suppliersPerMonth           || 0),
              ordersPerSupplierPerMonth:   Number(lim.ordersPerSupplierPerMonth   || 0),
              extraUsers:                  Number(lim.extraUsers                  || 0),
            });
          }
        }).catch(() => {});
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, initial?.uid]);

  // addLimits = how much NEW quota admin wants to add on top of existing
  // (starts at 0, user types how much more to add)
  const [addLimits, setAddLimits] = useState(
    { invoicesPerMonth: "0", invoicesPerCustomerPerMonth: "0", customersPerMonth: "0", suppliersPerMonth: "0", ordersPerSupplierPerMonth: "0", extraUsers: "0" }
  );

  // extraLimits = TOTAL = existing + new additions (what gets saved)
  const extraLimits = Object.fromEntries(
    EXTRA_FIELDS_LIST.map(f => [f.key, String(existingLimits[f.key] + (Number(addLimits[f.key]) || 0))])
  );

  const [extraSaving,    setExtraSaving]    = useState(false);
  const [extraDone,      setExtraDone]      = useState(false);
  const [addonConfirm,   setAddonConfirm]   = useState(false);
  const [addonSuccess,   setAddonSuccess]   = useState(null);
  const [addonPayMethod, setAddonPayMethod] = useState(initial?.paymentMethod || "cash");
  const [addonPrices,    setAddonPrices]    = useState(null);

  // Default add-on prices (fallback if Firestore not loaded yet)
  const DEFAULT_ADDON_P = {
    invoicesPerMonth_per: 10,
    invoicesPerMonth_50: 500, invoicesPerMonth_100: 900, invoicesPerMonth_250: 2000, invoicesPerMonth_500: 3500, invoicesPerMonth_1000: 6000,
    invoicesPerCustomerPerMonth_per: 10,
    invoicesPerCustomerPerMonth_50: 500, invoicesPerCustomerPerMonth_100: 900, invoicesPerCustomerPerMonth_250: 2000, invoicesPerCustomerPerMonth_500: 3500, invoicesPerCustomerPerMonth_1000: 6000,
    customersPerMonth_per: 30,
    customersPerMonth_50: 1200, customersPerMonth_100: 2200, customersPerMonth_250: 5000, customersPerMonth_500: 9000, customersPerMonth_1000: 16000,
    suppliersPerMonth_per: 30,
    suppliersPerMonth_20: 500, suppliersPerMonth_50: 1200, suppliersPerMonth_100: 2200, suppliersPerMonth_250: 5000, suppliersPerMonth_500: 9000, suppliersPerMonth_1000: 16000,
    ordersPerSupplierPerMonth_per: 10,
    ordersPerSupplierPerMonth_50: 500, ordersPerSupplierPerMonth_100: 900, ordersPerSupplierPerMonth_250: 2000, ordersPerSupplierPerMonth_500: 3500, ordersPerSupplierPerMonth_1000: 6000,
    extraUser_monthly: 1000,
  };

  // ── Load addon prices from Firestore ─────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    import("firebase/firestore").then(({ getDoc, doc: fsDoc }) => {
      import("@/lib/firebase").then(({ db: fdb }) => {
        getDoc(fsDoc(fdb, "adminConfig", "plans")).then(snap => {
          setAddonPrices(snap.exists() && snap.data().addonPrices ? snap.data().addonPrices : DEFAULT_ADDON_P);
        }).catch(() => setAddonPrices(DEFAULT_ADDON_P));
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  // Tiered pricing: fills packages largest→smallest, remainder per-unit
  function calcTieredPrice(qty, perUnitPrice, packages) {
    if (qty <= 0) return { total: 0 };
    const sorted = [...packages].sort((a, b) => b.qty - a.qty);
    let remaining = qty;
    let total = 0;
    for (const pkg of sorted) {
      if (remaining >= pkg.qty) {
        const count = Math.floor(remaining / pkg.qty);
        total     += count * pkg.price;
        remaining -= count * pkg.qty;
      }
    }
    if (remaining > 0) total += remaining * perUnitPrice;
    return { total };
  }

  // calcAddonLineItems — prices only the NEW additions (delta), not existing quota
  function calcAddonLineItems(newAdditions, prices) {
    const p = prices || DEFAULT_ADDON_P;
    const items = [];

    function pushItem(qty, limitKey, icon, label) {
      if (qty <= 0) return;
      const CATS = {
        invoicesPerMonth:            { perKey: "invoicesPerMonth_per",            pkgQtys: [50,100,250,500,1000] },
        invoicesPerCustomerPerMonth: { perKey: "invoicesPerCustomerPerMonth_per", pkgQtys: [50,100,250,500,1000] },
        customersPerMonth:           { perKey: "customersPerMonth_per",           pkgQtys: [50,100,250,500,1000] },
        suppliersPerMonth:           { perKey: "suppliersPerMonth_per",           pkgQtys: [20,50,100,250,500,1000] },
        ordersPerSupplierPerMonth:   { perKey: "ordersPerSupplierPerMonth_per",   pkgQtys: [50,100,250,500,1000] },
      };
      const cat = CATS[limitKey]; if (!cat) return;
      const perUnit  = p[cat.perKey] ?? DEFAULT_ADDON_P[cat.perKey] ?? 10;
      const packages = cat.pkgQtys.map(q => ({ qty: q, price: p[`${limitKey}_${q}`] ?? DEFAULT_ADDON_P[`${limitKey}_${q}`] ?? (perUnit * q) }));
      const { total } = calcTieredPrice(qty, perUnit, packages);
      if (total > 0) items.push({ key: limitKey, icon, label: `${label}`, qty, unitPrice: Math.round(total / qty * 10) / 10, total });
    }

    pushItem(Number(newAdditions.invoicesPerMonth) || 0,            "invoicesPerMonth",            "🧾", "Extra Invoices / Month");
    pushItem(Number(newAdditions.invoicesPerCustomerPerMonth) || 0, "invoicesPerCustomerPerMonth", "👥", "Extra Inv. per Customer / Month");
    pushItem(Number(newAdditions.customersPerMonth) || 0,           "customersPerMonth",           "👤", "Extra Customers");
    pushItem(Number(newAdditions.suppliersPerMonth) || 0,           "suppliersPerMonth",           "🏭", "Extra Suppliers");
    pushItem(Number(newAdditions.ordersPerSupplierPerMonth) || 0,   "ordersPerSupplierPerMonth",   "🛒", "Extra Orders per Supplier / Month");

    // Extra user seats — flat rate (no tiered packages)
    const extraUsersQty = Number(newAdditions.extraUsers) || 0;
    if (extraUsersQty > 0) {
      const perUserPrice = p["extraUser_monthly"] ?? DEFAULT_ADDON_P["extraUser_monthly"] ?? 1000;
      const total = extraUsersQty * perUserPrice;
      items.push({ key: "extraUsers", icon: "🧑‍💼", label: "Extra User Seats", qty: extraUsersQty, unitPrice: perUserPrice, total });
    }

    return { items, grandTotal: items.reduce((s, i) => s + i.total, 0) };
  }

  // doSaveExtraLimits — saves TOTAL (existing + new) to Firestore
  async function doSaveExtraLimits() {
    setExtraSaving(true);
    setExtraDone(false);
    try {
      const token   = await getToken();
      const headers = { "Content-Type": "application/json", authorization: `Bearer ${token}` };

      // ── Fresh read from Firestore before calculating totals ──────────────
      // Prevents stale state from overwriting existing limits incorrectly
      const { getDoc, doc: fsDoc } = await import("firebase/firestore");
      const { db: fdb }            = await import("@/lib/firebase");
      const freshSnap = await getDoc(fsDoc(fdb, "users", initial.uid));
      const freshLims = freshSnap.exists() ? (freshSnap.data().extraLimits || {}) : {};

      const cleaned = {};
      EXTRA_FIELDS_LIST.forEach(f => {
        cleaned[f.key] = (Number(freshLims[f.key]) || 0) + (Number(addLimits[f.key]) || 0);
      });
      const purchasedAt   = new Date().toISOString();
      const expiresAtDate = new Date(); expiresAtDate.setMonth(expiresAtDate.getMonth() + 1);
      const expiresAt     = expiresAtDate.toISOString();
      const res  = await fetch("/api/admin/update-user", { method: "POST", headers, body: JSON.stringify({ uid: initial.uid, extraLimits: cleaned, extraLimitsExpiresAt: expiresAt, extraLimitsPurchasedAt: purchasedAt, extraLimitsPaymentMethod: addonPayMethod }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExtraDone(true);

      // ── Re-fetch from Firestore to get confirmed saved values ──────────
      try {
        const { getDoc, doc: fsDoc } = await import("firebase/firestore");
        const { db: fdb }            = await import("@/lib/firebase");
        const freshSnap = await getDoc(fsDoc(fdb, "users", initial.uid));
        if (freshSnap.exists()) {
          const freshLimits = freshSnap.data().extraLimits || {};
          setExistingLimits({
            invoicesPerMonth:            Number(freshLimits.invoicesPerMonth            || 0),
            invoicesPerCustomerPerMonth: Number(freshLimits.invoicesPerCustomerPerMonth || 0),
            customersPerMonth:           Number(freshLimits.customersPerMonth           || 0),
            suppliersPerMonth:           Number(freshLimits.suppliersPerMonth           || 0),
            ordersPerSupplierPerMonth:   Number(freshLimits.ordersPerSupplierPerMonth   || 0),
            extraUsers:                  Number(freshLimits.extraUsers                  || 0),
          });
        } else {
          setExistingLimits({ ...cleaned });
        }
      } catch {
        // fallback: use what we just saved
        setExistingLimits({ ...cleaned });
      }

      // Invoice only for new additions
      const { items: lineItems, grandTotal } = calcAddonLineItems(addLimits, addonPrices);
      if (initial.email && lineItems.length > 0) {
        fetch("/api/admin/send-addon-invoice", { method: "POST", headers, body: JSON.stringify({ uid: initial.uid, userName: initial.name || initial.email, userEmail: initial.email, lineItems, grandTotal, paymentMethod: addonPayMethod, purchasedAt, expiresAt }) }).catch(() => {});
      }

      // Record admin grant in history — so user sees it in Purchase History
      if (lineItems.length > 0) {
        fetch("/api/admin/record-addon-grant", {
          method:  "POST",
          headers,
          body: JSON.stringify({
            uid:           initial.uid,
            userName:      initial.name || initial.email || "",
            userEmail:     initial.email || "",
            lineItems:     lineItems.map(i => ({ limitKey: i.key, icon: i.icon, label: i.label, qty: i.qty, total: i.total })),
            grandTotal,
            paymentMethod: addonPayMethod,
            purchasedAt,
            expiresAt,
          }),
        }).catch(() => {});
      }
      const expSucc = new Date(); expSucc.setMonth(expSucc.getMonth() + 1);
      setAddonSuccess({ items: lineItems, grandTotal, payMethod: addonPayMethod, expiresAt: expSucc.toISOString(), totalLimits: cleaned });
      // Reset additions to 0 after save
      setAddLimits({ invoicesPerMonth: "0", invoicesPerCustomerPerMonth: "0", customersPerMonth: "0", suppliersPerMonth: "0", ordersPerSupplierPerMonth: "0", extraUsers: "0" });
      onToast?.("Extra limits saved! Invoice sent. ✓", "success");
      setTimeout(() => setExtraDone(false), 3000);
    } catch (err) {
      onToast?.(err.message || "Failed to save extra limits", "error");
    } finally {
      setExtraSaving(false);
    }
  }

  // ── Renewal state (edit mode only) ───────────────────────────────────────
  const [renewPayMethod,  setRenewPayMethod]  = useState(initial?.paymentMethod || "cash");
  const [renewSaving,     setRenewSaving]     = useState(false);
  const [renewDone,       setRenewDone]       = useState(false);
  const [renewConfirm,    setRenewConfirm]    = useState(false);   // "Are you sure?" popup
  const [renewSuccess,    setRenewSuccess]    = useState(null);    // success popup data

  // ── For NEW users: auto-set today as activeFrom + compute activeTo ───────
  useEffect(() => {
    if (!isEdit && !form.activeFrom) {
      const today = new Date().toISOString().slice(0, 10);
      const end   = calcEndDateStatic(today, form.billingPeriod || "monthly");
      setForm(p => ({ ...p, activeFrom: today, activeTo: end }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load plan options dynamically from Firestore ─────────────────────────
  const [dynamicPlans, setDynamicPlans] = useState(null);
  useEffect(() => {
    import("firebase/firestore").then(({ getDoc, doc: fsDoc }) => {
      import("@/lib/firebase").then(({ db: fdb }) => {
        getDoc(fsDoc(fdb, "adminConfig", "plans")).then(snap => {
          if (snap.exists()) {
            const list = snap.data().list || [];
            if (list.length > 0) setDynamicPlans(list);
          }
        }).catch(() => {});
      });
    });
  }, []);

  // Merge Firestore data with static PLAN_OPTIONS (keep color/ctaStyle from static)
  const activePlanOptions = (dynamicPlans || PLAN_OPTIONS).map(p => {
    const staticPlan = PLAN_OPTIONS.find(s => s.id === p.id) || {};
    const afterPrice = p.monthlyPrice || staticPlan.id;
    const beforePrice = p.beforeMonthlyPrice ?? null;
    return {
      ...staticPlan,
      id:    p.id    || staticPlan.id,
      label: `${p.icon || staticPlan.label?.split(" ")[0]} ${p.name || staticPlan.id}`,
      desc:  [
        p.maxDevices ? `${p.maxDevices} device${p.maxDevices > 1 ? "s" : ""}` : null,
        p.limits?.invoicesPerMonth !== undefined
          ? (p.limits.invoicesPerMonth === null ? "Unlimited invoices" : `${p.limits.invoicesPerMonth} invoices/mo`)
          : null,
        afterPrice
          ? (beforePrice
            ? `~~Rs.${Number(beforePrice).toLocaleString()}~~ Rs.${Number(afterPrice).toLocaleString()}/mo`
            : `Rs.${Number(afterPrice).toLocaleString()}/mo`)
          : null,
      ].filter(Boolean).join(" · ") || staticPlan.desc,
      color: staticPlan.color || "#10B981",
    };
  });

  // ── Helper: calculate end date from start date + billing period ─────────
  function calcEndDate(fromDateStr, period) {
    return calcEndDateStatic(fromDateStr, period);
  }

  // ── When subscriptionType changes to trial, auto-set dates ──────────────
  function handleSubscriptionTypeChange(type) {
    if (type === "trial") {
      const today = new Date();
      const trialEnd = new Date(today);
      trialEnd.setDate(today.getDate() + 7);
      const fmt = d => d.toISOString().slice(0, 10);
      setForm(p => ({ ...p, subscriptionType: "trial", activeFrom: fmt(today), activeTo: fmt(trialEnd) }));
    } else {
      setForm(p => ({ ...p, subscriptionType: "active" }));
    }
  }

  // ── When billingPeriod changes, auto-update activeTo ─────────────────────
  function handleBillingPeriodChange(period) {
    setForm(p => {
      const newActiveTo = p.activeFrom ? calcEndDate(p.activeFrom, period) : p.activeTo;
      return { ...p, billingPeriod: period, activeTo: newActiveTo };
    });
  }

  // ── When activeFrom changes, auto-update activeTo ────────────────────────
  function handleActiveFromChange(newFrom) {
    setForm(p => {
      if (p.subscriptionType === "trial") return { ...p, activeFrom: newFrom };
      const newActiveTo = newFrom ? calcEndDate(newFrom, p.billingPeriod || "monthly") : p.activeTo;
      return { ...p, activeFrom: newFrom, activeTo: newActiveTo };
    });
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg my-6 rounded-2xl"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>

        <div className="flex items-center justify-between px-6 py-5 rounded-t-2xl"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(245,158,11,0.04))" }}>
          <div>
            <h2 className="text-white font-black text-xl">{isEdit ? "Edit User" : "Register New User"}</h2>
            <p className="text-gray-300 text-xs mt-0.5">{isEdit ? "Update user details and subscription" : "Create a new Novexa ERP account"}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-all">✕</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <SInput label="Full Name *" value={form.name} onChange={set("name")} placeholder="e.g. Ahmed Raza" required />
            <SInput label="Phone" value={form.phone} onChange={set("phone")} placeholder="+92 300 0000000" />
          </div>
          <SInput label="Email Address *" type="email" value={form.email} onChange={set("email")} placeholder="user@example.com" required />
          <SInput label={isEdit ? "New Password (leave blank to keep)" : "Password *"} type="password"
            value={form.password} onChange={set("password")} placeholder="Min. 8 characters" required={!isEdit} />
          <SInput label="Address" value={form.address} onChange={set("address")} placeholder="City, Street..." />

          {/* ── Subscription Type ── */}
          <div className="rounded-xl p-4" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.18)" }}>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">🎯 Subscription Type</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Active */}
              <button type="button" onClick={() => handleSubscriptionTypeChange("active")}
                className="flex flex-col items-start px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  background: form.subscriptionType === "active" ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${form.subscriptionType === "active" ? "#2563EB" : "rgba(255,255,255,0.08)"}`,
                  boxShadow: form.subscriptionType === "active" ? "0 0 14px rgba(37,99,235,0.25)" : "none",
                }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">✅</span>
                  <span className="text-sm font-bold" style={{ color: form.subscriptionType === "active" ? "#60a5fa" : "#9ca3af" }}>Active</span>
                </div>
                <span className="text-[10px] leading-tight" style={{ color: form.subscriptionType === "active" ? "#d1d5db" : "#4b5563" }}>
                  Full subscription — dates manually set karein
                </span>
              </button>

              {/* Trial */}
              <button type="button" onClick={() => handleSubscriptionTypeChange("trial")}
                className="flex flex-col items-start px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  background: form.subscriptionType === "trial" ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${form.subscriptionType === "trial" ? "#F59E0B" : "rgba(255,255,255,0.08)"}`,
                  boxShadow: form.subscriptionType === "trial" ? "0 0 14px rgba(245,158,11,0.25)" : "none",
                }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">⏳</span>
                  <span className="text-sm font-bold" style={{ color: form.subscriptionType === "trial" ? "#fbbf24" : "#9ca3af" }}>Trial</span>
                </div>
                <span className="text-[10px] leading-tight" style={{ color: form.subscriptionType === "trial" ? "#d1d5db" : "#4b5563" }}>
                  7 days free — auto dates set, auto freeze
                </span>
              </button>
            </div>
            {form.subscriptionType === "trial" && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <span className="text-amber-400 text-sm">⚠️</span>
                <p className="text-amber-400 text-[11px] font-medium">
                  Trial: {form.activeFrom} → {form.activeTo} (7 days). Account auto-freeze hoga.
                </p>
              </div>
            )}
          </div>

          {/* ── Subscription Period ── */}
          <div className="rounded-xl p-4" style={{ background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.15)" }}>
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">📅 Subscription Period</p>
            <p className="text-gray-300 text-[10px] mb-3">
              Start date change karein — end date automatically {form.billingPeriod === "yearly" ? "1 saal" : "1 mahina"} baad set ho jaayegi. Aap manually bhi change kar sakte hain.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <SInput label="Active From *" type="date" value={form.activeFrom}
                onChange={e => handleActiveFromChange(e.target.value)} required />
              <SInput label="Active Until *" type="date" value={form.activeTo} onChange={set("activeTo")} required />
            </div>
            <div>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                ⏰ Freeze Time
                <span className="text-gray-300 normal-case font-normal tracking-normal" style={{ fontSize: 10 }}>(optional — default 11:59 PM)</span>
              </label>
              <SInput type="time" value={form.activeToTime} onChange={set("activeToTime")} />
              {form.activeToTime && form.activeTo && (
                <p className="text-blue-400 text-[11px] mt-1.5 font-medium">✓ Will freeze on {form.activeTo} at {form.activeToTime}</p>
              )}
            </div>
          </div>

          {/* ── Plan / Package Selector ── */}
          <div className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">📦 Subscription Plan</p>
            <div className="grid grid-cols-2 gap-2">
              {activePlanOptions.map(opt => (
                <button key={opt.id} type="button"
                  onClick={() => {
                    // Use Firestore maxDevices if available, else static default
                    const fsPlan = dynamicPlans?.find(p => p.id === opt.id);
                    const devices = fsPlan?.maxDevices ?? PLAN_DEFAULT_DEVICES[opt.id] ?? 1;
                    setForm(p => ({ ...p, plan: opt.id, maxDevices: String(devices) }));
                  }}
                  className="flex flex-col items-start px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: form.plan === opt.id
                      ? `rgba(${opt.id === "starter" ? "16,185,129" : opt.id === "business" ? "37,99,235" : opt.id === "professional" ? "245,158,11" : "168,85,247"},0.18)`
                      : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${form.plan === opt.id ? opt.color : "rgba(255,255,255,0.08)"}`,
                    boxShadow: form.plan === opt.id ? `0 0 12px ${opt.color}30` : "none",
                  }}>
                  <span className="text-xs font-bold mb-0.5" style={{ color: form.plan === opt.id ? opt.color : "#9ca3af" }}>
                    {opt.label}
                  </span>
                  <span className="text-[10px] leading-tight" style={{ color: form.plan === opt.id ? "#d1d5db" : "#4b5563" }}>
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Device / Session Limit (only for Enterprise plan) ── */}
          {form.plan === "enterprise" && (
            <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)" }}>
              <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-3">📱 Device / Session Limit</p>
              <div className="flex items-center gap-3">
                {/* Decrement */}
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, maxDevices: String(Math.max(1, Number(p.maxDevices) - 1)) }))}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all hover:scale-110 flex-shrink-0"
                  style={{ background: "rgba(139,92,246,0.15)", border: "1.5px solid rgba(139,92,246,0.35)", color: "#c4b5fd" }}>
                  −
                </button>

                {/* Number input */}
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.maxDevices}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      const num = Math.max(1, Math.min(100, Number(val) || 1));
                      setForm(p => ({ ...p, maxDevices: String(num) }));
                    }}
                    className="w-full text-center font-black text-lg outline-none"
                    style={{
                      background: "rgba(139,92,246,0.1)",
                      border: "1.5px solid rgba(139,92,246,0.4)",
                      borderRadius: 10,
                      padding: "8px 12px",
                      color: "#c4b5fd",
                      MozAppearance: "textfield",
                    }}
                  />
                </div>

                {/* Increment */}
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, maxDevices: String(Math.min(100, Number(p.maxDevices) + 1)) }))}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all hover:scale-110 flex-shrink-0"
                  style={{ background: "rgba(139,92,246,0.15)", border: "1.5px solid rgba(139,92,246,0.35)", color: "#c4b5fd" }}>
                  +
                </button>

                <span className="text-gray-300 text-sm font-medium flex-shrink-0">
                  {Number(form.maxDevices) === 1 ? "Device" : "Devices"}
                </span>
              </div>

              {/* Quick presets */}
              <div className="flex gap-2 mt-3">
                {[1, 2, 3, 5, 10].map(n => (
                  <button key={n} type="button"
                    onClick={() => setForm(p => ({ ...p, maxDevices: String(n) }))}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: Number(form.maxDevices) === n ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${Number(form.maxDevices) === n ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.06)"}`,
                      color: Number(form.maxDevices) === n ? "#c4b5fd" : "#4b5563",
                    }}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-gray-300 text-[10px] mt-2">Aap koi bhi number set kar sakte hain (1–100)</p>
            </div>
          )}

          {/* ── Billing Period (hidden for trial) ── */}
          {form.subscriptionType !== "trial" && (
            <div className="rounded-xl p-4" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.18)" }}>
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">🗓️ Billing Period</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "monthly",  label: "📅 Monthly",  desc: "Har mahina renewal" },
                  { id: "yearly",   label: "📆 Yearly",   desc: "Saal bhar ki plan" },
                ].map(opt => (
                  <button key={opt.id} type="button"
                    onClick={() => handleBillingPeriodChange(opt.id)}
                    className="flex flex-col items-start px-4 py-3 rounded-xl text-left transition-all"
                    style={{
                      background: form.billingPeriod === opt.id ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.03)",
                      border: `1.5px solid ${form.billingPeriod === opt.id ? "#10B981" : "rgba(255,255,255,0.08)"}`,
                      boxShadow: form.billingPeriod === opt.id ? "0 0 14px rgba(16,185,129,0.2)" : "none",
                    }}>
                    <span className="text-sm font-bold mb-0.5" style={{ color: form.billingPeriod === opt.id ? "#34d399" : "#9ca3af" }}>
                      {opt.label}
                    </span>
                    <span className="text-[10px]" style={{ color: form.billingPeriod === opt.id ? "#d1d5db" : "#4b5563" }}>
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Payment Method (hidden for trial) ── */}
          {form.subscriptionType !== "trial" && (
            <div className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.18)" }}>
              <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">💳 Payment Method</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "online",  label: "🌐 Online",  desc: "Card / Bank transfer" },
                  { id: "cash",    label: "💵 Cash",     desc: "Naqad ada ki" },
                  { id: "cheque",  label: "🧾 Cheque",  desc: "Cheque se payment" },
                ].map(opt => (
                  <button key={opt.id} type="button"
                    onClick={() => setForm(p => ({ ...p, paymentMethod: opt.id }))}
                    className="flex flex-col items-start px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: form.paymentMethod === opt.id ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.03)",
                      border: `1.5px solid ${form.paymentMethod === opt.id ? "#F59E0B" : "rgba(255,255,255,0.08)"}`,
                      boxShadow: form.paymentMethod === opt.id ? "0 0 12px rgba(245,158,11,0.2)" : "none",
                    }}>
                    <span className="text-xs font-bold mb-0.5" style={{ color: form.paymentMethod === opt.id ? "#fbbf24" : "#9ca3af" }}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] leading-tight" style={{ color: form.paymentMethod === opt.id ? "#d1d5db" : "#4b5563" }}>
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Renew Subscription (edit mode only) ── */}
          {isEdit && (() => {
            // Renewal logic:
            // - activeFrom stays the SAME (original start date, never changes)
            // - newEnd   = current activeTo + 1 month/year (or +7 days for trial)
            const currentEnd  = form.activeTo;
            const currentFrom = form.activeFrom;   // stays unchanged
            const isTrial     = form.subscriptionType === "trial";
            const period      = isTrial ? "trial" : (form.billingPeriod || "monthly");

            // New end = extend current end by 7 days (trial) or 1 month/year (active)
            const newEnd = currentEnd ? (isTrial ? calcTrialRenewalEndDate(currentEnd) : calcRenewalEndDate(currentEnd, period)) : "";
            // Display start of next period (currentEnd + 1 day) — shown in UI only, not saved
            const displayNewStart = calcRenewalDisplayStart(currentEnd);

            // Days remaining on current plan
            const daysRemaining = currentEnd
              ? Math.ceil((new Date(currentEnd + "T23:59:59") - new Date()) / 86400000)
              : null;

            async function handleRenew() {
              if (!newEnd) return;
              setRenewConfirm(false);
              setRenewSaving(true);
              try {
                const token   = await getToken();
                const headers = { "Content-Type": "application/json", authorization: `Bearer ${token}` };
                const renewedAt = new Date().toISOString();
                const body    = {
                  uid:           initial.uid,
                  // activeFrom intentionally NOT sent — keep original
                  activeTo:      newEnd,
                  // Only send paymentMethod if not trial
                  ...(isTrial ? {} : { paymentMethod: renewPayMethod }),
                  lastRenewedAt: renewedAt,
                  lastRenewedBy: "admin",
                };
                const res  = await fetch("/api/admin/update-user", { method: "POST", headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                // Only update activeTo in form, keep activeFrom as-is
                setForm(p => ({ ...p, activeTo: newEnd, ...(isTrial ? {} : { paymentMethod: renewPayMethod }) }));
                setRenewDone(true);

                // ── Send renewal confirmation email (skip for trial) ──────────────────────
                if (initial.email && !isTrial) {
                  try {
                    const emailRes  = await fetch("/api/admin/send-renewal-email", {
                      method:  "POST",
                      headers,
                      body: JSON.stringify({
                        uid:           initial.uid,
                        userName:      initial.name || initial.email,
                        userEmail:     initial.email,
                        plan:          form.plan,
                        billingPeriod: form.billingPeriod,
                        paymentMethod: renewPayMethod,
                        activeFrom:    currentFrom,
                        activeTo:      newEnd,
                        periodStart:   displayNewStart,
                        renewedAt,
                        isTrial:       false,
                      }),
                    });
                    const emailData = await emailRes.json();
                    if (!emailRes.ok) {
                      onToast?.(`Renewed but email failed: ${emailData.error || emailRes.status}`, "error");
                    }
                  } catch (emailErr) {
                    onToast?.(`Renewed but email error: ${emailErr.message}`, "error");
                  }
                }

                // ── Send trial extension email ──────────────────────────────────────────
                if (initial.email && isTrial) {
                  try {
                    const emailRes  = await fetch("/api/admin/send-renewal-email", {
                      method:  "POST",
                      headers,
                      body: JSON.stringify({
                        uid:           initial.uid,
                        userName:      initial.name || initial.email,
                        userEmail:     initial.email,
                        plan:          form.plan,
                        billingPeriod: "trial",
                        paymentMethod: null,
                        activeFrom:    currentFrom,
                        activeTo:      newEnd,
                        periodStart:   displayNewStart,
                        renewedAt,
                        isTrial:       true,
                        originalStart: currentFrom, // Original registration date
                      }),
                    });
                    const emailData = await emailRes.json();
                    if (!emailRes.ok) {
                      onToast?.(`Extended but email failed: ${emailData.error || emailRes.status}`, "error");
                    }
                  } catch (emailErr) {
                    onToast?.(`Extended but email error: ${emailErr.message}`, "error");
                  }
                }

                setRenewSuccess({ newStart: displayNewStart, newEnd, payMethod: isTrial ? null : renewPayMethod });
                onRenewSuccess?.();
              } catch (err) {
                onToast?.(err.message || "Renewal failed", "error");
              } finally {
                setRenewSaving(false);
              }
            }

            return (
              <div className="rounded-xl overflow-hidden"
                style={{ border: `1.5px solid ${renewDone ? "rgba(52,211,153,0.5)" : "rgba(52,211,153,0.35)"}`, background: "rgba(52,211,153,0.04)" }}>
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3"
                  style={{ borderBottom: "1px solid rgba(52,211,153,0.15)", background: "rgba(52,211,153,0.08)" }}>
                  <span className="text-base">🔄</span>
                  <div className="flex-1">
                    <p className="text-emerald-400 text-xs font-black uppercase tracking-widest">Subscription Renew Karein</p>
                    <p className="text-gray-300 text-[10px] mt-0.5">
                      Current end date ke baad se automatically next period shuru hoga
                    </p>
                  </div>
                  {daysRemaining !== null && (
                    <div className="flex-shrink-0 px-2 py-1 rounded-lg text-center"
                      style={{
                        background: daysRemaining <= 0 ? "rgba(248,113,113,0.15)" : daysRemaining <= 7 ? "rgba(251,191,36,0.15)" : "rgba(52,211,153,0.12)",
                        border: `1px solid ${daysRemaining <= 0 ? "rgba(248,113,113,0.3)" : daysRemaining <= 7 ? "rgba(251,191,36,0.3)" : "rgba(52,211,153,0.25)"}`,
                      }}>
                      <p className="text-[9px] uppercase tracking-widest font-bold"
                        style={{ color: daysRemaining <= 0 ? "#f87171" : daysRemaining <= 7 ? "#fbbf24" : "#34d399" }}>
                        {daysRemaining <= 0 ? "Expired" : "Baaki"}
                      </p>
                      <p className="text-sm font-black leading-tight"
                        style={{ color: daysRemaining <= 0 ? "#f87171" : daysRemaining <= 7 ? "#fbbf24" : "#34d399" }}>
                        {Math.abs(daysRemaining)}d
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-4 flex flex-col gap-3">
                  {/* New period preview */}
                  {newEnd && (
                    <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl"
                      style={{ background: renewDone ? "rgba(52,211,153,0.1)" : "rgba(37,99,235,0.08)", border: `1px solid ${renewDone ? "rgba(52,211,153,0.3)" : "rgba(37,99,235,0.2)"}` }}>
                      <span className="text-sm">{renewDone ? "✅" : "📅"}</span>
                      <div className="flex-1">
                        <p className="text-gray-300 text-[10px] uppercase tracking-widest font-bold mb-1">
                          {renewDone ? "Renewed — Updated End Date" : "New End Date (Preview)"}
                        </p>
                        {/* Start of new period — display only */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-300">New period starts:</span>
                          <span className="font-semibold" style={{ color: "#93c5fd" }}>
                            {displayNewStart ? new Date(displayNewStart + "T00:00:00").toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </span>
                        </div>
                        {/* End date extended */}
                        <div className="flex items-center gap-2 text-xs mt-1">
                          <span className="text-gray-300">End:</span>
                          <span className="text-gray-300 line-through text-[11px]">
                            {new Date(currentEnd + "T00:00:00").toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          <span className="text-xs">→</span>
                          <span className="font-bold" style={{ color: renewDone ? "#34d399" : "#93c5fd" }}>
                            {new Date(newEnd + "T00:00:00").toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <p className="text-gray-300 text-[10px] mt-1.5">
                          +{isTrial ? "7 days" : period === "yearly" ? "1 year" : "1 month"} from current end date
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Payment method for renewal (hidden for trial) */}
                  {!renewDone && !isTrial && (
                    <div>
                      <p className="text-gray-300 text-[10px] uppercase tracking-widest font-bold mb-2">💳 Renewal Payment Method</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "online", label: "🌐 Online", desc: "Card / Bank" },
                          { id: "cash",   label: "💵 Cash",   desc: "Naqad" },
                          { id: "cheque", label: "🧾 Cheque", desc: "Cheque" },
                        ].map(opt => (
                          <button key={opt.id} type="button"
                            onClick={() => setRenewPayMethod(opt.id)}
                            className="flex flex-col items-start px-3 py-2 rounded-xl text-left transition-all"
                            style={{
                              background: renewPayMethod === opt.id ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.03)",
                              border: `1.5px solid ${renewPayMethod === opt.id ? "#10B981" : "rgba(255,255,255,0.08)"}`,
                            }}>
                            <span className="text-xs font-bold" style={{ color: renewPayMethod === opt.id ? "#34d399" : "#9ca3af" }}>{opt.label}</span>
                            <span className="text-[10px]" style={{ color: renewPayMethod === opt.id ? "#d1d5db" : "#4b5563" }}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trial info message */}
                  {!renewDone && isTrial && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                      <span className="text-amber-400 text-sm">ℹ️</span>
                      <p className="text-amber-400 text-[11px] font-medium">
                        Trial extension — no payment required. Account will remain frozen after extension until upgraded.
                      </p>
                    </div>
                  )}

                  {/* Renew / Renewed button */}
                  {renewDone ? (
                    <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }}>
                      ✅ Subscription Successfully Renewed!
                    </div>
                  ) : (
                    <button type="button" disabled={!newEnd}
                      onClick={() => setRenewConfirm(true)}
                      className="w-full py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.01] active:scale-[0.99]"
                      style={{
                        background: isTrial ? "linear-gradient(135deg,#F59E0B,#D97706)" : "linear-gradient(135deg,#10B981,#059669)",
                        color: "#fff",
                        opacity: !newEnd ? 0.5 : 1,
                        boxShadow: isTrial ? "0 4px 16px rgba(245,158,11,0.3)" : "0 4px 16px rgba(16,185,129,0.3)",
                      }}>
                      {isTrial ? "⏳ Extend Trial (+7 Days)" : `🔄 Renew Subscription (+${period === "yearly" ? "1 Year" : "1 Month"})`}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Extra Monthly Limits — moved to User Detail → Add-ons tab ── */}
          {isEdit && (() => {
            const hasAnyExtra = EXTRA_FIELDS_LIST.some(f => (existingLimits[f.key] || 0) > 0);
            const exp   = initial?.extraLimitsExpiresAt ? new Date(initial.extraLimitsExpiresAt) : null;
            const dLeft = exp ? Math.ceil((exp - new Date()) / 86400000) : null;
            return (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <span className="text-xl flex-shrink-0">⚡</span>
                <div className="flex-1 min-w-0">
                  <p className="text-amber-400 text-xs font-bold">Extra Add-on Quota</p>
                  <p className="text-gray-300 text-[10px] mt-0.5">
                    {hasAnyExtra
                      ? `Active — ${dLeft !== null && dLeft > 0 ? `${dLeft}d left` : dLeft !== null && dLeft <= 0 ? "Expired" : "Set"}`
                      : "No active add-ons"}
                    {" · "}
                    <span className="text-amber-500">User Detail → Add-ons tab</span> mein manage karein
                  </p>
                </div>
                {hasAnyExtra && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0"
                    style={{ background: dLeft !== null && dLeft <= 0 ? "rgba(248,113,113,0.15)" : "rgba(245,158,11,0.15)", border: `1px solid ${dLeft !== null && dLeft <= 0 ? "rgba(248,113,113,0.35)" : "rgba(245,158,11,0.35)"}`, color: dLeft !== null && dLeft <= 0 ? "#f87171" : "#fbbf24" }}>
                    {dLeft !== null && dLeft <= 0 ? "Expired" : `${dLeft}d`}
                  </span>
                )}
              </div>
            );
          })()}

          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl text-white font-bold text-sm mt-1 transition-all hover:scale-[1.01]"
            style={{ background: saving ? "rgba(37,99,235,0.4)" : "linear-gradient(135deg,#2563EB,#1d4ed8)", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving..." : isEdit ? "Save Changes →" : "Register User →"}
          </button>
        </form>
      </div>
    </div>

    {/* ── Confirm Renewal Popup ── */}
    {renewConfirm && isEdit && (() => {
      const period     = form.billingPeriod || "monthly";
      const currentEnd = form.activeTo;
      const currentFrom = form.activeFrom;   // stays unchanged
      // newEnd = extend current activeTo by 1 month/year (no -1 day)
      const newEnd = currentEnd ? calcRenewalEndDate(currentEnd, period) : "";
      // Display start = currentEnd + 1 day (shown in popup, not saved)
      const displayNewStart = calcRenewalDisplayStart(currentEnd);
      return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: "#0d1117", border: "1.5px solid rgba(16,185,129,0.4)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>
            <div className="px-6 pt-6 pb-4 text-center"
              style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.05))" }}>
              <div className="text-4xl mb-3">🔄</div>
              <h3 className="text-white font-black text-lg">Confirm Renewal</h3>
              <p className="text-gray-300 text-sm mt-1">
                Are you sure you want to renew <span className="text-white font-semibold">{initial?.name}</span>&apos;s subscription?
              </p>
            </div>
            <div className="px-6 py-4 flex flex-col gap-2">
              {[
                { label: "New Period Start",   value: displayNewStart ? new Date(displayNewStart+"T00:00:00").toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"}) : "—" },
                { label: "New End Date",        value: newEnd ? new Date(newEnd+"T00:00:00").toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"}) : "—" },
                { label: "Duration Extended",  value: period === "yearly" ? "+1 Year" : "+1 Month" },
                { label: "Payment Method",     value: renewPayMethod === "online" ? "Online" : renewPayMethod === "cheque" ? "Cheque" : "Cash" },
                { label: "Confirmation Email", value: `Will be sent to ${initial?.email}` },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-gray-300 text-xs uppercase tracking-widest font-bold">{r.label}</span>
                  <span className="text-white text-xs font-semibold text-right max-w-[55%]">{r.value}</span>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button type="button" onClick={() => setRenewConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                Cancel
              </button>
              <button type="button"
                onClick={() => {
                  // invoke the handleRenew captured in the IIFE scope by re-triggering via a custom event trick
                  // Instead, we store a pending flag and the IIFE picks it up
                  setRenewConfirm(false);
                  setRenewSaving(true);
                  (async () => {
                    try {
                      const token     = await getToken();
                      const headers   = { "Content-Type": "application/json", authorization: `Bearer ${token}` };
                      const renewedAt = new Date().toISOString();
                      const body      = { uid: initial.uid, activeTo: newEnd, paymentMethod: renewPayMethod, lastRenewedAt: renewedAt, lastRenewedBy: "admin" };
                      const res       = await fetch("/api/admin/update-user", { method: "POST", headers, body: JSON.stringify(body) });
                      const data      = await res.json();
                      if (!res.ok) throw new Error(data.error);
                      // Keep activeFrom unchanged, only update activeTo
                      setForm(p => ({ ...p, activeTo: newEnd, paymentMethod: renewPayMethod }));
                      setRenewDone(true);
                      if (initial.email) {
                        try {
                          const emailRes  = await fetch("/api/admin/send-renewal-email", { method: "POST", headers, body: JSON.stringify({ uid: initial.uid, userName: initial.name || initial.email, userEmail: initial.email, plan: form.plan, billingPeriod: form.billingPeriod, paymentMethod: renewPayMethod, activeFrom: currentFrom, activeTo: newEnd, periodStart: displayNewStart, renewedAt }) });
                          const emailData = await emailRes.json();
                          if (!emailRes.ok) onToast?.(`Renewed but email failed: ${emailData.error || emailRes.status}`, "error");
                        } catch (emailErr) {
                          onToast?.(`Renewed but email error: ${emailErr.message}`, "error");
                        }
                      }
                      setRenewSuccess({ newStart: displayNewStart, newEnd, payMethod: renewPayMethod });
                      onRenewSuccess?.();
                    } catch (err) {
                      onToast?.(err.message || "Renewal failed", "error");
                    } finally {
                      setRenewSaving(false);
                    }
                  })();
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff", boxShadow: "0 4px 16px rgba(16,185,129,0.35)" }}>
                Yes, Renew Now
              </button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* ── Processing Overlay ── */}
    {renewSaving && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}>
        <div className="flex flex-col items-center gap-5 px-8 py-10 rounded-2xl"
          style={{ background: "#0d1117", border: "1.5px solid rgba(16,185,129,0.3)", minWidth: 260 }}>
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
              style={{ borderTopColor: "#10B981", borderRightColor: "rgba(16,185,129,0.3)" }} />
            <div className="absolute inset-2 rounded-full flex items-center justify-center text-2xl">🔄</div>
          </div>
          <div className="text-center">
            <p className="text-white font-black text-base">Processing Renewal...</p>
            <p className="text-gray-300 text-sm mt-1">Updating subscription &amp; sending email</p>
          </div>
          <div className="flex flex-col gap-1.5 w-full">
            {["Saving new subscription dates", "Updating payment record", "Sending confirmation email"].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                  style={{ background: "#10B981", animationDelay: `${i * 0.2}s` }} />
                <span className="text-gray-300 text-xs">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* ── Success Popup ── */}
    {renewSuccess && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background: "#0d1117", border: "1.5px solid rgba(52,211,153,0.5)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height: 5, background: "linear-gradient(to right,#10B981,#34d399,#6ee7b7)" }} />
          <div className="px-6 pt-6 pb-3 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
              style={{ background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.4)" }}>
              ✅
            </div>
            <h3 className="text-white font-black text-xl">Renewed Successfully!</h3>
            <p className="text-gray-300 text-sm mt-1.5">
              <span className="text-white font-semibold">{initial?.name}</span>&apos;s subscription has been renewed and a confirmation email has been sent.
            </p>
          </div>
          <div className="px-6 py-3 mx-2 rounded-xl mb-4"
            style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
            {[
              { label: "New Period Starts", value: new Date(renewSuccess.newStart+"T00:00:00").toLocaleDateString("en-PK",{day:"2-digit",month:"long",year:"numeric"}) },
              { label: "New Period Ends",   value: new Date(renewSuccess.newEnd+"T00:00:00").toLocaleDateString("en-PK",{day:"2-digit",month:"long",year:"numeric"}) },
              { label: "Payment Method",   value: renewSuccess.payMethod === "online" ? "🌐 Online" : renewSuccess.payMethod === "cheque" ? "🧾 Cheque" : "💵 Cash" },
              { label: "Email Sent",       value: `✉️ ${initial?.email}` },
            ].map(r => (
              <div key={r.label} className="flex items-start justify-between gap-3 py-1.5"
                style={{ borderBottom: "1px solid rgba(16,185,129,0.1)" }}>
                <span className="text-gray-300 text-[11px] uppercase tracking-widest font-bold flex-shrink-0">{r.label}</span>
                <span className="text-emerald-300 text-xs font-semibold text-right">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="px-6 pb-6">
            <button type="button" onClick={() => setRenewSuccess(null)}
              className="w-full py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff", boxShadow: "0 4px 16px rgba(16,185,129,0.3)" }}>
              Done ✓
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Addon Confirm Popup ─────────────────────────────────────────────── */}
    {addonConfirm && isEdit && (() => {
      const { items: cItems, grandTotal: cTotal } = calcAddonLineItems(addLimits, addonPrices);
      const now       = new Date();
      const expDate   = new Date(now); expDate.setMonth(expDate.getMonth() + 1);
      const purchStr  = now.toLocaleDateString("en-PK",    { day: "2-digit", month: "short", year: "numeric" });
      const expiryStr = expDate.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
      return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: "#0d1117", border: "1.5px solid rgba(245,158,11,0.45)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
            <div className="px-6 pt-6 pb-4 text-center"
              style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.1),rgba(217,119,6,0.05))" }}>
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="text-white font-black text-lg">Confirm Add-on Purchase</h3>
              <p className="text-gray-300 text-sm mt-1">
                <span className="text-white font-semibold">{initial?.name}</span> ke liye extra quota activate karein?
              </p>
            </div>
            <div className="px-6 py-4 flex flex-col gap-1">
              {cItems.map(item => (
                <div key={item.key} className="flex items-center gap-2 py-1.5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-gray-300 text-xs flex-1">{item.label}</span>
                  <span className="text-gray-300 text-xs mr-1">×{item.qty}</span>
                  <span className="text-amber-300 text-xs font-bold">Rs. {item.total.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 pb-1">
                <span className="text-gray-300 text-xs font-bold uppercase tracking-widest">Total</span>
                <span className="text-amber-300 font-black text-base">Rs. {cTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg mt-1"
                style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <span className="text-amber-400 text-xs">⏰</span>
                <p className="text-amber-400 text-[11px] font-medium">Valid: {purchStr} → {expiryStr} (1 month)</p>
              </div>
              <div className="flex items-center gap-2 py-1.5 mt-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-gray-300 text-xs uppercase tracking-widest font-bold">Payment</span>
                <span className="text-white text-xs font-semibold ml-auto">{addonPayMethod === "online" ? "🌐 Online" : addonPayMethod === "cheque" ? "🧾 Cheque" : "💵 Cash"}</span>
              </div>
              {initial?.email && (
                <div className="flex items-center gap-2 py-1.5">
                  <span className="text-gray-300 text-xs uppercase tracking-widest font-bold">Invoice Email</span>
                  <span className="text-blue-400 text-xs font-semibold ml-auto truncate max-w-[55%]">✉️ {initial.email}</span>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button type="button" onClick={() => setAddonConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                Cancel
              </button>
              <button type="button"
                onClick={() => { setAddonConfirm(false); doSaveExtraLimits(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}>
                ✓ Confirm &amp; Activate
              </button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* ── Addon Processing Overlay ────────────────────────────────────────── */}
    {extraSaving && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}>
        <div className="flex flex-col items-center gap-5 px-8 py-10 rounded-2xl"
          style={{ background: "#0d1117", border: "1.5px solid rgba(245,158,11,0.3)", minWidth: 260 }}>
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
              style={{ borderTopColor: "#F59E0B", borderRightColor: "rgba(245,158,11,0.3)" }} />
            <div className="absolute inset-2 rounded-full flex items-center justify-center text-2xl">⚡</div>
          </div>
          <div className="text-center">
            <p className="text-white font-black text-base">Activating Add-on...</p>
            <p className="text-gray-300 text-sm mt-1">Saving limits &amp; sending invoice email</p>
          </div>
          <div className="flex flex-col gap-1.5 w-full">
            {["Saving extra quota", "Setting 1-month expiry", "Sending invoice email"].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                  style={{ background: "#F59E0B", animationDelay: `${i * 0.2}s` }} />
                <span className="text-gray-300 text-xs">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* ── Addon Success Popup ─────────────────────────────────────────────── */}
    {addonSuccess && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background: "#0d1117", border: "1.5px solid rgba(245,158,11,0.5)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height: 5, background: "linear-gradient(to right,#F59E0B,#fbbf24,#FCD34D)" }} />
          <div className="px-6 pt-6 pb-3 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
              style={{ background: "rgba(245,158,11,0.15)", border: "2px solid rgba(245,158,11,0.4)" }}>✅</div>
            <h3 className="text-white font-black text-xl">Add-on Activated!</h3>
            <p className="text-gray-300 text-sm mt-1.5">
              <span className="text-white font-semibold">{initial?.name}</span>&apos;s extra quota is now active and an invoice has been sent.
            </p>
          </div>
          <div className="px-6 py-3 mx-2 rounded-xl mb-4"
            style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
            {addonSuccess.items?.map(item => (
              <div key={item.key} className="flex items-center justify-between py-1.5"
                style={{ borderBottom: "1px solid rgba(245,158,11,0.1)" }}>
                <span className="text-gray-300 text-[11px]">{item.icon} {item.label} ×{item.qty}</span>
                <span className="text-amber-300 text-xs font-semibold">Rs. {item.total.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(245,158,11,0.1)" }}>
              <span className="text-gray-300 text-[11px] uppercase tracking-widest font-bold">Total Paid</span>
              <span className="text-amber-300 font-black">Rs. {addonSuccess.grandTotal?.toLocaleString()}</span>
            </div>
            {addonSuccess.expiresAt && (
              <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(245,158,11,0.1)" }}>
                <span className="text-gray-300 text-[11px] uppercase tracking-widest font-bold">Expires On</span>
                <span className="text-amber-300 text-xs font-semibold">⏰ {new Date(addonSuccess.expiresAt).toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" })}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-gray-300 text-[11px] uppercase tracking-widest font-bold">Invoice Sent</span>
              <span className="text-blue-400 text-xs font-semibold">✉️ {initial?.email}</span>
            </div>
          </div>
          <div className="px-6 pb-6">
            <button type="button" onClick={() => setAddonSuccess(null)}
              className="w-full py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000", boxShadow: "0 4px 16px rgba(245,158,11,0.3)" }}>
              Done ✓
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

/* ── User Detail Modal ────────────────────────────────────────────────────── */
function UserDetailModal({ detailUser, detailLoading, onClose, fmtDate, daysLeft }) {
  if (!detailUser && !detailLoading) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl my-6 rounded-2xl overflow-hidden"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>

        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(139,92,246,0.05))" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black"
              style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.25),rgba(245,158,11,0.15))", color: "#60A5FA", border: "1px solid rgba(37,99,235,0.3)" }}>
              {(detailUser?.user?.name || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-white font-black text-lg leading-none">{detailUser?.user?.name || "Loading..."}</h2>
              <p className="text-gray-300 text-xs mt-0.5">{detailUser?.user?.email}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 transition-all">✕</button>
        </div>

        {detailLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-transparent animate-spin" />
          </div>
        ) : detailUser && (
          <div className="p-6 flex flex-col gap-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-3">👤 Profile</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Phone",    value: detailUser.user.phone   || "—" },
                  { label: "Address",  value: detailUser.user.address || "—" },
                  { label: "Registered", value: detailUser.user.createdAt ? new Date(detailUser.user.createdAt).toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"}) : "—" },
                  { label: "Email Verified", value: detailUser.authRecord?.emailVerified ? "✅ Yes" : "❌ No" },
                  { label: "Device Limit", value: `${detailUser.user.maxDevices||1} device${(detailUser.user.maxDevices||1)>1?"s":""}` },
                ].map(r => (
                  <div key={r.label} className="rounded-xl px-4 py-3"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-gray-300 text-[10px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                    <p className="text-white text-sm font-medium">{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-3">📅 Subscription</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label:"Active From", value: fmtDate(detailUser.user.activeFrom) },
                  { label:"Active Until", value: fmtDate(detailUser.user.activeTo) },
                  { label:"Days Left", value: (() => { const d=daysLeft(detailUser.user.activeTo); return d===null?"—":d<0?`Expired ${Math.abs(d)}d ago`:d===0?"Expires today!":`${d} days`; })() },
                  { label:"Billing Period", value: detailUser.user.billingPeriod === "yearly" ? "📆 Yearly" : detailUser.user.billingPeriod === "monthly" ? "📅 Monthly" : detailUser.user.billingPeriod || "—" },
                  { label:"Payment Method", value: detailUser.user.paymentMethod === "online" ? "🌐 Online" : detailUser.user.paymentMethod === "cheque" ? "🧾 Cheque" : detailUser.user.paymentMethod === "cash" ? "💵 Cash" : detailUser.user.paymentMethod || "—" },
                ].map(r => (
                  <div key={r.label} className="rounded-xl px-4 py-3"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-gray-300 text-[10px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                    <p className="text-white text-sm font-medium">{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-3">⚡ Activity</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label:"Last Login",   value: detailUser.user.lastLogin    ? new Date(detailUser.user.lastLogin).toLocaleString("en-PK")    : detailUser.authRecord?.lastSignInTime || "Never" },
                  { label:"Last Active",  value: detailUser.user.lastActiveAt ? new Date(detailUser.user.lastActiveAt).toLocaleString("en-PK") : "—" },
                  { label:"Login IP",     value: detailUser.user.lastLoginIP  || "—" },
                  { label:"Browser",      value: detailUser.user.lastBrowser  || "—" },
                  { label:"Device",       value: detailUser.user.lastDevice   || "—" },
                ].map(r => (
                  <div key={r.label} className="rounded-xl px-4 py-3"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-gray-300 text-[10px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                    <p className="text-white text-sm font-medium truncate">{r.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-2">🕐 Login History (last 20)</p>
              {detailUser.activityLogs.length === 0 ? (
                <p className="text-gray-300 text-xs px-1">No login history yet.</p>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div className="grid text-[10px] font-bold uppercase tracking-widest px-4 py-2"
                    style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.05)", gridTemplateColumns:"2fr 1fr 1fr 1fr" }}>
                    <span>Date & Time</span><span>IP</span><span>Browser</span><span>Device</span>
                  </div>
                  {detailUser.activityLogs.map((log, i) => (
                    <div key={log.id} className="grid px-4 py-2.5 text-xs hover:bg-white/[0.02] transition-colors"
                      style={{ gridTemplateColumns:"2fr 1fr 1fr 1fr", borderBottom: i<detailUser.activityLogs.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                      <span className="text-gray-300">{new Date(log.timestamp).toLocaleString("en-PK")}</span>
                      <span className="text-gray-300 font-mono text-[10px]">{log.ip}</span>
                      <span className="text-gray-300">{log.browser}</span>
                      <span className="text-gray-300">{log.device}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ADMIN SYSTEM BACKUP
   Backs up: all users (profiles + subcollections) + global collections
   (addonRequests, supportTickets, adminConfig)
══════════════════════════════════════════════════════════════════════ */
// Global collections to back up (top-level, no nesting)
const GLOBAL_COLS = [
  { id: "addonRequests",  label: "Addon Requests",  icon: "⚡" },
  { id: "supportTickets", label: "Support Tickets",  icon: "🎫" },
  { id: "adminConfig",    label: "Admin Config",     icon: "⚙️" },
];

// Per-user flat subcollections
const USER_FLAT_COLS = [
  "invoices","customers","products","payments","purchases",
  "suppliers","supplierPayments","supplierReceipts","supplierReturns",
  "expenses","quotations","addonRequests","tickets","activityLogs",
];
const USER_SUPPLIER_NESTED = ["orders","payments","receipts","returns"];
const USER_CUSTOMER_NESTED = ["invoices"];

function serializeAdminDoc(id, data) {
  const out = { _id: id };
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && typeof v.toDate === "function") {
      out[k] = { _type: "Timestamp", _ms: v.toDate().getTime() };
    } else { out[k] = v; }
  }
  return out;
}

// ── Auto-backup intervals (admin) ────────────────────────────────────────────
const ADMIN_AUTO_INTERVALS = [
  { id: "1h",      label: "Every 1 Hour",    ms: 1  * 60 * 60 * 1000 },
  { id: "6h",      label: "Every 6 Hours",   ms: 6  * 60 * 60 * 1000 },
  { id: "12h",     label: "Every 12 Hours",  ms: 12 * 60 * 60 * 1000 },
  { id: "daily",   label: "Daily (24 hrs)",  ms: 24 * 60 * 60 * 1000 },
  { id: "weekly",  label: "Weekly",          ms: 7  * 24 * 60 * 60 * 1000 },
  { id: "monthly", label: "Monthly (30d)",   ms: 30 * 24 * 60 * 60 * 1000 },
];

// ── Admin IndexedDB helpers (separate store from user backup) ─────────────────
const ADMIN_IDB_NAME  = "novexa_admin_backup";
const ADMIN_IDB_STORE = "admin_handles";

function openAdminIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ADMIN_IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      if (!e.target.result.objectStoreNames.contains(ADMIN_IDB_STORE))
        e.target.result.createObjectStore(ADMIN_IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
async function adminIdbPut(key, value) {
  try { const db = await openAdminIDB(); const tx = db.transaction(ADMIN_IDB_STORE,"readwrite"); tx.objectStore(ADMIN_IDB_STORE).put(value, key); await new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=j;}); } catch {}
}
async function adminIdbGet(key) {
  try { const db = await openAdminIDB(); const tx = db.transaction(ADMIN_IDB_STORE,"readonly"); const req = tx.objectStore(ADMIN_IDB_STORE).get(key); return await new Promise(r=>{req.onsuccess=()=>r(req.result??null);req.onerror=()=>r(null);}); } catch { return null; }
}
async function adminIdbDel(key) {
  try { const db = await openAdminIDB(); const tx = db.transaction(ADMIN_IDB_STORE,"readwrite"); tx.objectStore(ADMIN_IDB_STORE).delete(key); } catch {}
}

function AdminSystemBackup({ getToken, users }) {
  // ── Manual backup state ────────────────────────────────────────────────────
  const [phase,       setPhase]       = useState("idle");
  const [progress,    setProgress]    = useState(0);
  const [statusMsg,   setStatusMsg]   = useState("");
  const [resultMsg,   setResultMsg]   = useState({ type:"", text:"" });
  const [log,         setLog]         = useState([]);

  // ── Folder state ───────────────────────────────────────────────────────────
  const [dirHandle,    setDirHandle]    = useState(null);
  const [folderName,   setFolderName]   = useState("");
  const [folderModal,  setFolderModal]  = useState(false);
  // "manual" | "auto-enable"
  const folderPurposeRef = useRef("manual");
  const pendingRef = useRef(null);

  // ── Auto-backup state ──────────────────────────────────────────────────────
  const [autoEnabled,    setAutoEnabled]    = useState(false);
  const [autoIntervalId, setAutoIntervalId] = useState("daily");
  const [autoNextAt,     setAutoNextAt]     = useState(null);
  const [autoMsg,        setAutoMsg]        = useState({ type:"", text:"" });
  const [countdown,      setCountdown]      = useState("");
  const [autoDestModal,  setAutoDestModal]  = useState(false);
  const autoTimerRef  = useRef(null);
  const autoNextAtRef = useRef(null);

  // ── History ────────────────────────────────────────────────────────────────
  const [history, setHistory] = useState([]);

  // ── Password protection (manual backups) ───────────────────────────────────
  const [pwModal,    setPwModal]    = useState("idle");
  const [pwInput,    setPwInput]    = useState("");
  const [pwConfirm,  setPwConfirm]  = useState("");
  const [pwShow,     setPwShow]     = useState(false);
  const [pwError,    setPwError]    = useState("");
  const pwPendingRef = useRef(null);

  // ── Restore state ──────────────────────────────────────────────────────────
  const fileInputRef  = useRef(null);
  const [restoring,    setRestoring]    = useState(false);
  const [restoreMsg,   setRestoreMsg]   = useState({ type:"", text:"" });
  const [restoreProg,  setRestoreProg]  = useState(0);
  const [restoreLabel, setRestoreLabel] = useState("");
  const [modalStep,    setModalStep]    = useState(null); // "choose" | "confirm-merge" | "confirm-replace"
  const [pendingFile,  setPendingFile]  = useState(null);
  const [fileInfo,     setFileInfo]     = useState(null);
  const pwRestoreRef   = useRef(null);

  const cardS = { background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" };
  const running = phase === "running";

  function addLog(msg) { setLog(prev => [...prev, msg]); }

  function fmtCountdown(ms) {
    if (ms <= 0) return "now";
    const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60), d = Math.floor(h/24);
    if (d > 0) return `${d}d ${h%24}h`;
    if (h > 0) return `${h}h ${m%60}m`;
    if (m > 0) return `${m}m ${s%60}s`;
    return `${s}s`;
  }
  function fmtDT(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  // ── Load saved state on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("showDirectoryPicker" in window) {
      adminIdbGet("dirHandle").then(h => { if (h) { setDirHandle(h); setFolderName(h.name || "Saved Folder"); } });
    }
    adminIdbGet("autoSettings").then(s => {
      if (s?.intervalId) { setAutoEnabled(true); setAutoIntervalId(s.intervalId); setAutoNextAt(s.nextAt); autoNextAtRef.current = s.nextAt; }
    });
    adminIdbGet("history").then(h => { if (Array.isArray(h)) setHistory(h); });
  }, []);

  // ── Auto countdown + fire ──────────────────────────────────────────────────
  useEffect(() => {
    if (autoTimerRef.current) { clearInterval(autoTimerRef.current); autoTimerRef.current = null; }
    if (!autoEnabled || !autoNextAt) { setCountdown(""); return; }
    const tick = () => {
      const rem = (autoNextAtRef.current || 0) - Date.now();
      setCountdown(fmtCountdown(rem));
      if (rem <= 0) {
        runBackupSilent();
        const ms = ADMIN_AUTO_INTERVALS.find(i => i.id === autoIntervalId)?.ms || 24*3600*1000;
        const next = Date.now() + ms;
        autoNextAtRef.current = next; setAutoNextAt(next);
        adminIdbPut("autoSettings", { intervalId: autoIntervalId, nextAt: next });
      }
    };
    tick();
    autoTimerRef.current = setInterval(tick, 1000);
    return () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnabled, autoNextAt, autoIntervalId]);

  // ── History helpers ────────────────────────────────────────────────────────
  async function addHistoryEntry(fileName, userCount, docCount, type) {
    const entry = { at: new Date().toISOString(), fileName, userCount, docCount, type };
    const cur = await adminIdbGet("history");
    const arr = Array.isArray(cur) ? [entry, ...cur].slice(0, 50) : [entry];
    await adminIdbPut("history", arr);
    setHistory(arr);
  }

  // ── Core write helpers ─────────────────────────────────────────────────────
  async function writeToDirHandle(dh, json, fileName) {
    // Ensure .json extension is always present
    const safeName = fileName.endsWith(".json") ? fileName : fileName + ".json";
    const fh = await dh.getFileHandle(safeName, { create: true });
    const w  = await fh.createWritable();
    await w.write(json); await w.close();
  }

  async function writeToDirEncrypted(dh, json, baseFileName, password) {
    const encFileName = encryptedFileName(baseFileName);
    const buffer = await encryptJson(json, password);
    const fh = await dh.getFileHandle(encFileName, { create: true });
    const w  = await fh.createWritable();
    await w.write(buffer); await w.close();
    return encFileName;
  }

  function downloadBlob(content, fileName, mime = "application/json") {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function askPasswordThenSave(payload) {
    pwPendingRef.current = payload;
    setPwInput(""); setPwConfirm(""); setPwError(""); setPwShow(false);
    setPwModal("ask");
  }

  async function finalizePlainSave({ dh, json, fileName, totalDocs, userCount, type }) {
    if (dh) {
      await writeToDirHandle(dh, json, fileName);
      setResultMsg({ type:"success", text:`✅ Saved "${fileName}" to "${dh.name}" — ${totalDocs.toLocaleString()} total docs, ${userCount} users.` });
    } else {
      downloadBlob(json, fileName);
      setResultMsg({ type:"success", text:`✅ Downloaded "${fileName}" — ${totalDocs.toLocaleString()} total docs, ${userCount} users.` });
    }
    setProgress(100);
    addLog(`\n📦 Backup complete: ${totalDocs.toLocaleString()} docs across ${userCount} users.`);
    await addHistoryEntry(fileName, userCount, totalDocs, type);
    setPhase("done"); setStatusMsg("");
  }

  async function handleAskSkip() {
    setPwModal("idle");
    const { dh, json, fileName, totalDocs, userCount, type } = pwPendingRef.current || {};
    if (!json) return;
    setPhase("running");
    try {
      // Always encrypt with default hidden key — no password asked on restore
      const savedName = dh
        ? await writeToDirEncrypted(dh, json, fileName, NOVEXA_DEFAULT_KEY)
        : encryptedFileName(fileName);
      if (!dh) {
        const buffer = await encryptJson(json, NOVEXA_DEFAULT_KEY);
        downloadBlob(buffer, savedName, "application/octet-stream");
      }
      setResultMsg({ type:"success", text:`✅ Backup saved as "${savedName}" — ${totalDocs?.toLocaleString()} total docs, ${userCount} users.` });
      setProgress(100);
      addLog(`\n📦 Backup complete (auto-encrypted): ${totalDocs?.toLocaleString()} docs across ${userCount} users.`);
      await addHistoryEntry(savedName, userCount, totalDocs, type);
    } catch (err) {
      setResultMsg({ type:"error", text:"Save failed: " + err.message });
    }
    setPhase("done"); setStatusMsg("");
    pwPendingRef.current = null;
  }

  async function handlePwSet() {
    if (!pwInput) { setPwError("Please enter a password."); return; }
    if (pwInput !== pwConfirm) { setPwError("Passwords don't match."); return; }
    if (pwInput.length < 6) { setPwError("Password must be at least 6 characters."); return; }
    setPwModal("idle");
    const { dh, json, fileName, totalDocs, userCount, type } = pwPendingRef.current || {};
    if (!json) return;
    setPhase("running");
    try {
      const savedName = dh
        ? await writeToDirEncrypted(dh, json, fileName, pwInput)
        : encryptedFileName(fileName);
      if (!dh) {
        const buffer = await encryptJson(json, pwInput);
        downloadBlob(buffer, savedName, "application/octet-stream");
      }
      setResultMsg({
        type:"success",
        text:`🔐 Encrypted backup saved as "${savedName}" — ${totalDocs.toLocaleString()} total docs, ${userCount} users. Unlock via restore on a user backup tab.`,
      });
      setProgress(100);
      addLog(`\n📦 Encrypted backup complete: ${totalDocs.toLocaleString()} docs across ${userCount} users.`);
      await addHistoryEntry(savedName, userCount, totalDocs, type);
    } catch (err) {
      setResultMsg({ type:"error", text:"Encrypted save failed: " + err.message });
    }
    setPhase("done"); setStatusMsg("");
    pwPendingRef.current = null;
    setPwInput(""); setPwConfirm("");
  }

  async function runBackup(dh, type = "manual") {
    setPhase("running"); setLog([]); setResultMsg({ type:"", text:"" });
    try {
      const { collection: col, getDocs } = await import("firebase/firestore");
      const { db: fdb } = await import("@/lib/firebase");

      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        type: "admin-system-backup",
        globalCollections: {},
        users: {},
      };

      // ── 1. Global top-level collections ──────────────────────────────────
      const totalSteps = GLOBAL_COLS.length + (users?.length || 0) + 1;
      let done = 0;

      for (const gc of GLOBAL_COLS) {
        setStatusMsg(`Reading ${gc.label}...`);
        setProgress(Math.round((done / totalSteps) * 100));
        try {
          const snap = await getDocs(col(fdb, gc.id));
          backup.globalCollections[gc.id] = snap.docs.map(d => serializeAdminDoc(d.id, d.data()));
          addLog(`✅ ${gc.label}: ${snap.docs.length} docs`);
        } catch (err) {
          addLog(`⚠️ ${gc.label}: skipped (${err.message})`);
          backup.globalCollections[gc.id] = [];
        }
        done++;
      }

      // ── 2. All user profiles + subcollections ─────────────────────────────
      const allUsers = users?.length ? users : [];
      for (const usr of allUsers) {
        const uid = usr.uid || usr.id;
        setStatusMsg(`Backing up user: ${usr.name || uid}...`);
        setProgress(Math.round((done / totalSteps) * 100));
        try {
          // User profile doc
          const profileSnap = await getDocs(col(fdb, "users"));
          const profileDoc   = profileSnap.docs.find(d => d.id === uid);
          const profile      = profileDoc ? serializeAdminDoc(profileDoc.id, profileDoc.data()) : null;

          const userBackup = { profile, collections: {}, customerNested: {}, supplierNested: {} };

          // Flat subcollections
          for (const colId of USER_FLAT_COLS) {
            try {
              const snap = await getDocs(col(fdb, "users", uid, colId));
              if (snap.docs.length > 0)
                userBackup.collections[colId] = snap.docs.map(d => serializeAdminDoc(d.id, d.data()));
            } catch { /* skip missing */ }
          }

          // Customer nested
          const custSnap = await getDocs(col(fdb, "users", uid, "customers"));
          for (const custDoc of custSnap.docs) {
            userBackup.customerNested[custDoc.id] = {};
            for (const sub of USER_CUSTOMER_NESTED) {
              try {
                const subSnap = await getDocs(col(fdb, "users", uid, "customers", custDoc.id, sub));
                if (subSnap.docs.length) userBackup.customerNested[custDoc.id][sub] = subSnap.docs.map(d => serializeAdminDoc(d.id, d.data()));
              } catch { /* skip */ }
            }
          }

          // Supplier nested
          const supSnap = await getDocs(col(fdb, "users", uid, "suppliers"));
          for (const supDoc of supSnap.docs) {
            userBackup.supplierNested[supDoc.id] = {};
            for (const sub of USER_SUPPLIER_NESTED) {
              try {
                const subSnap = await getDocs(col(fdb, "users", uid, "suppliers", supDoc.id, sub));
                if (subSnap.docs.length) userBackup.supplierNested[supDoc.id][sub] = subSnap.docs.map(d => serializeAdminDoc(d.id, d.data()));
              } catch { /* skip */ }
            }
          }

          backup.users[uid] = userBackup;
          // Count docs for this user
          let userDocCount = 0;
          Object.values(userBackup.collections).forEach(a => { userDocCount += a.length; });
          Object.values(userBackup.customerNested).forEach(s => Object.values(s).forEach(a => { userDocCount += a.length; }));
          Object.values(userBackup.supplierNested).forEach(s => Object.values(s).forEach(a => { userDocCount += a.length; }));
          addLog(`✅ User ${usr.name || uid}: ${userDocCount} docs`);
        } catch (err) {
          addLog(`⚠️ User ${usr.name || uid}: error — ${err.message}`);
        }
        done++;
      }

      // ── 3. Finalize ───────────────────────────────────────────────────────
      setStatusMsg("Writing file...");
      setProgress(99);
      const json = JSON.stringify(backup, null, 2);
      const now  = new Date();
      const fileName = `novexa-admin-backup-${now.toISOString().split("T")[0]}_${now.toTimeString().slice(0,8).replace(/:/g,"-")}.json`;

      // Count total docs
      let totalDocs = 0;
      Object.values(backup.globalCollections).forEach(a => { totalDocs += a.length; });
      Object.keys(backup.users).forEach(uid => {
        const u = backup.users[uid];
        Object.values(u.collections || {}).forEach(a => { totalDocs += a.length; });
        Object.values(u.customerNested || {}).forEach(s => Object.values(s).forEach(a => { totalDocs += a.length; }));
        Object.values(u.supplierNested || {}).forEach(s => Object.values(s).forEach(a => { totalDocs += a.length; }));
      });

      if (type === "auto") {
        await finalizePlainSave({ dh, json, fileName, totalDocs, userCount: Object.keys(backup.users).length, type });
      } else {
        setProgress(100);
        setPhase("done");
        setStatusMsg("");
        askPasswordThenSave({
          dh,
          json,
          fileName,
          totalDocs,
          userCount: Object.keys(backup.users).length,
          type,
        });
      }
    } catch (err) {
      setResultMsg({ type:"error", text:"Backup failed: " + err.message });
      addLog(`❌ Fatal error: ${err.message}`);
      setPhase("done"); setStatusMsg("");
    }
  }

  // ── Silent auto-backup (no UI spinner, just runs + logs result) ────────────
  async function runBackupSilent() {
    if (!dirHandle) return;
    try {
      const perm = await dirHandle.requestPermission({ mode:"readwrite" });
      if (perm !== "granted") { setAutoMsg({ type:"error", text:"Auto-backup failed: folder permission denied." }); return; }
      await runBackup(dirHandle, "auto");
      setAutoMsg({ type:"success", text:`Auto backup saved at ${new Date().toLocaleTimeString()}` });
    } catch (err) {
      setAutoMsg({ type:"error", text:"Auto backup failed: " + err.message });
    }
  }

  async function handleStartBackup() {
    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      if (dirHandle) {
        folderPurposeRef.current = "manual";
        setFolderModal(true);
      } else {
        // open picker first
        try {
          const dh = await window.showDirectoryPicker({ mode: "readwrite" });
          setDirHandle(dh); setFolderName(dh.name || "Saved Folder");
          await adminIdbPut("dirHandle", dh);
          await runBackup(dh, "manual");
        } catch (err) {
          if (err.name !== "AbortError") setResultMsg({ type:"error", text:"Folder error: " + err.message });
        }
      }
    } else {
      await runBackup(null, "manual");
    }
  }

  async function useSameFolder() {
    setFolderModal(false);
    const purpose = folderPurposeRef.current;
    try {
      const perm = await dirHandle.requestPermission({ mode:"readwrite" });
      if (perm !== "granted") throw new Error("Permission denied.");
      if (purpose === "auto-enable") { commitAutoEnable(dirHandle); }
      else { await runBackup(dirHandle, "manual"); }
    } catch (err) {
      if (err.name !== "AbortError") setResultMsg({ type:"error", text:"Folder error: " + err.message });
    }
  }

  async function chooseNewFolder() {
    setFolderModal(false);
    const purpose = folderPurposeRef.current;
    try {
      const dh = await window.showDirectoryPicker({ mode:"readwrite" });
      setDirHandle(dh); setFolderName(dh.name || "Saved Folder");
      await adminIdbPut("dirHandle", dh);
      if (purpose === "auto-enable") { commitAutoEnable(dh); }
      else { await runBackup(dh, "manual"); }
    } catch (err) {
      if (err.name !== "AbortError") setResultMsg({ type:"error", text:"Folder error: " + err.message });
    }
  }

  // ── Auto-backup enable/disable ─────────────────────────────────────────────
  function handleEnableAuto() {
    if (!("showDirectoryPicker" in window)) {
      setAutoMsg({ type:"error", text:"Auto-backup requires a browser that supports the File System Access API." });
      return;
    }
    if (dirHandle) {
      folderPurposeRef.current = "auto-enable";
      setAutoDestModal(true);
    } else {
      startAutoWithNewFolder();
    }
  }

  async function startAutoWithSameFolder() {
    setAutoDestModal(false);
    try {
      const perm = await dirHandle.requestPermission({ mode:"readwrite" });
      if (perm !== "granted") throw new Error("Permission denied.");
      commitAutoEnable(dirHandle);
    } catch (err) {
      setAutoMsg({ type:"error", text:"Could not access folder: " + err.message });
    }
  }

  async function startAutoWithNewFolder() {
    setAutoDestModal(false);
    try {
      const dh = await window.showDirectoryPicker({ mode:"readwrite" });
      setDirHandle(dh); setFolderName(dh.name || "Saved Folder");
      await adminIdbPut("dirHandle", dh);
      commitAutoEnable(dh);
    } catch (err) {
      if (err.name !== "AbortError") setAutoMsg({ type:"error", text:"Folder error: " + err.message });
    }
  }

  function commitAutoEnable(dh) {
    const ms = ADMIN_AUTO_INTERVALS.find(i => i.id === autoIntervalId)?.ms || 24*3600*1000;
    const nextAt = Date.now() + ms;
    autoNextAtRef.current = nextAt;
    setAutoNextAt(nextAt); setAutoEnabled(true);
    adminIdbPut("autoSettings", { intervalId: autoIntervalId, nextAt });
    setAutoMsg({ type:"success", text:`Auto-backup enabled. First backup in ${fmtCountdown(ms)}.` });
    // If purpose was folder-modal, also update dirHandle
    if (dh && dh !== dirHandle) { setDirHandle(dh); setFolderName(dh.name || "Saved Folder"); }
  }

  function handleDisableAuto() {
    setAutoEnabled(false); setAutoNextAt(null); autoNextAtRef.current = null;
    setCountdown(""); setAutoMsg({ type:"", text:"" });
    adminIdbDel("autoSettings");
  }

  // ── Restore helpers ────────────────────────────────────────────────────────
  function processAdminBackupFile(parsed, fileName) {
    // Accept both admin system backup (version:1, type:admin-system-backup) and single-user backup (version:2)
    if (!parsed?.version || (!parsed?.collections && !parsed?.users && !parsed?.globalCollections)) {
      setRestoreMsg({ type:"error", text:"Invalid backup file. Please select a valid Novexa backup file." });
      return;
    }
    let count = 0;
    if (parsed.collections) {
      Object.values(parsed.collections).forEach(arr => { count += arr?.length || 0; });
      if (parsed.customerNested) Object.values(parsed.customerNested).forEach(s => Object.values(s).forEach(a => { count += a?.length||0; }));
      if (parsed.supplierNested) Object.values(parsed.supplierNested).forEach(s => Object.values(s).forEach(a => { count += a?.length||0; }));
    }
    if (parsed.globalCollections) Object.values(parsed.globalCollections).forEach(arr => { count += arr?.length||0; });
    if (parsed.users) Object.values(parsed.users).forEach(u => {
      Object.values(u.collections||{}).forEach(a => { count += a?.length||0; });
      Object.values(u.customerNested||{}).forEach(s => Object.values(s).forEach(a => { count += a?.length||0; }));
      Object.values(u.supplierNested||{}).forEach(s => Object.values(s).forEach(a => { count += a?.length||0; }));
    });
    const isAdminBackup = parsed.type === "admin-system-backup";
    const userCount = isAdminBackup ? Object.keys(parsed.users||{}).length : 1;
    setPendingFile(parsed);
    setFileInfo({ name: fileName, exportedAt: parsed.exportedAt, docCount: count, userCount, isAdminBackup, encrypted: isEncryptedFile(fileName) });
    setRestoreMsg({ type:"", text:"" });
    setModalStep("choose");
  }

  function handleRestoreFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (isEncryptedFile(file.name)) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const rawBuffer = ev.target.result;
        // First try default key (no-password backups) — silent auto-decrypt
        try {
          const json   = await decryptFile(rawBuffer, NOVEXA_DEFAULT_KEY);
          const parsed = JSON.parse(json);
          processAdminBackupFile(parsed, file.name);
          return;
        } catch { /* not a default-key file — fall through to ask password */ }
        // User-password backup — ask password
        pwRestoreRef.current = { rawBuffer, fileName: file.name };
        setPwInput(""); setPwError(""); setPwShow(false);
        setPwModal("enter");
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        processAdminBackupFile(parsed, file.name);
      } catch {
        setRestoreMsg({ type:"error", text:"Error reading file. Please select a valid JSON or .novexa backup file." });
      }
    };
    reader.readAsText(file);
  }

  async function handlePwEnterForRestore() {
    if (!pwInput) { setPwError("Please enter the password."); return; }
    setPwError("");
    const { rawBuffer, fileName } = pwRestoreRef.current || {};
    if (!rawBuffer) return;
    try {
      const json   = await decryptFile(rawBuffer, pwInput);
      const parsed = JSON.parse(json);
      setPwModal("idle"); setPwInput("");
      processAdminBackupFile(parsed, fileName);
    } catch {
      setPwError("Wrong password or corrupted file. Please try again.");
    }
  }

  // Helper: deserialize Firestore-serialized doc
  function adminDeserializeDoc(obj) {
    const { _id, ...rest } = obj;
    const out = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v && typeof v === "object" && v._type === "Timestamp") {
        out[k] = new Date(v._ms);
      } else { out[k] = v; }
    }
    return { id: _id, data: out };
  }

  // Core restore logic for admin backup
  async function executeAdminRestore(mode) {
    setModalStep(null);
    setRestoring(true);
    setRestoreMsg({ type:"", text:"" });
    setRestoreProg(0);
    try {
      const { collection: col, getDocs, doc: fsDoc, writeBatch, getFirestore } = await import("firebase/firestore");
      const { db: fdb } = await import("@/lib/firebase");
      const backup = pendingFile;
      const backupDate = backup.exportedAt ? new Date(backup.exportedAt) : new Date(0);
      const isAdminBackup = backup.type === "admin-system-backup";

      // Track restored users for Auth warning (defined here so both branches can use it)
      const restoredUsers = [];

      // Helper batch writers
      async function batchWrite(writes) {
        let batch = writeBatch(fdb); let count = 0;
        for (const { ref, data } of writes) {
          batch.set(ref, data, { merge: false }); count++;
          if (count === 490) { await batch.commit(); batch = writeBatch(fdb); count = 0; }
        }
        if (count > 0) await batch.commit();
      }
      async function batchDelete(refs) {
        let batch = writeBatch(fdb); let count = 0;
        for (const ref of refs) {
          batch.delete(ref); count++;
          if (count === 490) { await batch.commit(); batch = writeBatch(fdb); count = 0; }
        }
        if (count > 0) await batch.commit();
      }

      // ── Restore a flat collection ──────────────────────────────────────
      async function restoreCollection(colPath, backupDocs) {
        const backupIds = new Set(backupDocs.map(d => d._id));
        if (mode === "replace") {
          const liveSnap = await getDocs(col(fdb, ...colPath));
          const toDelete = liveSnap.docs.filter(d => !backupIds.has(d.id)).map(d => fsDoc(fdb, ...colPath, d.id));
          if (toDelete.length) await batchDelete(toDelete);
        } else {
          const liveSnap = await getDocs(col(fdb, ...colPath));
          const toDelete = liveSnap.docs.filter(d => {
            if (backupIds.has(d.id)) return false;
            const ct = d.data().createdAt;
            const ms = ct?.toDate ? ct.toDate().getTime() : ct ? new Date(ct).getTime() : 0;
            return ms <= backupDate.getTime();
          }).map(d => fsDoc(fdb, ...colPath, d.id));
          if (toDelete.length) await batchDelete(toDelete);
        }
        const writes = backupDocs.map(raw => {
          const { id, data } = adminDeserializeDoc(raw);
          return { ref: fsDoc(fdb, ...colPath, id), data };
        });
        if (writes.length) await batchWrite(writes);
      }

      if (isAdminBackup) {
        // ── Restore global collections ─────────────────────────────────
        const globalCols = Object.keys(backup.globalCollections || {});
        const totalSteps = globalCols.length + Object.keys(backup.users || {}).length;
        let done = 0;

        for (const colId of globalCols) {
          setRestoreLabel(`Restoring global: ${colId}...`);
          setRestoreProg(Math.round((done / totalSteps) * 100));
          const backupDocs = backup.globalCollections[colId] || [];
          await restoreCollection([colId], backupDocs);
          done++;
        }

        // ── Restore per-user data ──────────────────────────────────────
        for (const [uid, userBackup] of Object.entries(backup.users || {})) {
          setRestoreLabel(`Restoring user ${uid.slice(0,8)}...`);
          setRestoreProg(Math.round((done / totalSteps) * 100));

          // ── Restore user profile doc (users/{uid}) ────────────────────
          if (userBackup.profile) {
            try {
              const { id, data } = adminDeserializeDoc(userBackup.profile);
              await batchWrite([{ ref: fsDoc(fdb, "users", id), data }]);
              restoredUsers.push({ uid: id, name: data.name || "", email: data.email || "" });
            } catch (e) {
              addLog?.(`⚠️ User profile ${uid.slice(0,8)}: ${e.message}`);
            }
          }

          // Flat user subcollections
          for (const [colId, backupDocs] of Object.entries(userBackup.collections || {})) {
            await restoreCollection(["users", uid, colId], backupDocs);
          }
          // Customer nested
          for (const [custId, subs] of Object.entries(userBackup.customerNested || {})) {
            for (const [sub, docs] of Object.entries(subs || {})) {
              await restoreCollection(["users", uid, "customers", custId, sub], docs);
            }
          }
          // Supplier nested
          for (const [supId, subs] of Object.entries(userBackup.supplierNested || {})) {
            for (const [sub, docs] of Object.entries(subs || {})) {
              await restoreCollection(["users", uid, "suppliers", supId, sub], docs);
            }
          }
          done++;
        }
      } else {
        // ── Single-user backup restore ─────────────────────────────────
        const uid = backup.uid;
        if (!uid) throw new Error("Backup file has no UID. Cannot restore.");
        const allCols = Object.keys(backup.collections || {});
        const totalSteps = allCols.length + 2;
        let done = 0;
        for (const colId of allCols) {
          setRestoreLabel(`Restoring ${colId}...`);
          setRestoreProg(Math.round((done / totalSteps) * 100));
          await restoreCollection(["users", uid, colId], backup.collections[colId] || []);
          done++;
        }
        setRestoreLabel("Restoring customer data...");
        if (backup.customerNested) {
          for (const [custId, subs] of Object.entries(backup.customerNested)) {
            for (const [sub, docs] of Object.entries(subs || {})) {
              await restoreCollection(["users", uid, "customers", custId, sub], docs);
            }
          }
        }
        done++;
        setRestoreLabel("Restoring supplier data...");
        if (backup.supplierNested) {
          for (const [supId, subs] of Object.entries(backup.supplierNested)) {
            for (const [sub, docs] of Object.entries(subs || {})) {
              await restoreCollection(["users", uid, "suppliers", supId, sub], docs);
            }
          }
        }
        done++;
      }

      setRestoreProg(100);
      const modeLabel = mode === "replace" ? "Full replace" : "Smart merge";
      // Build message — if any users were restored, mention Auth recreation
      let successText = `✅ ${modeLabel} complete! ${fileInfo?.docCount?.toLocaleString() || ""} records restored.`;
      if (restoredUsers && restoredUsers.length > 0) {
        successText += ` | ⚠️ ${restoredUsers.length} user profile(s) restored to Firestore. If any were deleted, recreate their Auth accounts from Users tab → "Register New User" with the same email & a new password.`;
      }
      setRestoreMsg({ type:"success", text: successText });
    } catch (err) {
      setRestoreMsg({ type:"error", text:"Restore failed: " + err.message });
    }
    setRestoring(false); setRestoreProg(0); setRestoreLabel("");
    setPendingFile(null); setFileInfo(null);
  }

  function closeRestoreModal() { setModalStep(null); setPendingFile(null); setFileInfo(null); }

  return (
    <>
      {/* ── Password modals (manual system backup) ── */}
      {pwModal === "ask" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(99,102,241,0.4)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔐</span>
                <div>
                  <p className="text-white font-black text-sm">Protect this system backup?</p>
                  <p className="text-gray-300 text-xs">Encrypt with a password before saving</p>
                </div>
                <button onClick={() => { setPwModal("idle"); pwPendingRef.current = null; }}
                  className="ml-auto text-gray-300 hover:text-gray-300 text-lg">✕</button>
              </div>
              <div className="rounded-xl px-4 py-3 text-xs leading-relaxed text-gray-300"
                style={{ background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.18)" }}>
                🔒 <span className="text-indigo-300 font-semibold">Encrypted (.novexa)</span> — unlock via user backup restore tab.<br />
                📄 <span className="text-gray-300 font-semibold">Unencrypted (.json)</span> — plain readable JSON.
              </div>
              <div className="flex gap-3">
                <button onClick={handleAskSkip}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
                  📄 Skip, save plain
                </button>
                <button onClick={() => setPwModal("set")}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black"
                  style={{ background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"#fff" }}>
                  🔐 Yes, add password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pwModal === "set" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(99,102,241,0.4)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔑</span>
                <div>
                  <p className="text-white font-black text-sm">Set Backup Password</p>
                  <p className="text-gray-300 text-xs">AES-256 encryption — remember this password!</p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Password</label>
                <div className="relative">
                  <input type={pwShow ? "text" : "password"} value={pwInput}
                    onChange={e => { setPwInput(e.target.value); setPwError(""); }}
                    onKeyDown={e => e.key === "Enter" && handlePwSet()}
                    placeholder="Enter password (min 6 chars)"
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none pr-10"
                    style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)" }}
                    autoFocus
                  />
                  <button type="button" onClick={() => setPwShow(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-300 text-xs">
                    {pwShow ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Confirm Password</label>
                <input type={pwShow ? "text" : "password"} value={pwConfirm}
                  onChange={e => { setPwConfirm(e.target.value); setPwError(""); }}
                  onKeyDown={e => e.key === "Enter" && handlePwSet()}
                  placeholder="Repeat password"
                  className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                  style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)" }}
                />
              </div>
              {pwError && <p className="text-red-400 text-xs font-semibold">{pwError}</p>}
              <div className="rounded-xl px-3 py-2 text-[11px] text-amber-500"
                style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)" }}>
                ⚠️ If you forget this password, the backup cannot be recovered.
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPwModal("ask")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>← Back</button>
                <button onClick={handlePwSet} className="flex-1 py-2.5 rounded-xl text-sm font-black"
                  style={{ background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"#fff" }}>🔐 Encrypt &amp; Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Auto-dest modal ── */}
      {autoDestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.80)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(139,92,246,0.35)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#8b5cf6,#6d28d9)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏱️</span>
                <div>
                  <p className="text-white font-black text-sm">Auto-Backup Destination</p>
                  <p className="text-gray-300 text-xs">Where should auto-backups be saved?</p>
                </div>
                <button onClick={() => setAutoDestModal(false)} className="ml-auto text-gray-300 hover:text-gray-300 text-lg">✕</button>
              </div>
              <div className="px-4 py-3 rounded-xl flex items-center gap-3"
                style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)" }}>
                <span className="text-xl">🗂️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-300 uppercase font-bold mb-0.5">Current Folder</p>
                  <p className="text-amber-300 font-bold text-sm truncate">{folderName}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={startAutoWithSameFolder}
                  className="w-full py-3 rounded-xl text-sm font-black"
                  style={{ background:"linear-gradient(135deg,#8b5cf6,#6d28d9)", color:"#fff" }}>
                  ✅ Use this folder
                </button>
                <button onClick={startAutoWithNewFolder}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
                  📂 Choose a different folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Folder ask modal (manual backup) ── */}
      {folderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.80)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(245,158,11,0.35)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#F59E0B,#f97316)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📁</span>
                <div>
                  <p className="text-white font-black text-sm">Where to save the backup?</p>
                  <p className="text-gray-300 text-xs">A folder is already saved</p>
                </div>
                <button onClick={() => setFolderModal(false)} className="ml-auto text-gray-300 hover:text-gray-300 text-lg">✕</button>
              </div>
              <div className="px-4 py-3 rounded-xl flex items-center gap-3"
                style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)" }}>
                <span className="text-xl">🗂️</span>
                <p className="text-amber-300 font-bold text-sm truncate">{folderName}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={useSameFolder}
                  className="w-full py-3 rounded-xl text-sm font-black"
                  style={{ background:"linear-gradient(135deg,#F59E0B,#D97706)", color:"#000" }}>
                  ✅ Yes, save to this folder
                </button>
                <button onClick={chooseNewFolder}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
                  📂 Choose a different folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Password "enter" modal (for restore decrypt) ── */}
      {pwModal === "enter" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(99,102,241,0.4)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.3)" }}>🔓</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-sm">Enter Backup Password</p>
                  <p className="text-gray-300 text-xs truncate">{pwRestoreRef.current?.fileName}</p>
                </div>
                <button onClick={() => { setPwModal("idle"); pwRestoreRef.current = null; }}
                  className="ml-auto text-gray-300 hover:text-gray-300 text-lg">✕</button>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Password</label>
                <div className="relative">
                  <input type={pwShow ? "text" : "password"} value={pwInput}
                    onChange={e => { setPwInput(e.target.value); setPwError(""); }}
                    onKeyDown={e => e.key === "Enter" && handlePwEnterForRestore()}
                    placeholder="Enter the password you set"
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none pr-10"
                    style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)" }}
                    autoFocus
                  />
                  <button type="button" onClick={() => setPwShow(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-300 text-xs">
                    {pwShow ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              {pwError && <p className="text-red-400 text-xs font-semibold">{pwError}</p>}
              <button onClick={handlePwEnterForRestore}
                className="w-full py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"#fff" }}>🔓 Unlock &amp; Restore</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Restore modal: Choose mode ── */}
      {modalStep === "choose" && fileInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.80)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(255,255,255,0.1)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#3b82f6,#8b5cf6,#F59E0B)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background:"rgba(59,130,246,0.12)", border:"1px solid rgba(59,130,246,0.3)" }}>♻️</div>
                <div>
                  <p className="text-white font-black text-sm">Choose Restore Mode</p>
                  <p className="text-gray-300 text-xs">How would you like to restore?</p>
                </div>
                <button onClick={closeRestoreModal} className="ml-auto text-gray-300 hover:text-gray-300 text-lg">✕</button>
              </div>
              <div className="rounded-xl px-4 py-3 flex flex-col gap-1.5"
                style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex gap-2 text-xs"><span className="text-gray-300 w-20 flex-shrink-0">File:</span><span className="text-white font-medium truncate">{fileInfo.name}</span>{fileInfo.encrypted && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0" style={{ background:"rgba(99,102,241,0.15)", color:"#818cf8", border:"1px solid rgba(99,102,241,0.3)" }}>🔐</span>}</div>
                <div className="flex gap-2 text-xs"><span className="text-gray-300 w-20 flex-shrink-0">Backup Date:</span><span className="text-amber-300 font-medium">{fmtDT(fileInfo.exportedAt)}</span></div>
                <div className="flex gap-2 text-xs"><span className="text-gray-300 w-20 flex-shrink-0">Records:</span><span className="text-green-400 font-bold">{fileInfo.docCount?.toLocaleString()}</span></div>
                {fileInfo.isAdminBackup && <div className="flex gap-2 text-xs"><span className="text-gray-300 w-20 flex-shrink-0">Users:</span><span className="text-blue-400 font-bold">{fileInfo.userCount}</span></div>}
              </div>
              <button onClick={() => setModalStep("confirm-merge")}
                className="w-full text-left rounded-2xl p-4 flex items-start gap-3 transition-all hover:scale-[1.01]"
                style={{ background:"rgba(52,211,153,0.06)", border:"2px solid rgba(52,211,153,0.35)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 mt-0.5"
                  style={{ background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.3)" }}>🔀</div>
                <div className="flex flex-col gap-1">
                  <p className="text-white font-black text-sm">Smart Merge — Recommended</p>
                  <p className="text-gray-300 text-xs leading-relaxed">Backup data will be restored. Records created <span className="text-green-400 font-semibold">after</span> the backup date will <span className="text-green-400 font-semibold">remain safe</span>.</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(52,211,153,0.12)", color:"#34d399" }}>✅ New data safe</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(52,211,153,0.12)", color:"#34d399" }}>✅ Backup restored</span>
                  </div>
                </div>
              </button>
              <button onClick={() => setModalStep("confirm-replace")}
                className="w-full text-left rounded-2xl p-4 flex items-start gap-3 transition-all hover:scale-[1.01]"
                style={{ background:"rgba(239,68,68,0.05)", border:"1.5px solid rgba(239,68,68,0.25)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 mt-0.5"
                  style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)" }}>🔄</div>
                <div className="flex flex-col gap-1">
                  <p className="text-white font-black text-sm">Full Replace</p>
                  <p className="text-gray-300 text-xs leading-relaxed">Your <span className="text-red-400 font-semibold">entire current data will be deleted</span> and only the backup data will remain. Any work done after the backup will be <span className="text-red-400 font-semibold">permanently lost</span>.</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(239,68,68,0.12)", color:"#f87171" }}>⚠️ New data will be deleted</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Restore modal: Confirm merge ── */}
      {modalStep === "confirm-merge" && fileInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.80)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(52,211,153,0.35)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#34d399,#059669)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.3)" }}>🔀</div>
                <div>
                  <p className="text-white font-black text-sm">Confirm Smart Merge</p>
                  <p className="text-gray-300 text-xs">New data will be kept safe</p>
                </div>
              </div>
              <div className="rounded-xl px-4 py-3 text-xs leading-relaxed text-gray-300"
                style={{ background:"rgba(52,211,153,0.05)", border:"1px solid rgba(52,211,153,0.2)" }}>
                📅 Backup date: <span className="text-amber-300 font-semibold">{fmtDT(fileInfo.exportedAt)}</span><br />
                Records created <span className="text-green-400 font-medium">after this date</span> will be kept safe.<br />
                Backup records will be overwritten.
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModalStep("choose")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>← Back</button>
                <button onClick={() => executeAdminRestore("merge")} className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                  style={{ background:"linear-gradient(135deg,#34d399,#059669)", color:"#000" }}>Smart Merge →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Restore modal: Confirm replace ── */}
      {modalStep === "confirm-replace" && fileInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.80)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(239,68,68,0.4)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#ef4444,#f97316)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)" }}>⚠️</div>
                <div>
                  <p className="text-white font-black text-sm">Full Replace — Danger!</p>
                  <p className="text-gray-300 text-xs">This action cannot be undone</p>
                </div>
              </div>
              <div className="rounded-xl px-4 py-3 text-xs leading-relaxed"
                style={{ background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.2)", color:"#fca5a5" }}>
                ❌ Everything created <span className="font-semibold text-amber-300">after the backup date ({fmtDT(fileInfo.exportedAt)})</span> will be <span className="font-bold text-red-300">permanently deleted</span>.<br /><br />
                Are you sure? Make sure you have already taken a new backup first.
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModalStep("choose")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>← Back</button>
                <button onClick={() => executeAdminRestore("replace")} className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                  style={{ background:"linear-gradient(135deg,#ef4444,#c62828)", color:"#fff" }}>Yes, Delete &amp; Replace</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 max-w-4xl">

        {/* Header info */}
        <div className="rounded-2xl p-5 flex flex-col gap-3"
          style={{ background:"rgba(99,102,241,0.04)", border:"1px solid rgba(99,102,241,0.18)" }}>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color:"#818cf8" }}>💾 Full System Backup</p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Creates a single <span className="text-indigo-400 font-semibold">master backup file</span> containing the entire Novexa system — every user&apos;s data (invoices, customers, inventory, payments, suppliers and all nested records) plus all global admin collections (addon requests, support tickets, admin config).
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
            {[
              { icon:"👥", label:"All Users", sub:`${users?.length || 0} accounts` },
              { icon:"⚡", label:"Addon Requests", sub:"Global collection" },
              { icon:"🎫", label:"Support Tickets", sub:"Global collection" },
              { icon:"⚙️", label:"Admin Config", sub:"Plans & settings" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
                style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-base ">{item.icon}</span>
                <div>
                  <p className="text-gray-300 font-bold leading-tight">{item.label}</p>
                  <p className="text-gray-300">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(52,211,153,0.1)", color:"#34d399", border:"1px solid rgba(52,211,153,0.25)" }}>✅ Saved directly to your device</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(99,102,241,0.1)", color:"#818cf8", border:"1px solid rgba(99,102,241,0.25)" }}>✅ JSON or password-protected .novexa</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(245,158,11,0.1)", color:"#fbbf24", border:"1px solid rgba(245,158,11,0.25)" }}>⚠️ Large — may take a few minutes</span>
          </div>
        </div>

        {/* ── Folder indicator ── */}
        {folderName && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.2)" }}>
            <span className="text-xl flex-shrink-0">🗂️</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-300 uppercase tracking-widest font-bold mb-0.5">Saved Folder</p>
              <p className="text-amber-300 font-semibold text-sm truncate">{folderName}</p>
            </div>
            <button onClick={() => { setDirHandle(null); setFolderName(""); adminIdbDel("dirHandle"); }}
              title="Forget folder" className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0">✕</button>
          </div>
        )}

        {/* Progress */}
        {running && (
          <div className="flex flex-col gap-3 rounded-2xl p-5" style={cardS}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300">{statusMsg}</span>
              <span className="text-indigo-400 font-black">{progress}%</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width:`${progress}%`, background:"linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa)" }} />
            </div>
            <p className="text-gray-300 text-xs">⏳ Please keep this tab open until the backup completes.</p>
          </div>
        )}

        {/* Result message */}
        {resultMsg.text && (
          <div className="px-5 py-4 rounded-2xl text-sm font-medium"
            style={{
              background: resultMsg.type==="success" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
              border: `1px solid ${resultMsg.type==="success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
              color: resultMsg.type==="success" ? "#34d399" : "#f87171",
            }}>
            {resultMsg.text}
          </div>
        )}

        {/* Start button */}
        <button onClick={handleStartBackup} disabled={running}
          className="flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-black transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{
            background: running ? "rgba(99,102,241,0.15)" : "linear-gradient(135deg,#6366f1,#4f46e5)",
            color: running ? "#818cf8" : "#fff",
            border: running ? "1px solid rgba(99,102,241,0.3)" : "none",
            cursor: running ? "not-allowed" : "pointer",
            boxShadow: running ? "none" : "0 8px 32px rgba(99,102,241,0.35)",
          }}>
          {running ? (
            <><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
              <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/>
            </svg>Backup in Progress...</>
          ) : (
            "💾 Start Full System Backup"
          )}
        </button>

        {/* Activity log */}
        {log.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={cardS}>
            <div className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom:"1px solid rgba(255,255,255,0.05)", background:"rgba(255,255,255,0.02)" }}>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Activity Log</span>
              <button onClick={() => setLog([])} className="text-gray-300 hover:text-gray-300 text-xs">Clear</button>
            </div>
            <div className="p-4 flex flex-col gap-1 max-h-72 overflow-y-auto">
              {log.map((entry, i) => (
                <p key={i} className="font-mono text-xs" style={{ color: entry.startsWith("❌") ? "#f87171" : entry.startsWith("⚠️") ? "#fbbf24" : "#4ade80" }}>
                  {entry}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Warning */}
        {/* ══ AUTO-BACKUP ══ */}
        <div className="rounded-2xl p-5 flex flex-col gap-5" style={cardS}>
          <div className="pb-2 border-b border-white/10">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color:"#8b5cf6" }}>⏱️ Auto-Backup</p>
          </div>
          <div className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background:"rgba(139,92,246,0.04)", border:"1px solid rgba(139,92,246,0.15)" }}>
            <p className="text-gray-300 text-sm">Automatically run a full system backup at a set interval. Each backup saves as a new file — nothing gets overwritten.</p>
            <p className="text-gray-300 text-xs">✅ Requires a saved folder. ✅ Works only while this browser tab is open.</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-300 font-semibold uppercase tracking-wider">Backup Frequency</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ADMIN_AUTO_INTERVALS.map(opt => (
                <button key={opt.id} onClick={() => setAutoIntervalId(opt.id)} disabled={autoEnabled}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: autoIntervalId===opt.id ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)",
                    border: autoIntervalId===opt.id ? "2px solid rgba(139,92,246,0.6)" : "1px solid rgba(255,255,255,0.07)",
                    color: autoIntervalId===opt.id ? "#c4b5fd" : "#6b7280",
                    cursor: autoEnabled ? "not-allowed" : "pointer",
                    opacity: autoEnabled && autoIntervalId!==opt.id ? 0.4 : 1,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {autoEnabled && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background:"rgba(139,92,246,0.06)", border:"1px solid rgba(139,92,246,0.25)" }}>
              <span className="text-xl flex-shrink-0">🟣</span>
              <div className="flex-1">
                <p className="text-purple-300 font-black text-xs uppercase tracking-wider">Auto-Backup Active</p>
                <p className="text-gray-300 text-xs mt-0.5">
                  Next backup in <span className="text-purple-200 font-bold">{countdown || "…"}</span>
                  {folderName && <> → <span className="text-amber-300 font-semibold">{folderName}</span></>}
                </p>
              </div>
            </div>
          )}
          {autoMsg.text && (
            <div className="px-4 py-3 rounded-xl text-sm font-medium"
              style={{
                background: autoMsg.type==="success" ? "rgba(139,92,246,0.08)" : "rgba(248,113,113,0.08)",
                border:`1px solid ${autoMsg.type==="success" ? "rgba(139,92,246,0.35)" : "rgba(248,113,113,0.3)"}`,
                color: autoMsg.type==="success" ? "#c4b5fd" : "#f87171",
              }}>
              {autoMsg.text}
            </div>
          )}
          <div className="flex gap-3">
            {!autoEnabled
              ? <button onClick={handleEnableAuto}
                  className="flex-1 py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                  style={{ background:"linear-gradient(135deg,#8b5cf6,#6d28d9)", color:"#fff" }}>
                  ▶ Enable Auto-Backup
                </button>
              : <button onClick={handleDisableAuto}
                  className="flex-1 py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                  style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", color:"#f87171" }}>
                  ⏹ Disable Auto-Backup
                </button>
            }
          </div>
        </div>

        {/* ══ BACKUP HISTORY ══ */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={cardS}>
          <div className="pb-2 border-b border-white/10">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color:"#60a5fa" }}>📋 Backup History</p>
          </div>
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="text-4xl opacity-20">🗂️</span>
              <p className="text-gray-300 text-sm">No backups yet</p>
              <p className="text-gray-300 text-xs">Every backup (manual or auto) will appear here.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {history.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex-shrink-0">
                      {entry.type === "auto"
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                            style={{ background:"rgba(139,92,246,0.15)", color:"#c4b5fd", border:"1px solid rgba(139,92,246,0.3)" }}>⏱ Auto</span>
                        : <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                            style={{ background:"rgba(99,102,241,0.15)", color:"#818cf8", border:"1px solid rgba(99,102,241,0.3)" }}>✋ Manual</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{entry.fileName}</p>
                      <p className="text-gray-300 text-[11px] mt-0.5">{fmtDT(entry.at)}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-green-400 text-xs font-bold">{entry.docCount?.toLocaleString()}</p>
                      <p className="text-gray-300 text-[10px]">{entry.userCount} users</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={async () => { await adminIdbDel("history"); setHistory([]); }}
                className="self-end text-xs text-gray-300 hover:text-red-400 transition-colors underline underline-offset-2">
                Clear history
              </button>
            </>
          )}
        </div>

        {/* ══ ADMIN NOTES ══ */}
        <div className="rounded-2xl p-4 flex flex-col gap-1.5"
          style={{ background:"rgba(239,68,68,0.04)", border:"1px solid rgba(239,68,68,0.12)" }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-red-600">⚠️ Admin Notes</p>
          <ul className="flex flex-col gap-1">
            {[
              "Backup is read-only — it does NOT modify any live data.",
              "For large databases this may take several minutes. Keep the tab open.",
              "Store the backup file securely — it contains all user business data.",
              "Restore below supports both admin full-system backups and single-user backups.",
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-300">
                <span className="text-red-700 mt-0.5 flex-shrink-0">•</span>{t}
              </li>
            ))}
          </ul>
        </div>

        {/* ══ SYSTEM RESTORE ══ */}
        <div className="rounded-2xl p-5 flex flex-col gap-5" style={cardS}>
          <div className="pb-2 border-b border-white/10">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color:"#34d399" }}>♻️ System Restore</p>
          </div>

          <div className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background:"rgba(52,211,153,0.04)", border:"1px solid rgba(52,211,153,0.15)" }}>
            <p className="text-gray-300 text-sm leading-relaxed">
              Restore data from a backup file — supports both <span className="text-green-400 font-semibold">full system backups</span> (all users) and <span className="text-blue-400 font-semibold">single-user backups</span>. Choose <span className="text-green-400 font-semibold">Smart Merge</span> to keep new data safe, or <span className="text-red-400 font-semibold">Full Replace</span> to completely overwrite.
            </p>
            <p className="text-gray-300 text-xs">✅ Accepts <span className="text-white font-medium">.json</span> and password-encrypted <span className="text-indigo-300 font-medium">.novexa</span> files.</p>
          </div>

          {/* Restore progress */}
          {restoring && (
            <div className="flex flex-col gap-3 rounded-xl p-4"
              style={{ background:"rgba(52,211,153,0.04)", border:"1px solid rgba(52,211,153,0.2)" }}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{restoreLabel}</span>
                <span className="text-green-400 font-black">{restoreProg}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.07)" }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width:`${restoreProg}%`, background:"linear-gradient(90deg,#34d399,#059669)" }} />
              </div>
              <p className="text-gray-300 text-xs">⏳ Please keep this tab open until restore completes.</p>
            </div>
          )}

          {/* Restore result message */}
          {restoreMsg.text && (
            <div className="px-5 py-4 rounded-2xl text-sm font-medium"
              style={{
                background: restoreMsg.type==="success" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                border: `1px solid ${restoreMsg.type==="success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                color: restoreMsg.type==="success" ? "#34d399" : "#f87171",
              }}>
              {restoreMsg.text}
            </div>
          )}

          {/* Restore button */}
          <input ref={fileInputRef} type="file" accept=".json,.novexa" className="hidden"
            onChange={handleRestoreFileSelect} />
          <button onClick={() => fileInputRef.current?.click()} disabled={restoring}
            className="flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-black transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: restoring ? "rgba(52,211,153,0.1)" : "linear-gradient(135deg,#34d399,#059669)",
              color: restoring ? "#34d399" : "#000",
              border: restoring ? "1px solid rgba(52,211,153,0.3)" : "none",
              cursor: restoring ? "not-allowed" : "pointer",
              boxShadow: restoring ? "none" : "0 8px 32px rgba(52,211,153,0.3)",
            }}>
            {restoring ? (
              <><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/>
              </svg>Restoring...</>
            ) : (
              "♻️ Select Backup File to Restore"
            )}
          </button>

          <div className="rounded-xl px-4 py-3 text-xs text-amber-600 leading-relaxed"
            style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)" }}>
            ⚠️ <span className="font-bold text-amber-400">Before restoring:</span> Take a fresh backup first so you can undo if needed. Smart Merge is recommended — it keeps data created after the backup date safe.
          </div>
        </div>

      </div>
    </>
  );
}

/* ── Sidebar nav items ────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: "users",     icon: "👥", label: "Users",        badge: null },
  { id: "addons",    icon: "⚡", label: "Add-on Req.",  badge: null },
  { id: "packages",  icon: "📦", label: "Packages",     badge: null },
  { id: "inbox",     icon: "📬", label: "Support",      badge: null },
  { id: "analytics", icon: "📊", label: "Analytics",    badge: null },
  { id: "backup",    icon: "💾", label: "Backup",       badge: null },
  { id: "debug",     icon: "🔍", label: "Debug",        badge: null },
];

/* ── Stat Card ────────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, gradient, glow }) {
  return (
    <div className="relative rounded-2xl p-5 overflow-hidden group transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
      style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.08)", boxShadow: `0 0 0 0 ${glow}` }}>
      {/* glow bg */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20"
        style={{ background: gradient }} />
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-lg"
          style={{ background: gradient, boxShadow: `0 4px 16px ${glow}` }}>
          {icon}
        </div>
        <p className="text-white font-black text-3xl leading-none mb-1">{value}</p>
        <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

/* ── Main AdminPanel ──────────────────────────────────────────────────────── */
export default function AdminPanel() {
  const router = useRouter();
  const [user,          setUser]          = useState(null);
  const [authLoading,   setAuthLoading]   = useState(true);
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [showForm,      setShowForm]      = useState(false);
  const [editUser,      setEditUser]      = useState(null);
  const [confirm,       setConfirm]       = useState(null);
  const [search,        setSearch]        = useState("");
  const [toasts,        setToasts]        = useState([]);
  // Registration success dialog
  const [regSuccess,    setRegSuccess]    = useState(null); // { uid, name, email, password, plan, billingPeriod, paymentMethod, activeFrom, activeTo, subscriptionType }
  // View invoice dialog
  const [invoiceUser,   setInvoiceUser]   = useState(null); // same shape as regSuccess
  // Load activeTab from localStorage on mount, default to "users"
  const [activeTab,     setActiveTab]     = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("adminActiveTab") || "users";
    }
    return "users";
  });
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [debugInfo,     setDebugInfo]     = useState(null);
  const [detailUser,    setDetailUser]    = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedUid,   setSelectedUid]   = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("adminSelectedUid") || null;
    }
    return null;
  });
  const [pendingAddonCount, setPendingAddonCount] = useState(0); // live badge for add-on requests

  /* ── auth guard ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u || u.uid !== ADMIN_UID) { router.replace("/pages/login"); return; }
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  /* ── live pending add-on requests badge ── */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "addonRequests"), where("status", "==", "pending"));
    const unsub = onSnapshot(q, snap => setPendingAddonCount(snap.size), () => {});
    return () => unsub();
  }, [user]);

  /* ── toast ── */
  const toast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  /* ── token ── */
  const getToken = useCallback(async () => {
    if (user) return user.getIdToken(true);
    if (auth.currentUser) return auth.currentUser.getIdToken(true);
    throw new Error("Not authenticated");
  }, [user]);

  /* ── fetch users ── */
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/list-users", { headers: { authorization: `Bearer ${token}` } });
      const ct    = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error("Server error: " + (await res.text()).slice(0,120));
      const data  = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setUsers(data.users || []);
    } catch (err) {
      toast(err.message || "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  }, [user, toast, getToken]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /* ── save user ── */
  async function handleSaveUser(form) {
    setSaving(true);
    try {
      const token   = await getToken();
      const headers = { "Content-Type": "application/json", authorization: `Bearer ${token}` };
      if (editUser) {
        const body = { uid: editUser.uid, name: form.name, phone: form.phone, address: form.address, activeFrom: form.activeFrom, activeTo: form.activeTo, activeToTime: form.activeToTime, maxDevices: form.maxDevices, plan: form.plan, subscriptionType: form.subscriptionType, billingPeriod: form.billingPeriod, paymentMethod: form.paymentMethod };
        if (form.password) body.newPassword = form.password;
        const res  = await fetch("/api/admin/update-user", { method:"POST", headers, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast(`${form.name} updated successfully`);
      } else {
        const res  = await fetch("/api/admin/create-user", { method:"POST", headers, body: JSON.stringify(form) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast(`${form.name} registered successfully`);
        setShowForm(false); setEditUser(null); fetchUsers();
        // Show send-invoice dialog
        setRegSuccess({
          uid:              data.uid,
          name:             form.name,
          email:            form.email,
          password:         form.password,
          plan:             form.plan,
          billingPeriod:    form.billingPeriod,
          paymentMethod:    form.paymentMethod,
          activeFrom:       form.activeFrom,
          activeTo:         form.activeTo,
          subscriptionType: form.subscriptionType,
        });
        return; // skip the setShowForm below (already done)
      }
      setShowForm(false); setEditUser(null); fetchUsers();
    } catch (err) { toast(err.message || "Save failed", "error"); }
    finally { setSaving(false); }
  }

  /* ── freeze / unfreeze ── */
  async function handleToggleFreeze(uid, name, currentStatus) {
    const newStatus = currentStatus === "frozen" ? "active" : "frozen";
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type":"application/json", authorization:`Bearer ${token}` },
        body: JSON.stringify({ uid, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`${name} ${newStatus==="frozen"?"frozen":"unfrozen"} successfully`);
      fetchUsers();
    } catch (err) { toast(err.message||"Action failed","error"); }
    finally { setConfirm(null); }
  }

  /* ── toggle email feature ── */
  async function handleToggleEmail(uid, name, currentEnabled) {
    const newVal = !currentEnabled;
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid, emailFeatureEnabled: newVal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Email feature ${newVal ? "enabled" : "disabled"} for ${name}`);
      fetchUsers();
    } catch (err) { toast(err.message || "Action failed", "error"); }
    finally { setConfirm(null); }
  }

  /* ── delete user ── */
  async function handleDeleteUser(uid, name) {
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/delete-user", {
        method:"POST",
        headers:{ "Content-Type":"application/json", authorization:`Bearer ${token}` },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`${name} has been removed`);
      fetchUsers();
    } catch (err) { toast(err.message||"Delete failed","error"); }
    finally { setConfirm(null); }
  }

  /* ── debug ── */
  async function runDebug() {
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/debug", { headers:{ authorization:`Bearer ${token}` } });
      const data  = await res.json();
      setDebugInfo(data);
      setActiveTab("debug");
      if (typeof window !== "undefined") localStorage.setItem("adminActiveTab", "debug");
      toast("Debug info loaded","success");
    } catch (err) { toast("Debug failed: "+err.message,"error"); }
  }

  /* ── user detail ── */
  async function fetchUserDetail(uid) {
    setDetailLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch(`/api/admin/user-detail?uid=${uid}`, { headers:{ authorization:`Bearer ${token}` } });
      const data  = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetailUser(data);
    } catch (err) { toast(err.message||"Failed to load details","error"); }
    finally { setDetailLoading(false); }
  }

  /* ── derived ── */
  const activeCount = users.filter(u => u.status==="active").length;
  const frozenCount = users.filter(u => u.status==="frozen").length;
  const totalCount  = users.filter(u => u.status!=="deleted").length;
  const expiringIn7 = users.filter(u => { const d=daysLeft(u.activeTo); return d!==null&&d>=0&&d<=7&&u.status==="active"; }).length;

  const filteredUsers = users.filter(u => {
    if (u.status==="deleted") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q)||(u.phone||"").includes(q);
  });

  /* ── loading screen ── */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full border-4 border-transparent animate-spin"
            style={{ borderTopColor:"#2563EB", borderRightColor:"#F59E0B" }} />
          <p className="text-gray-300 text-sm font-medium tracking-widest uppercase">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex" style={{ fontFamily:"var(--font-poppins,sans-serif)" }}>
      <Toast toasts={toasts} />

      {/* ── User Detail Full-Screen Overlay ── */}
      {selectedUid && (
        <AdminUserDetail
          uid={selectedUid}
          getToken={getToken}
          onClose={() => {
            setSelectedUid(null);
            if (typeof window !== "undefined") localStorage.removeItem("adminSelectedUid");
          }}
          onToast={toast}
        />
      )}

      {/* ── Registration Invoice Dialog ── */}
      {regSuccess && (
        <RegInvoiceDialog
          data={regSuccess}
          getToken={getToken}
          onToast={toast}
          onClose={() => setRegSuccess(null)}
        />
      )}

      {/* ── View Invoice Dialog ── */}
      {invoiceUser && (
        <UserInvoiceDialog
          data={invoiceUser}
          getToken={getToken}
          onToast={toast}
          onClose={() => setInvoiceUser(null)}
        />
      )}

      {/* Modals */}
      {(showForm || editUser) && (
        <UserFormModal initial={editUser} saving={saving}
          onClose={() => { setShowForm(false); setEditUser(null); }}
          onSave={handleSaveUser}
          getToken={getToken}
          onToast={toast}
          onRenewSuccess={fetchUsers} />
      )}
      <UserDetailModal
        detailUser={detailUser} detailLoading={detailLoading}
        onClose={() => setDetailUser(null)} fmtDate={fmtDate} daysLeft={daysLeft} />

      {confirm?.type==="freeze" && (
        <ConfirmDialog
          title={confirm.currentStatus==="frozen"?`Unfreeze ${confirm.name}?`:`Freeze ${confirm.name}?`}
          message={confirm.currentStatus==="frozen"?"This will restore their dashboard access immediately.":"Their dashboard access will be blocked until you unfreeze."}
          confirmLabel={confirm.currentStatus==="frozen"?"Yes, Unfreeze":"Yes, Freeze"}
          confirmColor={confirm.currentStatus==="frozen"?"rgba(52,211,153,0.2)":"rgba(96,165,250,0.2)"}
          onConfirm={() => handleToggleFreeze(confirm.uid,confirm.name,confirm.currentStatus)}
          onCancel={() => setConfirm(null)} />
      )}
      {confirm?.type==="delete" && (
        <ConfirmDialog
          title={`Remove ${confirm.name}?`}
          message="Their account will be disabled. Data stays safe in Firestore."
          confirmLabel="Yes, Remove"
          confirmColor="rgba(239,68,68,0.2)"
          onConfirm={() => handleDeleteUser(confirm.uid,confirm.name)}
          onCancel={() => setConfirm(null)} />
      )}
      {confirm?.type==="emailToggle" && (
        <ConfirmDialog
          title={confirm.currentEnabled ? `Disable Email for ${confirm.name}?` : `Enable Email for ${confirm.name}?`}
          message={confirm.currentEnabled
            ? "Invoice email feature will be disabled. Their Settings page will show a locked notice."
            : "Invoice email feature will be enabled. They can connect their Gmail and send invoice emails."}
          confirmLabel={confirm.currentEnabled ? "Yes, Disable" : "Yes, Enable"}
          confirmColor={confirm.currentEnabled ? "rgba(245,158,11,0.2)" : "rgba(52,211,153,0.2)"}
          onConfirm={() => handleToggleEmail(confirm.uid, confirm.name, confirm.currentEnabled)}
          onCancel={() => setConfirm(null)} />
      )}

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside
        className="flex flex-col h-screen sticky top-0 transition-all duration-300 z-30 flex-shrink-0"
        style={{
          width: sidebarOpen ? 240 : 72,
          background: "rgba(8,13,20,0.98)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
        }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
          <div className="relative w-10 h-10 flex-shrink-0">
            <Image src="/images/Novexa N Logo.png" alt="Novexa" fill className="object-contain" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-white font-black text-sm leading-tight whitespace-nowrap">Super Admin</p>
              <p className="text-gray-300 text-[9px] font-bold tracking-widest uppercase whitespace-nowrap">Novexa ERP</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => {
                setActiveTab(item.id);
                if (typeof window !== "undefined") {
                  localStorage.setItem("adminActiveTab", item.id);
                  // Clear user detail when switching away from users tab
                  if (item.id !== "users") {
                    localStorage.removeItem("adminSelectedUid");
                    setSelectedUid(null);
                  }
                }
              }}
                className="flex items-center gap-3 rounded-xl transition-all duration-200 group relative"
                style={{
                  padding: sidebarOpen ? "10px 12px" : "10px 0",
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                  background: isActive
                    ? "linear-gradient(135deg,rgba(37,99,235,0.2),rgba(245,158,11,0.08))"
                    : "transparent",
                  border: isActive ? "1px solid rgba(37,99,235,0.25)" : "1px solid transparent",
                  color: isActive ? "#fff" : "#9fa0a1ff",
                }}>
                {/* active left bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ background:"linear-gradient(to bottom,#2563EB,#F59E0B)" }} />
                )}
                <span className="text-base flex-shrink-0 transition-transform group-hover:scale-110">{item.icon}</span>
                {sidebarOpen && (
                  <span className="text-sm font-semibold whitespace-nowrap text-left flex-1">{item.label}</span>
                )}
                {/* Pending badge for add-ons */}
                {item.id === "addons" && pendingAddonCount > 0 && sidebarOpen && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-black flex-shrink-0"
                    style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)", minWidth: 18, textAlign: "center" }}>
                    {pendingAddonCount}
                  </span>
                )}
                {item.id === "addons" && pendingAddonCount > 0 && !sidebarOpen && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full"
                    style={{ background: "#fbbf24" }} />
                )}
                {!sidebarOpen && (
                  <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                    style={{ background:"rgba(13,17,23,0.95)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff" }}>
                    {item.label}{item.id === "addons" && pendingAddonCount > 0 ? ` (${pendingAddonCount})` : ""}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="px-3 pb-4" style={{ borderTop:"1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => setSidebarOpen(o => !o)}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-gray-300 hover:text-gray-300 hover:bg-white/5 transition-all text-xs font-semibold mt-3">
            <span className="text-base transition-transform duration-300" style={{ transform: sidebarOpen?"rotate(0deg)":"rotate(180deg)" }}>◀</span>
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ══════════════════ MAIN CONTENT ══════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">

        {/* ── Top bar ── */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
          style={{ background:"rgba(8,13,20,0.97)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>

          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-white font-black text-base leading-tight">
                {NAV_ITEMS.find(n=>n.id===activeTab)?.icon} {" "}
                {activeTab==="users"?"User Management":activeTab==="addons"?"Add-on Requests":activeTab==="packages"?"Package Manager":activeTab==="inbox"?"Support Inbox":activeTab==="analytics"?"Analytics Overview":activeTab==="backup"?"System Backup":"Debug Console"}
              </h1>
              <p className="text-gray-300 text-[10px] font-semibold tracking-widest uppercase">{todayStr()}</p>
            </div>
            <DigitalClock />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={fetchUsers} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-white/10"
              style={{ border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
              <span className={loading?"animate-spin":""}>↻</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={runDebug}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-amber-500/10"
              style={{ border:"1px solid rgba(245,158,11,0.25)", color:"#fbbf24" }}>
              🔍 <span className="hidden sm:inline">Debug</span>
            </button>
            <button onClick={() => { setEditUser(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] hover:shadow-lg"
              style={{ background:"linear-gradient(135deg,#2563EB,#1d4ed8)", color:"#fff", boxShadow:"0 4px 16px rgba(37,99,235,0.3)" }}>
              ＋ <span className="hidden sm:inline">Register User</span>
            </button>
            <button onClick={() => signOut(auth).then(() => router.push("/pages/login"))}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-red-500/10"
              style={{ border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444" }}>
              🚪 <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 px-6 py-7">

          {/* ──────────── USERS TAB ──────────── */}
          {activeTab==="users" && (
            <div>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard icon="👥" label="Total Users"     value={totalCount}  gradient="linear-gradient(135deg,#2563EB,#1d4ed8)" glow="rgba(37,99,235,0.35)" />
                <StatCard icon="✅" label="Active"          value={activeCount} gradient="linear-gradient(135deg,#10b981,#059669)" glow="rgba(16,185,129,0.35)" />
                <StatCard icon="🔒" label="Frozen"          value={frozenCount} gradient="linear-gradient(135deg,#60a5fa,#3b82f6)" glow="rgba(96,165,250,0.35)" />
                <StatCard icon="⚠️" label="Expiring (7d)"  value={expiringIn7} gradient="linear-gradient(135deg,#F59E0B,#d97706)" glow="rgba(245,158,11,0.35)" />
              </div>

              {/* ── Subscription Expiry Timeline ── */}
              {(() => {
                const timeline = users
                  .filter(u => u.status !== "deleted" && u.activeTo)
                  .map(u => ({ ...u, dl: daysLeft(u.activeTo, u.activeToTime) }))
                  .filter(u => u.dl !== null && u.dl <= 30)
                  .sort((a, b) => a.dl - b.dl);

                if (timeline.length === 0) return null;

                return (
                  <div className="rounded-2xl mb-6 overflow-hidden"
                    style={{ background:"linear-gradient(135deg,rgba(245,158,11,0.05),rgba(255,255,255,0.02))", border:"1px solid rgba(245,158,11,0.18)" }}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3"
                      style={{ borderBottom:"1px solid rgba(245,158,11,0.1)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">⏳</span>
                        <p className="text-white font-bold text-sm">Subscription Expiry Watchlist</p>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background:"rgba(245,158,11,0.15)", color:"#fbbf24", border:"1px solid rgba(245,158,11,0.25)" }}>
                          {timeline.length} user{timeline.length!==1?"s":""}
                        </span>
                      </div>
                      <p className="text-gray-300 text-[10px] uppercase tracking-widest">Next 30 days</p>
                    </div>

                    {/* List */}
                    <div className="divide-y divide-white/[0.04]">
                      {timeline.map(u => {
                        const dl     = u.dl;
                        const isExp  = dl < 0;
                        const isToday = dl === 0;
                        const isCrit = dl >= 0 && dl <= 3;
                        const isWarn = dl > 3  && dl <= 7;
                        const color  = isExp ? "#f87171" : isToday ? "#f87171" : isCrit ? "#fb923c" : isWarn ? "#fbbf24" : "#a3a3a3";
                        const bgCol  = isExp ? "rgba(248,113,113,0.08)" : isCrit ? "rgba(251,146,60,0.06)" : isWarn ? "rgba(251,191,36,0.06)" : "transparent";

                        return (
                          <div key={u.uid}
                            className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-white/[0.02]"
                            style={{ background: bgCol }}>

                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
                              style={{ background:"linear-gradient(135deg,rgba(37,99,235,0.25),rgba(245,158,11,0.15))", color:"#60A5FA", border:"1px solid rgba(37,99,235,0.2)" }}>
                              {(u.name||"?").charAt(0).toUpperCase()}
                            </div>

                            {/* Name + email */}
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-semibold truncate">{u.name}</p>
                              <p className="text-gray-300 text-[11px] truncate">{u.email}</p>
                            </div>

                            {/* Expiry date */}
                            <div className="hidden sm:block text-right flex-shrink-0">
                              <p className="text-gray-300 text-[10px] uppercase tracking-widest">Expires</p>
                              <p className="text-gray-300 text-xs">{fmtDate(u.activeTo)}</p>
                            </div>

                            {/* Countdown pill */}
                            <div className="flex-shrink-0">
                              <span className="px-3 py-1.5 rounded-xl text-xs font-black tabular-nums"
                                style={{
                                  background: isExp ? "rgba(248,113,113,0.15)" : isCrit ? "rgba(251,146,60,0.15)" : isWarn ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.06)",
                                  border: `1px solid ${isExp ? "rgba(248,113,113,0.35)" : isCrit ? "rgba(251,146,60,0.35)" : isWarn ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.1)"}`,
                                  color,
                                }}>
                                {isExp   ? `Expired ${Math.abs(dl)}d ago`
                                 : isToday ? "🔴 Today!"
                                 : isCrit  ? `🔴 ${dl}d left`
                                 : isWarn  ? `🟡 ${dl}d left`
                                 :           `${dl}d left`}
                              </span>
                            </div>

                            {/* Status badge */}
                            <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                              {u.subscriptionType === "trial" && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                  style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
                                  ⏳ Trial
                                </span>
                              )}
                              {(() => { const ss = STATUS_STYLE[u.status]||STATUS_STYLE.active; return (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                  style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}` }}>
                                  {ss.label}
                                </span>
                              ); })()}
                            </div>

                            {/* Quick edit */}
                            <button onClick={() => setEditUser(u)} title="Renew subscription"
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all hover:bg-amber-500/20 hover:scale-110">
                              <span className="text-sm">✏️</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Search */}
              <div className="flex items-center gap-3 mb-5">
                <div className="relative flex-1 max-w-sm">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm pointer-events-none">🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Search by name, email, phone..."
                    style={{ ...inputStyle, paddingLeft:34, width:"100%" }} />
                </div>
                <span className="text-gray-300 text-xs">{filteredUsers.length} user{filteredUsers.length!==1?"s":""}</span>
              </div>

              {/* Table */}
              <div className="rounded-2xl overflow-hidden"
                style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))", border:"1px solid rgba(255,255,255,0.08)" }}>

                <div className="hidden md:grid gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color:"#fff", borderBottom:"1px solid rgba(255,255,255,0.06)", gridTemplateColumns:"2fr 2fr 1.2fr 1.8fr 1fr 0.8fr 1fr" }}>
                  <span>User</span><span>Email</span><span>Phone</span><span>Subscription</span><span>Status</span><span className="text-center">📧 Email</span><span>Actions</span>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-transparent animate-spin" />
                  </div>
                ) : filteredUsers.length===0 ? (
                  <div className="text-center py-16">
                    <p className="text-5xl mb-3">👥</p>
                    <p className="text-white font-semibold text-sm">No users found</p>
                    <p className="text-gray-300 text-xs mt-1">{search?"Try a different search":"Register your first user"}</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {filteredUsers.map((u, idx) => {
                      const ss = STATUS_STYLE[u.status] || STATUS_STYLE.active;
                      const dl = daysLeft(u.activeTo);
                      const isExpiringSoon = dl!==null&&dl>=0&&dl<=7&&u.status==="active";
                      return (
                        <div key={u.uid}
                          className="flex flex-col md:grid gap-4 px-5 py-4 transition-all duration-150 hover:bg-white/[0.025] group"
                          style={{ gridTemplateColumns:"2fr 2fr 1.2fr 1.8fr 1fr 0.8fr 1fr", borderBottom: idx<filteredUsers.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>

                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-transform group-hover:scale-105"
                              style={{ background:"linear-gradient(135deg,rgba(37,99,235,0.25),rgba(245,158,11,0.15))", color:"#60A5FA", border:"1px solid rgba(37,99,235,0.25)" }}>
                              {(u.name||"?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-white text-sm font-semibold truncate">{u.name}</p>
                              <p className="text-gray-300 text-[10px] md:hidden truncate">{u.email}</p>
                            </div>
                          </div>

                          <p className="text-gray-300 text-xs hidden md:flex items-center truncate">{u.email}</p>
                          <p className="text-gray-300 text-xs flex items-center">{u.phone||"—"}</p>

                          <div className="flex flex-col justify-center gap-0.5">
                            <p className="text-gray-300 text-[11px]">{fmtDate(u.activeFrom)} → {fmtDate(u.activeTo)}</p>
                            {dl!==null && (
                              <p className="text-[10px] font-semibold"
                                style={{ color: isExpiringSoon?"#fbbf24":dl<0?"#f87171":"#4b5563" }}>
                                {dl<0?`Expired ${Math.abs(dl)}d ago`:dl===0?"Expires today!":isExpiringSoon?`${dl}d left ⚠️`:`${dl}d left`}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {u.subscriptionType === "trial" && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
                                ⏳ Trial
                              </span>
                            )}
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                              style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}` }}>
                              {ss.label}
                            </span>
                          </div>

                          {/* Email feature toggle */}
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => setConfirm({ type: "emailToggle", uid: u.uid, name: u.name, currentEnabled: u.emailFeatureEnabled !== false })}
                              title={u.emailFeatureEnabled !== false ? "Disable Email Feature" : "Enable Email Feature"}
                              className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-300 focus:outline-none"
                              style={{
                                background: u.emailFeatureEnabled !== false
                                  ? "linear-gradient(135deg,#34d399,#059669)"
                                  : "rgba(255,255,255,0.1)",
                                border: u.emailFeatureEnabled !== false
                                  ? "1px solid rgba(52,211,153,0.4)"
                                  : "1px solid rgba(255,255,255,0.15)",
                              }}>
                              <span
                                className="inline-block w-4 h-4 transform bg-white rounded-full shadow-md transition-transform duration-300"
                                style={{ transform: u.emailFeatureEnabled !== false ? "translateX(24px)" : "translateX(4px)" }}
                              />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button onClick={() => {
                              setSelectedUid(u.uid);
                              if (typeof window !== "undefined") localStorage.setItem("adminSelectedUid", u.uid);
                            }} title="View Details"
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-purple-500/20 hover:scale-110">
                              <span className="text-sm">👁️</span>
                            </button>
                            <button onClick={() => setInvoiceUser({
                              uid:              u.uid,
                              name:             u.name,
                              email:            u.email,
                              plan:             u.plan,
                              billingPeriod:    u.billingPeriod,
                              paymentMethod:    u.paymentMethod,
                              activeFrom:       u.activeFrom,
                              activeTo:         u.activeTo,
                              subscriptionType: u.subscriptionType,
                            })} title="View Invoice"
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-amber-500/20 hover:scale-110">
                              <span className="text-sm">📄</span>
                            </button>
                            <button onClick={() => setEditUser(u)} title="Edit"
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10 hover:scale-110">
                              <span className="text-sm">✏️</span>
                            </button>
                            <button
                              onClick={() => setConfirm({ type:"freeze", uid:u.uid, name:u.name, currentStatus:u.status })}
                              title={u.status==="frozen"?"Unfreeze":"Freeze"}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-blue-500/20 hover:scale-110">
                              <span className="text-sm">{u.status==="frozen"?"🔓":"🔒"}</span>
                            </button>
                            <button onClick={() => setConfirm({ type:"delete", uid:u.uid, name:u.name })} title="Remove"
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/20 hover:scale-110">
                              <span className="text-sm">🗑️</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────── ADD-ON REQUESTS TAB ──────────── */}
          {activeTab==="addons" && (
            <AdminAddonRequests getToken={getToken} onToast={toast} />
          )}

          {/* ──────────── SUPPORT INBOX TAB ──────────── */}
          {activeTab==="inbox" && (
            <SupportInbox getToken={getToken} onToast={toast} />
          )}

          {/* ──────────── PACKAGES TAB ──────────── */}
          {activeTab==="packages" && (
            <PackageManager getToken={getToken} onToast={toast} />
          )}

          {/* ──────────── ANALYTICS TAB ──────────── */}
          {activeTab==="analytics" && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard icon="👥" label="Total Users"     value={totalCount}  gradient="linear-gradient(135deg,#2563EB,#1d4ed8)" glow="rgba(37,99,235,0.35)" />
                <StatCard icon="✅" label="Active"          value={activeCount} gradient="linear-gradient(135deg,#10b981,#059669)" glow="rgba(16,185,129,0.35)" />
                <StatCard icon="🔒" label="Frozen"          value={frozenCount} gradient="linear-gradient(135deg,#60a5fa,#3b82f6)" glow="rgba(96,165,250,0.35)" />
                <StatCard icon="⚠️" label="Expiring (7d)"  value={expiringIn7} gradient="linear-gradient(135deg,#F59E0B,#d97706)" glow="rgba(245,158,11,0.35)" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Subscription breakdown */}
                <div className="rounded-2xl p-6"
                  style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))", border:"1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-white font-bold text-sm mb-5">📊 Subscription Breakdown</p>
                  {[
                    { label:"Active Users",     value:activeCount,  total:totalCount, color:"#34d399", bg:"rgba(52,211,153,0.15)" },
                    { label:"Frozen Users",     value:frozenCount,  total:totalCount, color:"#60a5fa", bg:"rgba(96,165,250,0.15)" },
                    { label:"Expiring in 7d",   value:expiringIn7,  total:totalCount, color:"#fbbf24", bg:"rgba(251,191,36,0.15)" },
                  ].map(item => (
                    <div key={item.label} className="mb-4">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-gray-300 text-xs font-medium">{item.label}</span>
                        <span className="text-white text-xs font-bold">{item.value} / {item.total}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.05)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width:`${item.total>0?(item.value/item.total)*100:0}%`, background:item.color, boxShadow:`0 0 8px ${item.color}60` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Expiring soon list */}
                <div className="rounded-2xl p-6"
                  style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))", border:"1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-white font-bold text-sm mb-5">⚠️ Expiring Soon</p>
                  {users.filter(u => { const d=daysLeft(u.activeTo); return d!==null&&d>=0&&d<=7&&u.status==="active"; }).length===0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                      <p className="text-3xl mb-2">🎉</p>
                      <p className="text-gray-300 text-sm">No subscriptions expiring soon</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {users.filter(u => { const d=daysLeft(u.activeTo); return d!==null&&d>=0&&d<=7&&u.status==="active"; }).map(u => (
                        <div key={u.uid} className="flex items-center justify-between px-4 py-3 rounded-xl"
                          style={{ background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.15)" }}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{ background:"rgba(245,158,11,0.15)", color:"#fbbf24" }}>
                              {(u.name||"?").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-white text-sm font-medium">{u.name}</span>
                          </div>
                          <span className="text-amber-400 text-xs font-bold">{daysLeft(u.activeTo)}d left</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ──────────── BACKUP TAB ──────────── */}
          {activeTab==="backup" && (
            <AdminSystemBackup getToken={getToken} users={users} />
          )}

          {/* ──────────── DEBUG TAB ──────────── */}
          {activeTab==="debug" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white font-bold text-base">Debug Console</h2>
                  <p className="text-gray-300 text-xs mt-0.5">Inspect API state and admin auth tokens</p>
                </div>
                <button onClick={runDebug}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={{ background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.25)", color:"#fbbf24" }}>
                  🔍 Run Debug
                </button>
              </div>

              {!debugInfo ? (
                <div className="rounded-2xl p-10 text-center"
                  style={{ background:"rgba(245,158,11,0.03)", border:"1px dashed rgba(245,158,11,0.15)" }}>
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="text-gray-300 text-sm font-medium">Click "Run Debug" to inspect admin state</p>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden"
                  style={{ background:"rgba(8,13,20,0.8)", border:"1px solid rgba(245,158,11,0.2)" }}>
                  <div className="flex items-center justify-between px-5 py-3"
                    style={{ borderBottom:"1px solid rgba(245,158,11,0.12)", background:"rgba(245,158,11,0.05)" }}>
                    <span className="text-amber-400 font-bold text-xs uppercase tracking-widest">🔍 Debug Output</span>
                    <button onClick={() => setDebugInfo(null)} className="text-gray-300 hover:text-gray-300 transition-colors text-sm">✕</button>
                  </div>
                  <div className="p-5">
                    {Object.entries(debugInfo).map(([k,v]) => (
                      <div key={k} className="flex gap-3 py-1.5 font-mono text-xs"
                        style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                        <span className="text-gray-300 w-44 flex-shrink-0">{k}:</span>
                        <span className={String(v).includes("MISSING")||String(v).includes("FAILED")||String(v).includes("Unauthorized")
                          ?"text-red-400":"text-green-400"}>
                          {typeof v==="object"?JSON.stringify(v):String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </main>

        {/* Footer */}
        <footer className="px-6 py-3 text-center" style={{ borderTop:"1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-gray-300 text-[10px] font-mono">🔐 Super Admin-only panel — Novexa ERP v1.0</p>
        </footer>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}
