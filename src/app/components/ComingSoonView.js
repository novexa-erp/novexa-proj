"use client";

import { useEffect, useState } from "react";

/**
 * ComingSoonView
 * ──────────────
 * Animated "Coming Soon" screen for features that are planned but not yet built.
 * Props:
 *   - feature: string — feature name (e.g. "HR", "Branches")
 *   - icon: string — emoji icon
 *   - description: string — short tagline
 *   - color: string — gradient color string for accents (e.g. "from-blue-500 to-cyan-600")
 *   - accentColor: string — raw CSS color for borders/glows
 */
export default function ComingSoonView({
  feature = "Feature",
  icon = "🚀",
  description = "Hum is feature par kaam kar rahe hain.",
  color = "from-blue-500 to-cyan-600",
  accentColor = "#3b82f6",
}) {
  const [dots, setDots] = useState(0);
  const [floatUp, setFloatUp] = useState(false);
  const [pulse, setPulse] = useState(false);

  // Animated dots ...
  useEffect(() => {
    const id = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => clearInterval(id);
  }, []);

  // Float the icon slightly
  useEffect(() => {
    const id = setInterval(() => setFloatUp(v => !v), 1800);
    return () => clearInterval(id);
  }, []);

  // Pulse the ring
  useEffect(() => {
    const id = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  const dotStr = ".".repeat(dots);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 select-none">

      {/* ── Animated background glow ── */}
      <div
        className="absolute w-72 h-72 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`,
          filter: "blur(40px)",
          transform: "translate(-50%, -50%)",
          left: "50%",
          top: "50%",
        }}
      />

      {/* ── Pulsing outer ring ── */}
      <div
        className="relative flex items-center justify-center mb-8"
        style={{ width: 160, height: 160 }}
      >
        {/* Outer animated ring */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-700"
          style={{
            border: `2px solid ${accentColor}`,
            opacity: pulse ? 0 : 0.25,
            transform: pulse ? "scale(1.35)" : "scale(1)",
          }}
        />
        {/* Middle ring */}
        <div
          className="absolute rounded-full"
          style={{
            inset: 12,
            border: `1.5px solid ${accentColor}44`,
            borderRadius: "50%",
          }}
        />
        {/* Icon container */}
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: 100,
            height: 100,
            background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}08)`,
            border: `2px solid ${accentColor}55`,
            boxShadow: `0 0 40px ${accentColor}30, inset 0 0 20px ${accentColor}10`,
            transition: "transform 0.9s ease-in-out",
            transform: floatUp ? "translateY(-8px)" : "translateY(0px)",
          }}
        >
          <span style={{ fontSize: 46 }}>{icon}</span>
        </div>
      </div>

      {/* ── "Coming Soon" text ── */}
      <div className="text-center mb-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
          style={{
            background: `${accentColor}15`,
            border: `1px solid ${accentColor}35`,
          }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentColor }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>
            Work In Progress
          </span>

        </div>

        <h1 className="text-white font-black mb-2" style={{ fontSize: "clamp(28px, 6vw, 42px)", letterSpacing: "-0.02em" }}>
          Coming Soon{dotStr}
        </h1>

        <p className="font-bold mb-1" style={{ fontSize: "clamp(16px, 4vw, 22px)", color: accentColor }}>
          {icon} {feature}
        </p>

        <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
          {description}
        </p>
      </div>

      {/* ── Separator ── */}
      <div className="flex items-center gap-3 my-5 w-full max-w-xs">
        <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${accentColor}40)` }} />
        <span className="text-xs" style={{ color: `${accentColor}80` }}>●</span>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(to left, transparent, ${accentColor}40)` }} />
      </div>

      {/* ── Feature preview cards ── */}
      <div className="flex flex-wrap gap-2 justify-center max-w-sm mb-8">
        {getFeatureHints(feature).map((hint, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#6b7280",
            }}
          >
            <span>{hint.icon}</span>
            <span>{hint.label}</span>
          </div>
        ))}
      </div>

      {/* ── Notification badge ── */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          maxWidth: 320,
        }}
      >
        <span className="text-xl flex-shrink-0">🔔</span>
        <p className="text-gray-500 text-xs leading-relaxed">
          This feature will be available soon. Contact{" "}
          <a
            href="https://wa.me/923001234567"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold transition-colors hover:opacity-80"
            style={{ color: accentColor }}
          >
            Novexa support
          </a>{" "}
          to get notified when it launches.
        </p>
      </div>
    </div>
  );
}

// ── Per-feature hint chips ────────────────────────────────────────────────────
function getFeatureHints(feature) {
  const map = {
    HR: [
      { icon: "👤", label: "Employee Records" },
      { icon: "📅", label: "Attendance" },
      { icon: "💵", label: "Payroll" },
      { icon: "📝", label: "Leave Management" },
      { icon: "📊", label: "HR Reports" },
    ],
    Branches: [
      { icon: "🏪", label: "Multi-Branch" },
      { icon: "📍", label: "Locations" },
      { icon: "🔄", label: "Stock Transfer" },
      { icon: "📊", label: "Branch Reports" },
      { icon: "👥", label: "Branch Staff" },
    ],
  };
  return map[feature] || [
    { icon: "✨", label: "New Features" },
    { icon: "🚀", label: "Coming Soon" },
  ];
}
