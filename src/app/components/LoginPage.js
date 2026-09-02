"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

// ── Sweet Alert ───────────────────────────────────────────────────────────────
function SweetAlert({ show, type, title, message, onClose }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { if (show) { setVisible(true); setLeaving(false); } }, [show]);
  const close = () => { setLeaving(true); setTimeout(() => { setVisible(false); onClose(); }, 300); };
  if (!show && !visible) return null;
  const cfg = {
    success: { grad: "from-emerald-500 to-green-600", icon: "✓", bg: "rgba(16,185,129,0.15)", color: "#10b981", border: "rgba(16,185,129,0.3)" },
    error:   { grad: "from-red-500 to-rose-600",      icon: "✕", bg: "rgba(239,68,68,0.15)",  color: "#ef4444", border: "rgba(239,68,68,0.3)"  },
  };
  const s = cfg[type] || cfg.error;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", animation: leaving ? "fadeOut .3s ease-out" : "fadeIn .3s ease-out" }}
      onClick={close}>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes fadeOut { from{opacity:1} to{opacity:0} }
        @keyframes slideUp { from{transform:translateY(30px) scale(.9);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
        @keyframes slideDown{ from{transform:translateY(0) scale(1);opacity:1} to{transform:translateY(30px) scale(.9);opacity:0} }
        @keyframes ripple  { 0%{transform:scale(0);opacity:1} 100%{transform:scale(2.5);opacity:0} }
        @keyframes iconPop { 0%{transform:scale(0) rotate(-180deg)} 50%{transform:scale(1.2) rotate(10deg)} 100%{transform:scale(1) rotate(0)} }
      `}</style>
      <div className="relative w-full max-w-sm rounded-3xl p-8 flex flex-col items-center gap-6"
        style={{ background:"linear-gradient(135deg,rgba(13,17,23,.98),rgba(8,13,20,.98))", border:`1.5px solid ${s.border}`,
          boxShadow:`0 20px 60px rgba(0,0,0,.5)`, animation: leaving?"slideDown .3s ease-out":"slideUp .4s cubic-bezier(.34,1.56,.64,1)" }}
        onClick={e=>e.stopPropagation()}>
        <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r ${s.grad}`}/>
        <div className="relative">
          <div className="absolute inset-0 rounded-full" style={{ background:s.bg, animation:"ripple 1.5s infinite" }}/>
          <div className="relative w-20 h-20 rounded-full flex items-center justify-center text-4xl font-bold"
            style={{ background:s.bg, border:`2px solid ${s.border}`, color:s.color, animation:"iconPop .5s cubic-bezier(.34,1.56,.64,1) .2s backwards" }}>
            {s.icon}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h3 className="text-white font-bold text-2xl" style={{ animation:"slideUp .5s ease-out .3s backwards" }}>{title}</h3>
          <p className="text-gray-400 text-sm leading-relaxed max-w-xs" style={{ animation:"slideUp .5s ease-out .4s backwards" }}>{message}</p>
        </div>
        <button onClick={close} className={`relative w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:scale-[1.02]`}
          style={{ background:`linear-gradient(135deg, ${s.grad})`, animation:"slideUp .5s ease-out .5s backwards" }}>
          Got it!
        </button>
      </div>
    </div>
  );
}

