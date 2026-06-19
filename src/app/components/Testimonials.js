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

const testimonials = [
  {
    name: "Ahmed Raza",
    role: "Owner, Raza Traders",
    avatar: "AR",
    rating: 5,
    text: "Made invoicing 10x faster. I used to spend 2 hours making invoices in Excel. Now it takes 5 minutes. Invorex is a game changer for my business.",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
  },
  {
    name: "Sara Khan",
    role: "CEO, SkyCraft Studio",
    avatar: "SK",
    rating: 5,
    text: "Best ERP for small business. The customer management and payment tracking features alone saved us from so many billing disputes. Highly recommended.",
    color: "#2563EB",
    bg: "rgba(37,99,235,0.08)",
    border: "rgba(37,99,235,0.25)",
  },
  {
    name: "Bilal Mehmood",
    role: "Manager, QuickMart",
    avatar: "BM",
    rating: 5,
    text: "Finally a tool that just works. No complex setup, no training needed. We onboarded our whole team in one afternoon. The PDF export is super clean.",
    color: "#10B981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.25)",
  },
  {
    name: "Fatima Noor",
    role: "Founder, Bloom Boutique",
    avatar: "FN",
    rating: 5,
    text: "I send invoices to clients on WhatsApp directly from the app. My clients love how professional it looks. My sales have improved since I started using Invorex.",
    color: "#A855F7",
    bg: "rgba(168,85,247,0.08)",
    border: "rgba(168,85,247,0.25)",
  },
  {
    name: "Usman Ali",
    role: "Director, TechBridge Pvt",
    avatar: "UA",
    rating: 5,
    text: "Stock tracking was always a headache. Now I get low-stock alerts automatically. The dashboard gives me a real-time view of my entire business.",
    color: "#06B6D4",
    bg: "rgba(6,182,212,0.08)",
    border: "rgba(6,182,212,0.25)",
  },
  {
    name: "Zara Siddiqui",
    role: "Owner, ZS Accessories",
    avatar: "ZS",
    rating: 5,
    text: "Switched from a very expensive ERP to Invorex and honestly I don't miss anything. Everything I need is here — invoices, customers, products, payments.",
    color: "#EC4899",
    bg: "rgba(236,72,153,0.08)",
    border: "rgba(236,72,153,0.25)",
  },
];

function StarRating({ count, color }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" fill={color}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({ t, index }) {
  const [ref, visible] = useInView(0.08);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="relative cursor-default"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(40px) scale(0.96)",
        transition: `opacity 0.65s ease ${index * 110}ms, transform 0.65s ease ${index * 110}ms`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="relative rounded-2xl p-6 h-full flex flex-col transition-all duration-500 overflow-hidden"
        style={{
          background: hovered ? t.bg : "rgba(255,255,255,0.025)",
          border: `1px solid ${hovered ? t.border : "rgba(255,255,255,0.07)"}`,
          boxShadow: hovered ? `0 16px 48px ${t.bg}` : "none",
          transform: hovered ? "translateY(-6px)" : "translateY(0)",
        }}
      >
        {/* Shimmer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 50%, transparent 60%)",
            transform: hovered ? "translateX(100%)" : "translateX(-100%)",
            transition: "transform 0.9s ease",
          }}
        />

        {/* Quote mark */}
        <span
          className="absolute top-4 right-5 font-serif select-none pointer-events-none transition-all duration-500"
          style={{
            fontSize: "72px",
            lineHeight: 1,
            color: t.color,
            opacity: hovered ? 0.13 : 0.06,
          }}
        >
          "
        </span>

        {/* Stars */}
        <div className="mb-4">
          <StarRating count={t.rating} color={t.color} />
        </div>

        {/* Text */}
        <p
          className="text-sm leading-relaxed flex-1 mb-5 transition-colors duration-300"
          style={{ color: hovered ? "#d1d5db" : "#9ca3af" }}
        >
          "{t.text}"
        </p>

        {/* Author */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all duration-500"
            style={{
              background: hovered ? t.bg : "rgba(255,255,255,0.05)",
              border: `1.5px solid ${hovered ? t.border : "rgba(255,255,255,0.1)"}`,
              color: hovered ? t.color : "#6b7280",
              boxShadow: hovered ? `0 0 16px ${t.bg}` : "none",
            }}
          >
            {t.avatar}
          </div>
          <div>
            <p className="text-white text-sm font-bold">{t.name}</p>
            <p className="text-gray-500 text-xs">{t.role}</p>
          </div>

          {/* Verified badge */}
          <div
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-300"
            style={{
              background: hovered ? t.bg : "transparent",
              border: `1px solid ${hovered ? t.border : "transparent"}`,
              color: hovered ? t.color : "transparent",
            }}
          >
            ✓ Verified
          </div>
        </div>

        {/* Bottom glow */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl transition-all duration-500"
          style={{
            background: `linear-gradient(to right, transparent, ${t.color}, transparent)`,
            opacity: hovered ? 1 : 0,
            transform: hovered ? "scaleX(1)" : "scaleX(0)",
          }}
        />
      </div>
    </div>
  );
}

export default function Testimonials() {
  const [headerRef, headerVisible] = useInView(0.2);

  return (
    <section className="relative py-24 md:py-32 bg-[#0d1117] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#F59E0B]/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB]/25 to-transparent" />
        <div className="absolute top-1/4 -left-40 w-[500px] h-[500px] bg-amber-500/4 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 -right-40 w-[500px] h-[500px] bg-blue-600/4 rounded-full blur-[150px]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
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
          className="text-center max-w-2xl mx-auto mb-16 transition-all duration-700"
          style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(28px)",
          }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
            style={{
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.3)",
              color: "#FCD34D",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Testimonials
          </div>

          <h2 className="text-white leading-tight mb-4">
            Trusted by{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #F59E0B, #EF4444 50%, #A855F7)" }}
            >
              Real Businesses
            </span>
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            From small shops to growing companies — here is what our users say about Invorex.
          </p>

          {/* Rating summary */}
          <div
            className="inline-flex items-center gap-3 mt-6 px-5 py-3 rounded-full"
            style={{
              background: "rgba(245,158,11,0.07)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <StarRating count={5} color="#F59E0B" />
            <span className="text-white font-bold text-sm">4.9 / 5</span>
            <span className="text-gray-500 text-xs">from 500+ reviews</span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <TestimonialCard key={t.name} t={t} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
