"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Countdown end date (for banner only) ─────────────────────────────────────
const EARLY_BIRD_END = new Date("2026-08-14T23:59:59");
// ─────────────────────────────────────────────────────────────────────────────

// ── Hook: real-time plans from Firestore ─────────────────────────────────────
// Returns null while loading, then a map: { starter: {...}, business: {...} }
function useFirestorePlans() {
  const [fsPlans, setFsPlans] = useState(undefined); // undefined = still loading
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "adminConfig", "plans"),
      (snap) => {
        if (snap.exists()) {
          const list = snap.data().list || [];
          const map = {};
          list.forEach(p => { map[p.id] = p; });
          setFsPlans(map);
        } else {
          setFsPlans({}); // empty — no data in Firestore yet
        }
      },
      () => setFsPlans({}) // error → empty map
    );
    return () => unsub();
  }, []);
  return fsPlans; // undefined = loading, {} or {plan: data} = loaded
}

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

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(targetDate) {
  const calc = () => {
    const diff = targetDate - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    return {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000)  / 60000),
      seconds: Math.floor((diff % 60000)    / 1000),
      expired: false,
    };
  };
  // Start with null to avoid hydration mismatch; populate after mount
  const [time, setTime] = useState(null);
  useEffect(() => {
    setTime(calc());
    const t = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Before hydration return "not expired" so early-bird UI is always shown
  if (time === null) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: false };
  return time;
}