// ── Forgot Password Popup ─────────────────────────────────────────────────────
function ForgotPasswordPopup({ show, onClose }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { if (show) { setVisible(true); setLeaving(false); } }, [show]);
  const close = () => { setLeaving(true); setTimeout(() => { setVisible(false); onClose(); }, 300); };
  if (!show && !visible) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", animation: leaving ? "fadeOut .3s ease-out" : "fadeIn .3s ease-out" }}
      onClick={close}>
      <style>{`
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes fadeOut  { from{opacity:1} to{opacity:0} }
        @keyframes slideUp  { from{transform:translateY(30px) scale(.9);opacity:0} to{transform:translateY(0) scale(1);opacity:1} }
        @keyframes slideDown{ from{transform:translateY(0) scale(1);opacity:1} to{transform:translateY(30px) scale(.9);opacity:0} }
        @keyframes iconPop  { 0%{transform:scale(0) rotate(-180deg)} 50%{transform:scale(1.2) rotate(10deg)} 100%{transform:scale(1) rotate(0)} }
      `}</style>
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg,rgba(13,17,23,.98),rgba(8,13,20,.98))",
          border: "1.5px solid rgba(37,99,235,0.3)",
          boxShadow: "0 20px 60px rgba(0,0,0,.5)",
          animation: leaving ? "slideDown .3s ease-out" : "slideUp .4s cubic-bezier(.34,1.56,.64,1)",
        }}
        onClick={e => e.stopPropagation()}>

        {/* Top gradient bar */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#2563EB,#60A5FA,#F59E0B)" }} />

        <div className="p-8 flex flex-col items-center gap-5">
          {/* Icon */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full" style={{ background: "rgba(37,99,235,0.15)", animation: "ripple 1.5s infinite" }} />
            <div className="relative w-20 h-20 rounded-full flex items-center justify-center text-4xl"
              style={{ background: "rgba(37,99,235,0.12)", border: "2px solid rgba(37,99,235,0.3)", animation: "iconPop .5s cubic-bezier(.34,1.56,.64,1) .2s backwards" }}>
              🔑
            </div>
          </div>

          {/* Title & message */}
          <div className="flex flex-col items-center gap-2 text-center" style={{ animation: "slideUp .5s ease-out .3s backwards" }}>
            <h3 className="text-white font-bold text-2xl">Forgot Your Password?</h3>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              No worries at all! Just reach out to us and we&apos;ll reset your password right away.
            </p>
          </div>

          {/* Contact info box */}
          <div className="w-full rounded-2xl p-4 flex flex-col gap-3"
            style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.15)", animation: "slideUp .5s ease-out .4s backwards" }}>
            <p className="text-blue-300 text-xs font-semibold text-center uppercase tracking-wider">Contact Us</p>

            {/* WhatsApp */}
            <a href="https://wa.me/923251507557?text=Hello%20Novexa%2C%20I%20forgot%20my%20password.%20Please%20help%20me%20reset%20it."
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: "rgba(37,211,102,0.12)" }}>💬</div>
              <div className="flex flex-col">
                <span className="text-white text-sm font-semibold">WhatsApp</span>
                <span className="text-green-400 text-xs">+92 325 150 7557</span>
              </div>
              <span className="ml-auto text-green-500 text-xs font-semibold">Chat →</span>
            </a>

            {/* Email */}
            <a href="mailto:novexaerp@gmail.com?subject=Forgot%20Password&body=Hello%20Novexa%2C%20I%20forgot%20my%20password%20and%20need%20help%20resetting%20it."
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02]"
              style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: "rgba(37,99,235,0.12)" }}>✉️</div>
              <div className="flex flex-col">
                <span className="text-white text-sm font-semibold">Email</span>
                <span className="text-blue-400 text-xs">novexaerp@gmail.com</span>
              </div>
              <span className="ml-auto text-blue-500 text-xs font-semibold">Send →</span>
            </a>
          </div>

          {/* Close button */}
          <button onClick={close}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", boxShadow: "0 4px 20px rgba(37,99,235,0.25)", animation: "slideUp .5s ease-out .5s backwards" }}>
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function firebaseError(code) {
  const map = {
    "auth/user-not-found":     "No account found with this email.",
    "auth/wrong-password":     "Incorrect password. Please try again.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/invalid-email":      "Please enter a valid email address.",
    "auth/too-many-requests":  "Too many attempts. Please wait and try again.",
    "auth/user-disabled":      "This account has been disabled.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

const BLOCKED_MSGS = {
  not_started:        { title: "Access Not Started",        msg: "Your subscription has not started yet. Please wait or contact admin.",                                                  icon: "📅" },
  access_denied:      { title: "Access Denied",             msg: "You do not have permission to access this panel.",                                                                       icon: "🚫" },
  session_evicted:    { title: "Logged Out Automatically",  msg: "Your account was opened on another device. Only 1 session is allowed at a time.",                                       icon: "📱" },
  password_changed:   { title: "Password Changed",          msg: "Your password was recently changed. For your security, you have been signed out. Please sign in with your new password.", icon: "🔐" },
  staff_inactive:     { title: "Account Deactivated",       msg: "Your staff account has been deactivated. Please contact your admin to restore access.",                                  icon: "⏸️" },
  account_suspended:  { title: "Account Suspended",         msg: "Your account has been temporarily suspended. Please contact your admin to reactivate your access.",                      icon: "⏸️" },
  account_removed:    { title: "Account Removed",           msg: "Your staff account has been permanently removed. Please contact your admin for more information.",                       icon: "🚫" },
};

// These get their own full-screen UI instead of a small popup
const FROZEN_REASONS = ["frozen", "expired", "subscription_expired"];

// ── Frozen / Expired full-screen ─────────────────────────────────────────────
function FrozenScreen({ reason }) {
  const isExpired = reason === "expired" || reason === "subscription_expired";
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      {/* Animated background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #ef4444 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #f97316 0%, transparent 70%)", filter: "blur(60px)" }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl overflow-hidden"
          style={{ background: "linear-gradient(135deg,rgba(13,17,23,0.98),rgba(8,13,20,0.98))", border: "1.5px solid rgba(239,68,68,0.3)", boxShadow: "0 0 80px rgba(239,68,68,0.1)" }}>

          {/* Top gradient bar */}
          <div className="h-1.5" style={{ background: "linear-gradient(90deg,#ef4444,#f97316,#ef4444)", backgroundSize: "200% 100%", animation: "shimmer 2s linear infinite" }} />

          <style>{`
            @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
            @keyframes pulse-ring { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:0.8;transform:scale(1.05)} }
          `}</style>

          <div className="p-8 flex flex-col items-center gap-5 text-center">
            {/* Lock icon with pulse ring */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full"
                style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.25)", animation: "pulse-ring 2s ease-in-out infinite" }} />
              <div className="relative w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.12)", border: "1.5px solid rgba(239,68,68,0.3)" }}>
                <span className="text-4xl">{isExpired ? "⏰" : "🔒"}</span>
              </div>
            </div>

            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black"
                style={{ background: "linear-gradient(135deg,#2563EB,#F59E0B)", color: "#fff" }}>N</div>
              <span className="text-gray-500 text-xs font-bold tracking-widest uppercase">Novexa ERP</span>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-white font-black text-2xl mb-2">
                {isExpired ? "Subscription Expired" : "Account Frozen"}
              </h1>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                {isExpired
                  ? "Your Novexa subscription has ended and your account has been automatically frozen."
                  : "Your account has been frozen. Please contact our team to restore access."}
              </p>
            </div>

            {/* Info box */}
            <div className="w-full rounded-2xl p-4"
              style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <p className="text-red-300 text-sm font-semibold mb-1">
                {isExpired ? "How to reactivate?" : "What happened?"}
              </p>
              <p className="text-gray-500 text-xs leading-relaxed">
                {isExpired
                  ? "Contact our team, pay your subscription fee, and your account will be activated within minutes."
                  : "Your account was frozen by the administrator. Contact our support team to understand the reason and get reactivated."}
              </p>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col gap-2.5 w-full">
              <a href="https://wa.me/923251507557?text=Hello%20Novexa%2C%20my%20account%20is%20frozen.%20I%20want%20to%20renew%20my%20subscription."
                target="_blank" rel="noopener noreferrer"
                className="w-full py-3.5 rounded-xl text-white font-black text-sm text-center transition-all hover:scale-[1.02] hover:brightness-110"
                style={{ background: "linear-gradient(135deg,#ef4444,#f97316)", boxShadow: "0 4px 20px rgba(239,68,68,0.25)" }}>
                💬 Contact Support to Reactivate
              </a>
              <a href="tel:+923251507557"
                className="w-full py-3 rounded-xl text-sm font-semibold text-center transition-all hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af" }}>
                📞 Call Us Directly
              </a>
            </div>

            <p className="text-gray-700 text-[10px]">
              Already renewed? Ask admin to unfreeze your account, then try logging in again.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Login form (inside Suspense) ──────────────────────────────────────────────
