"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import styles from "./ProblemSolutionSection.module.css";

// ── Sequenced divider animation ──────────────────────────────────────────────
// SEQUENCE (each step adds to lit state, nothing turns off until reset):
//
//  phase 0  → all idle / dim
//  phase 1  → top line beacon shoots down  → line stays lit
//  phase 2  → circle ring does ONE fast round → ring stays lit
//  phase 3  → ⚡ bolt double-flashes        → bolt stays lit
//  phase 4  → bottom line beacon shoots    → line stays lit
//  phase 5  → bridge text lights up        → text stays lit
//  phase 6  → short pause (all lit)
//  phase 0  → everything resets → pause → loop
//
// "phase" tracks the HIGHEST active step so far.
// Components are lit when phase >= their step number.

function AnimatedDivider() {
  const [phase, setPhase]       = useState(0);  // 0–6
  const [ringAnim, setRingAnim] = useState(""); // "" | "oneRound" | "lit"
  const [boltAnim, setBoltAnim] = useState(""); // "" | "flash"    | "lit"

  const timerRef = useRef([]);

  const clearAll = () => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  };

  const schedule = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timerRef.current.push(id);
  };

  const runSequence = useCallback(() => {
    clearAll();

    // Phase 1 — top line beacon shoots (500ms anim) → line stays lit
    setPhase(1);
    setRingAnim("");
    setBoltAnim("");

    // Phase 2 — circle does one fast spin round
    schedule(() => {
      setPhase(2);
      setRingAnim("oneRound");
      // After the round completes, keep ring lit
      schedule(() => setRingAnim("lit"), 820);
    }, 600); // wait for top line beacon

    // Phase 3 — bolt flash
    schedule(() => {
      setPhase(3);
      setBoltAnim("flash");
      // After flash, keep bolt lit
      schedule(() => setBoltAnim("lit"), 680);
    }, 600 + 900); // after circle round

    // Phase 4 — bottom line beacon shoots → stays lit
    schedule(() => setPhase(4), 600 + 900 + 500);

    // Phase 5 — bridge text lights up
    schedule(() => setPhase(5), 600 + 900 + 500 + 600);

    // Phase 6 — hold everything lit
    schedule(() => setPhase(6), 600 + 900 + 500 + 600 + 400);

    // Reset — all off, then restart
    schedule(() => {
      setPhase(0);
      setRingAnim("");
      setBoltAnim("");
    }, 600 + 900 + 500 + 600 + 400 + 900);

  }, []); // eslint-disable-line

  // Initial start
  useEffect(() => {
    const id = setTimeout(runSequence, 800);
    return () => { clearAll(); clearTimeout(id); };
  }, []); // eslint-disable-line

  // Restart after reset
  const prevPhase = useRef(1);
  useEffect(() => {
    if (prevPhase.current !== 0 && phase === 0) {
      const id = setTimeout(runSequence, 600);
      timerRef.current.push(id);
    }
    prevPhase.current = phase;
  }, [phase, runSequence]);

  // Derived states — each element is lit once phase reaches its step and stays
  const topLineLit    = phase >= 1;
  const ringActive    = phase >= 2;
  const boltActive    = phase >= 3;
  const bottomLineLit = phase >= 4;
  const textLit       = phase >= 5;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div className={styles.dividerWrap}>

        {/* TOP LINE */}
        <div className={`${styles.lineTrack} ${styles.lineTrackTop} ${topLineLit ? styles.active : ""}`}>
          <div className={styles.lineStatic} />
          <div className={`${styles.lineBeacon} ${styles.lineBeaconTop} ${phase === 1 ? styles.shoot : ""}`} />
        </div>

        {/* CIRCLE */}
        <div className={styles.circleWrap}>
          <div className={`${styles.outerGlow} ${ringActive ? styles.lit : ""}`} />
          <div className={`${styles.spinRing}  ${ringAnim ? styles[ringAnim] : ""}`} />
          <div className={styles.ringMask} />
          <div className={`${styles.innerBg}   ${ringActive ? styles.lit : ""}`} />
          <span className={`${styles.boltIcon} ${boltAnim ? styles[boltAnim] : ""}`}>⚡</span>
        </div>

        {/* BOTTOM LINE */}
        <div className={`${styles.lineTrack} ${styles.lineTrackBottom} ${bottomLineLit ? styles.active : ""}`}>
          <div className={styles.lineStatic} />
          <div className={`${styles.lineBeacon} ${styles.lineBeaconBottom} ${phase === 4 ? styles.shoot : ""}`} />
        </div>

      </div>

      {/* BRIDGE TEXT */}
      <p className={`${styles.bridgeText} ${textLit ? styles.lit : ""}`}>
        Novexa solves all of this — here is how 👇
      </p>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

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

