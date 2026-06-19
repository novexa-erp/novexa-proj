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

const pillars = [
  {
    icon: "🔐", title: "Encryption",
    color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.35)", glow: "rgba(37,99,235,0.25)",
    points: ["TLS 1.3 for all data in transit", "AES-256 encryption at rest", "Encrypted database backups", "End-to-end for sensitive fields"],
  },
  {
    icon: "🛡️", title: "Access Control",
    color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.35)", glow: "rgba(245,158,11,0.25)",
    points: ["Role-based permissions", "Multi-factor authentication", "Session & device management", "IP allowlisting (Enterprise)"],
  },
  {
    icon: "🗄️", title: "Data Backup",
    color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.35)", glow: "rgba(37,99,235,0.25)",
    points: ["Automated daily backups", "30-day retention window", "Geo-redundant storage", "One-click data restore"],
  },
  {
    icon: "👁️", title: "Monitoring",
    color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.35)", glow: "rgba(245,158,11,0.25)",
    points: ["24/7 infrastructure monitoring", "Real-time threat detection", "Full audit trail logs", "Anomaly alerts"],
  },
  {
    icon: "🏢", title: "Infrastructure",
    color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.35)", glow: "rgba(37,99,235,0.25)",
    points: ["Tier-1 cloud data centers", "99.9% uptime SLA", "Auto-scaling architecture", "DDoS protection"],
  },
  {
    icon: "📋", title: "Compliance",
    color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.35)", glow: "rgba(245,158,11,0.25)",
    points: ["GDPR compliant", "Data residency options", "Regular third-party audits", "Vulnerability disclosure program"],
  },
];

const certBadges = [
  { icon: "🔒", label: "SSL / TLS 1.3",       color: "#2563EB" },
  { icon: "🛡️", label: "AES-256 Encrypted",   color: "#F59E0B" },
  { icon: "☁️", label: "Cloud Secured",        color: "#2563EB" },
  { icon: "🔁", label: "Daily Backups",        color: "#F59E0B" },
  { icon: "✅", label: "GDPR Compliant",       color: "#2563EB" },
  { icon: "⚡", label: "99.9% Uptime SLA",     color: "#F59E0B" },
];

const faqs = [
  { q: "Who can access my business data?", a: "Only you and the team members you explicitly invite can access your data. Novexa staff cannot read your invoices, customers, or financial records." },
  { q: "What happens if I delete my account?", a: "All your data is permanently deleted within 30 days. Backups are purged within 60 days. This action is irreversible." },
  { q: "Is my data backed up?", a: "Yes — automatic daily backups with 30-day retention. You can also export all your data anytime from the dashboard." },
  { q: "Do you use two-factor authentication?", a: "Yes. You can enable 2FA from your account settings using any authenticator app (Google Authenticator, Authy, etc.)." },
  { q: "Where is my data stored?", a: "Data is stored on Tier-1 cloud infrastructure with geo-redundant storage. Enterprise customers can request specific data residency options." },
  { q: "How do you handle security vulnerabilities?", a: "We have a responsible disclosure program. If you find a vulnerability, report it to security@novexa.com and we will respond within 48 hours." },
];