function LoginContent() {
  const router         = useRouter();
  const searchParams   = useSearchParams();
  const blockedReason  = searchParams.get("blocked");
  const [mounted, setMounted]     = useState(false);
  const [focused, setFocused]     = useState(null);
  const [form,    setForm]        = useState({ email: "", password: "" });
  const [showPass, setShowPass]   = useState(false);
  const [loading,  setLoading]    = useState(false);
  const [alert,    setAlert]      = useState({ show: false, type: "", title: "", message: "" });
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  useEffect(() => {
    if (blockedReason && BLOCKED_MSGS[blockedReason]) {
      const b = BLOCKED_MSGS[blockedReason];
      setAlert({ show: true, type: "error", title: `${b.icon} ${b.title}`, message: b.msg });
    }
  }, [blockedReason]);

  // Show full frozen screen for expired/frozen accounts
  if (blockedReason && FROZEN_REASONS.includes(blockedReason)) {
    return <FrozenScreen reason={blockedReason} />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const cred    = await signInWithEmailAndPassword(auth, form.email, form.password);
      const isAdmin = cred.user.uid === process.env.NEXT_PUBLIC_ADMIN_UID;

      // Super-admin — skip all checks, go straight to admin panel
      if (isAdmin) {
        setAlert({ show: true, type: "success", title: "Welcome Back! 🎉", message: "Login successful! Redirecting you..." });
        setLoading(false);
        setTimeout(() => router.push("/super-admin"), 1500);
        return;
      }

      // Step 1: Check subscription / account status
      try {
        const token = await cred.user.getIdToken();
        const res   = await fetch("/api/admin/check-subscription", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!data.allowed) {
          const { signOut } = await import("firebase/auth");
          await signOut(auth);
          setLoading(false);
          const reason = data.status === "frozen"
            ? (data.reason === "subscription_expired" ? "expired" : "frozen")
            : data.status === "not_started" ? "not_started" : "access_denied";
          router.push(`/pages/login?blocked=${reason}`);
          return;
        }
      } catch {
        // Network error — allow in, dashboard will re-check
      }

      // Step 2: Detect if this is a staff login
      // Force-refresh the token to pick up custom claims set at account creation
      try {
        const token = await cred.user.getIdToken(true);
        const res   = await fetch("/api/staff/resolve", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.error && data.allowed === false) {
          // Staff account blocked (inactive, deleted, admin frozen)
          const { signOut } = await import("firebase/auth");
          await signOut(auth);
          setLoading(false);
          setAlert({
            show: true, type: "error",
            title: "Access Denied 🚫",
            message: data.error || "Your account does not have access. Please contact your admin.",
          });
          return;
        }

        if (data.isStaff) {
          // Persist staff context in sessionStorage so DashboardPage doesn't need
          // to re-call resolve on every page load (it checks this key first)
          const ctx = {
            adminUid:       data.adminUid,
            allowedModules: data.allowedModules || [],
            staffDoc:       data.staffDoc,
            adminPlan:      data.adminPlan || "starter",
          };
          sessionStorage.setItem("novexa_staff_context", JSON.stringify(ctx));
          setAlert({
            show: true, type: "success",
            title: `Welcome, ${data.staffDoc?.name || "Staff"}! 👋`,
            message: "Login successful! Redirecting to your workspace...",
          });
          setLoading(false);
          setTimeout(() => router.push("/dashboard"), 1500);
          return;
        }
        // data.isStaff === false → regular admin login, fall through
      } catch {
        // Network error — treat as regular admin login, dashboard will re-resolve
        sessionStorage.removeItem("novexa_staff_context");
      }

      // Regular admin login
      setAlert({ show: true, type: "success", title: "Welcome Back! 🎉", message: "Login successful! Redirecting you..." });
      setLoading(false);
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err) {
      setLoading(false);
      setAlert({ show: true, type: "error", title: "Login Failed", message: firebaseError(err.code) });
    }
  }

  const field = (name) => ({
    onFocus: () => setFocused(name),
    onBlur:  () => setFocused(null),
    style: {
      width:"100%", outline:"none",
      background: focused===name ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.03)",
      border: `1.5px solid ${focused===name ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.09)"}`,
      borderRadius:14, padding:"13px 16px", color:"#fff", fontSize:14, transition:"all .25s ease",
      boxShadow: focused===name ? "0 0 0 4px rgba(37,99,235,0.08)" : "none",
    },
  });

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      <SweetAlert show={alert.show} type={alert.type} title={alert.title} message={alert.message}
        onClose={() => setAlert(a => ({ ...a, show: false }))} />
      <ForgotPasswordPopup show={forgotOpen} onClose={() => setForgotOpen(false)} />

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background:"linear-gradient(135deg,#0a1628 0%,#0d1117 60%,#0f1a0a 100%)" }}/>
          <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full" style={{ background:"radial-gradient(circle,rgba(37,99,235,0.12) 0%,transparent 65%)" }}/>
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full" style={{ background:"radial-gradient(circle,rgba(245,158,11,0.08) 0%,transparent 65%)" }}/>
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage:"radial-gradient(rgba(255,255,255,0.08) 1px,transparent 1px)", backgroundSize:"36px 36px" }}/>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background:"linear-gradient(to right,transparent,rgba(37,99,235,0.4),transparent)" }}/>
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative w-14 h-14" style={{ filter:"drop-shadow(0 0 10px rgba(37,99,235,0.5))" }}>
            <Image src="/images/Novexa N Logo.png" alt="Novexa" fill className="object-contain"/>
          </div>
          <div className="flex flex-col leading-tight ml-[-6px]">
            <span className="text-white font-bold text-xl tracking-wide">NOVEXA</span>
            <span className="text-[#F59E0B] text-xs font-semibold tracking-[0.25em] uppercase">ERP System</span>
          </div>
        </div>
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
              style={{ background:"rgba(37,99,235,0.1)", border:"1px solid rgba(37,99,235,0.25)", color:"#93C5FD" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"/>Welcome back
            </div>
            <h2 className="text-white font-bold leading-tight mb-4" style={{ fontSize:38 }}>
              Your business is<br/>
              <span className="bg-clip-text text-transparent" style={{ backgroundImage:"linear-gradient(135deg,#2563EB,#60A5FA 50%,#F59E0B)" }}>
                waiting for you
              </span>
            </h2>
            <p className="text-gray-400 text-base leading-relaxed max-w-sm">
              Sign in to manage your invoices, customers, inventory, and payments — all in one place.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {[{ icon:"🧾",text:"Smart invoicing in seconds" },{ icon:"📦",text:"Real-time inventory tracking" },
              { icon:"📊",text:"Live business analytics" },{ icon:"🔐",text:"Bank-level data security" }].map(f=>(
              <div key={f.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background:"rgba(37,99,235,0.1)", border:"1px solid rgba(37,99,235,0.2)" }}>{f.icon}</div>
                <span className="text-gray-300 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex -space-x-2">
              {["🧑‍💼","👩‍💼","👨‍💼"].map((e,i)=>(
                <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 border-[#0d1117]"
                  style={{ background:i%2===0?"rgba(37,99,235,0.2)":"rgba(245,158,11,0.2)" }}>{e}</div>
              ))}
            </div>
            <div>
              <p className="text-white text-xs font-semibold">500+ businesses trust Novexa</p>
              <div className="flex gap-0.5 mt-0.5">{[...Array(5)].map((_,i)=><span key={i} className="text-[#F59E0B] text-xs">★</span>)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div className="absolute inset-0 lg:hidden" style={{ background:"radial-gradient(ellipse at 50% 30%,rgba(37,99,235,0.06) 0%,transparent 70%)" }}/>
        <div className="relative w-full max-w-md transition-all duration-700"
          style={{ opacity:mounted?1:0, transform:mounted?"translateY(0)":"translateY(20px)" }}>
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <div className="relative w-10 h-10"><Image src="/images/Novexa N Logo.png" alt="Novexa" fill className="object-contain"/></div>
            <span className="text-white font-bold text-lg tracking-wide">NOVEXA</span>
          </div>
          <div className="mb-8">
            <h1 className="text-white font-bold mb-2" style={{ fontSize:28 }}>Sign in</h1>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">Email Address</label>
              <input type="email" required placeholder="you@example.com"
                className="invoice-input"
                value={form.email} onChange={e=>setForm({...form,email:e.target.value})} {...field("email")}/>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Password</label>
                <button type="button" onClick={() => setForgotOpen(true)}
                  className="text-xs font-medium transition-colors hover:text-blue-300"
                  style={{ color:"#60A5FA" }}>Forgot password?</button>
              </div>
              <div className="relative">
                <input type={showPass?"text":"password"} required placeholder="••••••••"
                  className="invoice-input"
                  value={form.password} onChange={e=>setForm({...form,password:e.target.value})}
                  {...field("password")} style={{ ...field("password").style, paddingRight:44 }}/>
                <button type="button" onClick={()=>setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">
                  {showPass?"🙈":"👁"}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input type="checkbox" id="remember" className="w-4 h-4 rounded" style={{ accentColor:"#2563EB" }}/>
              <label htmlFor="remember" className="text-sm text-gray-400 cursor-pointer">Remember me for 30 days</label>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2"
              style={{ opacity:loading?.75:1, cursor:loading?"not-allowed":"pointer" }}>
              {loading?(
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" className="opacity-25"/>
                    <path fill="white" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/>
                  </svg>Signing in...
                </span>
              ):"Sign In →"}
            </button>
          </form>
          <p className="text-center text-gray-600 text-xs mt-6">
            By signing in, you agree to our{" "}
            <Link href="/pages/terms" className="text-gray-500 hover:text-gray-300 transition-colors">Terms</Link>
            {" "}and{" "}
            <Link href="/pages/privacy-policy" className="text-gray-500 hover:text-gray-300 transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Export with Suspense (required for useSearchParams) ───────────────────────
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-t-blue-500 border-transparent animate-spin"/>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
