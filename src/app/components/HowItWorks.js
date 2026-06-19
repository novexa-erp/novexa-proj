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
    glow: "rgba(37,99,235,0.22)",
    border: "rgba(37,99,235,0.35)",
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
    glow: "rgba(245,158,11,0.22)",
    border: "rgba(245,158,11,0.35)",
    bg: "rgba(245,158,11,0.08)",
    tag: "Catalog",
  },
  {
    step: "03",
    icon: "🧾",
    title: "Generate Invoice",
    description:
      "Pick a customer, select products, and Invorex auto-calculates totals, taxes, and discounts. Professional invoice in seconds.",
    color: "#10B981",
    glow: "rgba(16,185,129,0.22)",
    border: "rgba(16,185,129,0.35)",
    bg: "rgba(16,185,129,0.08)",
    tag: "Billing",
  },
  {
    step: "04",
    icon: "📤",
    title: "Share via PDF / WhatsApp",
    description:
      "Export a clean PDF or send directly to your client via WhatsApp with one tap. Fast, professional, and hassle-free.",
    color: "#A855F7",
    glow: "rgba(168,85,247,0.22)",
    border: "rgba(168,85,247,0.35)",
    bg: "rgba(168,85,247,0.08)",
    tag: "Delivery",
  },
];

function StepCard({ step, index, total }) {
  const [ref, visible] = useInView(0.1);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="relative flex flex-col items-center"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(36px)",
        transition: `opacity 0.65s ease ${index * 130}ms, transform 0.65s ease ${index * 130}ms`,
      }}
    >
      {/* Connector line (between cards, desktop) */}
      {index < total - 1 && (
        <div
          className="hidden lg:block absolute top-[52px] left-[calc(50%+52px)] right-0 h-px z-0"
          style={{
            background: `linear-gradient(to right, ${step.color}55, rgba(255,255,255,0.06))`,
            width: "calc(100% - 4px)",
          }}
        />
      )}

      {/* Card */}
      <div
        className="relative w-full rounded-2xl p-6 flex flex-col items-center text-center cursor-default transition-all duration-500 overflow-hidden z-10"
        style={{
          background: hovered ? step.bg : "rgba(255,255,255,0.025)",
          border: `1px solid ${hovered ? step.border : "rgba(255,255,255,0.07)"}`,
          boxShadow: hovered ? `0 16px 48px ${step.glow}` : "none",
          transform: hovered ? "translateY(-7px)" : "translateY(0)",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Shimmer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.035) 50%, transparent 60%)",
            transform: hovered ? "translateX(100%)" : "translateX(-100%)",
            transition: "transform 0.8s ease",
          }}
        />

        {/* Step number watermark */}
        <span
          className="absolute -top-2 -left-1 font-black select-none pointer-events-none transition-all duration-500"
          style={{
            fontSize: "72px",
            lineHeight: 1,
            color: step.color,
            opacity: hovered ? 0.1 : 0.05,
          }}
        >
          {step.step}
        </span>

        {/* Tag pill */}
        <div
          className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all duration-300"
          style={{
            background: hovered ? step.bg : "rgba(255,255,255,0.04)",
            border: `1px solid ${hovered ? step.border : "rgba(255,255,255,0.08)"}`,
            color: hovered ? step.color : "#6b7280",
          }}
        >
          {step.tag}
        </div>

        {/* Icon circle */}
        <div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-5 transition-all duration-500"
          style={{
            background: hovered ? step.bg : "rgba(255,255,255,0.05)",
            border: `1.5px solid ${hovered ? step.border : "rgba(255,255,255,0.09)"}`,
            boxShadow: hovered ? `0 0 24px ${step.glow}` : "none",
            transform: hovered ? "scale(1.12) rotate(-4deg)" : "scale(1) rotate(0deg)",
          }}
        >
          {step.icon}
          {/* Ping dot on hover */}
          {hovered && (
            <>
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-ping"
                style={{ background: step.color, opacity: 0.75 }}
              />
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                style={{ background: step.color }}
              />
            </>
          )}
        </div>

        {/* Step label */}
        <span
          className="text-xs font-bold tracking-widest uppercase mb-2 transition-colors duration-300"
          style={{ color: hovered ? step.color : "rgba(255,255,255,0.2)" }}
        >
          Step {step.step}
        </span>

        {/* Title */}
        <h4
          className="font-bold mb-3 transition-colors duration-300"
          style={{ fontSize: "17px", color: hovered ? "#fff" : "#e2e8f0" }}
        >
          {step.title}
        </h4>

        {/* Description */}
        <p
          className="text-sm leading-relaxed transition-colors duration-300"
          style={{ color: hovered ? "#9ca3af" : "#6b7280" }}
        >
          {step.description}
        </p>

        {/* Bottom glow bar */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl transition-all duration-500"
          style={{
            background: `linear-gradient(to right, transparent, ${step.color}, transparent)`,
            opacity: hovered ? 1 : 0,
            transform: hovered ? "scaleX(1)" : "scaleX(0)",
          }}
        />
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
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#A855F7]/25 to-transparent" />
        <div className="absolute top-1/3 -left-40 w-[450px] h-[450px] bg-blue-600/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/3 -right-40 w-[450px] h-[450px] bg-purple-600/5 rounded-full blur-[140px]" />
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
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
            style={{
              background: "rgba(168,85,247,0.1)",
              border: "1px solid rgba(168,85,247,0.3)",
              color: "#D8B4FE",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            How It Works
          </div>

          <h2 className="text-white leading-tight mb-5">
            Up & Running in{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #A855F7, #2563EB 50%, #10B981)",
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
          className="flex lg:hidden flex-col gap-6 relative"
          style={{
            opacity: timelineVisible ? 1 : 0,
            transform: timelineVisible ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          {/* Vertical line */}
          <div className="absolute left-[31px] top-8 bottom-8 w-px bg-gradient-to-b from-[#2563EB]/40 via-[#10B981]/30 to-[#A855F7]/30" />

          {steps.map((step, i) => (
            <MobileStep key={step.step} step={step} index={i} />
          ))}
        </div>

        {/* Desktop grid */}
        <div className="hidden lg:grid grid-cols-4 gap-6 relative">
          {steps.map((step, i) => (
            <StepCard key={step.step} step={step} index={i} total={steps.length} />
          ))}
        </div>

        {/* Bottom summary bar */}
        <BottomBar />
      </div>
    </section>
  );
}

/* ── Mobile step row ── */
function MobileStep({ step, index }) {
  const [ref, visible] = useInView(0.1);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="flex items-start gap-4"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-20px)",
        transition: `opacity 0.6s ease ${index * 120}ms, transform 0.6s ease ${index * 120}ms`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon circle */}
      <div
        className="relative flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl transition-all duration-400 z-10"
        style={{
          background: hovered ? step.bg : "rgba(255,255,255,0.05)",
          border: `1.5px solid ${hovered ? step.border : "rgba(255,255,255,0.1)"}`,
          boxShadow: hovered ? `0 0 20px ${step.glow}` : "none",
        }}
      >
        {step.icon}
      </div>

      {/* Text */}
      <div
        className="flex-1 rounded-2xl p-4 transition-all duration-400"
        style={{
          background: hovered ? step.bg : "rgba(255,255,255,0.02)",
          border: `1px solid ${hovered ? step.border : "rgba(255,255,255,0.06)"}`,
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

/* ── Bottom summary bar ── */
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
      {/* Quick steps pill row */}
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

      {/* CTA */}
      <div className="text-center">
        <p className="text-gray-500 mb-6 text-base">
          That is all it takes. Start your first invoice today — free.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            className="group relative inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white rounded-full overflow-hidden transition-all duration-300 hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #A855F7 0%, #7C3AED 50%, #2563EB 100%)",
              boxShadow: "0 6px 25px rgba(168,85,247,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}
            onMouseEnter={e =>
              (e.currentTarget.style.boxShadow =
                "0 8px 35px rgba(168,85,247,0.55), inset 0 1px 0 rgba(255,255,255,0.15)")
            }
            onMouseLeave={e =>
              (e.currentTarget.style.boxShadow =
                "0 6px 25px rgba(168,85,247,0.35), inset 0 1px 0 rgba(255,255,255,0.15)")
            }
          >
            <span>Get Started Free</span>
            <span className="text-sm transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </button>
          <button
            className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-full transition-all duration-300 hover:scale-105"
            style={{
              color: "#93C5FD",
              background: "rgba(37,99,235,0.08)",
              border: "1.5px solid rgba(37,99,235,0.45)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(37,99,235,0.18)";
              e.currentTarget.style.borderColor = "rgba(96,165,250,0.7)";
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(37,99,235,0.25)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(37,99,235,0.08)";
              e.currentTarget.style.borderColor = "rgba(37,99,235,0.45)";
              e.currentTarget.style.color = "#93C5FD";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Watch Demo <span className="text-sm">▶</span>
          </button>
        </div>
      </div>
    </div>
  );
}