const problems = [
  {
    icon: "📝",
    title: "Manual Billing Errors",
    description:
      "Handwritten or Excel-based invoices are full of calculation mistakes. Wrong totals, missing items, and duplicate entries cost you money and trust.",
    color: "#EF4444",
    glow: "rgba(239,68,68,0.2)",
    border: "rgba(239,68,68,0.3)",
    bg: "rgba(239,68,68,0.06)",
  },
  {
    icon: "💸",
    title: "Payment Tracking Confusion",
    description:
      "You have no idea which client paid, which didn't, and how much is still pending. Chasing payments manually is exhausting and unprofessional.",
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.2)",
    border: "rgba(245,158,11,0.3)",
    bg: "rgba(245,158,11,0.06)",
  },
  {
    icon: "📊",
    title: "Excel Sheets Mess",
    description:
      "Multiple spreadsheets, no version control, and data scattered everywhere. One wrong formula can break your entire financial record.",
    color: "#F97316",
    glow: "rgba(249,115,22,0.2)",
    border: "rgba(249,115,22,0.3)",
    bg: "rgba(249,115,22,0.06)",
  },
  {
    icon: "📉",
    title: "No Real-Time Business View",
    description:
      "You never know how your business is actually performing. No live sales data, no inventory alerts, no dashboard — just guesswork.",
    color: "#EC4899",
    glow: "rgba(236,72,153,0.2)",
    border: "rgba(236,72,153,0.3)",
    bg: "rgba(236,72,153,0.06)",
  },
];

const solutions = [
  {
    icon: "🧾",
    title: "Smart Invoicing",
    description:
      "Generate professional, error-free invoices in seconds. Auto-calculate taxes, totals, and discounts — no manual work needed.",
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.2)",
    border: "rgba(245,158,11,0.3)",
    bg: "rgba(245,158,11,0.06)",
  },
  {
    icon: "👥",
    title: "Customer Management",
    description:
      "Keep all your client records, purchase history, and contact info in one place. Build better relationships with full visibility.",
    color: "#A855F7",
    glow: "rgba(168,85,247,0.2)",
    border: "rgba(168,85,247,0.3)",
    bg: "rgba(168,85,247,0.06)",
  },
  {
    icon: "💳",
    title: "Payment Tracking",
    description:
      "See every invoice status — Paid, Unpaid, or Partial — at a glance. Get notified and follow up without the chaos.",
    color: "#10B981",
    glow: "rgba(16,185,129,0.2)",
    border: "rgba(16,185,129,0.3)",
    bg: "rgba(16,185,129,0.06)",
  },
  {
    icon: "📈",
    title: "Business Dashboard",
    description:
      "A live overview of your sales, revenue, stock levels, and customer activity. Make informed decisions backed by real data.",
    color: "#2563EB",
    glow: "rgba(37,99,235,0.2)",
    border: "rgba(37,99,235,0.3)",
    bg: "rgba(37,99,235,0.06)",
  },
];

