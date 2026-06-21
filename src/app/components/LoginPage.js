"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "../../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted]   = useState(false);
  const [focused, setFocused]   = useState(null);
  const [form, setForm]         = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
      // Redirect to dashboard after successful login
      router.push("/dashboard");
    } catch (err) {
      setLoading(false);
      console.error("Login error:", err);
      
      // Handle specific Firebase errors
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Invalid email or password. Please try again.");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError("Login failed. Please try again.");
      }
    }
  }

  const field = (name) => ({
    onFocus: () => setFocused(name),
    onBlur:  () => setFocused(null),
    style: {
      width: "100%", outline: "none", background: focused === name ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.03)",
      border: `1.5px solid ${focused === name ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.09)"}`,
      borderRadius: 14, padding: "13px 16px", color: "#fff", fontSize: 14,
      transition: "all 0.25s ease",
      boxShadow: focused === name ? "0 0 0 4px rgba(37,99,235,0.08)" : "none",
    },
  });

  return (
    <div className="min-h-screen bg-[#0d1117] flex">

      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12">
        {/* bg layers */}
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1117 60%, #0f1a0a 100%)" }} />
          <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 65%)" }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full" style={{ background: "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 65%)" }} />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
          {/* top line */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(37,99,235,0.4), transparent)" }} />
        </div>

        {/* logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative w-14 h-14" style={{ filter: "drop-shadow(0 0 10px rgba(37,99,235,0.5))" }}>
            <Image src="/images/Novexa N Logo.png" alt="Novexa" fill className="object-contain" />
          </div>
          <div className="flex flex-col leading-tight ml-[-6px]">
            <span className="text-white font-bold text-xl tracking-wide">NOVEXA</span>
            <span className="text-[#F59E0B] text-xs font-semibold tracking-[0.25em] uppercase">ERP System</span>
          </div>
        </div>

        {/* center content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
              style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#93C5FD" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Welcome back
            </div>
            <h2 className="text-white font-bold leading-tight mb-4" style={{ fontSize: 38 }}>
              Your business is<br />
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
                waiting for you
              </span>
            </h2>
            <p className="text-gray-400 text-base leading-relaxed max-w-sm">
              Sign in to manage your invoices, customers, inventory, and payments — all in one place.
            </p>
          </div>

          {/* feature list */}
          <div className="flex flex-col gap-3">
            {[
              { icon: "🧾", text: "Smart invoicing in seconds" },
              { icon: "📦", text: "Real-time inventory tracking" },
              { icon: "📊", text: "Live business analytics" },
              { icon: "🔐", text: "Bank-level data security" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)" }}>
                  {f.icon}
                </div>
                <span className="text-gray-300 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* bottom */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex -space-x-2">
              {["🧑‍💼","👩‍💼","👨‍💼"].map((e, i) => (
                <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 border-[#0d1117]"
                  style={{ background: i % 2 === 0 ? "rgba(37,99,235,0.2)" : "rgba(245,158,11,0.2)" }}>
                  {e}
                </div>
              ))}
            </div>
            <div>
              <p className="text-white text-xs font-semibold">500+ businesses trust Novexa</p>
              <div className="flex gap-0.5 mt-0.5">{[...Array(5)].map((_, i) => <span key={i} className="text-[#F59E0B] text-xs">★</span>)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div className="absolute inset-0 lg:hidden" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(37,99,235,0.06) 0%, transparent 70%)" }} />

        <div
          className="relative w-full max-w-md transition-all duration-700"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)" }}
        >
          {/* mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <div className="relative w-10 h-10"><Image src="/images/Novexa N Logo.png" alt="Novexa" fill className="object-contain" /></div>
            <span className="text-white font-bold text-lg tracking-wide">NOVEXA</span>
          </div>

          <div className="mb-8">
            <h1 className="text-white font-bold mb-2" style={{ fontSize: 28 }}>Sign in</h1>
            <p className="text-gray-400 text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-semibold transition-colors duration-200" style={{ color: "#F59E0B" }}
                onMouseEnter={e => e.currentTarget.style.color = "#FCD34D"} onMouseLeave={e => e.currentTarget.style.color = "#F59E0B"}>
                Create one free →
              </Link>
            </p>
          </div>

          {/* social login */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: "Google", icon: <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> },
              { label: "Microsoft", icon: <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg> },
            ].map((s) => (
              <button key={s.label}
                className="flex items-center justify-center gap-2.5 py-3 rounded-2xl text-sm font-medium text-gray-300 transition-all duration-200"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#d1d5db"; }}>
                {s.icon}
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {/* divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-xs text-gray-600 font-medium">or continue with email</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-5 text-sm"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#FCA5A5" }}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">Email Address</label>
              <input type="email" required placeholder="you@example.com"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                {...field("email")} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Password</label>
                <Link href="#" className="text-xs font-medium transition-colors duration-200" style={{ color: "#60A5FA" }}>Forgot password?</Link>
              </div>
              <div className="relative">
                <input type={showPass ? "text" : "password"} required placeholder="••••••••"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  {...field("password")}
                  style={{ ...field("password").style, paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-sm">
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <input type="checkbox" id="remember" className="w-4 h-4 rounded" style={{ accentColor: "#2563EB" }} />
              <label htmlFor="remember" className="text-sm text-gray-400 cursor-pointer">Remember me for 30 days</label>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2"
              style={{ opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" className="opacity-25" />
                    <path fill="white" d="M4 12a8 8 0 018-8v8z" className="opacity-75" />
                  </svg>
                  Signing in...
                </span>
              ) : "Sign In →"}
            </button>
          </form>

          <p className="text-center text-gray-600 text-xs mt-6">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="text-gray-500 hover:text-gray-300 transition-colors">Terms</Link>
            {" "}and{" "}
            <Link href="/privacy-policy" className="text-gray-500 hover:text-gray-300 transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
