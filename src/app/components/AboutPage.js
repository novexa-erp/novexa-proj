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

const timeline = [
  { year: "2021", title: "The Idea",        desc: "Founded after seeing small businesses struggle with paper invoices and Excel chaos.", color: "#2563EB" },
  { year: "2022", title: "First Version",   desc: "Launched MVP with invoicing and customer management. 50 businesses signed up in week one.", color: "#F59E0B" },
  { year: "2023", title: "Growth",          desc: "Added inventory, payments, and analytics. Crossed 200 active businesses.", color: "#2563EB" },
  { year: "2024", title: "Scale",           desc: "HR, procurement, and multi-branch modules launched. 500+ businesses onboard.", color: "#F59E0B" },
  { year: "2025", title: "Today & Beyond",  desc: "Continuing to build the most complete ERP for SMEs — faster, smarter, simpler.", color: "#2563EB" },
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

          <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto mb-10">
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
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
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
              <p className="text-gray-400 text-sm leading-relaxed">{c.text}</p>
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
          <p className="text-gray-400 text-lg max-w-xl mx-auto">Our values guide every decision we make.</p>
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

// ── Timeline ─────────────────────────────────────────────────────────────────
function TimelineSection() {
  const [ref, v] = useInView(0.08);
  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-600/4 rounded-full blur-[120px]" />
      </div>
      <div ref={ref} className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
        style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(28px)" }}>
        <div className="text-center mb-14">
          <h2 className="text-white leading-tight mb-4">
            Our{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
              Journey
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">From idea to 500+ businesses — here is how we got here.</p>
        </div>

        <div className="relative">
          {/* vertical line */}
          <div className="absolute left-[19px] sm:left-1/2 sm:-translate-x-px top-0 bottom-0 w-px"
            style={{ background: "linear-gradient(to bottom, #2563EB40, #F59E0B40, #2563EB40)" }} />

          <div className="flex flex-col gap-8">
            {timeline.map((item, i) => {
              const isRight = i % 2 === 0;
              return (
                <div key={item.year}
                  className="relative flex items-start gap-4 sm:gap-0"
                  style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(20px)", transition: `opacity 0.6s ease ${i * 130}ms, transform 0.6s ease ${i * 130}ms` }}>

                  {/* dot — mobile always left, desktop center */}
                  <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center sm:absolute sm:left-1/2 sm:-translate-x-1/2"
                    style={{ background: item.color === "#2563EB" ? "rgba(37,99,235,0.15)" : "rgba(245,158,11,0.15)", border: `2px solid ${item.color}`, boxShadow: `0 0 16px ${item.color}50` }}>
                    <span className="text-[10px] font-black" style={{ color: item.color }}>{item.year.slice(2)}</span>
                  </div>

                  {/* content */}
                  <div className={`flex-1 sm:w-[calc(50%-32px)] ${isRight ? "sm:ml-auto sm:pr-0 sm:pl-8" : "sm:mr-auto sm:pl-0 sm:pr-8 sm:text-right"}`}>
                    <div className="rounded-2xl p-5 transition-all duration-300 cursor-default"
                      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = item.color === "#2563EB" ? "rgba(37,99,235,0.07)" : "rgba(245,158,11,0.07)";
                        e.currentTarget.style.borderColor = item.color === "#2563EB" ? "rgba(37,99,235,0.3)" : "rgba(245,158,11,0.3)";
                        e.currentTarget.style.transform = "translateY(-3px)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.025)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}>
                      <span className="text-xs font-bold tracking-widest uppercase mb-1 block" style={{ color: item.color }}>{item.year}</span>
                      <h4 className="text-white font-bold text-base mb-1">{item.title}</h4>
                      <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
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
            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
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
