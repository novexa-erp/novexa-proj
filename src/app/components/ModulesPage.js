"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

function useInView(threshold = 0.08) {
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

// ─── Module Data ──────────────────────────────────────────────────────────────
const modules = [
  {
    id: "invoicing",
    icon: "🧾",
    number: "01",
    title: "Invoice Management",
    tagline: "Professional invoices in seconds",
    desc: "Create, send, and track invoices with automatic tax calculations, custom branding, and instant PDF or WhatsApp delivery. No manual work.",
    color: "#F59E0B",
    colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.3)",
    border: "rgba(245,158,11,0.4)",
    bg: "rgba(245,158,11,0.08)",
    tag: "Billing",
    badge: "Core",
    subFeatures: [
      "Auto tax & discount calculation",
      "Custom logo & branding",
      "Recurring invoice templates",
      "Bulk invoice generation",
      "One-click PDF export",
      "Direct WhatsApp sharing",
    ],
    stat: { value: "1M+", label: "Invoices Generated" },
  },
  {
    id: "inventory",
    icon: "📦",
    number: "02",
    title: "Inventory & Stock",
    tagline: "Never run out — never overstock",
    desc: "Track real-time stock levels across all locations. Get low-stock alerts, manage categories, and maintain accurate counts with zero effort.",
    color: "#2563EB",
    colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.3)",
    border: "rgba(37,99,235,0.4)",
    bg: "rgba(37,99,235,0.08)",
    tag: "Inventory",
    badge: "Core",
    subFeatures: [
      "Real-time stock monitoring",
      "Low-stock & reorder alerts",
      "Multi-location tracking",
      "Product categories & variants",
      "Stock adjustment logs",
      "Bulk import via Excel/CSV",
    ],
    stat: { value: "50K+", label: "Products Tracked" },
  },
  {
    id: "crm",
    icon: "👥",
    number: "03",
    title: "Customer Management",
    tagline: "Know your customers deeply",
    desc: "Store complete client profiles, full purchase history, notes, and outstanding balances. Build stronger relationships with total visibility.",
    color: "#F59E0B",
    colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.3)",
    border: "rgba(245,158,11,0.4)",
    bg: "rgba(245,158,11,0.08)",
    tag: "CRM",
    badge: "Core",
    subFeatures: [
      "Full client profiles",
      "Complete purchase history",
      "Custom notes & tags",
      "Customer statements & ledger",
      "Outstanding balance tracking",
      "Customer-wise reports",
    ],
    stat: { value: "200K+", label: "Customers Managed" },
  },
  {
    id: "payments",
    icon: "💳",
    number: "04",
    title: "Payment Tracking",
    tagline: "Know exactly who owes what",
    desc: "Every invoice shows Paid, Unpaid, or Partial status automatically. Get overdue alerts, record partial payments, and never chase a client blind.",
    color: "#2563EB",
    colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.3)",
    border: "rgba(37,99,235,0.4)",
    bg: "rgba(37,99,235,0.08)",
    tag: "Finance",
    badge: "Core",
    subFeatures: [
      "Paid / Unpaid / Partial status",
      "Overdue payment alerts",
      "Partial payment recording",
      "Payment history per client",
      "Outstanding balance reports",
      "Multi-payment method support",
    ],
    stat: { value: "Rs. 2B+", label: "Payments Tracked" },
  },
  {
    id: "analytics",
    icon: "📊",
    number: "05",
    title: "Analytics & Reports",
    tagline: "Data that drives decisions",
    desc: "Live dashboard with revenue, top products, and sales trends. Generate detailed reports filtered by date, branch, or category — export anytime.",
    color: "#F59E0B",
    colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.3)",
    border: "rgba(245,158,11,0.4)",
    bg: "rgba(245,158,11,0.08)",
    tag: "Analytics",
    badge: "Pro",
    subFeatures: [
      "Live revenue dashboard",
      "Top-selling product charts",
      "Customer purchase trends",
      "Expense vs revenue reports",
      "PDF & Excel export",
      "Scheduled auto-reports",
    ],
    stat: { value: "99%", label: "Data Accuracy" },
  },
  {
    id: "hr",
    icon: "🧑‍💼",
    number: "06",
    title: "HR & Payroll",
    tagline: "Manage your team effortlessly",
    desc: "Track employees, manage attendance, and run payroll — all from one place. Set salaries, deductions, and generate payslips instantly.",
    color: "#2563EB",
    colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.3)",
    border: "rgba(37,99,235,0.4)",
    bg: "rgba(37,99,235,0.08)",
    tag: "HR",
    badge: "Pro",
    subFeatures: [
      "Employee profiles & records",
      "Attendance & leave tracking",
      "Salary & payroll management",
      "Deduction & bonus handling",
      "Auto payslip generation",
      "Department & role management",
    ],
    stat: { value: "10K+", label: "Employees Managed" },
  },
  {
    id: "procurement",
    icon: "🛒",
    number: "07",
    title: "Purchase & Procurement",
    tagline: "Buy smarter, track everything",
    desc: "Manage supplier relationships, create purchase orders, and track incoming stock. Full visibility from order to delivery.",
    color: "#F59E0B",
    colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.3)",
    border: "rgba(245,158,11,0.4)",
    bg: "rgba(245,158,11,0.08)",
    tag: "Procurement",
    badge: "Pro",
    subFeatures: [
      "Supplier profiles & history",
      "Purchase order creation",
      "Goods receipt tracking",
      "Supplier payment ledger",
      "Purchase vs sales reports",
      "Low-stock reorder triggers",
    ],
    stat: { value: "30K+", label: "Purchase Orders" },
  },
  {
    id: "security",
    icon: "🔐",
    number: "08",
    title: "Security & Access Control",
    tagline: "Your data, fully protected",
    desc: "Role-based access ensures every team member sees only what they need. Full audit logs, session management, and bank-level encryption.",
    color: "#2563EB",
    colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.3)",
    border: "rgba(37,99,235,0.4)",
    bg: "rgba(37,99,235,0.08)",
    tag: "Security",
    badge: "Core",
    subFeatures: [
      "Custom user roles & permissions",
      "Full audit trail logs",
      "Session & device management",
      "End-to-end encryption",
      "Daily automated backups",
      "GDPR compliant storage",
    ],
    stat: { value: "99.9%", label: "Uptime SLA" },
  },
];

