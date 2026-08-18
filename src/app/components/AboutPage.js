"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

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

const stats = [
  { value: "500+",  label: "Businesses Onboard",    icon: "🏢", color: "#2563EB" },
  { value: "1M+",   label: "Invoices Generated",    icon: "🧾", color: "#F59E0B" },
  { value: "8+",    label: "Core Modules",           icon: "🔧", color: "#2563EB" },
  { value: "99.9%", label: "Uptime Guaranteed",      icon: "⚡", color: "#F59E0B" },
  { value: "24/7",  label: "Customer Support",       icon: "🛡️", color: "#2563EB" },
  { value: "5 min", label: "Average Setup Time",     icon: "⏱️", color: "#F59E0B" },
];

const values = [
  { icon: "🎯", title: "Simplicity First",      desc: "Every feature is built to be used — not just to exist. If it is not simple, we rebuild it.", color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.3)" },
  { icon: "🚀", title: "Speed Matters",          desc: "Your time is your money. Novexa does in seconds what used to take hours.", color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)" },
  { icon: "🔒", title: "Trust & Security",       desc: "Your data belongs to you. Bank-level encryption and daily backups — always.", color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.3)" },
  { icon: "🤝", title: "Customer Obsession",     desc: "We build what our customers need, not what looks good on a features page.", color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)" },
  { icon: "📈", title: "Constant Improvement",   desc: "We ship updates every week. If something can be better, we make it better.", color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.3)" },
  { icon: "🌍", title: "Built for Everyone",     desc: "From a 2-person shop to a 200-person enterprise — Novexa scales with you.", color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)" },
];

