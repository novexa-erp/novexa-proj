"use client";

import { useEffect, useRef, useState } from "react";

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

const features = [
  {
    icon: "🧾",
    title: "Smart Invoicing",
    desc: "Generate professional invoices in seconds. Auto-calculate taxes, discounts, and totals. Custom branding, itemized billing — zero errors.",
    color: "#F59E0B",
    colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.25)",
    border: "rgba(245,158,11,0.35)",
    bg: "rgba(245,158,11,0.07)",
    tag: "Billing",
    highlight: true,
  },
  {
    icon: "👥",
    title: "Customer Management",
    desc: "Store every client's details, purchase history, and notes in one place. Build stronger relationships with full visibility.",
    color: "#2563EB",
    colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.25)",
    border: "rgba(37,99,235,0.35)",
    bg: "rgba(37,99,235,0.07)",
    tag: "CRM",
    highlight: false,
  },
  {
    icon: "📦",
    title: "Product & Inventory",
    desc: "Manage your full catalog — prices, categories, stock levels. Get low-stock alerts before you run out.",
    color: "#F59E0B",
    colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.25)",
    border: "rgba(245,158,11,0.35)",
    bg: "rgba(245,158,11,0.07)",
    tag: "Inventory",
    highlight: false,
  },
  {
    icon: "💳",
    title: "Payment Tracking",
    desc: "Know exactly who paid, who hasn't, and how much is pending. Paid, Unpaid, Partial — tracked automatically.",
    color: "#2563EB",
    colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.25)",
    border: "rgba(37,99,235,0.35)",
    bg: "rgba(37,99,235,0.07)",
    tag: "Finance",
    highlight: false,
  },
  {
    icon: "📊",
    title: "Live Dashboard",
    desc: "A real-time overview of your sales, revenue, stock, and customers. Make decisions backed by live data.",
    color: "#F59E0B",
    colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.25)",
    border: "rgba(245,158,11,0.35)",
    bg: "rgba(245,158,11,0.07)",
    tag: "Analytics",
    highlight: false,
  },
  {
    icon: "📄",
    title: "PDF & WhatsApp Export",
    desc: "Export any invoice as a clean PDF or send it directly via WhatsApp in one tap. Fast, professional delivery.",
    color: "#2563EB",
    colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.25)",
    border: "rgba(37,99,235,0.35)",
    bg: "rgba(37,99,235,0.07)",
    tag: "Sharing",
    highlight: false,
  },
  {
    icon: "🏢",
    title: "Multi-Branch Support",
    desc: "Run multiple branches or warehouses from a single account. Separate stock, reports, and staff per location.",
    color: "#F59E0B",
    colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.25)",
    border: "rgba(245,158,11,0.35)",
    bg: "rgba(245,158,11,0.07)",
    tag: "Enterprise",
    highlight: false,
  },
  {
    icon: "🔐",
    title: "Role-Based Access",
    desc: "Assign roles to your staff — Admin, Manager, Cashier. Each sees only what they need. Full audit logs.",
    color: "#2563EB",
    colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.25)",
    border: "rgba(37,99,235,0.35)",
    bg: "rgba(37,99,235,0.07)",
    tag: "Security",
    highlight: false,
  },
  {
    icon: "📈",
    title: "Reports & Analytics",
    desc: "Generate detailed sales, expense, and inventory reports. Filter by date, category, or branch. Export any time.",
    color: "#F59E0B",
    colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.25)",
    border: "rgba(245,158,11,0.35)",
    bg: "rgba(245,158,11,0.07)",
    tag: "Reports",
    highlight: false,
  },
];

const stats = [
  { value: "50+", label: "Modules", icon: "🔧", color: "#2563EB" },
  { value: "500+", label: "Businesses", icon: "🏢", color: "#F59E0B" },
  { value: "99.9%", label: "Uptime", icon: "⚡", color: "#2563EB" },
  { value: "24/7", label: "Support", icon: "🛡️", color: "#F59E0B" },
];