function ProblemCard({ item, index }) {
  const [ref, visible] = useInView(0.1);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="relative group cursor-default"
      style={{
        transitionDelay: `${index * 100}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="relative rounded-2xl p-6 h-full flex flex-col transition-all duration-500 overflow-hidden"
        style={{
          background: hovered ? item.bg : "rgba(255,255,255,0.02)",
          border: `1px solid ${hovered ? item.border : "rgba(255,255,255,0.07)"}`,
          boxShadow: hovered ? `0 12px 40px ${item.glow}` : "none",
          transform: hovered ? "translateY(-5px)" : "translateY(0)",
        }}
      >
        {/* Warning pulse badge */}
        <div
          className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full"
          style={{
            background: item.color,
            boxShadow: `0 0 8px ${item.color}`,
            animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
          }}
        />

        {/* Icon */}
        <div
          className="w-13 h-13 w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 transition-all duration-500"
          style={{
            background: hovered ? item.bg : "rgba(255,255,255,0.04)",
            border: `1px solid ${hovered ? item.border : "rgba(255,255,255,0.08)"}`,
            boxShadow: hovered ? `0 0 16px ${item.glow}` : "none",
          }}
        >
          {item.icon}
        </div>

        <h4
          className="font-bold mb-2 transition-colors duration-300"
          style={{ color: hovered ? "#fff" : "#e2e8f0", fontSize: "16px" }}
        >
          {item.title}
        </h4>
        <p
          className="text-sm leading-relaxed flex-1 transition-colors duration-300"
          style={{ color: hovered ? "#9ca3af" : "#6b7280" }}
        >
          {item.description}
        </p>

        {/* Bottom glow line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl transition-all duration-500"
          style={{
            background: `linear-gradient(to right, transparent, ${item.color}, transparent)`,
            opacity: hovered ? 1 : 0,
            transform: hovered ? "scaleX(1)" : "scaleX(0)",
          }}
        />
      </div>
    </div>
  );
}

function SolutionCard({ item, index }) {
  const [ref, visible] = useInView(0.1);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="relative group cursor-default"
      style={{
        transitionDelay: `${index * 100}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="relative rounded-2xl p-6 h-full flex flex-col transition-all duration-500 overflow-hidden"
        style={{
          background: hovered ? item.bg : "rgba(255,255,255,0.02)",
          border: `1px solid ${hovered ? item.border : "rgba(255,255,255,0.07)"}`,
          boxShadow: hovered ? `0 12px 40px ${item.glow}` : "none",
          transform: hovered ? "translateY(-5px)" : "translateY(0)",
        }}
      >
        {/* Checkmark badge */}
        <div
          className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
          style={{
            background: hovered ? item.color : "rgba(255,255,255,0.05)",
            color: hovered ? "#fff" : "transparent",
            border: `1px solid ${hovered ? item.color : "rgba(255,255,255,0.1)"}`,
          }}
        >
          ✓
        </div>

        {/* Icon */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 transition-all duration-500"
          style={{
            background: hovered ? item.bg : "rgba(255,255,255,0.04)",
            border: `1px solid ${hovered ? item.border : "rgba(255,255,255,0.08)"}`,
            boxShadow: hovered ? `0 0 16px ${item.glow}` : "none",
            transform: hovered ? "scale(1.1) rotate(-3deg)" : "scale(1) rotate(0deg)",
          }}
        >
          {item.icon}
        </div>

        <h4
          className="font-bold mb-2 transition-colors duration-300"
          style={{ color: hovered ? "#fff" : "#e2e8f0", fontSize: "16px" }}
        >
          {item.title}
        </h4>
        <p
          className="text-sm leading-relaxed flex-1 transition-colors duration-300"
          style={{ color: hovered ? "#9ca3af" : "#6b7280" }}
        >
          {item.description}
        </p>

        {/* Bottom glow line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl transition-all duration-500"
          style={{
            background: `linear-gradient(to right, transparent, ${item.color}, transparent)`,
            opacity: hovered ? 1 : 0,
            transform: hovered ? "scaleX(1)" : "scaleX(0)",
          }}
        />
      </div>
    </div>
  );
}

export default function ProblemSolutionSection() {
  const [problemRef, problemVisible] = useInView(0.1);
  const [solutionRef, solutionVisible] = useInView(0.1);
  const [dividerRef, dividerVisible] = useInView(0.2);

  return (
    <section className="relative py-24 md:py-32 bg-[#0d1117] overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#10B981]/25 to-transparent" />
        <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] bg-red-600/5 rounded-full blur-[130px]" />
        <div className="absolute bottom-1/3 -right-40 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[130px]" />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ─── PROBLEM BLOCK ─── */}
        <div
          ref={problemRef}
          className="transition-all duration-700"
          style={{
            opacity: problemVisible ? 1 : 0,
            transform: problemVisible ? "translateY(0)" : "translateY(28px)",
          }}
        >
          {/* Label */}
          <div className="flex justify-center mb-6">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#FCA5A5",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              The Problem
            </div>
          </div>

          {/* Heading */}
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-white leading-tight mb-4">
              Managing Business Manually{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}
              >
                Wastes Time & Causes Errors
              </span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Most small businesses still rely on spreadsheets, paper records, and manual tracking.
              Here is what that actually costs you every day.
            </p>
          </div>

          {/* Problem Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {problems.map((item, i) => (
              <ProblemCard key={item.title} item={item} index={i} />
            ))}
          </div>
        </div>

        {/* ─── DIVIDER / TRANSITION ─── */}
        <div
          ref={dividerRef}
          className="flex flex-col items-center my-20 gap-6 transition-all duration-700"
          style={{
            opacity: dividerVisible ? 1 : 0,
            transform: dividerVisible ? "scale(1)" : "scale(0.9)",
          }}
        >
          <AnimatedDivider />
        </div>

        {/* ─── SOLUTION BLOCK ─── */}
        <div
          ref={solutionRef}
          className="transition-all duration-700"
          style={{
            opacity: solutionVisible ? 1 : 0,
            transform: solutionVisible ? "translateY(0)" : "translateY(28px)",
          }}
        >
          {/* Label */}
          <div className="flex justify-center mb-6">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase"
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.3)",
                color: "#6EE7B7",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              The Solution
            </div>
          </div>

          {/* Heading */}
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-white leading-tight mb-4">
              Novexa Gives You{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}
              >
                Everything in One Place
              </span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              One platform. Zero confusion. Novexa replaces your spreadsheets, manual tracking,
              and guesswork with smart, automated tools built for real businesses.
            </p>
          </div>

          {/* Solution Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {solutions.map((item, i) => (
              <SolutionCard key={item.title} item={item} index={i} />
            ))}
          </div>
        </div>

        {/* ─── BOTTOM CTA ─── */}
        <div className="mt-20 text-center">
          <p className="text-gray-500 mb-6 text-base">
            Stop managing manually. Start running smarter.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button className="btn-primary">
              Fix My Business Now <span className="text-sm">→</span>
            </button>
            <button className="btn-secondary">
              See All Features <span className="text-sm">→</span>
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
