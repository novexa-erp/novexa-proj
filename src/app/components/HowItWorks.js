"use client";

import { useEffect, useRef, useState } from "react";

function useInView(threshold = 0.15) {
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

const steps = [
  {
    step: "01",
    icon: "👥",
    title: "Add Your Customers",
    description:
      "Start by adding your clients — name, contact, and business details. All in one place, ready whenever you need them.",
    color: "#2563EB",
    colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.3)",
    border: "rgba(37,99,235,0.4)",
    bg: "rgba(37,99,235,0.08)",
    tag: "Setup",
  },
  {
    step: "02",
    icon: "📦",
    title: "Add Your Products",
    description:
      "Build your product catalog with names, prices, and stock quantities. Reuse them across every invoice — no re-entering.",
    color: "#F59E0B",
    colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.3)",
    border: "rgba(245,158,11,0.4)",
    bg: "rgba(245,158,11,0.08)",
    tag: "Catalog",
  },
  {
    step: "03",
    icon: "🧾",
    title: "Generate Invoice",
    description:
      "Pick a customer, select products, and Novexa auto-calculates totals, taxes, and discounts. Professional invoice in seconds.",
    color: "#2563EB",
    colorLight: "#60A5FA",
    glow: "rgba(37,99,235,0.3)",
    border: "rgba(37,99,235,0.4)",
    bg: "rgba(37,99,235,0.08)",
    tag: "Billing",
  },
  {
    step: "04",
    icon: "📤",
    title: "Share via PDF / WhatsApp",
    description:
      "Export a clean PDF or send directly to your client via WhatsApp with one tap. Fast, professional, and hassle-free.",
    color: "#F59E0B",
    colorLight: "#FCD34D",
    glow: "rgba(245,158,11,0.3)",
    border: "rgba(245,158,11,0.4)",
    bg: "rgba(245,158,11,0.08)",
    tag: "Delivery",
  },
];