export default function AboutPage() {
  const [heroRef, heroV] = useInView(0.1);

  return (
    <div className="bg-[#0d1117] min-h-screen">

      {/* ── HERO ── */}
      <section className="relative pt-36 pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB]/40 to-transparent" />
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/7 rounded-full blur-[140px]" />
          <div className="absolute top-28 left-1/5 w-72 h-72 bg-amber-500/5 rounded-full blur-[110px]" />
          <div className="absolute inset-0 opacity-[0.1]"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>

        <div ref={heroRef} className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-700"
          style={{ opacity: heroV ? 1 : 0, transform: heroV ? "translateY(0)" : "translateY(32px)" }}>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-8">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-gray-300">About</span>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", color: "#93C5FD" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Our Story
          </div>

          <h1 className="text-white leading-tight mb-6">
            Built by Business Owners,{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
              For Business Owners
            </span>
          </h1>

          <p className="text-gray-200 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto mb-10">
            We started Novexa because we were tired of watching great businesses fail due to paperwork,
            missed payments, and spreadsheet chaos. We built the tool we always wished existed.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button className="btn-primary">Start Free Trial →</button>
            <Link href="/contact" className="btn-secondary">Talk to Us →</Link>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <StatsSection />

      {/* ── MISSION + VISION ── */}
      <MissionSection />

      {/* ── VALUES ── */}
      <ValuesSection />

      {/* ── TIMELINE ── */}
      <TimelineSection />

      {/* ── CODEVERZA ── */}
      <CodeVerzaSection />

      {/* ── CTA ── */}
      <AboutCta />
    </div>
  );
}

// ── Stats ────────────────────────────────────────────────────────────────────
function StatsSection() {
  const [ref, v] = useInView(0.1);
  return (
    <section className="relative py-16">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
        style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(24px)" }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map((s, i) => (
            <div key={s.label}
              className="relative rounded-2xl p-5 text-center cursor-default transition-all duration-400 overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                opacity: v ? 1 : 0,
                transform: v ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.5s ease ${i * 80}ms, transform 0.5s ease ${i * 80}ms`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = s.color === "#2563EB" ? "rgba(37,99,235,0.08)" : "rgba(245,158,11,0.08)";
                e.currentTarget.style.borderColor = s.color === "#2563EB" ? "rgba(37,99,235,0.35)" : "rgba(245,158,11,0.35)";
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = s.color === "#2563EB" ? "0 10px 30px rgba(37,99,235,0.2)" : "0 10px 30px rgba(245,158,11,0.18)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.025)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}>
              <span className="text-2xl mb-2 block">{s.icon}</span>
              <span className="text-3xl font-black block mb-1 bg-clip-text text-transparent"
                style={{ backgroundImage: s.color === "#2563EB" ? "linear-gradient(135deg,#2563EB,#60A5FA)" : "linear-gradient(135deg,#F59E0B,#FCD34D)" }}>
                {s.value}
              </span>
              <span className="text-xs text-gray-500 font-medium leading-tight block">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Mission + Vision ─────────────────────────────────────────────────────────
function MissionSection() {
  const [ref, v] = useInView(0.1);
  const cards = [
    { icon: "🏢", title: "What We Do", color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.3)",
      text: "Novexa ERP gives small and medium businesses a complete digital toolkit. From invoicing to HR, inventory to analytics — one platform handles it all. No juggling five different tools." },
    { icon: "🎯", title: "Our Mission", color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)",
      text: "To put powerful, enterprise-grade business software in the hands of every SME owner — at a price that makes sense, with a setup that takes minutes, not months." },
    { icon: "🔭", title: "Our Vision", color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.3)",
      text: "A world where every business, regardless of size, runs on smart digital systems. Where no sale is missed, no payment is forgotten, and no inventory is a mystery." },
  ];

  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[130px]" />
      </div>
      <div ref={ref} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
        style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(28px)" }}>
        <div className="text-center mb-14">
          <h2 className="text-white leading-tight mb-4">
            Why We{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
              Built Novexa
            </span>
          </h2>
          <p className="text-gray-200 text-lg max-w-2xl mx-auto">
            Every line of code has a reason. Here is what drives us.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((c, i) => (
            <div key={c.title}
              className="relative rounded-3xl p-7 overflow-hidden cursor-default transition-all duration-400"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                opacity: v ? 1 : 0,
                transform: v ? "translateY(0)" : "translateY(28px)",
                transition: `opacity 0.6s ease ${i * 120}ms, transform 0.6s ease ${i * 120}ms`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = c.bg;
                e.currentTarget.style.borderColor = c.border;
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow = `0 16px 50px ${c.bg}`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.025)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}>
              <span className="absolute -bottom-4 -right-4 text-[90px] opacity-[0.04] select-none pointer-events-none">{c.icon}</span>
              <div className="w-13 h-13 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-5"
                style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                {c.icon}
              </div>
              <h3 className="text-white font-bold text-xl mb-3">{c.title}</h3>
              <p className="text-gray-200 text-sm leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Values ───────────────────────────────────────────────────────────────────
function ValuesSection() {
  const [ref, v] = useInView(0.1);
  return (
    <section className="relative py-20 overflow-hidden">
      <div ref={ref} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
        style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(28px)" }}>
        <div className="text-center mb-14">
          <h2 className="text-white leading-tight mb-4">
            What We{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
              Stand For
            </span>
          </h2>
          <p className="text-gray-200 text-lg max-w-xl mx-auto">Our values guide every decision we make.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {values.map((val, i) => (
            <div key={val.title}
              className="relative rounded-3xl overflow-hidden cursor-default transition-all duration-400"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                opacity: v ? 1 : 0,
                transform: v ? "translateY(0)" : "translateY(32px)",
                transition: `opacity 0.6s ease ${i * 90}ms, transform 0.6s ease ${i * 90}ms`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = val.bg;
                e.currentTarget.style.borderColor = val.border;
                e.currentTarget.style.transform = "translateY(-5px)";
                e.currentTarget.style.boxShadow = `0 14px 40px ${val.bg}`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.025)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}>
              <div className="h-0.5" style={{ background: `linear-gradient(to right, ${val.color}50, transparent)` }} />
              <div className="p-6">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                  style={{ background: val.bg, border: `1px solid ${val.border}` }}>
                  {val.icon}
                </div>
                <h4 className="text-white font-bold text-base mb-2">{val.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{val.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── What Makes Novexa Different ──────────────────────────────────────────────
function TimelineSection() {
  const [ref, v]   = useInView(0.06);
  const [hov, setHov] = useState(null);

  const FEATURES = [
    {
      icon: "⚡",
      title: "Everything in One Place",
      desc: "Invoices, inventory, customers, payments, suppliers, analytics, HR — one login, one dashboard, zero chaos.",
      wide: true,
    },
    {
      icon: "�",
      title: "Your Data, Your Control",
      desc: "End-to-end encrypted. Daily backups. We never share or sell your business data.",
      wide: false,
    },
    {
      icon: "📱",
      title: "Works on Any Device",
      desc: "Phone, tablet, or desktop — Novexa adapts perfectly to your screen, anywhere you are.",
      wide: false,
    },
    {
      icon: "�",
      title: "5-Minute Setup",
      desc: "No IT team needed. No month-long onboarding. Sign up, add your products, and start invoicing — today.",
      wide: false,
    },
    {
      icon: "📊",
      title: "Real-Time Analytics",
      desc: "See exactly how your business is performing right now — sales, balances, top customers, and trends at a glance.",
      wide: false,
    },
    {
      icon: "🤝",
      title: "Built Around You",
      desc: "Every feature in Novexa was built because a real business owner asked for it. We listen, then we build.",
      wide: true,
    },
  ];

  return (
    <section className="relative py-24 overflow-hidden">
      {/* bg */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-600/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/15 to-transparent" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[160px]"
          style={{ background: "rgba(37,99,235,0.05)" }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[130px]"
          style={{ background: "rgba(245,158,11,0.04)" }} />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      <div ref={ref} className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
        style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(32px)" }}>

        {/* heading */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-5 tracking-widest uppercase"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#93C5FD" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Why Novexa
          </div>
          <h2 className="text-white font-black leading-tight mb-4">
            What Makes Us{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
              Different
            </span>
          </h2>
          <p className="text-gray-200 text-lg max-w-2xl mx-auto leading-relaxed">
            Novexa is not just another ERP. It is the software your business actually deserves.
          </p>
        </div>

        {/* bento grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => {
            const isBlue = i % 2 === 0;
            const isHov  = hov === i;
            return (
              <div key={i}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
                className="relative rounded-2xl p-6 cursor-default transition-all duration-300 overflow-hidden"
                style={{
                  background: isHov
                    ? isBlue ? "rgba(37,99,235,0.09)" : "rgba(245,158,11,0.07)"
                    : "rgba(255,255,255,0.025)",
                  border: `1px solid ${isHov
                    ? isBlue ? "rgba(37,99,235,0.35)" : "rgba(245,158,11,0.35)"
                    : "rgba(255,255,255,0.07)"}`,
                  transform: isHov ? "translateY(-5px)" : "translateY(0)",
                  boxShadow: isHov
                    ? isBlue ? "0 20px 48px rgba(37,99,235,0.15)" : "0 20px 48px rgba(245,158,11,0.12)"
                    : "none",
                  gridColumn: f.wide ? "span 1 / span 1" : undefined,
                  transitionDelay: `${i * 30}ms`,
                }}>

                {/* corner glow on hover */}
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: isBlue ? "rgba(37,99,235,0.25)" : "rgba(245,158,11,0.2)",
                    opacity: isHov ? 1 : 0,
                  }} />

                {/* top accent line */}
                <div className="absolute top-0 left-6 right-6 h-px transition-opacity duration-300"
                  style={{
                    background: isBlue
                      ? "linear-gradient(90deg,transparent,rgba(37,99,235,0.6),transparent)"
                      : "linear-gradient(90deg,transparent,rgba(245,158,11,0.5),transparent)",
                    opacity: isHov ? 1 : 0,
                  }} />

                <div className="relative z-10">
                  {/* icon */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5 transition-transform duration-300"
                    style={{
                      background: isBlue ? "rgba(37,99,235,0.1)" : "rgba(245,158,11,0.1)",
                      border: `1px solid ${isBlue ? "rgba(37,99,235,0.25)" : "rgba(245,158,11,0.25)"}`,
                      transform: isHov ? "scale(1.1) rotate(-4deg)" : "scale(1) rotate(0deg)",
                    }}>
                    {f.icon}
                  </div>

                  {/* title */}
                  <h4 className="text-white font-black text-base mb-2 leading-snug">{f.title}</h4>

                  {/* desc */}
                  <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>

                  {/* bottom arrow on hover */}
                  <div className="mt-4 flex items-center gap-1.5 transition-all duration-300"
                    style={{ opacity: isHov ? 1 : 0, transform: isHov ? "translateX(0)" : "translateX(-8px)" }}>
                    <span className="text-xs font-bold"
                      style={{ color: isBlue ? "#60a5fa" : "#fbbf24" }}>Learn more</span>
                    <span className="text-xs" style={{ color: isBlue ? "#60a5fa" : "#fbbf24" }}>→</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* bottom strip */}
        <div className="mt-10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6">
            {[
              { val: "500+",   lbl: "Businesses",   blue: true  },
              { val: "1M+",    lbl: "Invoices",      blue: false },
              { val: "8+",     lbl: "Modules",       blue: true  },
              { val: "99.9%",  lbl: "Uptime",        blue: false },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="font-black text-xl leading-none mb-0.5"
                  style={{ color: s.blue ? "#60a5fa" : "#fbbf24" }}>{s.val}</p>
                <p className="text-gray-600 text-[11px] uppercase tracking-widest font-bold">{s.lbl}</p>
              </div>
            ))}
          </div>
          <div className="h-px sm:h-10 w-full sm:w-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <p className="text-gray-500 text-sm text-center sm:text-right max-w-xs">
            Join <span className="text-white font-semibold">500+ businesses</span> that switched to Novexa and never looked back.
          </p>
        </div>

      </div>
    </section>
  );
}

// ── Codeverza Section ─────────────────────────────────────────────────────────
const CC_SERVICES = [
  { icon: "🌐", title: "Web Development",      desc: "High-performance, scalable web applications built with modern frameworks and clean architecture.", color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.25)" },
  { icon: "📱", title: "App Development",       desc: "Native and cross-platform mobile apps that deliver seamless experiences on iOS and Android.", color: "#8B5CF6", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.25)" },
  { icon: "🎨", title: "UI/UX & Web Design",    desc: "Pixel-perfect interfaces and immersive user experiences — designed to convert and delight.", color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" },
  { icon: "✨", title: "Animation",             desc: "Motion design and interactive animations that bring your digital presence to life.", color: "#EC4899", bg: "rgba(236,72,153,0.08)", border: "rgba(236,72,153,0.25)" },
  { icon: "📣", title: "Digital Marketing",     desc: "Data-driven campaigns, SEO, and social media strategies that grow your brand and revenue.", color: "#10B981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)" },
  { icon: "🖌️", title: "Graphic Designing",     desc: "Brand identities, logos, and visual assets that make a lasting impression.", color: "#F97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.25)" },
];

const CC_SOFTWARE = [
  { icon: "🏭", name: "ERP System",               desc: "Complete enterprise resource planning — like Novexa.", tag: "Rent · Sell" },
  { icon: "🎓", name: "LMS",                       desc: "Learning Management System for schools and training centers.", tag: "Rent · Sell" },
  { icon: "🏫", name: "School Management",         desc: "Full school operations: admissions, fees, grades & more.", tag: "Rent · Sell" },
  { icon: "💪", name: "Gym Management",            desc: "Member tracking, billing, attendance and trainer management.", tag: "Rent · Sell" },
  { icon: "🏥", name: "Hospital / Clinic",         desc: "Patient records, appointments, prescriptions & billing.", tag: "Rent · Sell" },
  { icon: "⚙️", name: "Custom Software",           desc: "Tailored software solutions built specifically for your business needs.", tag: "Custom Build" },
];

function CodeVerzaSection() {
  const [ref, v]       = useInView(0.06);
  const [sRef, sV]     = useInView(0.06);
  const [swRef, swV]   = useInView(0.06);
  const [hovered, setHovered] = useState(null);

  return (
    <section className="relative py-24 overflow-hidden">
      {/* background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB]/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F59E0B]/20 to-transparent" />
        <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/3 right-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div ref={ref} className="text-center mb-20 transition-all duration-700"
          style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(32px)" }}>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6 tracking-widest uppercase"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", color: "#93C5FD" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Powered By
          </div>

          {/* Logo + name */}
          <div className="flex flex-col items-center gap-5 mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl blur-2xl opacity-40"
                style={{ background: "linear-gradient(135deg,#2563EB,#F59E0B)" }} />
              <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <Image src="/images/codeverza-logo.png" alt="Codeverza Logo" width={100} height={100}
                  className="object-contain" style={{ filter: "drop-shadow(0 0 12px rgba(37,99,235,0.5))" }} />
              </div>
            </div>
            <div>
              <h2 className="text-white font-black leading-tight mb-2">
                Novexa is a Project of{" "}
                <span className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 40%, #F59E0B)" }}>
                  Codeverza
                </span>
              </h2>
              <p className="text-gray-200 text-lg max-w-3xl mx-auto leading-relaxed">
                codeverza is a full-spectrum software solutions company — building, renting, and selling
                digital products that empower businesses of every size.
              </p>
            </div>
          </div>

          {/* Tagline badges */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { label: "Web & App Development", color: "#2563EB" },
              { label: "UI/UX Design",           color: "#8B5CF6" },
              { label: "Digital Marketing",       color: "#10B981" },
              { label: "Software Rent & Sales",   color: "#F59E0B" },
              { label: "Custom Software",         color: "#EC4899" },
            ].map((b, i) => (
              <span key={i} className="px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: `${b.color}18`, border: `1px solid ${b.color}50`, color: b.color }}>
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── What codeverza Provides ── */}
        <div ref={sRef} className="mb-20 transition-all duration-700"
          style={{ opacity: sV ? 1 : 0, transform: sV ? "translateY(0)" : "translateY(28px)" }}>

          <div className="text-center mb-10">
            <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: "#F59E0B" }}>Services</p>
            <h3 className="text-white font-black text-2xl md:text-3xl">Everything Your Business Needs</h3>
            <p className="text-gray-500 text-sm mt-2 max-w-xl mx-auto">From concept to launch — design, development, marketing, and beyond.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CC_SERVICES.map((s, i) => (
              <div key={i}
                onMouseEnter={() => setHovered(`svc-${i}`)}
                onMouseLeave={() => setHovered(null)}
                className="group relative rounded-2xl p-6 cursor-default transition-all duration-300"
                style={{
                  background: hovered === `svc-${i}` ? s.bg : "rgba(255,255,255,0.02)",
                  border: `1px solid ${hovered === `svc-${i}` ? s.border : "rgba(255,255,255,0.07)"}`,
                  transform: hovered === `svc-${i}` ? "translateY(-4px)" : "translateY(0)",
                  boxShadow: hovered === `svc-${i}` ? `0 16px 40px ${s.color}18` : "none",
                  transitionDelay: `${i * 40}ms`,
                }}>
                {/* animated corner accent */}
                <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(225deg, ${s.color}20, transparent)` }} />
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                    style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-white font-black text-sm mb-1.5">{s.title}</p>
                    <p className="text-gray-500 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Software Products ── */}
        <div ref={swRef} className="transition-all duration-700"
          style={{ opacity: swV ? 1 : 0, transform: swV ? "translateY(0)" : "translateY(28px)" }}>

          <div className="text-center mb-10">
            <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: "#2563EB" }}>Software Products</p>
            <h3 className="text-white font-black text-2xl md:text-3xl">Ready-Made Software — Rent or Own</h3>
            <p className="text-gray-500 text-sm mt-2 max-w-xl mx-auto">Battle-tested software solutions available to rent or purchase outright for your business.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {CC_SOFTWARE.map((sw, i) => (
              <div key={i}
                onMouseEnter={() => setHovered(`sw-${i}`)}
                onMouseLeave={() => setHovered(null)}
                className="relative rounded-2xl p-5 transition-all duration-300"
                style={{
                  background: hovered === `sw-${i}` ? "rgba(37,99,235,0.07)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${hovered === `sw-${i}` ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.07)"}`,
                  transform: hovered === `sw-${i}` ? "translateY(-3px)" : "translateY(0)",
                  boxShadow: hovered === `sw-${i}` ? "0 12px 32px rgba(37,99,235,0.12)" : "none",
                  transitionDelay: `${i * 40}ms`,
                }}>
                <div className="flex items-start gap-4">
                  <div className="text-3xl flex-shrink-0 transition-transform duration-300"
                    style={{ transform: hovered === `sw-${i}` ? "scale(1.15)" : "scale(1)" }}>
                    {sw.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-white font-black text-sm">{sw.name}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" }}>
                        {sw.tag}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs leading-relaxed">{sw.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA banner */}
          <div className="relative rounded-2xl overflow-hidden p-8 text-center"
            style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(13,17,23,0.95), rgba(245,158,11,0.08))", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="absolute top-0 left-0 w-48 h-48 rounded-full blur-[80px] pointer-events-none" style={{ background: "rgba(37,99,235,0.18)" }} />
            <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full blur-[80px] pointer-events-none" style={{ background: "rgba(245,158,11,0.14)" }} />
            {/* animated dots */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
              style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Image src="/images/codeverza-logo.png" alt="codeverza" width={56} height={56} className="object-contain w-full h-full" />
              </div>
              <div>
                <p className="text-white font-black text-xl mb-1">
                  Have a project in mind?
                </p>
                <p className="text-gray-200 text-sm max-w-md mx-auto">
                  Whether you need a website, a mobile app, a full ERP, or a custom software solution —
                  <span className="text-blue-400 font-semibold"> codeverza </span>
                  has you covered.
                </p>
              </div>
              <a href="https://codeverza.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", color: "#fff", boxShadow: "0 8px 24px rgba(37,99,235,0.35)" }}>
                Visit codeverza →
              </a>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

// ── About CTA ─────────────────────────────────────────────────────────────────
function AboutCta() {
  const [ref, v] = useInView(0.1);
  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F59E0B]/25 to-transparent" />
      <div ref={ref} className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
        style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(28px)" }}>
        <div className="relative rounded-3xl overflow-hidden p-10 md:p-16 text-center"
          style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(13,17,23,0.97) 50%, rgba(245,158,11,0.1) 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="absolute top-0 left-0 w-56 h-56 rounded-full blur-[100px] pointer-events-none" style={{ background: "rgba(37,99,235,0.2)" }} />
          <div className="absolute bottom-0 right-0 w-56 h-56 rounded-full blur-[100px] pointer-events-none" style={{ background: "rgba(245,158,11,0.16)" }} />
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          <div className="relative z-10">
            <h2 className="text-white leading-tight mb-4">
              Join the{" "}
              <span className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
                Novexa Family
              </span>
            </h2>
            <p className="text-gray-200 text-lg mb-8 max-w-2xl mx-auto">
              500+ businesses already trust Novexa to run their operations. Start your free trial today — no credit card needed.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
              <button className="btn-primary">Start Free Trial →</button>
              <Link href="/contact" className="btn-secondary">Contact Us →</Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              {["✓ Free to start", "✓ No credit card", "✓ Setup in 5 minutes", "✓ 24/7 support"].map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