export default function SecurityPage() {
  const [heroRef, heroV] = useInView(0.1);
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="bg-[#0d1117] min-h-screen">

      {/* ── HERO ── */}
      <section className="relative pt-36 pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB]/40 to-transparent" />
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/7 rounded-full blur-[140px]" />
          <div className="absolute top-28 left-1/4 w-72 h-72 bg-amber-500/5 rounded-full blur-[110px]" />
          <div className="absolute inset-0 opacity-[0.1]"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>

        <div ref={heroRef} className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-700"
          style={{ opacity: heroV ? 1 : 0, transform: heroV ? "translateY(0)" : "translateY(32px)" }}>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-8">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-gray-300">Security</span>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", color: "#93C5FD" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Enterprise-Grade Security
          </div>

          <h1 className="text-white leading-tight mb-6">
            Your Data is{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
              Safe With Us
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto mb-10">
            We take security seriously — not as a checkbox, but as a core part of everything we build.
            Here is exactly how we protect your business data.
          </p>

          {/* cert badges */}
          <div className="flex flex-wrap justify-center gap-3">
            {certBadges.map((b) => (
              <div key={b.label}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                style={{ background: b.color === "#2563EB" ? "rgba(37,99,235,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${b.color === "#2563EB" ? "rgba(37,99,235,0.3)" : "rgba(245,158,11,0.3)"}`, color: b.color === "#2563EB" ? "#93C5FD" : "#FCD34D" }}>
                <span>{b.icon}</span>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY PILLARS ── */}
      <SecurityPillars />

      {/* ── HOW IT WORKS STRIP ── */}
      <HowWeProtect />

      {/* ── FAQ ── */}
      <section className="relative py-20 overflow-hidden">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-white leading-tight mb-4">
              Security{" "}
              <span className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
                FAQs
              </span>
            </h2>
            <p className="text-gray-400">Common questions about how we keep your data safe.</p>
          </div>
          <div className="flex flex-col gap-3">
            {faqs.map((faq, i) => (
              <div key={i}
                className="rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
                style={{ background: openFaq === i ? "rgba(37,99,235,0.07)" : "rgba(255,255,255,0.025)", border: `1px solid ${openFaq === i ? "rgba(37,99,235,0.35)" : "rgba(255,255,255,0.07)"}` }}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <div className="flex items-center justify-between p-5">
                  <span className="text-sm font-semibold pr-4" style={{ color: openFaq === i ? "#fff" : "#d1d5db" }}>{faq.q}</span>
                  <span className="text-lg flex-shrink-0 transition-transform duration-300" style={{ color: "#2563EB", transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
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

      {/* ── CTA ── */}
      <SecurityCta />
    </div>
  );
}

function SecurityPillars() {
  const [ref, v] = useInView(0.08);
  return (
    <section className="relative py-16">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
        style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(28px)" }}>
        <div className="text-center mb-14">
          <h2 className="text-white leading-tight mb-4">
            6 Layers of{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
              Protection
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Every layer working together to keep your data secure.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {pillars.map((p, i) => (
            <PillarCard key={p.title} pillar={p} index={i} visible={v} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PillarCard({ pillar, index, visible }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="relative rounded-3xl overflow-hidden cursor-default transition-all duration-500"
      style={{
        background: hovered ? `linear-gradient(160deg, ${pillar.bg} 0%, rgba(13,17,23,0.97) 100%)` : "linear-gradient(160deg, rgba(255,255,255,0.025) 0%, rgba(13,17,23,0.9) 100%)",
        border: `1px solid ${hovered ? pillar.border : "rgba(255,255,255,0.06)"}`,
        boxShadow: hovered ? `0 20px 60px ${pillar.glow}, inset 0 1px 0 rgba(255,255,255,0.05)` : "inset 0 1px 0 rgba(255,255,255,0.03)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.6s ease ${index * 90}ms, transform 0.6s ease ${index * 90}ms, background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div className="h-0.5 transition-all duration-500"
        style={{ background: hovered ? `linear-gradient(to right, ${pillar.color}, ${pillar.color}80)` : `linear-gradient(to right, ${pillar.color}30, transparent)` }} />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500"
            style={{ background: hovered ? pillar.bg : "rgba(255,255,255,0.04)", border: `1.5px solid ${hovered ? pillar.border : "rgba(255,255,255,0.07)"}`, boxShadow: hovered ? `0 0 24px ${pillar.glow}` : "none", transform: hovered ? "scale(1.1) rotate(-5deg)" : "scale(1)" }}>
            {pillar.icon}
          </div>
          <h3 className="text-white font-bold text-lg">{pillar.title}</h3>
        </div>
        <ul className="flex flex-col gap-2">
          {pillar.points.map((pt) => (
            <li key={pt} className="flex items-center gap-2 text-sm transition-colors duration-300"
              style={{ color: hovered ? "#d1d5db" : "#6b7280" }}>
              <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold transition-all duration-300"
                style={{ background: hovered ? pillar.bg : "rgba(255,255,255,0.04)", color: hovered ? pillar.color : "#374151", border: `1px solid ${hovered ? pillar.border : "rgba(255,255,255,0.06)"}` }}>
                ✓
              </span>
              {pt}
            </li>
          ))}
        </ul>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-3xl transition-all duration-500"
          style={{ background: `linear-gradient(to right, transparent, ${pillar.color}, transparent)`, opacity: hovered ? 1 : 0, transform: hovered ? "scaleX(1)" : "scaleX(0)" }} />
      </div>
    </div>
  );
}

function HowWeProtect() {
  const [ref, v] = useInView(0.1);
  const steps = [
    { icon: "🌐", label: "Request leaves browser", color: "#2563EB" },
    { icon: "🔒", label: "TLS 1.3 encrypts in transit", color: "#F59E0B" },
    { icon: "🛡️", label: "DDoS & WAF filter at edge", color: "#2563EB" },
    { icon: "🏢", label: "Auth & access control layer", color: "#F59E0B" },
    { icon: "🗄️", label: "AES-256 encrypted storage", color: "#2563EB" },
    { icon: "🔁", label: "Daily backup to geo-redundant cloud", color: "#F59E0B" },
  ];
  return (
    <section className="relative py-16">
      <div ref={ref} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
        style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(28px)" }}>
        <div className="rounded-3xl p-8 md:p-12" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-white font-bold text-xl mb-2 text-center">How Your Data Travels</h3>
          <p className="text-gray-500 text-sm text-center mb-10">Every request is protected at every step.</p>
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1.5 text-center w-24">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
                    style={{ background: s.color === "#2563EB" ? "rgba(37,99,235,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${s.color === "#2563EB" ? "rgba(37,99,235,0.3)" : "rgba(245,158,11,0.3)"}` }}>
                    {s.icon}
                  </div>
                  <span className="text-[10px] text-gray-500 leading-tight">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <span className="text-gray-700 text-lg hidden sm:block">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SecurityCta() {
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
              Run Your Business{" "}
              <span className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
                With Confidence
              </span>
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
              Your data is protected by enterprise-grade security — so you can focus on growing your business, not worrying about it.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
              <button className="btn-primary">Start Free Trial →</button>
              <Link href="/contact" className="btn-secondary">Talk to Security Team →</Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              {["✓ Bank-level encryption", "✓ Daily backups", "✓ 99.9% uptime", "✓ GDPR compliant"].map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
