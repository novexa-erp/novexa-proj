"use client";

import { useState, useEffect, useCallback } from "react";

const slides = [
  {
    badge: "🚀 Next-Gen ERP Solution",
    title: "Manage Your Entire",
    highlight: "Business Operations",
    subtitle: "in One Place",
    description:
      "Novexa ERP streamlines your inventory, finance, HR, sales, and supply chain — giving you real-time insights and full control over every department.",
    cta: "Start Free Trial",
    ctaSecondary: "Watch Demo",
    gradient: "from-[#0d1117] via-[#0f1f3d] to-[#0d1117]",
    accentColor: "#2563EB",
  },
  {
    badge: "📊 Real-Time Analytics",
    title: "Data-Driven Decisions",
    highlight: "Powerful Dashboards",
    subtitle: "at Your Fingertips",
    description:
      "Get live reports, KPIs, and visual analytics across all business modules. Make smarter decisions faster with intelligent data visualization.",
    cta: "Explore Analytics",
    ctaSecondary: "Learn More",
    gradient: "from-[#0d1117] via-[#1a1000] to-[#0d1117]",
    accentColor: "#F59E0B",
  },
  {
    badge: "🔗 Seamless Integration",
    title: "Connect Every",
    highlight: "Department & Team",
    subtitle: "Effortlessly",
    description:
      "Break down silos between departments. Novexa ERP connects sales, procurement, warehousing, and accounting into a unified workflow.",
    cta: "See Integrations",
    ctaSecondary: "View Modules",
    gradient: "from-[#0d1117] via-[#0a1a2e] to-[#0d1117]",
    accentColor: "#06B6D4",
  },
  {
    badge: "🛡️ Enterprise Security",
    title: "Your Business Data",
    highlight: "Safe & Secure",
    subtitle: "Always Protected",
    description:
      "Bank-level encryption, role-based access control, audit logs, and automated backups keep your critical business data protected 24/7.",
    cta: "Learn About Security",
    ctaSecondary: "Get Demo",
    gradient: "from-[#0d1117] via-[#0f1f3d] to-[#0d1117]",
    accentColor: "#2563EB",
  },
];

const stats = [
  { value: "500+", label: "Businesses" },
  { value: "99.9%", label: "Uptime" },
  { value: "50+", label: "Modules" },
  { value: "24/7", label: "Support" },
];

