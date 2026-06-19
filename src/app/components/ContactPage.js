"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function useInView(t = 0.08) {
  const [v, setV] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: t });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, [t]);
  return [ref, v];
}

const contactInfo = [
  { icon: "📧", label: "Email Us",     value: "support@novexa.com",  sub: "We reply within 24 hours",   color: "#2563EB", bg: "rgba(37,99,235,0.08)",   border: "rgba(37,99,235,0.35)",   glow: "rgba(37,99,235,0.25)",   href: "mailto:support@novexa.com" },
  { icon: "💬", label: "WhatsApp",     value: "+92 300 1234567",      sub: "Chat with us directly",      color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.35)",  glow: "rgba(245,158,11,0.25)",  href: "https://wa.me/923001234567" },
  { icon: "📍", label: "Location",     value: "Lahore, Pakistan",     sub: "Serving clients worldwide",  color: "#2563EB", bg: "rgba(37,99,235,0.08)",   border: "rgba(37,99,235,0.35)",   glow: "rgba(37,99,235,0.25)",   href: "#" },
  { icon: "🕐", label: "Working Hours", value: "Mon–Sat, 9am–7pm",   sub: "PKT (UTC+5)",                color: "#F59E0B", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.35)",  glow: "rgba(245,158,11,0.25)",  href: "#" },
];

const faqs = [
  { q: "How quickly will you respond?", a: "We typically reply within 1–2 hours during business hours, and within 24 hours on weekends." },
  { q: "Do you offer a free trial?",    a: "Yes — every plan includes a free trial with no credit card required. Sign up and start in minutes." },
  { q: "Can I get a product demo?",     a: "Absolutely. Book a live demo via WhatsApp or email and we will walk you through the entire platform." },
  { q: "What if I need help setting up?", a: "Our onboarding team will help you get fully set up for free. Most businesses are live within 30 minutes." },
];

