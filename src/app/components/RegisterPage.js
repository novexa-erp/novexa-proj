"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const steps = ["Account", "Business", "Done"];

export default function RegisterPage() {
  const [mounted, setMounted]   = useState(false);
  const [step, setStep]         = useState(0);
  const [focused, setFocused]   = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [form, setForm]         = useState({
    name: "", email: "", password: "",
    business: "", phone: "", industry: "",
  });

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const field = (name) => ({
    onFocus: () => setFocused(name),
    onBlur:  () => setFocused(null),
    style: {
      width: "100%", outline: "none",
      background: focused === name ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.03)",
      border: `1.5px solid ${focused === name ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.09)"}`,
      borderRadius: 14, padding: "13px 16px", color: "#fff", fontSize: 14,
      transition: "all 0.25s ease",
      boxShadow: focused === name ? "0 0 0 4px rgba(37,99,235,0.08)" : "none",
    },
  });

  function handleNext(e) {
    e.preventDefault();
    if (step === 0) { setStep(1); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); setStep(2); }, 1600);
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1117 60%, #140f02 100%)" }} />
          <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 65%)" }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 65%)" }} />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(245,158,11,0.35), transparent)" }} />
        </div>

        {/* logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative w-14 h-14" style={{ filter: "drop-shadow(0 0 10px rgba(245,158,11,0.4))" }}>
            <Image src="/images/Novexa N Logo.png" alt="Novexa" fill className="object-contain" />
          </div>
          <div className="flex flex-col leading-tight ml-[-6px]">
            <span className="text-white font-bold text-xl tracking-wide">NOVEXA</span>
            <span className="text-[#F59E0B] text-xs font-semibold tracking-[0.25em] uppercase">ERP System</span>
          </div>
        </div>

        {/* center */}
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6 w-fit tracking-widest uppercase"
            style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#FCD34D" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Free to start
          </div>
          <h2 className="text-white font-bold leading-tight mb-4" style={{ fontSize: 36 }}>
            Get your business<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #F59E0B, #FCD34D 50%, #2563EB)" }}>
              running in minutes
            </span>
          </h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-sm mb-8">
            No credit card. No setup fees. Just sign up and start managing your business the smart way.
          </p>

          {/* what you get */}
          <div className="flex flex-col gap-2.5">
            {[
              "✓  All 8 modules included from day one",
              "✓  Unlimited invoices & customers",
              "✓  Real-time inventory & analytics",
              "✓  PDF export & WhatsApp sharing",
              "✓  Role-based team access",
              "✓  24/7 support & onboarding",
            ].map((t) => (
              <p key={t} className="text-sm text-gray-300">{t}</p>
            ))}
          </div>
        </div>

        {/* bottom trust */}
        <div className="relative z-10 flex items-center gap-3 p-4 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="text-2xl">🔒</span>
          <div>
            <p className="text-white text-xs font-semibold">Bank-level security</p>
            <p className="text-gray-500 text-xs">AES-256 encryption · GDPR compliant · Daily backups</p>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div className="absolute inset-0 lg:hidden" style={{ background: "radial-gradient(ellipse at 50% 20%, rgba(245,158,11,0.05) 0%, transparent 70%)" }} />

        <div
          className="relative w-full max-w-md transition-all duration-700"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)" }}
        >
          {/* mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <div className="relative w-10 h-10"><Image src="/images/Novexa N Logo.png" alt="Novexa" fill className="object-contain" /></div>
            <span className="text-white font-bold text-lg tracking-wide">NOVEXA</span>
          </div>

          {/* step indicator */}
          <div className="flex items-center gap-0 mb-8">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-400"
                    style={{
                      background: i <= step ? (i < step ? "linear-gradient(135deg,#F59E0B,#D97706)" : "rgba(245,158,11,0.15)") : "rgba(255,255,255,0.05)",
                      border: `2px solid ${i <= step ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                      color: i <= step ? (i < step ? "#fff" : "#F59E0B") : "#4b5563",
                    }}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span className="text-[10px] mt-1 font-medium" style={{ color: i <= step ? "#F59E0B" : "#4b5563" }}>{s}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-px mx-2 mt-[-10px] transition-all duration-400"
                    style={{ background: i < step ? "#F59E0B" : "rgba(255,255,255,0.07)" }} />
                )}
              </div>
            ))}
          </div>

          {step === 2 ? (
            /* ── Success ── */
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-5"
                style={{ background: "rgba(245,158,11,0.12)", border: "2px solid rgba(245,158,11,0.4)", boxShadow: "0 0 40px rgba(245,158,11,0.2)" }}>
                🎉
              </div>
              <h2 className="text-white font-bold text-2xl mb-2">Account Created!</h2>
              <p className="text-gray-400 text-sm mb-2">Welcome to Novexa ERP, <strong className="text-white">{form.name || "there"}</strong>!</p>
              <p className="text-gray-500 text-sm mb-8">We sent a confirmation to <span className="text-blue-400">{form.email}</span>.</p>
              <Link href="/login" className="btn-primary">Go to Dashboard →</Link>
              <p className="text-gray-600 text-xs mt-4">Or check your email to verify your account.</p>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-white font-bold mb-1.5" style={{ fontSize: 26 }}>
                  {step === 0 ? "Create your account" : "Tell us about your business"}
                </h1>
                <p className="text-gray-400 text-sm">
                  {step === 0 ? (
                    <>Already have an account?{" "}
                      <Link href="/login" className="font-semibold" style={{ color: "#F59E0B" }}>Sign in →</Link>
                    </>
                  ) : "Help us personalise your experience."}
                </p>
              </div>

              {step === 0 && (
                /* social */
                <>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                      { label: "Google", icon: <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> },
                      { label: "Microsoft", icon: <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg> },
                    ].map((s) => (
                      <button key={s.label} className="flex items-center justify-center gap-2.5 py-3 rounded-2xl text-sm font-medium text-gray-300 transition-all duration-200"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#d1d5db"; }}>
                        {s.icon} <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
                    <span className="text-xs text-gray-600">or with email</span>
                    <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
                  </div>
                </>
              )}

              <form onSubmit={handleNext} className="flex flex-col gap-4">
                {step === 0 && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">Full Name</label>
                      <input type="text" required placeholder="Ahmed Raza" value={form.name} onChange={set("name")} {...field("name")} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">Email Address</label>
                      <input type="email" required placeholder="you@company.com" value={form.email} onChange={set("email")} {...field("email")} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">Password</label>
                      <div className="relative">
                        <input type={showPass ? "text" : "password"} required placeholder="Min. 8 characters"
                          value={form.password} onChange={set("password")} {...field("password")}
                          style={{ ...field("password").style, paddingRight: 44 }} />
                        <button type="button" onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-sm">
                          {showPass ? "🙈" : "👁"}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">Business Name</label>
                      <input type="text" required placeholder="e.g. Ali Traders" value={form.business} onChange={set("business")} {...field("business")} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">Phone Number</label>
                      <input type="tel" placeholder="+92 300 1234567" value={form.phone} onChange={set("phone")} {...field("phone")} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">Industry</label>
                      <select value={form.industry} onChange={set("industry")} {...field("industry")}
                        style={{ ...field("industry").style, cursor: "pointer" }}>
                        <option value="" style={{ background: "#0d1117" }}>Select your industry</option>
                        {["Retail & Trading", "Manufacturing", "Services", "Healthcare", "Food & Beverage", "Construction", "Technology", "Other"].map(o => (
                          <option key={o} value={o} style={{ background: "#0d1117" }}>{o}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-1"
                  style={{ opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" className="opacity-25" />
                        <path fill="white" d="M4 12a8 8 0 018-8v8z" className="opacity-75" />
                      </svg>
                      Creating account...
                    </span>
                  ) : step === 0 ? "Continue →" : "Create Account →"}
                </button>

                {step === 1 && (
                  <button type="button" onClick={() => setStep(0)}
                    className="text-center text-gray-500 text-sm hover:text-gray-300 transition-colors">
                    ← Back
                  </button>
                )}
              </form>

              {step === 0 && (
                <p className="text-center text-gray-600 text-xs mt-5">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="text-gray-500 hover:text-gray-300 transition-colors">Terms</Link>
                  {" "}and{" "}
                  <Link href="/privacy-policy" className="text-gray-500 hover:text-gray-300 transition-colors">Privacy Policy</Link>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