export default function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState("next");

  const goTo = useCallback(
    (index, dir = "next") => {
      if (animating) return;
      setDirection(dir);
      setAnimating(true);
      setTimeout(() => {
        setCurrent(index);
        setAnimating(false);
      }, 400);
    },
    [animating]
  );

  const next = useCallback(() => {
    goTo((current + 1) % slides.length, "next");
  }, [current, goTo]);

  const prev = useCallback(() => {
    goTo((current - 1 + slides.length) % slides.length, "prev");
  }, [current, goTo]);

  // Auto-play
  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = slides[current];

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden bg-[#0d1117]">
      {/* Animated background grid */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(37,99,235,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(37,99,235,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-amber-500/8 rounded-full blur-[100px] animate-pulse delay-1000" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-cyan-500/8 rounded-full blur-[80px] animate-pulse delay-500" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-blue-400/40 animate-float"
            style={{
              left: `${8 + i * 8}%`,
              top: `${15 + ((i * 17) % 70)}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${3 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex items-center pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 md:py-24">
          <div className="max-w-4xl">
            {/* Badge */}
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6 border transition-all duration-400 ${
                animating ? "opacity-0 -translate-y-3" : "opacity-100 translate-y-0"
              }`}
              style={{
                background: "rgba(37,99,235,0.1)",
                borderColor: "rgba(37,99,235,0.3)",
                color: "#93C5FD",
                transitionTimingFunction: "ease-out",
              }}
            >
              <span>{slide.badge}</span>
            </div>

            {/* Heading */}
            <h1
              className={`text-white leading-tight mb-4 transition-all duration-400 ${
                animating
                  ? direction === "next"
                    ? "opacity-0 translate-x-8"
                    : "opacity-0 -translate-x-8"
                  : "opacity-100 translate-x-0"
              }`}
              style={{ transitionTimingFunction: "ease-out" }}
            >
              <span className="block">{slide.title}</span>
              <span
                className="block bg-gradient-to-r from-[#2563EB] via-[#60A5FA] to-[#F59E0B] bg-clip-text text-transparent"
              >
                {slide.highlight}
              </span>
              <span className="block text-gray-400 text-4xl md:text-5xl font-semibold">
                {slide.subtitle}
              </span>
            </h1>

            {/* Description */}
            <p
              className={`text-gray-400 text-lg md:text-xl leading-relaxed max-w-2xl mb-10 transition-all duration-400 delay-75 ${
                animating ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
              }`}
              style={{ transitionTimingFunction: "ease-out" }}
            >
              {slide.description}
            </p>

            {/* CTA Buttons */}
            <div
              className={`flex flex-wrap gap-4 mb-16 transition-all duration-400 delay-100 ${
                animating ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
              }`}
              style={{ transitionTimingFunction: "ease-out" }}
            >
              {/* Primary Button */}
              <button
                className="group relative inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white rounded-full overflow-hidden transition-all duration-300 hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #B45309 100%)",
                  boxShadow: "0 6px 25px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 8px 35px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,255,0.15)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "0 6px 25px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.15)"}
              >
                <span className="relative z-10">{slide.cta}</span>
                <span className="relative z-10 text-sm">→</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </button>

              {/* Secondary Button */}
              <button
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-full transition-all duration-300 hover:scale-105"
                style={{
                  color: "#93C5FD",
                  background: "rgba(37,99,235,0.08)",
                  border: "1.5px solid rgba(37,99,235,0.45)",
                  boxShadow: "0 4px 15px rgba(37,99,235,0.1)",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(37,99,235,0.18)";
                  e.currentTarget.style.borderColor = "rgba(96,165,250,0.7)";
                  e.currentTarget.style.color = "#fff";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(37,99,235,0.3)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(37,99,235,0.08)";
                  e.currentTarget.style.borderColor = "rgba(37,99,235,0.45)";
                  e.currentTarget.style.color = "#93C5FD";
                  e.currentTarget.style.boxShadow = "0 4px 15px rgba(37,99,235,0.1)";
                }}
              >
                {slide.ctaSecondary}
                <span className="text-sm">→</span>
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div
            className={`grid grid-cols-2 md:grid-cols-4 gap-6 transition-all duration-500 delay-150 ${
              animating ? "opacity-0 translate-y-6" : "opacity-100 translate-y-0"
            }`}
            style={{ transitionTimingFunction: "ease-out" }}
          >
            {stats.map((stat, i) => (
              <div
                key={i}
                className="flex flex-col items-start p-5 rounded-2xl border border-white/8 bg-white/3 backdrop-blur-sm hover:border-blue-500/30 hover:bg-white/5 transition-all duration-200"
              >
                <span className="text-3xl font-bold bg-gradient-to-r from-[#2563EB] to-[#F59E0B] bg-clip-text text-transparent mb-1">
                  {stat.value}
                </span>
                <span className="text-sm text-gray-400 font-medium">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Slider Controls */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-8 pb-8">
        {/* Dot indicators */}
        <div className="flex items-center gap-3">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > current ? "next" : "prev")}
              className={`transition-all duration-300 rounded-full ${
                i === current
                  ? "w-8 h-2.5 bg-gradient-to-r from-[#2563EB] to-[#F59E0B]"
                  : "w-2.5 h-2.5 bg-white/25 hover:bg-white/50"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Progress bar + Arrow buttons */}
        <div className="flex items-center gap-4">
          {/* Auto-play progress */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
            <div className="w-24 h-0.5 bg-white/10 rounded-full overflow-hidden">
              <div
                key={current}
                className="h-full bg-gradient-to-r from-[#2563EB] to-[#F59E0B] rounded-full"
                style={{
                  animation: "progress 5s linear",
                  width: "0%",
                }}
              />
            </div>
            <span>
              {current + 1}/{slides.length}
            </span>
          </div>

          {/* Arrow buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-[#2563EB]/40 text-[#93C5FD] hover:text-white hover:border-[#F59E0B]/60 hover:bg-[#F59E0B]/10 transition-all duration-200"
              aria-label="Previous slide"
            >
              ←
            </button>
            <button
              onClick={next}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#FBBF24] hover:to-[#F59E0B] text-[#0d1117] shadow-md shadow-amber-600/30 hover:shadow-amber-400/40 transition-all duration-200"
              aria-label="Next slide"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0d1117] to-transparent pointer-events-none" />

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.4; }
          50% { transform: translateY(-12px) scale(1.2); opacity: 0.8; }
        }
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .delay-1000 { animation-delay: 1s; }
        .delay-500 { animation-delay: 0.5s; }
      `}</style>
    </section>
  );
}