// ── Big Hero Feature Card (first item) ────────────────────────────────────────
function HeroFeatureCard({ feature }) {
  const [ref, visible] = useInView(0.1);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="relative rounded-3xl overflow-hidden cursor-default transition-all duration-500 col-span-1 md:col-span-2 lg:col-span-2"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: "opacity 0.7s ease, transform 0.7s ease",
        background: hovered
          ? `linear-gradient(135deg, ${feature.bg} 0%, rgba(13,17,23,0.97) 70%)`
          : "linear-gradient(135deg, rgba(245,158,11,0.05) 0%, rgba(13,17,23,0.9) 70%)",
        border: `1px solid ${hovered ? feature.border : "rgba(245,158,11,0.15)"}`,
        boxShadow: hovered
          ? `0 24px 80px ${feature.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`
          : `0 8px 32px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.03)`,
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* top bar */}
      <div className="h-1" style={{
        background: `linear-gradient(to right, ${feature.color}, ${feature.colorLight}, transparent)`
      }} />

      {/* big bg emoji watermark */}
      <span className="absolute -bottom-6 -right-4 text-[140px] select-none pointer-events-none"
        style={{ opacity: hovered ? 0.06 : 0.03, transition: "opacity 0.5s ease" }}>
        {feature.icon}
      </span>

      <div className="p-8 md:p-10 flex flex-col md:flex-row gap-8 items-start relative z-10">
        {/* left */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all duration-500"
              style={{
                background: feature.bg,
                border: `1.5px solid ${feature.border}`,
                boxShadow: hovered ? `0 0 32px ${feature.glow}` : "none",
                transform: hovered ? "scale(1.1) rotate(-5deg)" : "scale(1)",
              }}>
              {feature.icon}
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase"
              style={{ background: feature.bg, border: `1px solid ${feature.border}`, color: feature.colorLight }}>
              {feature.tag}
            </span>
          </div>
          <h3 className="text-white font-bold mb-3 leading-tight" style={{ fontSize: "26px" }}>
            {feature.title}
          </h3>
          <p className="text-gray-400 leading-relaxed text-base mb-6">{feature.desc}</p>
          <div className="flex flex-wrap gap-2">
            {["Auto Tax Calc", "Custom Branding", "PDF Export", "Instant Send"].map((t) => (
              <span key={t} className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#FCD34D" }}>
                ✓ {t}
              </span>
            ))}
          </div>
        </div>
        {/* right: mini preview mockup */}
        <div className="w-full md:w-56 flex-shrink-0 rounded-2xl p-4 transition-all duration-500"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: hovered ? `0 8px 32px ${feature.glow}` : "none",
          }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] text-gray-600 ml-1">invoice.pdf</span>
          </div>
          {["Customer: Ali Traders", "Product: Laptop x2", "Tax (17%): Rs. 5,100", "Total: Rs. 35,100"].map((line, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
              <span className="text-[11px] text-gray-500">{line.split(":")[0]}</span>
              <span className="text-[11px] font-semibold" style={{ color: i === 3 ? "#F59E0B" : "#e2e8f0" }}>
                {line.split(":")[1]}
              </span>
            </div>
          ))}
          <div className="mt-3 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>
            ✓ PAID
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Regular Feature Card ───────────────────────────────────────────────────
function FeatureCard({ feature, index }) {
  const [ref, visible] = useInView(0.1);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="relative rounded-3xl overflow-hidden cursor-default transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: `opacity 0.65s ease ${index * 80}ms, transform 0.65s ease ${index * 80}ms`,
        background: hovered
          ? `linear-gradient(160deg, ${feature.bg} 0%, rgba(13,17,23,0.97) 100%)`
          : "linear-gradient(160deg, rgba(255,255,255,0.025) 0%, rgba(13,17,23,0.85) 100%)",
        border: `1px solid ${hovered ? feature.border : "rgba(255,255,255,0.06)"}`,
        boxShadow: hovered
          ? `0 20px 60px ${feature.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`
          : "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* top color bar */}
      <div className="h-0.5 transition-all duration-500" style={{
        background: hovered
          ? `linear-gradient(to right, ${feature.color}, ${feature.colorLight})`
          : `linear-gradient(to right, ${feature.color}30, transparent)`,
      }} />

      {/* watermark number */}
      <span className="absolute -bottom-3 -right-2 font-black select-none pointer-events-none leading-none"
        style={{ fontSize: "80px", color: feature.color, opacity: hovered ? 0.07 : 0.035, transition: "opacity 0.5s" }}>
        {String(index + 2).padStart(2, "0")}
      </span>

      <div className="p-6 relative z-10">
        {/* icon + tag row */}
        <div className="flex items-start justify-between mb-5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500"
            style={{
              background: hovered ? feature.bg : "rgba(255,255,255,0.04)",
              border: `1.5px solid ${hovered ? feature.border : "rgba(255,255,255,0.07)"}`,
              boxShadow: hovered ? `0 0 24px ${feature.glow}` : "none",
              transform: hovered ? "scale(1.12) rotate(-5deg)" : "scale(1) rotate(0deg)",
            }}>
            {feature.icon}
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase transition-all duration-300"
            style={{
              background: hovered ? feature.bg : "rgba(255,255,255,0.04)",
              border: `1px solid ${hovered ? feature.border : "rgba(255,255,255,0.06)"}`,
              color: hovered ? feature.colorLight : "#4b5563",
            }}>
            {feature.tag}
          </span>
        </div>

        <h4 className="font-bold mb-2 leading-snug transition-colors duration-300"
          style={{ fontSize: "17px", color: hovered ? "#ffffff" : "#e2e8f0" }}>
          {feature.title}
        </h4>
        <p className="text-sm leading-relaxed transition-colors duration-300"
          style={{ color: hovered ? "#9ca3af" : "#6b7280" }}>
          {feature.desc}
        </p>

        {/* arrow */}
        <div className="flex items-center gap-1 mt-4 text-xs font-semibold transition-all duration-300"
          style={{ color: feature.color, opacity: hovered ? 1 : 0, transform: hovered ? "translateX(0)" : "translateX(-8px)" }}>
          Learn more <span style={{ transform: hovered ? "translateX(4px)" : "translateX(0)", transition: "transform 0.3s" }}>→</span>
        </div>

        {/* bottom glow bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-3xl transition-all duration-500"
          style={{
            background: `linear-gradient(to right, transparent, ${feature.color}, transparent)`,
            opacity: hovered ? 1 : 0,
            transform: hovered ? "scaleX(1)" : "scaleX(0)",
          }} />
      </div>
    </div>
  );
}

// ── Stats Row ──────────────────────────────────────────────────────────────
function StatsRow() {
  const [ref, visible] = useInView(0.15);
  return (
    <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)", transition: "opacity 0.7s ease, transform 0.7s ease" }}>
      {stats.map((s, i) => (
        <div key={i} className="relative rounded-2xl p-6 flex flex-col items-center text-center overflow-hidden transition-all duration-400 cursor-default group"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
          onMouseEnter={e => {
            e.currentTarget.style.background = s.color === "#2563EB" ? "rgba(37,99,235,0.08)" : "rgba(245,158,11,0.08)";
            e.currentTarget.style.borderColor = s.color === "#2563EB" ? "rgba(37,99,235,0.35)" : "rgba(245,158,11,0.35)";
            e.currentTarget.style.transform = "translateY(-5px)";
            e.currentTarget.style.boxShadow = s.color === "#2563EB" ? "0 12px 40px rgba(37,99,235,0.2)" : "0 12px 40px rgba(245,158,11,0.2)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(255,255,255,0.025)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}>
          <span className="text-2xl mb-2">{s.icon}</span>
          <span className="text-4xl font-black mb-1 bg-clip-text text-transparent"
            style={{ backgroundImage: s.color === "#2563EB" ? "linear-gradient(135deg,#2563EB,#60A5FA)" : "linear-gradient(135deg,#F59E0B,#FCD34D)" }}>
            {s.value}
          </span>
          <span className="text-xs text-gray-500 font-medium tracking-wide">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────
export default function FeaturesSection() {
  const [headerRef, headerVisible] = useInView(0.2);

  return (
    <section id="features" className="relative py-24 md:py-32 bg-[#0d1117] overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB]/35 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F59E0B]/25 to-transparent" />
        <div className="absolute top-1/4 -left-40 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 -right-40 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-blue-900/4 rounded-full blur-[180px]" />
        <div className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div ref={headerRef} className="text-center max-w-3xl mx-auto mb-16 transition-all duration-700"
          style={{ opacity: headerVisible ? 1 : 0, transform: headerVisible ? "translateY(0)" : "translateY(28px)" }}>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", color: "#93C5FD" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Everything You Need
          </div>

          <h2 className="text-white leading-tight mb-5">
            Powerful Features,{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
              Built for Business
            </span>
          </h2>

          <p className="text-gray-400 text-lg leading-relaxed">
            Every tool you need to run your business — invoicing, inventory, payments, analytics — 
            all in one platform. No subscriptions per feature. No complexity.
          </p>
        </div>

        {/* ── Stats ── */}
        <StatsRow />

        {/* ── Feature Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
          {/* Hero card spans 2 cols */}
          <HeroFeatureCard feature={features[0]} />
          {/* 3rd card fills the remaining spot on first row */}
          <FeatureCard feature={features[1]} index={0} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
          {features.slice(2).map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i + 1} />
          ))}
        </div>

        {/* ── Bottom CTA ── */}
        <div className="relative rounded-3xl overflow-hidden p-10 md:p-14 text-center"
          style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(13,17,23,0.95) 50%, rgba(245,158,11,0.08) 100%)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {/* corner glows */}
          <div className="absolute top-0 left-0 w-40 h-40 rounded-full blur-[80px]" style={{ background: "rgba(37,99,235,0.2)" }} />
          <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full blur-[80px]" style={{ background: "rgba(245,158,11,0.15)" }} />

          <div className="relative z-10">
            <span className="text-4xl mb-4 block">🚀</span>
            <h3 className="text-white font-bold mb-3" style={{ fontSize: "28px" }}>
              Ready to Run Smarter?
            </h3>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Join 500+ businesses already using Novexa ERP. Get started in minutes — no credit card required.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button className="btn-primary">Start Free Trial →</button>
              <button className="btn-secondary">See All Modules →</button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