function inputStyle(focused, field) {
  return {
    width: "100%",
    background: focused === field ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.03)",
    border: `1.5px solid ${focused === field ? "rgba(37,99,235,0.45)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: "14px",
    padding: "13px 16px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease",
    boxShadow: focused === field ? "0 0 0 3px rgba(37,99,235,0.1)" : "none",
  };
}

export default function ContactPage() {
  const [heroRef, heroV] = useInView(0.1);
  const [formRef, formV] = useInView(0.08);
  const [faqRef, faqV]   = useInView(0.08);

  const [form, setForm]         = useState({ name: "", email: "", subject: "", message: "" });
  const [focused, setFocused]   = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [openFaq, setOpenFaq]   = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubmitted(true); }, 1500);
  }

  return (
    <div className="bg-[#0d1117] min-h-screen">

      {/* ── HERO ── */}
      <section className="relative pt-36 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB]/40 to-transparent" />
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/7 rounded-full blur-[140px]" />
          <div className="absolute inset-0 opacity-[0.1]"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>

        <div ref={heroRef} className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-700"
          style={{ opacity: heroV ? 1 : 0, transform: heroV ? "translateY(0)" : "translateY(32px)" }}>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-8">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-gray-300">Contact</span>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", color: "#93C5FD" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Online — replies within 1 hour
          </div>

          <h1 className="text-white leading-tight mb-6">
            We Would Love to{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
              Hear From You
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            Have a question, need a demo, or want to talk about your business needs?
            Drop us a message — we are here to help.
          </p>
        </div>
      </section>

      {/* ── INFO CARDS ── */}
      <section className="relative py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {contactInfo.map((info, i) => (
              <InfoCard key={info.label} info={info} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM + SIDEBAR ── */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] bg-blue-600/4 rounded-full blur-[130px]" />
          <div className="absolute bottom-1/3 -right-40 w-[400px] h-[400px] bg-amber-500/4 rounded-full blur-[130px]" />
        </div>

        <div ref={formRef} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-8 items-start">

            {/* Sidebar */}
            <div className="lg:col-span-2 flex flex-col gap-5 transition-all duration-700"
              style={{ opacity: formV ? 1 : 0, transform: formV ? "translateX(0)" : "translateX(-28px)", transitionDelay: "100ms" }}>

              <div className="rounded-3xl p-6" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-white font-bold text-xl mb-2">Let us talk</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">
                  Whether you are a new user, existing customer, or just curious — we are one message away.
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 text-xs font-semibold">Typically replies in under 1 hour</span>
                </div>
              </div>

              {/* quick options */}
              {[
                { icon: "🎯", title: "Book a Demo",    desc: "See Novexa live in 20 minutes.", action: "Schedule via WhatsApp", href: "https://wa.me/923001234567", color: "#F59E0B", bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.25)" },
                { icon: "🛠️", title: "Technical Help", desc: "Issue with the platform? We fix fast.", action: "Email support", href: "mailto:support@novexa.com", color: "#2563EB", bg: "rgba(37,99,235,0.07)", border: "rgba(37,99,235,0.25)" },
                { icon: "💼", title: "Sales Enquiry",  desc: "Pricing, plans, custom deals.", action: "Start conversation", href: "mailto:sales@novexa.com", color: "#F59E0B", bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.25)" },
              ].map((opt) => (
                <a key={opt.title} href={opt.href} target="_blank" rel="noopener noreferrer"
                  className="group relative rounded-2xl p-5 overflow-hidden transition-all duration-300 block no-underline"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = opt.bg; e.currentTarget.style.borderColor = opt.border; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 10px 30px ${opt.bg}`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opt.icon}</span>
                    <div className="flex-1">
                      <p className="text-white font-semibold text-sm">{opt.title}</p>
                      <p className="text-gray-500 text-xs">{opt.desc}</p>
                    </div>
                    <span className="text-sm font-semibold transition-all duration-300 group-hover:translate-x-1" style={{ color: opt.color }}>→</span>
                  </div>
                  <p className="text-xs mt-2 font-medium" style={{ color: opt.color }}>{opt.action}</p>
                </a>
              ))}
            </div>

            {/* Form */}
            <div className="lg:col-span-3 transition-all duration-700"
              style={{ opacity: formV ? 1 : 0, transform: formV ? "translateX(0)" : "translateX(28px)", transitionDelay: "200ms" }}>
              <div className="relative rounded-3xl overflow-hidden p-8 md:p-10"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: "linear-gradient(to right, transparent, rgba(37,99,235,0.6), rgba(245,158,11,0.4), transparent)" }} />

                {submitted ? (
                  <SuccessState />
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <h3 className="text-white font-bold text-xl mb-1">Send us a Message</h3>
                    <p className="text-gray-500 text-sm mb-2">Fill out the form and we will get back to you within 24 hours.</p>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">Your Name</label>
                        <input type="text" name="name" required placeholder="Ahmed Raza"
                          value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                          onFocus={() => setFocused("name")} onBlur={() => setFocused(null)}
                          style={inputStyle(focused, "name")} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">Email Address</label>
                        <input type="email" name="email" required placeholder="you@example.com"
                          value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                          onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                          style={inputStyle(focused, "email")} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">Subject</label>
                      <select name="subject" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}
                        onFocus={() => setFocused("subject")} onBlur={() => setFocused(null)}
                        style={{ ...inputStyle(focused, "subject"), cursor: "pointer" }}>
                        <option value="" style={{ background: "#0d1117" }}>Select a subject</option>
                        {["General Enquiry", "Book a Demo", "Technical Support", "Sales / Pricing", "Partnership", "Other"].map(s => (
                          <option key={s} value={s} style={{ background: "#0d1117" }}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">Message</label>
                      <textarea name="message" required rows={5} placeholder="Tell us how we can help..."
                        value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                        onFocus={() => setFocused("message")} onBlur={() => setFocused(null)}
                        style={{ ...inputStyle(focused, "message"), resize: "none" }} />
                    </div>

                    <button type="submit" disabled={loading} className="btn-primary w-full justify-center"
                      style={{ opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" className="opacity-25" />
                            <path fill="white" d="M4 12a8 8 0 018-8v8z" className="opacity-75" />
                          </svg>
                          Sending...
                        </span>
                      ) : "Send Message →"}
                    </button>

                    <p className="text-center text-gray-600 text-xs">🔒 We never share your data. Ever.</p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="relative py-16 overflow-hidden">
        <div ref={faqRef} className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
          style={{ opacity: faqV ? 1 : 0, transform: faqV ? "translateY(0)" : "translateY(28px)" }}>
          <div className="text-center mb-12">
            <h2 className="text-white leading-tight mb-4">
              Quick{" "}
              <span className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
                Answers
              </span>
            </h2>
            <p className="text-gray-400">Common questions about getting in touch.</p>
          </div>
          <div className="flex flex-col gap-3">
            {faqs.map((faq, i) => (
              <div key={i}
                className="rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
                style={{ background: openFaq === i ? "rgba(37,99,235,0.07)" : "rgba(255,255,255,0.025)", border: `1px solid ${openFaq === i ? "rgba(37,99,235,0.35)" : "rgba(255,255,255,0.07)"}` }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <div className="flex items-center justify-between p-5">
                  <span className="text-sm font-semibold" style={{ color: openFaq === i ? "#fff" : "#d1d5db" }}>{faq.q}</span>
                  <span className="text-lg ml-4 flex-shrink-0 transition-transform duration-300"
                    style={{ color: "#2563EB", transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
                </div>
                {openFaq === i && (
                  <div className="px-5 pb-5">
                    <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

function InfoCard({ info, index }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a href={info.href} target={info.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
      className="relative rounded-2xl p-5 overflow-hidden transition-all duration-400 block no-underline cursor-pointer"
      style={{ background: hovered ? info.bg : "rgba(255,255,255,0.025)", border: `1px solid ${hovered ? info.border : "rgba(255,255,255,0.07)"}`, boxShadow: hovered ? `0 12px 35px ${info.glow}` : "none", transform: hovered ? "translateY(-4px)" : "translateY(0)" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-all duration-400"
          style={{ background: hovered ? info.bg : "rgba(255,255,255,0.04)", border: `1.5px solid ${hovered ? info.border : "rgba(255,255,255,0.07)"}`, boxShadow: hovered ? `0 0 18px ${info.glow}` : "none", transform: hovered ? "scale(1.1) rotate(-4deg)" : "scale(1)" }}>
          {info.icon}
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5 transition-colors duration-300" style={{ color: hovered ? info.color : "#6b7280" }}>{info.label}</p>
          <p className="text-sm font-semibold text-white truncate">{info.value}</p>
          <p className="text-xs text-gray-600">{info.sub}</p>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl transition-all duration-500"
        style={{ background: `linear-gradient(to right, transparent, ${info.color}, transparent)`, opacity: hovered ? 1 : 0, transform: hovered ? "scaleX(1)" : "scaleX(0)" }} />
    </a>
  );
}

function SuccessState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
        style={{ background: "rgba(37,99,235,0.12)", border: "1.5px solid rgba(37,99,235,0.4)", boxShadow: "0 0 40px rgba(37,99,235,0.2)" }}>
        ✅
      </div>
      <h3 className="text-white font-bold text-2xl">Message Sent!</h3>
      <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
        Thank you for reaching out. Our team will get back to you within 24 hours.
      </p>
      <div className="flex items-center gap-2 mt-1">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-emerald-400 text-xs font-semibold">We will be in touch soon</span>
      </div>
    </div>
  );
}
