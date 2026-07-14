"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { doc, serverTimestamp } from "firebase/firestore";
import {
  updatePassword as fbUpdatePassword,
  updateEmail as fbUpdateEmail,
  EmailAuthProvider as FBEmailAuthProvider,
  reauthenticateWithCredential as fbReauth,
} from "firebase/auth";
import { db } from "@/lib/firebase";

const base = {
  width: "100%", outline: "none", background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: 10,
  padding: "10px 14px", color: "#fff", fontSize: 13,
  transition: "border-color .2s, background .2s",
};
const focusStyle = {
  background: "rgba(37,99,235,0.07)", border: "1.5px solid rgba(37,99,235,0.5)",
  boxShadow: "0 0 0 3px rgba(37,99,235,0.08)",
};
const lbl = {
  display: "block", color: "#9ca3af", fontSize: 11, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5,
};

function SInput({ type = "text", placeholder, value, onChange, req, disabled, inputMode }) {
  const [f, setF] = useState(false);
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      required={req} disabled={disabled} autoComplete="off" inputMode={inputMode}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...base, ...(f && !disabled ? focusStyle : {}), opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "text" }} />
  );
}

function SSelect({ value, onChange, children }) {
  const [f, setF] = useState(false);
  return (
    <select value={value} onChange={onChange}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...base, ...(f ? focusStyle : {}), cursor: "pointer" }}>
      {children}
    </select>
  );
}

const CURRENCIES = [
  { code: "PKR", symbol: "Rs.", label: "Pakistani Rupee (Rs.)" },
  { code: "USD", symbol: "$",   label: "US Dollar ($)" },
  { code: "EUR", symbol: "€",   label: "Euro (€)" },
  { code: "GBP", symbol: "£",   label: "British Pound (£)" },
  { code: "AED", symbol: "AED", label: "UAE Dirham (AED)" },
  { code: "SAR", symbol: "SAR", label: "Saudi Riyal (SAR)" },
  { code: "INR", symbol: "₹",   label: "Indian Rupee (₹)" },
];

const SECT = ({ title, color = "#F59E0B", children }) => (
  <div className="flex flex-col gap-4">
    <div className="pb-2 border-b border-white/10">
      <p className="text-xs font-black uppercase tracking-widest" style={{ color }}>{title}</p>
    </div>
    {children}
  </div>
);

