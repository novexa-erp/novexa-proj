"use client";

import { useEffect, useRef, useState } from "react";

const features = [
  {
    icon: "🧾",
    number: "01",
    title: "Invoice Management",
    description:
      "Create professional invoices in seconds with custom branding, itemized billing, and automatic tax calculations.",
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.25)",
    border: "rgba(245,158,11,0.3)",
    bg: "rgba(245,158,11,0.06)",
  },
  {
    icon: "📄",
    number: "02",
    title: "PDF Generation",
    description:
      "Export any invoice, report, or document as a clean, print-ready PDF with a single click. Share instantly via email.",
    color: "#2563EB",
    glow: "rgba(37,99,235,0.25)",
    border: "rgba(37,99,235,0.3)",
    bg: "rgba(37,99,235,0.06)",
  },
  {
    icon: "📦",
    number: "03",
    title: "Product Management",
    description:
      "Manage your entire product catalog in one place. Update categories, pricing, and descriptions with ease.",
    color: "#06B6D4",
    glow: "rgba(6,182,212,0.25)",
    border: "rgba(6,182,212,0.3)",
    bg: "rgba(6,182,212,0.06)",
  },
  {
    icon: "📊",
    number: "04",
    title: "Stock Tracking",
    description:
      "Monitor real-time inventory levels, get low stock alerts, and maintain accurate stock counts across all locations.",
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.25)",
    border: "rgba(245,158,11,0.3)",
    bg: "rgba(245,158,11,0.06)",
  },
  {
    icon: "💳",
    number: "05",
    title: "Payment Status",
    description:
      "Track every invoice at a glance — Paid, Unpaid, or Partial. Never lose track of outstanding payments again.",
    color: "#10B981",
    glow: "rgba(16,185,129,0.25)",
    border: "rgba(16,185,129,0.3)",
    bg: "rgba(16,185,129,0.06)",
  },
  {
    icon: "👥",
    number: "06",
    title: "Customer Management",
    description:
      "Add and manage your customers, view their full purchase history, add notes, and build stronger business relationships.",
    color: "#A855F7",
    glow: "rgba(168,85,247,0.25)",
    border: "rgba(168,85,247,0.3)",
    bg: "rgba(168,85,247,0.06)",
  },
];

const stats = [
  { value: "1M+", label: "Invoices Generated", icon: "🧾" },
  { value: "500+", label: "Businesses Onboard", icon: "🏢" },
  { value: "99%", label: "Customer Satisfaction", icon: "⭐" },
  { value: "6+", label: "Core Modules", icon: "🔧" },
];

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

