"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

function useInView(threshold = 0.1) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// ── Data ─────────────────────────────────────────────────────────────────────

const categories = [
  { id: "all",       label: "All Features",  icon: "⚡" },
  { id: "billing",   label: "Billing",       icon: "🧾" },
  { id: "inventory", label: "Inventory",     icon: "📦" },
  { id: "crm",       label: "CRM",           icon: "👥" },
  { id: "analytics", label: "Analytics",     icon: "📊" },
  { id: "security",  label: "Security",      icon: "🔐" },
];

const features = [
  {
    icon: "🧾", title: "Smart Invoicing",
    desc: "Create professional invoices in seconds. Auto-calculate taxes, discounts, and totals with custom branding. Zero manual errors.",
    cat: "billing", color: "#F59E0B", colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.28)", border: "rgba(245,158,11,0.38)", bg: "rgba(245,158,11,0.08)",
    bullets: ["Auto tax & discount calc", "Custom logo & branding", "Recurring invoices", "Bulk invoice generation"],
    badge: "Most Used",
  },
  {
    icon: "📄", title: "PDF & WhatsApp Export",
    desc: "Export any invoice as a pixel-perfect PDF or send it directly via WhatsApp in one tap. Clients get it instantly.",
    cat: "billing", color: "#2563EB", colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.28)", border: "rgba(37,99,235,0.38)", bg: "rgba(37,99,235,0.08)",
    bullets: ["One-click PDF export", "Direct WhatsApp share", "Email delivery", "Print-ready layout"],
  },
  {
    icon: "💳", title: "Payment Tracking",
    desc: "Every invoice shows Paid, Unpaid, or Partial status at a glance. Get notified on overdue payments automatically.",
    cat: "billing", color: "#F59E0B", colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.28)", border: "rgba(245,158,11,0.38)", bg: "rgba(245,158,11,0.08)",
    bullets: ["Paid / Unpaid / Partial", "Overdue alerts", "Payment history", "Partial payment support"],
  },
  {
    icon: "📦", title: "Product Management",
    desc: "Manage your entire catalog — names, prices, categories, and images. Reuse products across every invoice instantly.",
    cat: "inventory", color: "#2563EB", colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.28)", border: "rgba(37,99,235,0.38)", bg: "rgba(37,99,235,0.08)",
    bullets: ["Full product catalog", "Category management", "Bulk import/export", "Price history"],
  },
  {
    icon: "📊", title: "Stock Tracking",
    desc: "Monitor real-time inventory across all locations. Get low-stock alerts before you run out and avoid lost sales.",
    cat: "inventory", color: "#F59E0B", colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.28)", border: "rgba(245,158,11,0.38)", bg: "rgba(245,158,11,0.08)",
    bullets: ["Real-time stock levels", "Low-stock alerts", "Multi-location tracking", "Stock adjustment logs"],
    badge: "New",
  },
  {
    icon: "👥", title: "Customer Management",
    desc: "Store every client's full details, purchase history, and notes. Build stronger relationships with total visibility.",
    cat: "crm", color: "#2563EB", colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.28)", border: "rgba(37,99,235,0.38)", bg: "rgba(37,99,235,0.08)",
    bullets: ["Full client profiles", "Purchase history", "Custom notes & tags", "Customer statements"],
  },
  {
    icon: "📈", title: "Sales Analytics",
    desc: "Live dashboard with revenue, top products, and customer trends. Filter by date, branch, or category any time.",
    cat: "analytics", color: "#F59E0B", colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.28)", border: "rgba(245,158,11,0.38)", bg: "rgba(245,158,11,0.08)",
    bullets: ["Revenue charts", "Top-selling products", "Customer analytics", "Custom date filters"],
  },
  {
    icon: "📋", title: "Reports",
    desc: "Generate detailed sales, expense, and inventory reports. Export as PDF or Excel. Schedule automatic reports.",
    cat: "analytics", color: "#2563EB", colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.28)", border: "rgba(37,99,235,0.38)", bg: "rgba(37,99,235,0.08)",
    bullets: ["Sales & expense reports", "PDF & Excel export", "Scheduled reports", "Branch-wise breakdown"],
  },
  {
    icon: "🏢", title: "Multi-Branch",
    desc: "Run multiple branches or warehouses from one account. Separate stock, reports, and staff per location.",
    cat: "analytics", color: "#F59E0B", colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.28)", border: "rgba(245,158,11,0.38)", bg: "rgba(245,158,11,0.08)",
    bullets: ["Unlimited branches", "Separate stock per branch", "Consolidated reports", "Branch transfers"],
    badge: "Pro",
  },
  {
    icon: "🔐", title: "Role-Based Access",
    desc: "Assign Admin, Manager, or Cashier roles. Each user sees only what they need. Full audit trail of every action.",
    cat: "security", color: "#2563EB", colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.28)", border: "rgba(37,99,235,0.38)", bg: "rgba(37,99,235,0.08)",
    bullets: ["Custom user roles", "Permission controls", "Full audit logs", "Session management"],
  },
  {
    icon: "🛡️", title: "Data Security",
    desc: "Bank-level encryption, automated daily backups, and secure cloud storage. Your business data is always safe.",
    cat: "security", color: "#F59E0B", colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.28)", border: "rgba(245,158,11,0.38)", bg: "rgba(245,158,11,0.08)",
    bullets: ["End-to-end encryption", "Daily auto backups", "GDPR compliant", "Secure cloud hosting"],
  },
  {
    icon: "📱", title: "Mobile Ready",
    desc: "Fully responsive on any device. Manage invoices, check stock, and track payments from your phone anywhere.",
    cat: "crm", color: "#2563EB", colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.28)", border: "rgba(37,99,235,0.38)", bg: "rgba(37,99,235,0.08)",
    bullets: ["100% mobile responsive", "PWA support", "Offline mode", "Touch optimized"],
  },
];