function StepCard({ step, index, total }) {
  const [ref, visible] = useInView(0.1);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="relative flex flex-col"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: `opacity 0.65s ease ${index * 150}ms, transform 0.65s ease ${index * 150}ms`,
      }}
    >
      {/* ── Card ── */}
      <div
        className="relative flex flex-col h-full rounded-3xl overflow-hidden cursor-default transition-all duration-500"
        style={{
          background: hovered
            ? `linear-gradient(160deg, ${step.bg} 0%, rgba(13,17,23,0.95) 100%)`
            : "linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(13,17,23,0.8) 100%)",
          border: `1px solid ${hovered ? step.border : "rgba(255,255,255,0.06)"}`,
          boxShadow: hovered
            ? `0 20px 60px ${step.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`
            : "inset 0 1px 0 rgba(255,255,255,0.04)",
          transform: hovered ? "translateY(-8px)" : "translateY(0)",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* top color bar */}
        <div
          className="h-1 w-full transition-all duration-500"
          style={{
            background: hovered
              ? `linear-gradient(to right, ${step.color}, ${step.colorLight})`
              : `linear-gradient(to right, ${step.color}40, transparent)`,
          }}
        />

        {/* large step number — background watermark */}
        <span
          className="absolute -bottom-4 -right-2 font-black select-none pointer-events-none leading-none"
          style={{
            fontSize: "100px",
            color: step.color,
            opacity: hovered ? 0.07 : 0.04,
            transition: "opacity 0.5s ease",
          }}
        >
          {step.step}
        </span>

        <div className="p-7 flex flex-col flex-1 relative z-10">

          {/* Top row: icon + tag */}
          <div className="flex items-start justify-between mb-6">
            {/* Icon box */}
            <div
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500"
              style={{
                background: hovered ? step.bg : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${hovered ? step.border : "rgba(255,255,255,0.07)"}`,
                boxShadow: hovered ? `0 0 28px ${step.glow}` : "none",
                transform: hovered ? "scale(1.1) rotate(-5deg)" : "scale(1) rotate(0deg)",
              }}
            >
              {step.icon}
              {/* glow dot */}
              <span
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full transition-all duration-300"
                style={{
                  background: step.color,
                  boxShadow: hovered ? `0 0 10px ${step.color}` : "none",
                  opacity: hovered ? 1 : 0.3,
                }}
              />
            </div>

            {/* Tag pill */}
            <span
              className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all duration-300"
              style={{
                background: hovered ? step.bg : "rgba(255,255,255,0.04)",
                border: `1px solid ${hovered ? step.border : "rgba(255,255,255,0.07)"}`,
                color: hovered ? step.colorLight : "#4b5563",
              }}
            >
              {step.tag}
            </span>
          </div>

          {/* Step label */}
          <span
            className="text-xs font-bold tracking-[0.2em] uppercase mb-2 transition-colors duration-300"
            style={{ color: hovered ? step.color : "rgba(255,255,255,0.18)" }}
          >
            Step {step.step}
          </span>

          {/* Title */}
          <h4
            className="font-bold mb-3 leading-snug transition-colors duration-300"
            style={{ fontSize: "18px", color: hovered ? "#ffffff" : "#e2e8f0" }}
          >
            {step.title}
          </h4>

          {/* Description */}
          <p
            className="text-sm leading-relaxed flex-1 transition-colors duration-300"
            style={{ color: hovered ? "#9ca3af" : "#6b7280" }}
          >
            {step.description}
          </p>

          {/* Bottom: step progress dots */}
          <div className="flex items-center gap-1.5 mt-6">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === index ? 20 : 6,
                  height: 4,
                  background: i === index
                    ? `linear-gradient(to right, ${step.color}, ${step.colorLight})`
                    : i < index
                    ? step.color + "60"
                    : "rgba(255,255,255,0.08)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Arrow connector (desktop only, not last) */}
      {index < total - 1 && (
        <div
          className="hidden lg:flex absolute top-1/2 -right-5 -translate-y-1/2 items-center justify-center w-10 h-10 rounded-full z-20 transition-all duration-300"
          style={{
            background: "rgba(13,17,23,0.9)",
            border: `1px solid ${step.border}`,
            boxShadow: `0 0 16px ${step.glow}`,
            color: step.colorLight,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          →
        </div>
      )}
    </div>
  );
}

/* ── Mobile step row ── */
function MobileStep({ step, index }) {
  const [ref, visible] = useInView(0.1);

  return (
    <div
      ref={ref}
      className="flex items-start gap-4"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-24px)",
        transition: `opacity 0.6s ease ${index * 120}ms, transform 0.6s ease ${index * 120}ms`,
      }}
    >
      {/* left: number circle */}
      <div
        className="relative flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-xl z-10"
        style={{
          background: step.bg,
          border: `1.5px solid ${step.border}`,
          boxShadow: `0 0 20px ${step.glow}`,
        }}
      >
        {step.icon}
        <span
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
          style={{ background: step.color, color: "#fff" }}
        >
          {step.step}
        </span>
      </div>

      {/* right: text card */}
      <div
        className="flex-1 rounded-2xl p-4"
        style={{
          background: step.bg,
          border: `1px solid ${step.border}`,
        }}
      >
        <span
          className="text-[10px] font-bold tracking-widest uppercase mb-1 block"
          style={{ color: step.color }}
        >
          Step {step.step} · {step.tag}
        </span>
        <h4 className="text-white font-bold text-sm mb-1">{step.title}</h4>
        <p className="text-gray-500 text-xs leading-relaxed">{step.description}</p>
      </div>
    </div>
  );
}

/* ── Bottom bar ── */
function BottomBar() {
  const [ref, visible] = useInView(0.2);

  return (
    <div
      ref={ref}
      className="mt-20 transition-all duration-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transitionDelay: "200ms",
      }}
    >
      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
        {steps.map((s, i) => (
          <div key={s.step} className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                color: s.color,
              }}
            >
              <span>{s.icon}</span>
              <span>{s.title}</span>
            </div>
            {i < steps.length - 1 && (
              <span className="text-gray-700 text-sm">→</span>
            )}
          </div>
        ))}
      </div>

      <div className="text-center">
        <p className="text-gray-500 mb-6 text-base">
          That is all it takes. Start your first invoice today — free.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button className="btn-primary">Get Started Free →</button>
          <button className="btn-secondary">Watch Demo →</button>
        </div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const [headerRef, headerVisible] = useInView(0.2);
  const [timelineRef, timelineVisible] = useInView(0.1);

  return (
    <section className="relative py-24 md:py-32 bg-[#0d1117] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB]/35 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F59E0B]/25 to-transparent" />
        <div className="absolute top-1/3 -left-40 w-[450px] h-[450px] bg-blue-600/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/3 -right-40 w-[450px] h-[450px] bg-amber-500/5 rounded-full blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div
          ref={headerRef}
          className="text-center max-w-2xl mx-auto mb-20 transition-all duration-700"
          style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(28px)",
          }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
            style={{
              background: "rgba(37,99,235,0.1)",
              border: "1px solid rgba(37,99,235,0.3)",
              color: "#93C5FD",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            How It Works
          </div>

          <h2 className="text-white leading-tight mb-5">
            Up & Running in{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)",
              }}
            >
              4 Simple Steps
            </span>
          </h2>

          <p className="text-gray-400 text-lg leading-relaxed">
            No complex setup. No training required. Just follow these four steps and your
            business is fully digital in minutes.
          </p>
        </div>

        {/* Mobile vertical timeline */}
        <div
          ref={timelineRef}
          className="flex lg:hidden flex-col gap-5 relative"
          style={{
            opacity: timelineVisible ? 1 : 0,
            transform: timelineVisible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          <div className="absolute left-[27px] top-8 bottom-8 w-px bg-gradient-to-b from-[#2563EB]/50 via-[#F59E0B]/40 to-[#2563EB]/30" />
          {steps.map((step, i) => (
            <MobileStep key={step.step} step={step} index={i} />
          ))}
        </div>

        {/* Desktop grid */}
        <div className="hidden lg:grid grid-cols-4 gap-8 relative">
          {steps.map((step, i) => (
            <StepCard key={step.step} step={step} index={i} total={steps.length} />
          ))}
        </div>

        <BottomBar />
      </div>
    </section>
  );
}