function FeatureCard({ feature, index }) {
  const [ref, visible] = useInView(0.1);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="relative group cursor-default"
      style={{
        transitionDelay: `${index * 100}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(40px) scale(0.96)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Outer glow on hover */}
      <div
        className="absolute -inset-px rounded-2xl transition-opacity duration-500"
        style={{
          background: `linear-gradient(135deg, ${feature.border}, transparent 60%)`,
          opacity: hovered ? 1 : 0,
          filter: `blur(1px)`,
        }}
      />

      {/* Card body */}
      <div
        className="relative rounded-2xl p-6 h-full flex flex-col transition-all duration-500 overflow-hidden"
        style={{
          background: hovered
            ? `linear-gradient(135deg, ${feature.bg}, rgba(13,17,23,0.95))`
            : "rgba(255,255,255,0.03)",
          border: `1px solid ${hovered ? feature.border : "rgba(255,255,255,0.07)"}`,
          boxShadow: hovered ? `0 12px 40px ${feature.glow}, 0 0 0 1px ${feature.border}` : "none",
          transform: hovered ? "translateY(-6px)" : "translateY(0)",
        }}
      >
        {/* Shimmer sweep */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) 50%, transparent 60%)",
            transform: hovered ? "translateX(100%)" : "translateX(-100%)",
            transition: "transform 0.8s ease",
          }}
        />

        {/* Number watermark */}
        <span
          className="absolute top-4 right-5 font-black select-none pointer-events-none transition-all duration-500"
          style={{
            fontSize: "56px",
            lineHeight: 1,
            color: feature.color,
            opacity: hovered ? 0.12 : 0.06,
          }}
        >
          {feature.number}
        </span>

        {/* Icon box */}
        <div
          className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-5 transition-all duration-500"
          style={{
            background: hovered ? feature.bg : "rgba(255,255,255,0.05)",
            border: `1px solid ${hovered ? feature.border : "rgba(255,255,255,0.08)"}`,
            boxShadow: hovered ? `0 0 20px ${feature.glow}` : "none",
            transform: hovered ? "scale(1.1) rotate(-4deg)" : "scale(1) rotate(0deg)",
          }}
        >
          {feature.icon}
          {/* Ping dot */}
          {hovered && (
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-ping"
              style={{ background: feature.color }}
            />
          )}
          {hovered && (
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
              style={{ background: feature.color }}
            />
          )}
        </div>

        {/* Title */}
        <h4
          className="font-bold text-white mb-3 transition-colors duration-300"
          style={{
            fontSize: "17px",
            color: hovered ? "#fff" : "#e2e8f0",
          }}
        >
          {feature.title}
        </h4>

        {/* Description */}
        <p className="text-gray-400 text-sm leading-relaxed flex-1 transition-colors duration-300"
          style={{ color: hovered ? "#9ca3af" : "#6b7280" }}>
          {feature.description}
        </p>

        {/* Bottom arrow link */}
        {/* <div
          className="flex items-center gap-1.5 mt-4 text-xs font-semibold transition-all duration-300"
          style={{
            color: feature.color,
            opacity: hovered ? 1 : 0,
            transform: hovered ? "translateX(0)" : "translateX(-8px)",
          }}
        >
          Learn more
          <span
            className="transition-transform duration-300"
            style={{ transform: hovered ? "translateX(4px)" : "translateX(0)" }}
          >
            →
          </span>
        </div> */}

        {/* Bottom glow line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl transition-all duration-500"
          style={{
            background: `linear-gradient(to right, transparent, ${feature.color}, transparent)`,
            opacity: hovered ? 1 : 0,
            transform: hovered ? "scaleX(1)" : "scaleX(0)",
          }}
        />
      </div>
    </div>
  );
}

function StatCard({ stat, index }) {
  const [ref, visible] = useInView(0.1);
  return (
    <div
      ref={ref}
      className="relative group flex flex-col items-center justify-center py-10 px-6 text-center rounded-2xl overflow-hidden transition-all duration-500 cursor-default"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s ease ${index * 120}ms, transform 0.6s ease ${index * 120}ms`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.borderColor = index % 2 === 0 ? "rgba(245,158,11,0.3)" : "rgba(37,99,235,0.3)";
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = index % 2 === 0
          ? "0 8px 30px rgba(245,158,11,0.15)"
          : "0 8px 30px rgba(37,99,235,0.15)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <span className="text-3xl mb-3">{stat.icon}</span>
      <span
        className="text-4xl font-black mb-1 bg-clip-text text-transparent"
        style={{
          backgroundImage: index % 2 === 0
            ? "linear-gradient(135deg, #F59E0B, #D97706)"
            : "linear-gradient(135deg, #2563EB, #60A5FA)",
        }}
      >
        {stat.value}
      </span>
      <span className="text-gray-400 text-sm font-medium">{stat.label}</span>
    </div>
  );
}

export default function AboutSection() {
  const [titleRef, titleVisible] = useInView(0.2);
  const [introRef, introVisible] = useInView(0.15);

  return (
    <section className="relative py-24 md:py-32 bg-[#0d1117] overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB]/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F59E0B]/25 to-transparent" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-amber-500/6 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/3 rounded-full blur-[150px]" />
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(rgba(37,99,235,0.15) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div
          ref={titleRef}
          className="text-center max-w-3xl mx-auto mb-20 transition-all duration-700"
          style={{
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? "translateY(0)" : "translateY(28px)",
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
            <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse" />
            Who We Are
          </div>

          <h2 className="text-white mb-6 leading-tight">
            Your Entire Business,{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}
            >
              One Platform
            </span>
          </h2>

          <p className="text-gray-400 text-lg leading-relaxed">
            Novexa ERP is a complete business management solution. Whether you need to create invoices,
            track stock, or manage customers — everything is available in one place, simple and fast.
          </p>
        </div>

        {/* Two-column intro cards */}
        <div
          ref={introRef}
          className="grid md:grid-cols-2 gap-6 mb-20 transition-all duration-700"
          style={{
            opacity: introVisible ? 1 : 0,
            transform: introVisible ? "translateY(0)" : "translateY(28px)",
            transitionDelay: "100ms",
          }}
        >
          {[
            {
              icon: "🏢",
              color: "#2563EB",
              bg: "rgba(37,99,235,0.1)",
              border: "rgba(37,99,235,0.25)",
              title: "What We Do",
              text: "We give small and medium businesses the tools to manage their entire operation digitally. From sales to payments, inventory to customers — Novexa ERP organizes and automates every part of your business workflow.",
            },
            {
              icon: "🎯",
              color: "#F59E0B",
              bg: "rgba(245,158,11,0.1)",
              border: "rgba(245,158,11,0.25)",
              title: "Our Mission",
              text: "To give every business owner a powerful tool that is easy to use. No complex setup — with Novexa ERP you can get started in minutes and run your business professionally from day one.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="group relative rounded-2xl p-7 overflow-hidden transition-all duration-400 cursor-default"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid rgba(255,255,255,0.07)`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = item.bg;
                e.currentTarget.style.borderColor = item.border;
                e.currentTarget.style.boxShadow = `0 12px 40px ${item.bg}`;
                e.currentTarget.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* Big bg icon watermark */}
              <span
                className="absolute -bottom-4 -right-4 text-8xl opacity-5 select-none pointer-events-none"
              >
                {item.icon}
              </span>
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: item.bg, border: `1px solid ${item.border}` }}
                >
                  {item.icon}
                </div>
                <h3 className="text-white text-xl font-bold">{item.title}</h3>
              </div>
              <p className="text-gray-400 leading-relaxed text-sm">{item.text}</p>
            </div>
          ))}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>

        {/* Stats Row */}
        {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {stats.map((stat, i) => (
            <StatCard key={i} stat={stat} index={i} />
          ))}
        </div> */}

        {/* Bottom CTA */}
        <div
          className="text-center transition-all duration-700"
          style={{
            opacity: titleVisible ? 1 : 0,
            transitionDelay: "400ms",
          }}
        >
          <p className="text-gray-500 mb-6 text-base">
            Ready to transform the way you run your business?
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              className="group relative inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white rounded-full overflow-hidden transition-all duration-300 hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #B45309 100%)",
                boxShadow: "0 6px 25px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 8px 35px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,255,0.15)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 6px 25px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.15)"}
            >
              <span>Start Free Trial</span>
              <span className="text-sm transition-transform duration-300 group-hover:translate-x-1">→</span>
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
              View All Features <span className="text-sm">→</span>
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