// ── OTP Modal ─────────────────────────────────────────────────────────────────
function OTPModal({ onClose, onVerified, userEmail, isResendAllowed, onResend, resendCountdown, sending, sendError }) {
  const [otp, setOtp]       = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError]   = useState("");

  async function handleVerify() {
    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Please enter the 6-digit OTP."); return;
    }
    setVerifying(true);
    setError("");
    const result = await onVerified(otp.trim());
    if (result?.error) { setError(result.error); }
    setVerifying(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
      <div className="rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 25px 60px rgba(0,0,0,0.6)" }}>

        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)" }}>
              🔐
            </div>
            <div>
              <p className="text-white font-bold text-sm">Enter OTP</p>
              <p className="text-gray-500 text-xs">Sent to <span className="text-blue-400 font-mono">{userEmail}</span></p>
            </div>
          </div>
        </div>

        {/* OTP input */}
        <div className="flex flex-col gap-2">
          <label style={{ display:"block", color:"#9ca3af", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>
            6-Digit OTP
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Enter OTP"
            value={otp}
            onChange={e => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleVerify()}
            autoFocus
            style={{
              width:"100%", outline:"none", background:"rgba(255,255,255,0.04)",
              border: error ? "1.5px solid rgba(239,68,68,0.6)" : "1.5px solid rgba(37,99,235,0.4)",
              borderRadius:10, padding:"12px 16px", color:"#fff", fontSize:22,
              letterSpacing:"0.4em", textAlign:"center", fontFamily:"monospace",
              transition:"border-color .2s",
            }} />
          {error && (
            <p className="text-xs font-medium" style={{ color:"#fca5a5" }}>⚠ {error}</p>
          )}
          {sendError && !error && (
            <p className="text-xs font-medium" style={{ color:"#fca5a5" }}>⚠ {sendError}</p>
          )}
        </div>

        {/* Resend */}
        <div className="text-center">
          {resendCountdown > 0 ? (
            <p className="text-xs" style={{ color:"#6b7280" }}>
              Resend in <span className="font-bold" style={{ color:"#9ca3af" }}>
                {Math.floor(resendCountdown / 60)}:{String(resendCountdown % 60).padStart(2, "0")}
              </span>
            </p>
          ) : (
            <button type="button" onClick={onResend} disabled={sending}
              className="text-xs font-semibold transition-colors hover:opacity-80"
              style={{ color: sending ? "#6b7280" : "#60A5FA", cursor: sending ? "not-allowed" : "pointer" }}>
              {sending ? "Sending..." : "Resend OTP"}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
            Cancel
          </button>
          <button type="button" onClick={handleVerify} disabled={verifying || otp.length !== 6}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color:"#fff",
              opacity: (verifying || otp.length !== 6) ? 0.5 : 1,
              cursor: (verifying || otp.length !== 6) ? "not-allowed" : "pointer",
            }}>
            {verifying ? "Verifying..." : "Verify →"}
          </button>
        </div>

        <p className="text-center text-xs" style={{ color:"#6b7280" }}>
          OTP expires in 10 minutes
        </p>
      </div>
    </div>
  );
}

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = "Yes, Proceed", confirmColor = "#2563eb" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
      <div className="rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 25px 60px rgba(0,0,0,0.6)" }}>
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.25)" }}>
            ✉️
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-white font-bold text-sm">{title}</p>
            <p className="text-gray-400 text-xs leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
            style={{ background:`linear-gradient(135deg,${confirmColor},${confirmColor}cc)`, color:"#fff" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── OTP Verified Success Modal ────────────────────────────────────────────────
function OTPSuccessModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
      <div className="rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5 text-center"
        style={{ background: "#0d1117", border: "1px solid rgba(52,211,153,0.3)", boxShadow: "0 25px 60px rgba(0,0,0,0.6)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}>
            ✅
          </div>
          <p className="text-white font-bold text-base">OTP Verified!</p>
          <p className="text-gray-400 text-sm leading-relaxed">
            Now you can change your <span className="text-green-400 font-semibold">email</span> and <span className="text-green-400 font-semibold">password</span> below.
          </p>
        </div>
        <button type="button" onClick={onClose}
          className="py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
          style={{ background:"linear-gradient(135deg,#34d399,#059669)", color:"#fff" }}>
          Got it →
        </button>
      </div>
    </div>
  );
}

export default function SettingsView({ uid, user, userDoc, onSettingsSaved, loading }) {
  const logoInputRef = useRef(null);

  const [profile, setProfile] = useState({
    name:        userDoc?.name        || "",
    business:    userDoc?.business    || "",
    phone:       userDoc?.phone       || "",
    email:       userDoc?.email       || user?.email || "",
    address:     userDoc?.address     || "",
    website:     userDoc?.website     || "",
    currency:    userDoc?.currency    || "PKR",
    logoDataUrl: userDoc?.logoDataUrl || "",
  });

  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });

  // ── Gmail sender state ────────────────────────────────────────────────────
  const [gmailForm, setGmailForm]   = useState({
    gmailSender:      userDoc?.gmailSender      || "",
    gmailAppPassword: "",   // never pre-fill password for security
  });
  const [showGmailPass, setShowGmailPass] = useState(false);
  const [gmailSaving,   setGmailSaving]   = useState(false);
  const [gmailMsg,      setGmailMsg]      = useState({ type: "", text: "" });
  const [gmailConnected, setGmailConnected] = useState(!!(userDoc?.gmailSender));

  const [saving,   setSaving]   = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [pwMsg,    setPwMsg]    = useState({ type: "", text: "" });

  // ── OTP / Change Email+Password flow ─────────────────────────────────────
  // Steps: null → "confirm" → "sending" → "otp" → "success" → null (unlocked)
  const [otpStep,          setOtpStep]          = useState(null);
  const [otpSending,       setOtpSending]        = useState(false);
  const [otpSendError,     setOtpSendError]      = useState("");
  const [resendCountdown,  setResendCountdown]   = useState(0);
  const [credUnlocked,     setCredUnlocked]      = useState(false);
  const resendTimerRef = useRef(null);

  // Start 60s resend countdown
  const startResendCountdown = useCallback(() => {
    setResendCountdown(60);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendCountdown(c => {
        if (c <= 1) { clearInterval(resendTimerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (resendTimerRef.current) clearInterval(resendTimerRef.current); }, []);

  async function getToken() {
    if (!user) return null;
    try { return await user.getIdToken(); } catch { return null; }
  }

  async function sendOTP(isResend = false) {
    setOtpSending(true);
    setOtpSendError("");
    try {
      const token = await getToken();
      const res   = await fetch("/api/send-otp", {
        method:  "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ purpose: "change_credentials", isResend }),
      });
      const data = await res.json();
      if (!res.ok) { setOtpSendError(data.error || "Failed to send OTP."); }
      else { startResendCountdown(); }
    } catch (err) { setOtpSendError(err.message); }
    setOtpSending(false);
  }

  async function handleChangeEmailClick() {
    // Show confirmation first
    setOtpStep("confirm");
  }

  async function handleConfirmYes() {
    setOtpStep("sending");
    await sendOTP(false);
    setOtpStep("otp");
  }

  async function handleOTPVerify(otp) {
    try {
      const token = await getToken();
      const res   = await fetch("/api/verify-otp", {
        method:  "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || "Verification failed." };
      // Success
      setOtpStep("success");
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  }

  function handleOTPSuccessDone() {
    setOtpStep(null);
    setCredUnlocked(true);
  }

  function handleOTPCancel() {
    setOtpStep(null);
  }

  // sync if userDoc changes externally
  useEffect(() => {
    if (userDoc) {
      setProfile(p => ({
        name:        userDoc.name        || p.name,
        business:    userDoc.business    || p.business,
        phone:       userDoc.phone       || p.phone,
        email:       userDoc.email       || p.email,
        address:     userDoc.address     || p.address,
        website:     userDoc.website     || p.website,
        currency:    userDoc.currency    || p.currency || "PKR",
        logoDataUrl: userDoc.logoDataUrl || p.logoDataUrl,
      }));
      // Sync gmail connected state
      if (userDoc.gmailSender) {
        setGmailForm(f => ({ ...f, gmailSender: userDoc.gmailSender }));
        setGmailConnected(true);
      }
    }
  }, [userDoc]);

  const set = k => e => setProfile(p => ({ ...p, [k]: e.target.value }));

  // ── Logo ──────────────────────────────────────────────────────────────────
  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { alert("Logo too large — max 1 MB."); return; }
    const reader = new FileReader();
    reader.onload = ev => setProfile(p => ({ ...p, logoDataUrl: ev.target.result }));
    reader.readAsDataURL(file);
  }

  // ── Save profile ──────────────────────────────────────────────────────────
  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!uid || saving) return;
    setSaving(true);
    try {
      const { setDoc: sd } = await import("firebase/firestore");
      await sd(doc(db, "users", uid), {
        ...profile,
        uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (onSettingsSaved) onSettingsSaved(profile);
    } catch (err) { alert("Save failed: " + err.message); }
    setSaving(false);
  }

  // ── Save Gmail Sender ─────────────────────────────────────────────────────
  async function handleSaveGmail(e) {
    e.preventDefault();
    setGmailMsg({ type: "", text: "" });
    if (!gmailForm.gmailSender || !gmailForm.gmailAppPassword) {
      setGmailMsg({ type: "error", text: "Both Gmail address and App Password are required." });
      return;
    }
    if (!gmailForm.gmailSender.includes("@gmail.com") && !gmailForm.gmailSender.includes("@")) {
      setGmailMsg({ type: "error", text: "Please enter a valid email address." });
      return;
    }
    if (gmailForm.gmailAppPassword.replace(/\s/g, "").length !== 16) {
      setGmailMsg({ type: "error", text: "Gmail App Password should be exactly 16 characters (remove spaces)." });
      return;
    }
    setGmailSaving(true);
    try {
      const { setDoc: sd, arrayUnion, getDoc } = await import("firebase/firestore");

      // ── Fetch previous password for history log ──────────────────────────
      const prevSnap = await getDoc(doc(db, "users", uid));
      const prevData = prevSnap.data() || {};
      const prevPassword = prevData.gmailAppPassword || null;
      const prevSender   = prevData.gmailSender || null;

      // ── Build history entry ──────────────────────────────────────────────
      const historyEntry = {
        changedAt:   new Date().toISOString(),
        prevSender:  prevSender  || null,
        newSender:   gmailForm.gmailSender.trim(),
        prevPass:    prevPassword || null,
        newPass:     gmailForm.gmailAppPassword.replace(/\s/g, ""),
        device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : "Unknown",
      };

      await sd(doc(db, "users", uid), {
        gmailSender:       gmailForm.gmailSender.trim(),
        gmailAppPassword:  gmailForm.gmailAppPassword.replace(/\s/g, ""),
        updatedAt:         serverTimestamp(),
        gmailHistory:      arrayUnion(historyEntry),
      }, { merge: true });
      setGmailConnected(true);
      setCredUnlocked(false); // re-lock after save
      setGmailMsg({ type: "success", text: `Gmail connected! Invoices will be sent from ${gmailForm.gmailSender}` });
      setGmailForm(f => ({ ...f, gmailAppPassword: "" })); // clear password from UI
    } catch (err) {
      setGmailMsg({ type: "error", text: "Failed to save: " + err.message });
    }
    setGmailSaving(false);
  }

  async function handleDisconnectGmail() {
    try {
      const { setDoc: sd } = await import("firebase/firestore");
      await sd(doc(db, "users", uid), {
        gmailSender:      "",
        gmailAppPassword: "",
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setGmailConnected(false);
      setGmailForm({ gmailSender: "", gmailAppPassword: "" });
      setGmailMsg({ type: "success", text: "Gmail disconnected." });
    } catch (err) {
      setGmailMsg({ type: "error", text: err.message });
    }
  }

  // ── Change password (+ optional email) ───────────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMsg({ type: "", text: "" });
    if (pwForm.newPw !== pwForm.confirm) {
      setPwMsg({ type: "error", text: "New passwords don't match." }); return;
    }
    if (pwForm.newPw.length < 6) {
      setPwMsg({ type: "error", text: "Password must be at least 6 characters." }); return;
    }
    setPwSaving(true);
    try {
      const credential = FBEmailAuthProvider.credential(user.email, pwForm.current);
      await fbReauth(user, credential);
      await fbUpdatePassword(user, pwForm.newPw);

      // If email also changed
      if (profile.email && profile.email !== user.email) {
        await fbUpdateEmail(user, profile.email);
        // Update Firestore email too
        const { setDoc: sd } = await import("firebase/firestore");
        await sd(doc(db, "users", uid), { email: profile.email, updatedAt: serverTimestamp() }, { merge: true });
        setPwMsg({ type: "success", text: "Email and password updated successfully!" });
      } else {
        setPwMsg({ type: "success", text: "Password changed successfully!" });
      }

      setPwForm({ current: "", newPw: "", confirm: "" });
      setCredUnlocked(false); // re-lock after save
    } catch (err) {
      const map = {
        "auth/wrong-password":        "Current password is incorrect.",
        "auth/invalid-credential":    "Current password is incorrect.",
        "auth/too-many-requests":     "Too many attempts. Try again later.",
        "auth/requires-recent-login": "Please sign out and sign in again before changing your password.",
        "auth/email-already-in-use":  "That email is already in use by another account.",
        "auth/invalid-email":         "Please enter a valid email address.",
      };
      setPwMsg({ type: "error", text: map[err.code] || err.message });
    }
    setPwSaving(false);
  }

  const cardS = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" };

  // ── Professional Loader ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-t-amber-500 border-r-purple-500 border-b-blue-500 border-l-pink-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">⚙️</div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 w-full max-w-7xl px-2 sm:px-0">
      
      {/* ────────────── LEFT COLUMN: Forms ────────────── */}
      <div className="flex-1 flex flex-col gap-4 sm:gap-6">

      {/* ── Profile & Business form ── */}
      <form onSubmit={handleSaveProfile} className="rounded-2xl p-4 sm:p-6 flex flex-col gap-5 sm:gap-6" style={cardS}>

        {/* Logo section */}
        <SECT title="Business Logo" color="#9ca3af">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed rgba(255,255,255,0.12)" }}>
              {profile.logoDataUrl ? (
                <img src={profile.logoDataUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-3xl">🏢</span>
              )}
            </div>
            <div className="flex flex-col gap-2 w-full">
              <p className="text-white text-sm font-semibold">Business Logo</p>
              <p className="text-gray-500 text-xs leading-relaxed">
                This logo will be used automatically on all invoices. PNG or JPG, max 1 MB.
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#60A5FA" }}>
                  {profile.logoDataUrl ? "Change Logo" : "Upload Logo"}
                </button>
                {profile.logoDataUrl && (
                  <button type="button" onClick={() => setProfile(p => ({ ...p, logoDataUrl: "" }))}
                    className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                    style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>
        </SECT>

        {/* Business info */}
        <SECT title="Business Information" color="#F59E0B">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={lbl}>Your Name</label>
              <SInput placeholder="e.g. Ahmed Raza" value={profile.name} onChange={set("name")} />
            </div>
            <div>
              <label style={lbl}>Business / Company Name</label>
              <SInput placeholder="e.g. Ali Traders" value={profile.business} onChange={set("business")} />
            </div>
            <div>
              <label style={lbl}>Phone Number</label>
              <SInput type="tel" inputMode="tel" placeholder="+92 300 1234567" value={profile.phone} onChange={set("phone")} />
            </div>
            <div>
              <label style={lbl}>Email</label>
              {/* Show editable when OTP verified (credUnlocked), else locked with Change Email btn */}
              {gmailConnected && !credUnlocked ? (
                <div className="flex gap-2 items-center">
                  <div className="flex-1" style={{ ...base, color:"#6b7280", opacity:0.6, cursor:"not-allowed", padding:"10px 14px", borderRadius:10, fontSize:13 }}>
                    {profile.email || user?.email || ""}
                  </div>
                  <button type="button" onClick={handleChangeEmailClick}
                    className="px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 flex-shrink-0 whitespace-nowrap"
                    style={{ background:"rgba(37,99,235,0.12)", border:"1px solid rgba(37,99,235,0.3)", color:"#60A5FA" }}>
                    Change Email
                  </button>
                </div>
              ) : (
                <SInput type="email" placeholder="you@business.com" value={profile.email}
                  onChange={set("email")} disabled={!credUnlocked} />
              )}
              {!credUnlocked && (
                <p className="text-gray-500 text-[10px] mt-1.5 flex items-center gap-1">
                  {gmailConnected
                    ? <><span>🔒</span> Click &quot;Change Email&quot; to verify via OTP first</>
                    : <><span>🔒</span> Connect Gmail first to enable email/password changes</>
                  }
                </p>
              )}
              {credUnlocked && (
                <p className="text-[10px] mt-1.5 flex items-center gap-1" style={{ color:"#34d399" }}>
                  <span>✅</span> OTP verified — you can now update email and password
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label style={lbl}>Address</label>
              <SInput placeholder="Street, City, Country" value={profile.address} onChange={set("address")} />
            </div>
            <div className="sm:col-span-2">
              <label style={lbl}>Website (optional)</label>
              <SInput type="url" inputMode="url" placeholder="https://yourbusiness.com" value={profile.website} onChange={set("website")} />
            </div>
          </div>
        </SECT>

        {/* Currency */}
        <SECT title="Currency" color="#2563EB">
          <div className="max-w-xs">
            <label style={lbl}>Default Currency</label>
            <SSelect value={profile.currency} onChange={set("currency")}>
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code} style={{ background: "#0d1117" }}>
                  {c.label}
                </option>
              ))}
            </SSelect>
            <p className="text-gray-600 text-xs mt-2">
              Selected: <span className="text-gray-400 font-semibold">
                {CURRENCIES.find(c => c.code === profile.currency)?.symbol} ({profile.currency})
              </span>
            </p>
          </div>
        </SECT>

        {/* save btn */}
        <div className="flex items-center gap-3 pt-2 border-t border-white/[0.06]">
          <button type="submit" disabled={saving}
            className="px-6 py-3 rounded-2xl text-sm font-black transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000",
              opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : "Save Changes →"}
          </button>
          {saved && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
              ✓ Saved successfully
            </span>
          )}
        </div>
      </form>

      {/* ── Change Password ── */}
      <form onSubmit={handleChangePassword} className="rounded-2xl p-4 sm:p-6 flex flex-col gap-5" style={cardS}>
        <SECT title="Change Password" color="#f87171">
          <div className="flex flex-col gap-3">

            {/* Lock notice when Gmail connected but OTP not verified */}
            {gmailConnected && !credUnlocked && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background:"rgba(37,99,235,0.06)", border:"1px solid rgba(37,99,235,0.2)" }}>
                <span className="text-lg">🔐</span>
                <p className="text-blue-300 text-xs leading-relaxed">
                  Click <span className="font-bold text-blue-400">&quot;Change Email&quot;</span> in Business Info to verify via OTP before changing password.
                </p>
              </div>
            )}

            {[
              { key: "current", label: "Current Password",  placeholder: "Enter current password" },
              { key: "newPw",   label: "New Password",      placeholder: "Min. 6 characters"      },
              { key: "confirm", label: "Confirm New Password", placeholder: "Repeat new password" },
            ].map(f => (
              <div key={f.key}>
                <label style={lbl}>{f.label}</label>
                <div className="relative">
                  <input
                    type={showPw[f.key] ? "text" : "password"}
                    placeholder={f.placeholder}
                    value={pwForm[f.key]}
                    onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                    disabled={gmailConnected && !credUnlocked}
                    autoComplete="new-password"
                    style={{ ...base, paddingRight: 42, opacity: (gmailConnected && !credUnlocked) ? 0.4 : 1, cursor: (gmailConnected && !credUnlocked) ? "not-allowed" : "text" }} />
                  <button type="button"
                    onClick={() => setShowPw(p => ({ ...p, [f.key]: !p[f.key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-sm">
                    {showPw[f.key] ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
            ))}

            {pwMsg.text && (
              <div className="px-4 py-3 rounded-xl text-xs font-medium"
                style={{
                  background: pwMsg.type === "success" ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${pwMsg.type === "success" ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.25)"}`,
                  color: pwMsg.type === "success" ? "#34d399" : "#fca5a5",
                }}>
                {pwMsg.type === "success" ? "✓ " : "⚠ "}{pwMsg.text}
              </div>
            )}

            <button type="submit"
              disabled={pwSaving || !pwForm.current || !pwForm.newPw || !pwForm.confirm || (gmailConnected && !credUnlocked)}
              className="px-6 py-3 rounded-2xl text-sm font-bold transition-all w-fit"
              style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171",
                opacity: (pwSaving || !pwForm.current || !pwForm.newPw || !pwForm.confirm || (gmailConnected && !credUnlocked)) ? 0.5 : 1,
                cursor: (pwSaving || !pwForm.current || !pwForm.newPw || !pwForm.confirm || (gmailConnected && !credUnlocked)) ? "not-allowed" : "pointer" }}>
              {pwSaving ? "Updating..." : "Update Password →"}
            </button>
          </div>
        </SECT>
      </form>

      {/* ── Gmail Email Sender Setup ── */}
      <div className="rounded-2xl p-4 sm:p-6 flex flex-col gap-5" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <SECT title="📧 Email Sender Setup" color="#34d399">

          {/* ── DISABLED BY ADMIN ── */}
          {userDoc?.emailFeatureEnabled === false ? (
            <div className="flex flex-col gap-4">
              {/* Locked banner */}
              <div className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.05))", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div className="absolute inset-0 opacity-[0.03]"
                  style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)", backgroundSize: "10px 10px" }} />
                <div className="relative z-10 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
                    🔒
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-white font-bold text-sm">Email Feature Disabled</p>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      This feature has been disabled by your administrator. Invoice email sending is currently not available for your account.
                    </p>
                  </div>
                </div>
              </div>
              {/* Note card */}
              <div className="rounded-xl p-4 flex flex-col gap-2.5"
                style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">💡</span>
                  <p className="text-amber-400 text-xs font-bold uppercase tracking-wider">What does this mean?</p>
                </div>
                <ul className="text-gray-400 text-xs flex flex-col gap-1.5 leading-relaxed">
                  <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span> You cannot connect a Gmail account at this time</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span> Invoice emails will not be sent automatically</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span> All other features (PDF, WhatsApp, Print) still work normally</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span> Contact your administrator to get this feature enabled</li>
                </ul>
              </div>
              {/* Greyed-out form preview */}
              <div className="flex flex-col gap-3 opacity-30 pointer-events-none select-none">
                <div>
                  <label style={lbl}>Your Gmail Address</label>
                  <div style={{ ...base, color: "#6b7280" }}>yourname@gmail.com</div>
                </div>
                <div>
                  <label style={lbl}>Gmail App Password</label>
                  <div style={{ ...base, color: "#6b7280", letterSpacing: "0.3em" }}>••••••••••••••••</div>
                </div>
                <div className="px-6 py-2.5 rounded-xl text-sm font-bold w-fit"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280" }}>
                  Connect Gmail →
                </div>
              </div>
            </div>
          ) : (
            /* ── ENABLED STATE ── */
            <div className="flex flex-col gap-4">
              {/* Status banner */}
              {gmailConnected ? (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">✅</span>
                    <div>
                      <p className="text-green-400 text-sm font-bold">Gmail Connected</p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        Invoices will be sent from <span className="text-green-300 font-mono">{gmailForm.gmailSender || userDoc?.gmailSender}</span>
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={handleChangeEmailClick}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                    style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.3)", color: "#60A5FA" }}>
                    Change Email
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <span className="text-xl">⚠️</span>
                  <p className="text-amber-400 text-xs leading-relaxed">
                    Gmail not connected. Invoice emails will not be sent until you set this up.
                  </p>
                </div>
              )}
              {/* How to get App Password */}
              <div className="rounded-xl p-4 flex flex-col gap-2"
                style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.15)" }}>
                <p className="text-blue-400 text-xs font-bold uppercase tracking-wider">How to get Gmail App Password</p>
                <ol className="text-gray-400 text-xs flex flex-col gap-1.5 list-decimal list-inside leading-relaxed">
                  <li>Go to <span className="text-blue-400 font-semibold">myaccount.google.com</span> → Security</li>
                  <li>Enable <span className="text-white font-semibold">2-Step Verification</span> (required)</li>
                  <li>Search <span className="text-white font-semibold">"App passwords"</span> in search bar</li>
                  <li>Create new → name it <span className="text-white font-semibold">Novexa</span> → Copy the 16-digit password</li>
                </ol>
              </div>
              {/* Form */}
              <form onSubmit={handleSaveGmail} className="flex flex-col gap-3">
                <div>
                  <label style={lbl}>Your Gmail Address</label>
                  <SInput type="email" placeholder="yourname@gmail.com" value={gmailForm.gmailSender}
                    disabled={gmailConnected && !credUnlocked}
                    onChange={e => setGmailForm(f => ({ ...f, gmailSender: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Gmail App Password (16 characters)</label>
                  <div className="relative">
                    <input
                      type={showGmailPass ? "text" : "password"}
                      placeholder="xxxx xxxx xxxx xxxx"
                      value={gmailForm.gmailAppPassword}
                      onChange={e => setGmailForm(f => ({ ...f, gmailAppPassword: e.target.value }))}
                      disabled={gmailConnected && !credUnlocked}
                      autoComplete="new-password"
                      style={{ ...base, paddingRight: 42, letterSpacing: showGmailPass ? "0.1em" : "0.2em",
                        opacity: (gmailConnected && !credUnlocked) ? 0.4 : 1,
                        cursor: (gmailConnected && !credUnlocked) ? "not-allowed" : "text" }}
                    />
                    <button type="button" onClick={() => setShowGmailPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-sm">
                      {showGmailPass ? "🙈" : "👁"}
                    </button>
                  </div>
                  <p className="text-gray-600 text-[10px] mt-1.5">
                    Stored securely — only used to send invoice emails on your behalf.
                  </p>
                </div>
                {gmailMsg.text && (
                  <div className="px-4 py-3 rounded-xl text-xs font-medium"
                    style={{
                      background: gmailMsg.type === "success" ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)",
                      border: `1px solid ${gmailMsg.type === "success" ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.25)"}`,
                      color: gmailMsg.type === "success" ? "#34d399" : "#fca5a5",
                    }}>
                    {gmailMsg.type === "success" ? "✓ " : "⚠ "}{gmailMsg.text}
                  </div>
                )}
                <button type="submit" disabled={gmailSaving || (gmailConnected && !credUnlocked)}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 w-fit"
                  style={{ background: "linear-gradient(135deg,#34d399,#059669)", color: "#fff",
                    opacity: (gmailSaving || (gmailConnected && !credUnlocked)) ? 0.5 : 1,
                    cursor: (gmailSaving || (gmailConnected && !credUnlocked)) ? "not-allowed" : "pointer" }}>
                  {gmailSaving ? "Saving..." : gmailConnected ? "Update Gmail →" : "Connect Gmail →"}
                </button>
              </form>
            </div>
          )}

        </SECT>
      </div>

      </div>

      {/* ────────────── RIGHT COLUMN: Info Cards ────────────── */}
      <div className="lg:w-96 flex flex-col gap-4">
        
        {/* Quick Tips Card */}
        <div className="rounded-2xl p-4 sm:p-5 flex flex-col gap-4" style={cardS}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)" }}>
              💡
            </div>
            <h3 className="text-white font-bold text-sm">Quick Tips</h3>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { icon: "🏢", text: "Add your business logo for professional invoices" },
              { icon: "💰", text: "Select your default currency for all transactions" },
              { icon: "🔒", text: "Change password regularly for better security" },
              { icon: "📧", text: "Connect your Gmail in Email Setup to auto-send invoices" },
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className="text-lg leading-none mt-0.5">{tip.icon}</span>
                <p className="text-gray-400 leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Account Stats Card */}
        <div className="rounded-2xl p-4 sm:p-5 flex flex-col gap-4" style={cardS}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "rgba(37,99,235,0.12)" }}>
              📊
            </div>
            <h3 className="text-white font-bold text-sm">Account Info</h3>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-gray-500 text-xs">Account Status</span>
              <span className="px-2 py-1 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
                Active
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-gray-500 text-xs">User ID</span>
              <span className="text-gray-400 text-xs font-mono">{uid?.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-500 text-xs">Email Verified</span>
              <span className="text-xs">
                {user?.emailVerified ? "✓ Yes" : "⚠ No"}
              </span>
            </div>
          </div>
        </div>

        {/* Security Tips Card */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" 
          style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "rgba(248,113,113,0.15)" }}>
              🛡️
            </div>
            <h3 className="text-white font-bold text-sm">Security Best Practices</h3>
          </div>
          <div className="flex flex-col gap-2.5 text-xs text-gray-400 leading-relaxed">
            <p>✓ Use a strong password with uppercase, lowercase, numbers & symbols</p>
            <p>✓ Never share your password with anyone</p>
            <p>✓ Change your password every 3-6 months</p>
            <p>✓ Sign out from shared or public devices</p>
          </div>
        </div>

        {/* Help Card */}
        <div className="rounded-2xl p-5 flex flex-col gap-3" style={cardS}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤝</span>
            <h3 className="text-white font-bold text-sm">Need Help?</h3>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed">
            Having trouble with settings? Contact our support team for assistance.
          </p>
          <button type="button" 
            className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 w-full"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#60A5FA" }}>
            Contact Support
          </button>
        </div>

      </div>

    </div>

    {/* ── OTP Modals ── */}
    {otpStep === "confirm" && (
      <ConfirmModal
        title="Change Email / Password"
        message={`An OTP will be sent to your email (${user?.email || "your registered email"}) to verify your identity. Do you want to proceed?`}
        confirmLabel="Yes, Send OTP"
        confirmColor="#2563eb"
        onConfirm={handleConfirmYes}
        onCancel={handleOTPCancel}
      />
    )}

    {otpStep === "sending" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
        <div className="rounded-2xl p-8 flex flex-col items-center gap-4"
          style={{ background:"#0d1117", border:"1px solid rgba(255,255,255,0.1)" }}>
          <div className="w-12 h-12 rounded-full border-4 border-t-blue-500 border-r-purple-500 border-b-blue-500 border-l-transparent animate-spin" />
          <p className="text-white font-semibold text-sm">Sending OTP...</p>
        </div>
      </div>
    )}

    {otpStep === "otp" && (
      <OTPModal
        userEmail={user?.email || ""}
        sending={otpSending}
        sendError={otpSendError}
        resendCountdown={resendCountdown}
        onClose={handleOTPCancel}
        onVerified={handleOTPVerify}
        onResend={() => sendOTP(true)}
      />
    )}

    {otpStep === "success" && (
      <OTPSuccessModal onClose={handleOTPSuccessDone} />
    )}
    </>
  );
}
