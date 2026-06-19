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

const faqs = [
  {
    q: "Is Invorex free to use?",
    a: "Yes! Invorex offers a free plan that includes core features like invoice creation, customer management, and PDF export. You can upgrade to a paid plan anytime for advanced features and higher limits.",
    icon: "💰",
    color: "#10B981",
    border: "rgba(16,185,129,0.3)",
    bg: "rgba(16,185,129,0.07)",
  },
  {
    q: "Can I export invoices as PDF?",
    a: "Absolutely. Every invoice can be exported as a clean, professional PDF with one click. You can also share it directly via WhatsApp, email, or any messaging app right from the platform.",
    icon: "📄",
    color: "#2563EB",
    border: "rgba(37,99,235,0.3)",
    bg: "rgba(37,99,235,0.07)",
  },
  {
    q: "Is Invorex cloud-based?",
    a: "Yes. Invorex is fully cloud-based. Your data is securely stored online and accessible from any device — desktop, tablet, or mobile — anytime, anywhere. No installation needed.",
    icon: "☁️",
    color: "#06B6D4",
    border: "rgba(6,182,212,0.3)",
    bg: "rgba(6,182,212,0.07)",
  },
  {
    q: "How many customers and products can I add?",
    a: "The free plan supports up to 50 customers and 100 products. On paid plans, limits are significantly higher — or completely unlimited depending on your tier.",
    icon: "📦",
    color: "#F59E0B",
    border: "rgba(245,158,11,0.3)",
    bg: "rgba(245,158,11,0.07)",
  },
  {
    q: "Is my data secure?",
    a: "Your data is encrypted at rest and in transit. We follow industry-standard security practices and take regular backups so your business data is always safe and recoverable.",
    icon: "🔒",
    color: "#A855F7",
    border: "rgba(168,85,247,0.3)",
    bg: "rgba(168,85,247,0.07)",
  },
  {
    q: "Can multiple team members use the same account?",
    a: "Multi-user access is available on paid plans. You can add team members with different roles and permission levels, so everyone sees only what they need.",
    icon: "👥",
    color: "#EC4899",
    border: "rgba(236,72,153,0.3)",
    bg: "rgba(236,72,153,0.07)",
  },
];

function FAQItem({ faq, index }) {
  const [ref, visible] = useInView(0.08);
  const [open, setOpen] = useState(false);

  return (
    <div
      ref={ref}
      className="relative"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s ease ${index * 90}ms, transform 0.6s ease ${index * 90}ms`,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left rounded-2xl p-5 transition-all duration-400 group"
        style={{
          background: open ? faq.bg : "rgba(255,255,255,0.025)",
          border: `1px solid ${open ? faq.border : "rgba(255,255,255,0.07)"}`,
          boxShadow: open ? `0 8px 32px ${faq.bg}` : "none",
        }}
      >
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-all duration-400"
            style={{
              background: open ? faq.bg : "rgba(255,255,255,0.04)",
              border: `1px solid ${open ? faq.border : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {faq.icon}
          </div>

          {/* Question */}
          <span
            className="flex-1 font-semibold text-sm md:text-base transition-colors duration-300"
            style={{ color: open ? "#fff" : "#d1d5db" }}
          >
            {faq.q}
          </span>

          {/* Chevron */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-400"
            style={{
              background: open ? faq.bg : "rgba(255,255,255,0.04)",
              border: `1px solid ${open ? faq.border : "rgba(255,255,255,0.08)"}`,
              color: open ? faq.color : "#6b7280",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Answer — animated expand */}
        <div
          style={{
            maxHeight: open ? "300px" : "0px",
            overflow: "hidden",
            transition: "max-height 0.45s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div className="pt-4 pl-14">
            <p
              className="text-sm leading-relaxed"
              style={{ color: "#9ca3af" }}
            >
              {faq.a}
            </p>
            {/* Color accent line */}
            <div
              className="mt-3 h-px rounded-full"
              style={{
                background: `linear-gradient(to right, ${faq.color}55, transparent)`,
              }}
            />
          </div>
        </div>
      </button>
    </div>
  );
}

export default function FAQ() {
  const [headerRef, headerVisible] = useInView(0.2);

  return (
    <section className="relative py-24 md:py-32 bg-[#0d1117] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#06B6D4]/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#A855F7]/25 to-transparent" />
        <div className="absolute top-1/3 -left-40 w-[450px] h-[450px] bg-cyan-600/4 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/3 -right-40 w-[450px] h-[450px] bg-purple-600/4 rounded-full blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div
          ref={headerRef}
          className="text-center mb-16 transition-all duration-700"
          style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(28px)",
          }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
            style={{
              background: "rgba(6,182,212,0.1)",
              border: "1px solid rgba(6,182,212,0.3)",
              color: "#67E8F9",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            FAQ
          </div>

          <h2 className="text-white leading-tight mb-4">
            Questions?{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #06B6D4, #2563EB 50%, #A855F7)" }}
            >
              We Have Answers
            </span>
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            Everything you need to know about Invorex. Can not find what you are looking for?
            Reach out to our team anytime.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <FAQItem key={faq.q} faq={faq} index={i} />
          ))}
        </div>

        {/* Still have questions */}
        <StillHaveQuestions />
      </div>
    </section>
  );
}

function StillHaveQuestions() {
  const [ref, visible] = useInView(0.2);

  return (
    <div
      ref={ref}
      className="mt-14 text-center transition-all duration-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transitionDelay: "150ms",
      }}
    >
      <div
        className="rounded-2xl p-8"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <span className="text-3xl mb-3 block">🤔</span>
        <h3 className="text-white font-bold text-lg mb-2">Still have questions?</h3>
        <p className="text-gray-500 text-sm mb-5">
          Our support team is ready to help you with anything.
        </p>
        <a
          href="#contact"
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-full transition-all duration-300 hover:scale-105"
          style={{
            background: "rgba(6,182,212,0.1)",
            border: "1.5px solid rgba(6,182,212,0.35)",
            color: "#67E8F9",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(6,182,212,0.2)";
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(6,182,212,0.2)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(6,182,212,0.1)";
            e.currentTarget.style.color = "#67E8F9";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          Contact Support →
        </a>
      </div>
    </div>
  );
}
