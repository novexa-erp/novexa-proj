"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./HeroSlider.module.css";

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
            className={`absolute w-1 h-1 rounded-full bg-blue-400/40 ${styles['animate-float']}`}
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
          <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
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
              <span className="block text-4xl md:text-6xl font-bold">{slide.title}</span>
              <span
                className="block text-4xl md:text-6xl font-bold bg-gradient-to-r from-[#2563EB] via-[#60A5FA] to-[#F59E0B] bg-clip-text text-transparent"
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
                className="btn-primary group"
              >
                <span className="relative z-10">{slide.cta}</span>
                <span className="relative z-10 text-sm">→</span>
              </button>

              {/* Secondary Button */}
              <button className="btn-secondary">
                {slide.ctaSecondary}
                <span className="text-sm">→</span>
              </button>
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

          {/* Right Side - Animated Visual Content */}
          <div className="relative hidden lg:block">
            {/* Main Dashboard Card */}
            <div
              className={`relative transition-all duration-700 ${
                animating
                  ? direction === "next"
                    ? "opacity-0 translate-x-12 scale-95"
                    : "opacity-0 -translate-x-12 scale-95"
                  : "opacity-100 translate-x-0 scale-100"
              }`}
              style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
            >
              {/* Glow effect behind card */}
              <div
                className="absolute -inset-4 rounded-3xl blur-2xl opacity-30 animate-pulse"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${slide.accentColor}40, transparent 70%)`,
                }}
              />

              {/* Main Dashboard Preview */}
              <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl overflow-hidden">
                {/* Card Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{ background: slide.accentColor }}
                    />
                    <span className="text-white/90 font-semibold text-sm">Live Dashboard</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-white/30"
                      />
                    ))}
                  </div>
                </div>

                {/* Animated Chart/Graph Area */}
                <div className="space-y-4 mb-6">
                  {/* Bar Chart Visualization */}
                  <div className="flex items-end justify-between gap-2 h-32">
                    {[65, 85, 45, 95, 75, 60, 88].map((height, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div
                          className="w-full rounded-t-lg transition-all duration-1000 relative overflow-hidden"
                          style={{
                            height: `${height}%`,
                            background: `linear-gradient(180deg, ${slide.accentColor}dd, ${slide.accentColor}44)`,
                            animationDelay: `${i * 100}ms`,
                          }}
                        >
                          <div
                            className={`absolute inset-0 ${styles['animate-shimmer']}`}
                            style={{
                              background: `linear-gradient(to bottom, transparent, ${slide.accentColor}88, transparent)`,
                            }}
                          />
                        </div>
                        <div className="w-1 h-1 rounded-full bg-white/40" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metrics Cards Row */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Revenue", value: "$142K", change: "+12.5%" },
                    { label: "Orders", value: "1,834", change: "+8.2%" },
                  ].map((metric, i) => (
                    <div
                      key={i}
                      className={`bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 ${styles['animate-slide-up']}`}
                      style={{
                        animationDelay: `${i * 150}ms`,
                      }}
                    >
                      <div className="text-white/50 text-xs mb-1">{metric.label}</div>
                      <div className="text-white font-bold text-xl mb-1">{metric.value}</div>
                      <div
                        className="text-xs font-semibold"
                        style={{ color: slide.accentColor }}
                      >
                        {metric.change} ↗
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating Side Cards */}
              <div
                className={`absolute -right-6 top-12 transition-all duration-700 delay-150 ${
                  animating ? "opacity-0 translate-x-8 rotate-6" : "opacity-100 translate-x-0 rotate-3"
                }`}
                style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              >
                <div className="w-48 bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-xl hover:scale-105 transition-transform duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: `${slide.accentColor}33` }}
                    >
                      📊
                    </div>
                    <div>
                      <div className="text-white text-sm font-semibold">Analytics</div>
                      <div className="text-white/50 text-xs">Real-time</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={styles['animate-progress']}
                        style={{ background: slide.accentColor, width: "0%" }}
                      />
                    </div>
                    <span className="text-white/70 text-xs">87%</span>
                  </div>
                </div>
              </div>

              <div
                className={`absolute -left-6 bottom-16 transition-all duration-700 delay-200 ${
                  animating ? "opacity-0 -translate-x-8 -rotate-6" : "opacity-100 translate-x-0 -rotate-3"
                }`}
                style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              >
                <div className="w-44 bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-xl hover:scale-105 transition-transform duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-xs font-medium">Active Users</span>
                    <div
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ background: slide.accentColor }}
                    />
                  </div>
                  <div className="text-white text-2xl font-bold mb-1">2,847</div>
                  <div className="text-xs" style={{ color: slide.accentColor }}>
                    +324 today
                  </div>
                </div>
              </div>

              {/* Floating Icons/Elements */}
              <div
                className={`absolute -top-8 right-12 transition-all duration-1000 ${
                  animating ? "opacity-0 scale-0" : "opacity-100 scale-100"
                }`}
              >
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-lg backdrop-blur-sm ${styles['animate-float']}`}
                  style={{
                    background: `linear-gradient(135deg, ${slide.accentColor}55, ${slide.accentColor}22)`,
                    border: `1px solid ${slide.accentColor}44`,
                    animationDelay: "0s",
                    animationDuration: "3s",
                  }}
                >
                  💡
                </div>
              </div>

              <div
                className={`absolute top-1/2 -right-8 transition-all duration-1000 delay-100 ${
                  animating ? "opacity-0 scale-0" : "opacity-100 scale-100"
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl shadow-lg backdrop-blur-sm ${styles['animate-float']}`}
                  style={{
                    background: `linear-gradient(135deg, ${slide.accentColor}55, ${slide.accentColor}22)`,
                    border: `1px solid ${slide.accentColor}44`,
                    animationDelay: "0.5s",
                    animationDuration: "3.5s",
                  }}
                >
                  🚀
                </div>
              </div>

              <div
                className={`absolute bottom-8 right-1/4 transition-all duration-1000 delay-200 ${
                  animating ? "opacity-0 scale-0" : "opacity-100 scale-100"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg shadow-lg backdrop-blur-sm ${styles['animate-float']}`}
                  style={{
                    background: `linear-gradient(135deg, ${slide.accentColor}55, ${slide.accentColor}22)`,
                    border: `1px solid ${slide.accentColor}44`,
                    animationDelay: "1s",
                    animationDuration: "4s",
                  }}
                >
                  ⚡
                </div>
              </div>
            </div>
          </div>
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
                className={`h-full bg-gradient-to-r from-[#2563EB] to-[#F59E0B] rounded-full ${styles['animate-progress']}`}
                style={{
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
    </section>
  );
}