// ─── Module Card ──────────────────────────────────────────────────────────────
function ModuleCard({ mod, index }) {
  const [ref, visible] = useInView(0.08);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="relative rounded-3xl overflow-hidden cursor-default flex flex-col h-full"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(44px)",
        transition: `opacity 0.65s ease ${(index % 4) * 100}ms, transform 0.65s ease ${(index % 4) * 100}ms`,
        background: hovered
          ? `linear-gradient(155deg, ${mod.bg} 0%, rgba(13,17,23,0.98) 100%)`
          : "linear-gradient(155deg, rgba(255,255,255,0.025) 0%, rgba(13,17,23,0.92) 100%)",
        border: `1px solid ${hovered ? mod.border : "rgba(255,255,255,0.06)"}`,
        boxShadow: hovered
          ? `0 24px 70px ${mod.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`
          : "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* top gradient bar */}
      <div className="h-1 transition-all duration-500" style={{
        background: hovered
          ? `linear-gradient(to right, ${mod.color}, ${mod.colorLight})`
          : `linear-gradient(to right, ${mod.color}30, transparent)`,
      }} />

      {/* watermark number */}
      <span
        className="absolute -bottom-3 -right-2 font-black select-none pointer-events-none leading-none"
        style={{ fontSize: "110px", color: mod.color, opacity: hovered ? 0.06 : 0.03, transition: "opacity 0.5s" }}
      >
        {mod.number}
      </span>

      <div className="p-7 flex flex-col flex-1 relative z-10">

        {/* top row — icon + badges */}
        <div className="flex items-start justify-between mb-6">
          <div
            className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500"
            style={{
              background: hovered ? mod.bg : "rgba(255,255,255,0.04)",
              border: `1.5px solid ${hovered ? mod.border : "rgba(255,255,255,0.07)"}`,
              boxShadow: hovered ? `0 0 28px ${mod.glow}` : "none",
              transform: hovered ? "scale(1.12) rotate(-6deg)" : "scale(1) rotate(0deg)",
            }}
          >
            {mod.icon}
            {hovered && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full animate-ping" style={{ background: mod.color, opacity: 0.7 }} />}
            {hovered && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full" style={{ background: mod.color }} />}
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span
              className="px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase"
              style={{
                background: hovered ? mod.bg : "rgba(255,255,255,0.05)",
                border: `1px solid ${hovered ? mod.border : "rgba(255,255,255,0.08)"}`,
                color: hovered ? mod.colorLight : "#4b5563",
              }}
            >
              {mod.badge}
            </span>
            <span
              className="px-2.5 py-0.5 rounded-full text-[9px] font-semibold tracking-wide uppercase"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#374151" }}
            >
              {mod.tag}
            </span>
          </div>
        </div>

        {/* tagline */}
        <span
          className="text-xs font-bold tracking-widest uppercase mb-1.5 transition-colors duration-300"
          style={{ color: hovered ? mod.color : "rgba(255,255,255,0.2)" }}
        >
          {mod.tagline}
        </span>

        {/* title */}
        <h3
          className="font-bold mb-3 leading-snug transition-colors duration-300"
          style={{ fontSize: "20px", color: hovered ? "#ffffff" : "#e2e8f0" }}
        >
          {mod.title}
        </h3>

        {/* desc */}
        <p className="text-sm leading-relaxed mb-5 transition-colors duration-300"
          style={{ color: hovered ? "#9ca3af" : "#6b7280" }}>
          {mod.desc}
        </p>

        {/* sub-features grid */}
        <ul className="grid grid-cols-1 gap-1.5 mt-auto mb-5">
          {mod.subFeatures.map((sf) => (
            <li
              key={sf}
              className="flex items-center gap-2 text-xs transition-all duration-300"
              style={{ color: hovered ? "#d1d5db" : "#4b5563" }}
            >
              <span
                className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-300"
                style={{
                  background: hovered ? mod.bg : "rgba(255,255,255,0.04)",
                  border: `1px solid ${hovered ? mod.border : "rgba(255,255,255,0.06)"}`,
                  color: hovered ? mod.colorLight : "#374151",
                }}
              >
                ✓
              </span>
              {sf}
            </li>
          ))}
        </ul>

        {/* stat pill */}
        <div
          className="flex items-center gap-3 p-3 rounded-2xl transition-all duration-500"
          style={{
            background: hovered ? mod.bg : "rgba(255,255,255,0.03)",
            border: `1px solid ${hovered ? mod.border : "rgba(255,255,255,0.05)"}`,
          }}
        >
          <span
            className="text-xl font-black bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(135deg, ${mod.color}, ${mod.colorLight})` }}
          >
            {mod.stat.value}
          </span>
          <span className="text-xs text-gray-500">{mod.stat.label}</span>
        </div>

        {/* bottom glow line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-3xl transition-all duration-500"
          style={{
            background: `linear-gradient(to right, transparent, ${mod.color}, transparent)`,
            opacity: hovered ? 1 : 0,
            transform: hovered ? "scaleX(1)" : "scaleX(0)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function ModulesPage() {
  const [heroRef, heroVisible] = useInView(0.1);
  const [activeTag, setActiveTag] = useState("All");

  const tags = ["All", ...Array.from(new Set(modules.map((m) => m.tag)))];
  const filtered = activeTag === "All" ? modules : modules.filter((m) => m.tag === activeTag);

  return (
    <div className="bg-[#0d1117] min-h-screen">

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB]/40 to-transparent" />
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/7 rounded-full blur-[140px]" />
          <div className="absolute top-28 left-1/4 w-72 h-72 bg-amber-500/6 rounded-full blur-[110px]" />
          <div className="absolute top-28 right-1/4 w-72 h-72 bg-blue-500/5 rounded-full blur-[110px]" />
          <div className="absolute inset-0 opacity-[0.1]"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>

        <div
          ref={heroRef}
          className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-700"
          style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? "translateY(0)" : "translateY(32px)" }}
        >
          {/* breadcrumb */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-8">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-gray-300">Modules</span>
          </div>

          {/* badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", color: "#93C5FD" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            8 Powerful Modules
          </div>

          <h1 className="text-white leading-tight mb-6">
            One Platform.{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}
            >
              Every Module You Need.
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto mb-10">
            From invoicing to HR, inventory to analytics — each Novexa module is built to handle
            one part of your business perfectly, while working seamlessly with all the others.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-14">
            <button className="btn-primary">Start Free Trial →</button>
            <button className="btn-secondary">Watch Demo →</button>
          </div>

          {/* module count pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {modules.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.colorLight }}
              >
                <span>{m.icon}</span>
                <span>{m.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FILTER + CARDS ────────────────────────────────────────── */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] bg-blue-600/4 rounded-full blur-[130px]" />
          <div className="absolute bottom-1/3 -right-40 w-[400px] h-[400px] bg-amber-500/4 rounded-full blur-[130px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
            {tags.map((tag) => {
              const isActive = activeTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300"
                  style={{
                    background: isActive ? "linear-gradient(135deg, #2563EB, #1d4ed8)" : "rgba(255,255,255,0.04)",
                    border: isActive ? "1px solid rgba(37,99,235,0.6)" : "1px solid rgba(255,255,255,0.08)",
                    color: isActive ? "#fff" : "#6b7280",
                    boxShadow: isActive ? "0 4px 20px rgba(37,99,235,0.35)" : "none",
                    transform: isActive ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {tag}
                  {tag !== "All" && (
                    <span
                      className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: isActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.05)",
                        color: isActive ? "#fff" : "#4b5563",
                      }}
                    >
                      {modules.filter((m) => m.tag === tag).length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filtered.map((mod, i) => (
              <ModuleCard key={mod.id} mod={mod} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── INTEGRATION STRIP ─────────────────────────────────────── */}
      <IntegrationStrip />

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <ModulesCta />
    </div>
  );
}

// ─── Integration Strip ────────────────────────────────────────────────────────
function IntegrationStrip() {
  const [ref, visible] = useInView(0.1);
  return (
    <section className="relative py-16 overflow-hidden">
      <div
        ref={ref}
        className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)" }}
      >
        <div
          className="rounded-3xl p-8 md:p-12"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="text-center mb-10">
            <h3 className="text-white font-bold mb-2" style={{ fontSize: "22px" }}>
              All Modules Work{" "}
              <span className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
                Together
              </span>
            </h3>
            <p className="text-gray-500 text-sm">
              Every module shares the same data — no duplication, no silos, no manual syncing.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {modules.map((m) => (
              <div
                key={m.id}
                className="group flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all duration-300 cursor-default"
                style={{ background: m.bg, border: `1px solid ${m.border}` }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${m.glow}`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <span className="text-lg">{m.icon}</span>
                <span className="text-sm font-semibold" style={{ color: m.colorLight }}>{m.title}</span>
              </div>
            ))}
          </div>

          {/* connector dots */}
          <div className="flex justify-center mt-8 gap-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === 2 ? 24 : 8,
                  height: 4,
                  background: i === 2
                    ? "linear-gradient(to right, #2563EB, #F59E0B)"
                    : "rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Section ─────────────────────────────────────────────────────────────
function ModulesCta() {
  const [ref, visible] = useInView(0.1);
  return (
    <section className="relative py-20 overflow-hidden">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F59E0B]/25 to-transparent" />

      <div
        ref={ref}
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-700"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)" }}
      >
        <div
          className="relative rounded-3xl overflow-hidden p-10 md:p-16 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(13,17,23,0.97) 50%, rgba(245,158,11,0.1) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="absolute top-0 left-0 w-56 h-56 rounded-full blur-[100px] pointer-events-none" style={{ background: "rgba(37,99,235,0.2)" }} />
          <div className="absolute bottom-0 right-0 w-56 h-56 rounded-full blur-[100px] pointer-events-none" style={{ background: "rgba(245,158,11,0.16)" }} />
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

          <div className="relative z-10">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
              style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", color: "#93C5FD" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              All Modules Included
            </div>

            <h2 className="text-white leading-tight mb-4">
              Get Every Module.{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}
              >
                Pay Once.
              </span>
            </h2>

            <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
              No per-module pricing. No hidden fees. Every Novexa plan includes all 8 modules
              so your whole business runs from day one.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
              <button className="btn-primary">Start Free Trial →</button>
              <Link href="/features" className="btn-secondary">See All Features →</Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              {["✓ All 8 modules included", "✓ No credit card needed", "✓ Free onboarding", "✓ 24/7 support"].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