// ── Feature Card ──────────────────────────────────────────────────────────────
function FeatureCard({ feature, index }) {
  const [ref, visible] = useInView(0.08);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="relative rounded-3xl overflow-hidden cursor-default flex flex-col h-full"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(36px)",
        transition: `opacity 0.6s ease ${(index % 6) * 80}ms, transform 0.6s ease ${(index % 6) * 80}ms`,
        background: hovered
          ? `linear-gradient(160deg, ${feature.bg} 0%, rgba(13,17,23,0.97) 100%)`
          : "linear-gradient(160deg, rgba(255,255,255,0.025) 0%, rgba(13,17,23,0.9) 100%)",
        border: `1px solid ${hovered ? feature.border : "rgba(255,255,255,0.06)"}`,
        boxShadow: hovered ? `0 20px 60px ${feature.glow}, inset 0 1px 0 rgba(255,255,255,0.05)` : "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* top bar */}
      <div className="h-0.5 transition-all duration-500" style={{
        background: hovered
          ? `linear-gradient(to right, ${feature.color}, ${feature.colorLight})`
          : `linear-gradient(to right, ${feature.color}35, transparent)`,
      }} />

      {/* bg watermark */}
      <span className="absolute -bottom-4 -right-3 text-[90px] select-none pointer-events-none leading-none"
        style={{ color: feature.color, opacity: hovered ? 0.07 : 0.03, transition: "opacity 0.5s" }}>
        {feature.icon}
      </span>

      <div className="p-6 flex flex-col flex-1 relative z-10">
        {/* top row */}
        <div className="flex items-start justify-between mb-5">
          <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500"
            style={{
              background: hovered ? feature.bg : "rgba(255,255,255,0.04)",
              border: `1.5px solid ${hovered ? feature.border : "rgba(255,255,255,0.07)"}`,
              boxShadow: hovered ? `0 0 24px ${feature.glow}` : "none",
              transform: hovered ? "scale(1.12) rotate(-5deg)" : "scale(1) rotate(0deg)",
            }}>
            {feature.icon}
            {hovered && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-ping" style={{ background: feature.color, opacity: 0.7 }} />}
            {hovered && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: feature.color }} />}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {feature.badge && (
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase"
                style={{ background: feature.bg, border: `1px solid ${feature.border}`, color: feature.colorLight }}>
                {feature.badge}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#4b5563" }}>
              {feature.cat}
            </span>
          </div>
        </div>

        <h4 className="font-bold mb-2 leading-snug transition-colors duration-300"
          style={{ fontSize: "17px", color: hovered ? "#ffffff" : "#e2e8f0" }}>
          {feature.title}
        </h4>
        <p className="text-sm leading-relaxed mb-4 transition-colors duration-300"
          style={{ color: hovered ? "#9ca3af" : "#6b7280" }}>
          {feature.desc}
        </p>

        {/* bullet list */}
        <ul className="flex flex-col gap-1.5 mt-auto">
          {feature.bullets.map((b) => (
            <li key={b} className="flex items-center gap-2 text-xs transition-colors duration-300"
              style={{ color: hovered ? "#d1d5db" : "#4b5563" }}>
              <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold transition-all duration-300"
                style={{ background: hovered ? feature.bg : "rgba(255,255,255,0.05)", color: hovered ? feature.colorLight : "#374151", border: `1px solid ${hovered ? feature.border : "rgba(255,255,255,0.06)"}` }}>
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>

        {/* bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-3xl transition-all duration-500"
          style={{ background: `linear-gradient(to right, transparent, ${feature.color}, transparent)`, opacity: hovered ? 1 : 0, transform: hovered ? "scaleX(1)" : "scaleX(0)" }} />
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────
export default function FeaturesPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [heroRef, heroVisible] = useInView(0.1);

  const filtered = activeCategory === "all"
    ? features
    : features.filter((f) => f.cat === activeCategory);

  return (
    <div className="bg-[#0d1117] min-h-screen">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-24 overflow-hidden">
        {/* bg glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB]/40 to-transparent" />
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/8 rounded-full blur-[120px]" />
          <div className="absolute top-32 left-1/4 w-64 h-64 bg-amber-500/6 rounded-full blur-[100px]" />
          <div className="absolute top-32 right-1/4 w-64 h-64 bg-blue-500/6 rounded-full blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.1]"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>

        <div ref={heroRef} className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-700"
          style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateY(0)" : "translateY(32px)" }}>

          {/* breadcrumb */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-8">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-gray-300">Features</span>
          </div>

          {/* badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", color: "#93C5FD" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            50+ Powerful Features
          </div>

          <h1 className="text-white leading-tight mb-6">
            Everything Your Business{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
              Needs to Grow
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto mb-10">
            Novexa ERP packs everything into one platform — invoicing, inventory, payments, analytics,
            and security. No per-feature pricing. No learning curve.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-14">
            <button className="btn-primary">Start Free Trial →</button>
            <button className="btn-secondary">Watch Demo →</button>
          </div>

          {/* quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {[
              { v: "50+", l: "Modules", c: "#2563EB" },
              { v: "500+", l: "Businesses", c: "#F59E0B" },
              { v: "99.9%", l: "Uptime", c: "#2563EB" },
              { v: "24/7", l: "Support", c: "#F59E0B" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl p-4 text-center"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="text-2xl font-black bg-clip-text text-transparent mb-0.5"
                  style={{ backgroundImage: s.c === "#2563EB" ? "linear-gradient(135deg,#2563EB,#60A5FA)" : "linear-gradient(135deg,#F59E0B,#FCD34D)" }}>
                  {s.v}
                </div>
                <div className="text-xs text-gray-500 font-medium">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FILTER TABS + CARDS ──────────────────────────────────── */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[130px]" />
          <div className="absolute bottom-1/3 -right-40 w-[400px] h-[400px] bg-amber-500/4 rounded-full blur-[130px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300"
                  style={{
                    background: isActive ? "linear-gradient(135deg, #2563EB, #1d4ed8)" : "rgba(255,255,255,0.04)",
                    border: isActive ? "1px solid rgba(37,99,235,0.6)" : "1px solid rgba(255,255,255,0.08)",
                    color: isActive ? "#fff" : "#6b7280",
                    boxShadow: isActive ? "0 4px 20px rgba(37,99,235,0.35)" : "none",
                    transform: isActive ? "scale(1.05)" : "scale(1)",
                  }}>
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  {cat.id !== "all" && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5"
                      style={{ background: isActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)", color: isActive ? "#fff" : "#4b5563" }}>
                      {features.filter(f => f.cat === cat.id).length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((feature, i) => (
              <FeatureCard key={feature.title} feature={feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ─────────────────────────────────────── */}
      <CompareSection />

      {/* ── BOTTOM CTA ───────────────────────────────────────────── */}
      <CtaSection />
    </div>
  );
}

// ── Comparison Table ──────────────────────────────────────────────────────────
function CompareSection() {
  const [ref, visible] = useInView(0.1);

  const rows = [
    { feature: "Invoice Generation",      novexa: true,  excel: false, manual: false },
    { feature: "Auto Tax Calculation",    novexa: true,  excel: false, manual: false },
    { feature: "PDF & WhatsApp Export",   novexa: true,  excel: false, manual: false },
    { feature: "Real-Time Stock Alerts",  novexa: true,  excel: false, manual: false },
    { feature: "Payment Status Tracking", novexa: true,  excel: "Partial", manual: false },
    { feature: "Customer Management",     novexa: true,  excel: "Partial", manual: false },
    { feature: "Live Dashboard",          novexa: true,  excel: false, manual: false },
    { feature: "Role-Based Access",       novexa: true,  excel: false, manual: false },
    { feature: "Multi-Branch Support",    novexa: true,  excel: false, manual: false },
    { feature: "Automated Backups",       novexa: true,  excel: false, manual: false },
  ];

  const Cell = ({ val }) => {
    if (val === true)  return <span className="text-lg" title="Yes">✅</span>;
    if (val === false) return <span className="text-lg" title="No">❌</span>;
    return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.25)" }}>Partial</span>;
  };

  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <div ref={ref} className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(32px)" }}>

        <div className="text-center mb-12">
          <h2 className="text-white leading-tight mb-4">
            Why Choose{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
              Novexa ERP?
            </span>
          </h2>
          <p className="text-gray-400 text-lg">See how Novexa stacks up against Excel and manual methods.</p>
        </div>

        <div className="rounded-3xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
          {/* header */}
          <div className="grid grid-cols-4 text-center py-4 px-6"
            style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-left text-xs font-bold tracking-widest uppercase text-gray-500">Feature</div>
            {[
              { label: "Novexa ERP", color: "#2563EB", bg: "rgba(37,99,235,0.12)", border: "rgba(37,99,235,0.3)" },
              { label: "Excel / Sheets", color: "#6b7280", bg: "transparent", border: "transparent" },
              { label: "Manual / Paper", color: "#6b7280", bg: "transparent", border: "transparent" },
            ].map((h) => (
              <div key={h.label} className="text-center">
                <span className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: h.bg, border: `1px solid ${h.border}`, color: h.label === "Novexa ERP" ? "#93C5FD" : "#6b7280" }}>
                  {h.label}
                </span>
              </div>
            ))}
          </div>

          {/* rows */}
          {rows.map((row, i) => (
            <div key={row.feature} className="grid grid-cols-4 items-center py-3.5 px-6 transition-colors duration-200 hover:bg-white/[0.02]"
              style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <span className="text-sm text-gray-300 font-medium">{row.feature}</span>
              <div className="flex justify-center"><Cell val={row.novexa} /></div>
              <div className="flex justify-center"><Cell val={row.excel} /></div>
              <div className="flex justify-center"><Cell val={row.manual} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA Section ───────────────────────────────────────────────────────────────
function CtaSection() {
  const [ref, visible] = useInView(0.15);
  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F59E0B]/25 to-transparent" />

      <div ref={ref} className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)" }}>

        <div className="relative rounded-3xl overflow-hidden p-10 md:p-16 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(13,17,23,0.97) 50%, rgba(245,158,11,0.1) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
          {/* corner glows */}
          <div className="absolute top-0 left-0 w-48 h-48 rounded-full blur-[90px] pointer-events-none" style={{ background: "rgba(37,99,235,0.22)" }} />
          <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full blur-[90px] pointer-events-none" style={{ background: "rgba(245,158,11,0.18)" }} />
          {/* grid overlay */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
              style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", color: "#93C5FD" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Free to Start
            </div>

            <h2 className="text-white leading-tight mb-4">
              Ready to Transform{" "}
              <span className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
                Your Business?
              </span>
            </h2>

            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
              Join 500+ businesses already running smarter with Novexa ERP.
              Get started in minutes — no credit card, no setup fees.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
              <button className="btn-primary">Start Free Trial →</button>
              <Link href="/" className="btn-secondary">← Back to Home</Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              {["✓ No credit card required", "✓ Setup in 5 minutes", "✓ Cancel anytime", "✓ 24/7 support"].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