// ── Plan definitions ──────────────────────────────────────────────────────────
const plans = [
  {
    id: "starter",
    name: "Starter",
    icon: "💎",
    tagline: "Small Shop, Freelancer, Home Business",
    color: "#10B981",
    glowColor: "rgba(16,185,129,0.18)",
    borderColor: "rgba(16,185,129,0.35)",
    badge: null,
    cta: "Start Free Demo",
    ctaStyle: "green",
    features: {
      users: "4 User", invoices: "100 / Month", customers: "100 Customers",
      inventory: true, purchases: true, payments: true, analytics: false,
      email: "Email Support", orderForm: false, multiBranch: false, api: false,
      support: "Email Support",
    },
  },
  {
    id: "business",
    name: "Business",
    icon: "🚀",
    tagline: "Growing Businesses",
    color: "#2563EB",
    glowColor: "rgba(37,99,235,0.22)",
    borderColor: "rgba(37,99,235,0.5)",
    badge: "Most Popular",
    cta: "Start Free Demo",
    ctaStyle: "blue",
    features: {
      users: "8 Users", invoices: "Unlimited", customers: "Unlimited",
      inventory: true, purchases: true, payments: true, analytics: true,
      email: "Email Notifications", orderForm: true, multiBranch: false, api: false,
      support: "Priority Support",
    },
  },
  {
    id: "professional",
    name: "Professional",
    icon: "👑",
    tagline: "Medium Companies",
    color: "#F59E0B",
    glowColor: "rgba(245,158,11,0.18)",
    borderColor: "rgba(245,158,11,0.4)",
    badge: "Best Value",
    cta: "Start Free Demo",
    ctaStyle: "amber",
    features: {
      users: "14 Users", invoices: "Unlimited", customers: "Unlimited",
      inventory: true, purchases: true, payments: true, analytics: "Advanced",
      email: "Email Automation", orderForm: true, multiBranch: true, api: "Coming Soon",
      support: "Priority Support",
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: "🏢",
    tagline: "Large Organizations",
    color: "#A855F7",
    glowColor: "rgba(168,85,247,0.15)",
    borderColor: "rgba(168,85,247,0.35)",
    badge: null,
    cta: "Contact Sales",
    ctaStyle: "purple",
    features: {
      users: "Unlimited", invoices: "Unlimited", customers: "Unlimited",
      inventory: true, purchases: true, payments: true, analytics: "Advanced",
      email: "Email Automation", orderForm: true, multiBranch: "Unlimited", api: true,
      support: "SLA + Dedicated AM",
    },
  },
];

const compareRows = [
  { key: "users",       label: "Users" },
  { key: "invoices",    label: "Invoices" },
  { key: "customers",   label: "Customers" },
  { key: "inventory",   label: "Inventory" },
  { key: "purchases",   label: "Purchases" },
  { key: "payments",    label: "Payments" },
  { key: "analytics",   label: "Analytics" },
  { key: "email",       label: "Email" },
  { key: "orderForm",   label: "Order Form" },
  { key: "multiBranch", label: "Multi-Branch" },
  { key: "api",         label: "API Access" },
  { key: "support",     label: "Support" },
];

// ── Countdown Banner ──────────────────────────────────────────────────────────
function CountdownBanner() {
  const { days, hours, minutes, seconds, expired } = useCountdown(EARLY_BIRD_END);
  if (expired) return null;

  const pad = (n) => String(n).padStart(2, "0");
  const units = [
    { label: "Days",    val: pad(days) },
    { label: "Hours",   val: pad(hours) },
    { label: "Minutes", val: pad(minutes) },
    { label: "Seconds", val: pad(seconds) },
  ];

  //Offer koi lagyae to uska countdown hay 

  // return (
  //   <div
  //     className="relative overflow-hidden mx-4 sm:mx-6 lg:mx-8 mb-8 rounded-2xl px-6 py-4"
  //     style={{
  //       background: "linear-gradient(135deg,rgba(239,68,68,0.12),rgba(245,158,11,0.10))",
  //       border: "1px solid rgba(239,68,68,0.3)",
  //       boxShadow: "0 0 30px rgba(239,68,68,0.1)",
  //     }}
  //   >
  //     {/* Shimmer line */}
  //     <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-400/60 to-transparent" />

  //     <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-center">
  //       <div className="flex items-center gap-2">
  //         <span className="text-2xl">🔥</span>
  //         <div>
  //           <p className="text-white font-bold text-sm md:text-base">Early Bird Offer — Limited Time!</p>
  //           <p className="text-gray-400 text-xs">Yeh discount offer sirf kuch waqt ke liye hai. Jaldi karein!</p>
  //         </div>
  //       </div>

  //       <div className="flex items-center gap-2">
  //         {units.map((u, i) => (
  //           <div key={u.label} className="flex items-center gap-2">
  //             <div className="flex flex-col items-center">
  //               <div
  //                 className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black tabular-nums"
  //                 style={{
  //                   background: "rgba(239,68,68,0.15)",
  //                   border: "1px solid rgba(239,68,68,0.35)",
  //                   color: "#fca5a5",
  //                   fontVariantNumeric: "tabular-nums",
  //                 }}
  //               >
  //                 {u.val}
  //               </div>
  //               <span className="text-gray-500 text-[10px] mt-1 uppercase tracking-wider">{u.label}</span>
  //             </div>
  //             {i < units.length - 1 && (
  //               <span className="text-red-400 font-bold text-lg mb-4">:</span>
  //             )}
  //           </div>
  //         ))}
  //       </div>
  //     </div>
  //   </div>
  // );

}

// ── Helper: feature cell ──────────────────────────────────────────────────────
function FeatureCell({ value, color }) {
  if (value === true)  return <span className="text-lg" style={{ color: "#10B981" }}>✓</span>;
  if (value === false) return <span className="text-lg text-gray-700">✕</span>;
  return <span className="text-xs font-semibold" style={{ color }}>{value}</span>;
}

// ── CTA button style map ──────────────────────────────────────────────────────
const ctaStyleMap = {
  green:  { background: "rgba(16,185,129,0.12)",               border: "1px solid rgba(16,185,129,0.35)", color: "#10B981", shadow: "0 6px 20px rgba(16,185,129,0.3)" },
  blue:   { background: "linear-gradient(135deg,#2563EB,#1d4ed8)", border: "none",                       color: "#fff",    shadow: "0 6px 25px rgba(37,99,235,0.5)"  },
  amber:  { background: "linear-gradient(135deg,#F59E0B,#D97706)", border: "none",                       color: "#fff",    shadow: "0 6px 25px rgba(245,158,11,0.45)"},
  purple: { background: "linear-gradient(135deg,#A855F7,#9333ea)", border: "none",                       color: "#fff",    shadow: "0 6px 25px rgba(168,85,247,0.4)" },
};

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, isYearly, index, fsPlans }) {
  const [ref, visible] = useInView(0.08);
  const [hovered, setHovered] = useState(false);

  const isPopular = plan.badge === "Most Popular";

  // ── Prices from Firestore only — no hardcoded fallback ───────────────────
  const fsData         = fsPlans?.[plan.id];
  // Main price (blank = Custom)
  const mainMonthly    = fsData !== undefined ? (fsData?.monthlyPrice ?? null)      : null;
  const mainYearly     = fsData !== undefined ? (fsData?.yearlyPrice  ?? null)      : null;
  // Discount price — if set, main becomes crossed and this shown big
  const discountMonthly = fsData?.afterMonthlyPrice ?? null;
  const discountYearly  = fsData?.afterYearlyPrice  ?? null;
  const discountLabel   = fsData?.discountLabel     ?? "";

  const hasDiscount = plan.id !== "enterprise" && !!(isYearly ? discountYearly : discountMonthly);

  // What to show big
  const displayPrice = plan.id === "enterprise" ? null
    : hasDiscount
      ? (isYearly ? discountYearly  : discountMonthly)
      : (isYearly ? mainYearly      : mainMonthly);

  // What to show crossed
  const crossedPrice = hasDiscount
    ? (isYearly ? mainYearly : mainMonthly)
    : null;

  const discountPct = hasDiscount && crossedPrice && displayPrice
    ? Math.round((1 - displayPrice / crossedPrice) * 100) : 0;

  const planName = fsData?.name || plan.name;
  const planIcon = fsData?.icon || plan.icon;

  const cta = ctaStyleMap[plan.ctaStyle];

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col rounded-3xl p-6 transition-all duration-700"
      style={{
        opacity:   visible ? 1 : 0,
        transform: visible
          ? hovered ? "translateY(-6px) scale(1.02)" : "translateY(0) scale(1)"
          : "translateY(40px) scale(0.95)",
        transitionDelay: visible ? "0ms" : `${index * 110}ms`,
        background: isPopular
          ? "linear-gradient(145deg,rgba(37,99,235,0.14),rgba(37,99,235,0.05))"
          : "rgba(255,255,255,0.03)",
        border: `1.5px solid ${hovered || isPopular ? plan.borderColor : "rgba(255,255,255,0.08)"}`,
        boxShadow: hovered
          ? `0 20px 50px ${plan.glowColor}`
          : isPopular ? `0 0 40px ${plan.glowColor}` : "none",
      }}
    >
      {/* Plan badge (Most Popular / Best Value) */}
      {plan.badge && (
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap z-10"
          style={{
            background: isPopular
              ? "linear-gradient(135deg,#2563EB,#1d4ed8)"
              : "linear-gradient(135deg,#F59E0B,#D97706)",
            boxShadow: isPopular
              ? "0 4px 14px rgba(37,99,235,0.55)"
              : "0 4px 14px rgba(245,158,11,0.5)",
            color: "#fff",
          }}
        >
          {isPopular ? "⭐ Most Popular" : "💎 Best Value"}
        </div>
      )}

      {/* Discount % badge — only if before price set AND label exists */}
      {hasDiscount && discountPct > 0 && (
        <div
          className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-black"
          style={{
            background: "linear-gradient(135deg,rgba(239,68,68,0.9),rgba(220,38,38,0.9))",
            color: "#fff",
            boxShadow: "0 3px 12px rgba(239,68,68,0.5)",
          }}
        >
          -{discountPct}% OFF
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4 mb-5 mt-2">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: plan.glowColor, border: `1px solid ${plan.borderColor}` }}
        >
          {planIcon}
        </div>
        <div>
          <h4 className="text-white font-bold text-lg leading-tight">{planName}</h4>
          <p className="text-gray-500 text-xs mt-0.5">{plan.tagline}</p>
        </div>
      </div>

      {/* Price block */}
      <div className="mb-1">
        {displayPrice === null ? (
          <div>
            <p className="text-3xl font-black text-white">Custom</p>
            <p className="text-gray-500 text-xs mt-1">Tailored to your needs</p>
          </div>
        ) : (
          <div>
            {/* Crossed-out original price + label badge — only if discount price is set */}
            {hasDiscount && crossedPrice && (
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-gray-600 text-sm line-through">
                  Rs. {crossedPrice.toLocaleString()}
                </span>
                {discountLabel && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}
                  >
                    🔥 {discountLabel}
                  </span>
                )}
              </div>
            )}

            {/* Current price */}
            <div className="flex items-baseline gap-1 flex-wrap">
              <span className="text-gray-400 text-sm font-semibold">Rs.</span>
              <span className="text-4xl font-black" style={{ color: plan.color }}>
                {displayPrice.toLocaleString()}
              </span>
              <span className="text-gray-500 text-sm">/ {isYearly ? "year" : "month"}</span>
            </div>

            {isYearly ? (
              <p className="text-xs mt-1" style={{ color: "#10B981" }}>🎉 2 months free included</p>
            ) : hasDiscount && discountLabel ? (
              <p className="text-xs mt-1 text-gray-500">Limited time offer — price will increase soon</p>
            ) : (
              <p className="text-xs mt-1 text-gray-600">billed monthly</p>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px my-5" style={{ background: "rgba(255,255,255,0.06)" }} />

      {/* Features */}
      <ul className="flex flex-col gap-2.5 flex-1 mb-6">
        {compareRows.map((row) => {
          const val = plan.features[row.key];
          if (val === false) return null;
          return (
            <li key={row.key} className="flex items-center gap-2.5">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: plan.glowColor, color: plan.color, border: `1px solid ${plan.borderColor}` }}
              >✓</span>
              <span className="text-gray-300 text-sm">
                <span className="font-semibold">{row.label}:</span>{" "}
                {val === true ? "Yes" : val}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Book Free Demo */}
      {/* <Link
        href="/pages/contact"
        className="block text-center py-3 px-5 rounded-2xl text-sm font-semibold mb-3 transition-all duration-300 hover:scale-[1.02]"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#9ca3af",
        }}
      >
        📅 Book a Free Demo
      </Link> */}

      {/* Main CTA */}
      <Link
        href="/pages/contact"
        className="block text-center py-3.5 px-5 rounded-2xl text-sm font-bold transition-all duration-300 hover:scale-[1.02]"
        style={{
          background: cta.background,
          border: cta.border || "none",
          color: cta.color,
          boxShadow: hovered ? cta.shadow : "none",
        }}
      >
        {plan.cta} →
      </Link>
    </div>
  );
}

// ── Comparison Table ──────────────────────────────────────────────────────────
function CompareTable({ isYearly, fsPlans }) {
  const [ref, visible] = useInView(0.05);

  return (
    <section
      ref={ref}
      className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
      }}
    >
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Detailed Plan Comparison</h2>
        <p className="text-gray-500 text-sm">Har feature ek jagah compare karein</p>
      </div>

      <div
        className="rounded-3xl overflow-x-auto"
        style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
      >
        <table className="w-full min-w-[640px]">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <th className="text-left px-6 py-5 text-gray-400 text-sm font-semibold w-[200px]">Feature</th>
              {plans.map((p) => {
                const fsData = fsPlans?.[p.id];
                // Main price — Firestore only, no hardcoded fallback
                const mainMo   = fsData?.monthlyPrice ?? null;
                const mainYr   = fsData?.yearlyPrice  ?? null;
                // Discount price
                const discMo   = fsData?.afterMonthlyPrice ?? null;
                const discYr   = fsData?.afterYearlyPrice  ?? null;
                const label    = fsData?.discountLabel     ?? "";

                const hasDisc  = !!(isYearly ? discYr  : discMo);
                // What to show big
                const pr       = p.id === "enterprise" ? null : (hasDisc ? (isYearly ? discYr  : discMo)  : (isYearly ? mainYr : mainMo));
                // What to cross out
                const crossPr  = p.id === "enterprise" ? null : (hasDisc ? (isYearly ? mainYr  : mainMo)  : null);

                const planName = fsData?.name || p.name;
                const planIcon = fsData?.icon || p.icon;
                return (
                  <th key={p.id} className="px-4 py-5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">{planIcon}</span>
                      <span className="font-bold text-sm" style={{ color: p.color }}>{planName}</span>
                      {p.id === "enterprise" ? (
                        <span className="text-xs text-gray-400 font-semibold">Custom</span>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          {hasDisc && crossPr && (
                            <span className="text-xs text-gray-600 line-through">
                              Rs. {crossPr.toLocaleString()}
                            </span>
                          )}
                          <span className="text-xs font-bold" style={{ color: p.color }}>
                            Rs. {pr?.toLocaleString()}{isYearly ? "/yr" : "/mo"}
                          </span>
                          {hasDisc && label && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>
                              🔥 {label}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {compareRows.map((row, i) => (
              <tr
                key={row.key}
                className="transition-colors hover:bg-white/[0.02]"
                style={{ borderBottom: i < compareRows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
              >
                <td className="px-6 py-3.5 text-gray-300 text-sm font-medium">{row.label}</td>
                {plans.map((p) => (
                  <td key={p.id} className="px-4 py-3.5 text-center">
                    <FeatureCell value={p.features[row.key]} color={p.color} />
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <td className="px-6 py-5 text-gray-400 text-xs font-semibold uppercase tracking-wider">Get Started</td>
              {plans.map((p) => (
                <td key={p.id} className="px-4 py-5 text-center">
                  <Link
                    href="/pages/contact"
                    className="inline-block px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 hover:scale-105"
                    style={{
                      background:
                        p.ctaStyle === "green"  ? "rgba(16,185,129,0.12)"            :
                        p.ctaStyle === "blue"   ? "linear-gradient(135deg,#2563EB,#1d4ed8)" :
                        p.ctaStyle === "amber"  ? "linear-gradient(135deg,#F59E0B,#D97706)" :
                                                  "linear-gradient(135deg,#A855F7,#9333ea)",
                      border: p.ctaStyle === "green" ? "1px solid rgba(16,185,129,0.3)" : "none",
                      color:  p.ctaStyle === "green" ? "#10B981" : "#fff",
                    }}
                  >
                    {p.id === "enterprise" ? "Contact Us" : "Get Started"}
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
const faqs = [
  { q: "Kya 14-day free trial available hai?",             a: "Haan, har plan ke saath 14-day free trial milta hai. Koi credit card required nahi." },
  { q: "Yearly plan mein kitni savings hoti hain?",        a: "Yearly plan mein 2 months free milte hain — approximately 17% ki savings." },
  { q: "Early bird offer kab tak valid hai?",              a: "Yeh limited-time offer hai aur jab tak timer chal raha hai tab tak valid hai. Uske baad original prices apply honge." },
  { q: "Kya main plan baad mein upgrade kar sakta hoon?",  a: "Bilkul! Aap kabhi bhi upgrade ya downgrade kar sakte hain. Charges pro-rated basis par hote hain." },
  { q: "Payment kaise ho sakti hai?",                      a: "Hum PKR mein payment accept karte hain — EasyPaisa, JazzCash, aur bank transfer ke zariye." },
  { q: "Data secure hai?",                                 a: "Haan, bank-level SSL encryption, daily backups, aur role-based access control se aapka data protected hai." },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(!open)}
      className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-300"
      style={{
        background: open ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${open ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      <div className="flex items-center justify-between px-6 py-4 gap-4">
        <p className="text-white font-medium text-sm md:text-base">{q}</p>
        <span
          className="text-xl transition-transform duration-300 flex-shrink-0"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0)", color: open ? "#2563EB" : "#6b7280" }}
        >+</span>
      </div>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-gray-400 text-sm leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PricingPage() {
  const [isYearly,  setIsYearly]  = useState(false);
  const fsPlans = useFirestorePlans(); // undefined=loading, {}=loaded
  const [heroRef,   heroVisible]  = useInView(0.1);
  const [faqRef,    faqVisible]   = useInView(0.05);
  const [ctaRef,    ctaVisible]   = useInView(0.1);

  return (
    <div className="min-h-screen bg-[#0d1117] overflow-x-hidden">

      {/* Ambient glow + grid */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-1/4 w-[700px] h-[500px] bg-blue-600/5 rounded-full blur-[160px]" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[400px] bg-amber-500/4 rounded-full blur-[130px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[300px] bg-emerald-500/4 rounded-full blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `linear-gradient(rgba(37,99,235,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,0.6) 1px,transparent 1px)`,
            backgroundSize: "60px 60px",
          }} />
      </div>

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="relative pt-36 pb-10 text-center px-4"
        style={{
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? "translateY(0)" : "translateY(30px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
        }}
      >
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
          style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)", color: "#93C5FD" }}
        >
          💰 Simple, Transparent Pricing
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight">
          Apne Business ke liye{" "}
          <span className="bg-gradient-to-r from-[#2563EB] via-[#60A5FA] to-[#F59E0B] bg-clip-text text-transparent">
            Sahi Plan
          </span>{" "}
          Chunein
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">
          Koi hidden charges nahi. Koi lock-in nahi. 14-day free trial ke saath shuru karein.
        </p>

        {/* Billing Toggle */}
        <div
          className="inline-flex items-center gap-1 p-1.5 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={() => setIsYearly(false)}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300"
            style={!isYearly
              ? { background: "rgba(37,99,235,0.2)", color: "#93C5FD", border: "1px solid rgba(37,99,235,0.4)" }
              : { color: "#6b7280" }}
          >Monthly</button>
          <button
            onClick={() => setIsYearly(true)}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2"
            style={isYearly
              ? { background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.4)" }
              : { color: "#6b7280" }}
          >
            Yearly
            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(16,185,129,0.18)", color: "#10B981" }}>
              2 Months Free
            </span>
          </button>
        </div>
      </section>

      {/* ── COUNTDOWN BANNER ── */}
      <div className="max-w-7xl mx-auto">
        <CountdownBanner />
      </div>

      {/* ── PLAN CARDS ── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {fsPlans === undefined ? (
          /* Loading state — wait for Firestore before showing prices */
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-t-amber-500 border-transparent animate-spin" />
              <p className="text-gray-600 text-sm">Loading plans...</p>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {plans.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} isYearly={isYearly} index={i} fsPlans={fsPlans} />
          ))}
        </div>
        )}
      </section>

      {/* ── COMPARISON TABLE ── */}
      <CompareTable isYearly={isYearly} fsPlans={fsPlans} />

      {/* ── TRUST BADGES ── */}
      <section className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: "🔒", title: "SSL Secured",     desc: "Bank-level encryption" },
            { icon: "🔄", title: "Cancel Anytime",  desc: "No lock-in contracts" },
            { icon: "💬", title: "Free Onboarding", desc: "Full setup support" },
            { icon: "🇵🇰", title: "PKR Billing",    desc: "EasyPaisa, JazzCash, Bank" },
          ].map((item, i) => (
            <div key={i}
              className="flex flex-col items-center text-center p-5 rounded-2xl transition-all duration-300 hover:bg-white/5"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-3xl mb-3">{item.icon}</span>
              <p className="text-white text-sm font-semibold mb-1">{item.title}</p>
              <p className="text-gray-500 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section
        ref={faqRef}
        className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24"
        style={{
          opacity: faqVisible ? 1 : 0,
          transform: faqVisible ? "translateY(0)" : "translateY(30px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
        }}
      >
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Aksar Pooche Jane Wale Sawalat</h2>
          <p className="text-gray-500 text-sm">Pricing ke baare mein common questions</p>
        </div>
        <div className="flex flex-col gap-3">
          {faqs.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section
        ref={ctaRef}
        className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-32"
        style={{
          opacity: ctaVisible ? 1 : 0,
          transform: ctaVisible ? "translateY(0)" : "translateY(30px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
        }}
      >
        <div
          className="relative rounded-3xl p-10 md:p-14 text-center overflow-hidden"
          style={{
            background: "linear-gradient(135deg,rgba(37,99,235,0.14) 0%,rgba(245,158,11,0.07) 100%)",
            border: "1px solid rgba(37,99,235,0.25)",
            boxShadow: "0 0 60px rgba(37,99,235,0.1)",
          }}
        >
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <p className="text-4xl mb-4">🎯</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Abhi Free Demo Book Karein</h2>
            <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
              14 din bilkul free. Koi credit card required nahi. Humari team aapko setup mein help karegi.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/pages/contact"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white transition-all duration-300 hover:scale-105"
                style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", boxShadow: "0 6px 25px rgba(245,158,11,0.4)" }}
              >
                📅 Free Demo Book Karein
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link href="/pages/contact"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-gray-300 hover:text-white transition-all duration-300"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                💬 Sales Team se Baat Karein
              </Link>
            </div>
            <p className="text-gray-600 text-xs mt-6">500+ Pakistani businesses already use Novexa ERP</p>
          </div>
        </div>
      </section>
    </div>
  );
}
