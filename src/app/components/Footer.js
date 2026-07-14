"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

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

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#" },
    { label: "Pricing", href: "/pages/pricing" },
    { label: "Modules", href: "#modules" },
    { label: "Changelog", href: "#" },
  ],
  Company: [
    { label: "About Us", href: "#about" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Press Kit", href: "#" },
    { label: "Contact", href: "#contact" },
  ],
  Support: [
    { label: "Help Center", href: "#" },
    { label: "Documentation", href: "#" },
    { label: "API Reference", href: "#" },
    { label: "Status Page", href: "#" },
    { label: "Community", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy",  href: "/pages/privacy-policy" },
    { label: "Terms of Service", href: "/pages/terms" },
    { label: "Cookie Policy",   href: "/pages/privacy-policy" },
    { label: "Refund Policy",   href: "/pages/terms" },
    { label: "Security",        href: "/pages/security" },
  ],
};

const socialLinks = [
  {
    label: "Twitter",
    href: "#",
    color: "#1DA1F2",
    bg: "rgba(29,161,242,0.1)",
    border: "rgba(29,161,242,0.3)",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "#",
    color: "#0A66C2",
    bg: "rgba(10,102,194,0.1)",
    border: "rgba(10,102,194,0.3)",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    href: "#",
    color: "#25D366",
    bg: "rgba(37,211,102,0.1)",
    border: "rgba(37,211,102,0.3)",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "#",
    color: "#E1306C",
    bg: "rgba(225,48,108,0.1)",
    border: "rgba(225,48,108,0.3)",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
];

const badges = [
  { icon: "🔒", text: "SSL Secured" },
  { icon: "☁️", text: "Cloud Based" },
  { icon: "⚡", text: "99.9% Uptime" },
  { icon: "🇵🇰", text: "Made in Pakistan" },
];

function NewsletterBox() {
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (email) setSubmitted(true);
  }

  return submitted ? (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
      style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
      <span className="text-emerald-400 text-sm font-semibold">✓ You are subscribed!</span>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="your@email.com"
        className="flex-1 px-4 py-2.5 text-sm text-white rounded-xl outline-none transition-all duration-300"
        style={{
          background: focused ? "rgba(37,99,235,0.08)" : "rgba(255,255,255,0.05)",
          border: `1.5px solid ${focused ? "rgba(37,99,235,0.45)" : "rgba(255,255,255,0.1)"}`,
          boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.1)" : "none",
        }}
      />
      <button
        type="submit"
        className="px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-300 hover:scale-105 whitespace-nowrap"
        style={{
          background: "linear-gradient(135deg, #F59E0B, #D97706)",
          boxShadow: "0 4px 15px rgba(245,158,11,0.3)",
        }}
      >
        Subscribe →
      </button>
    </form>
  );
}

export default function Footer() {
  const [ref, visible] = useInView(0.05);
  const [hoveredLink, setHoveredLink] = useState(null);
  const [hoveredSocial, setHoveredSocial] = useState(null);

  return (
    <footer
      ref={ref}
      className="relative bg-[#0d1117] overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(30px)",
        transition: "opacity 0.8s ease, transform 0.8s ease",
      }}
    >
      {/* Top separator with glow */}
      <div className="relative h-px">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#2563EB]/50 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-[#F59E0B]/60 blur-sm" />
      </div>

      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 left-1/4 w-[600px] h-[300px] bg-blue-600/4 rounded-full blur-[120px]" />
        <div className="absolute -top-20 right-1/4 w-[400px] h-[250px] bg-amber-500/4 rounded-full blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* ── MAIN FOOTER CONTENT ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-14">

          {/* Brand column — spans 4 cols */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group w-fit">
              <div className="relative w-14 h-14 drop-shadow-[0_0_8px_rgba(37,99,235,0.5)]">
                <Image
                  src="/images/Novexa N Logo.png"
                  alt="Novexa ERP Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex flex-col leading-tight ml-[-8px]">
                <span className="text-white font-bold text-lg tracking-wide">NOVEXA</span>
                <span className="text-[#F59E0B] text-xs font-semibold tracking-[0.25em] uppercase">
                  ERP System
                </span>
              </div>
            </Link>

            {/* Tagline */}
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              Novexa — the all-in-one ERP platform that helps small and medium businesses manage
              invoices, customers, inventory, and payments from one place.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <div
                  key={b.text}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#9ca3af",
                  }}
                >
                  <span>{b.icon}</span>
                  <span>{b.text}</span>
                </div>
              ))}
            </div>

            {/* Social icons */}
            <div className="flex gap-2">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300"
                  style={{
                    background: hoveredSocial === s.label ? s.bg : "rgba(255,255,255,0.05)",
                    border: `1px solid ${hoveredSocial === s.label ? s.border : "rgba(255,255,255,0.08)"}`,
                    color: hoveredSocial === s.label ? s.color : "#6b7280",
                    boxShadow: hoveredSocial === s.label ? `0 4px 16px ${s.bg}` : "none",
                    transform: hoveredSocial === s.label ? "translateY(-3px) scale(1.1)" : "scale(1)",
                  }}
                  onMouseEnter={() => setHoveredSocial(s.label)}
                  onMouseLeave={() => setHoveredSocial(null)}
                >
                  {s.icon}
                </a>
              ))}
            </div>

            {/* Newsletter */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Stay Updated
              </p>
              <NewsletterBox />
            </div>
          </div>

          {/* Links columns — spans 8 cols */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h4
                  className="text-white font-bold text-sm mb-4 pb-2 relative"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {category}
                  <span
                    className="absolute bottom-[-1px] left-0 h-px w-8"
                    style={{
                      background: category === "Product"
                        ? "#F59E0B"
                        : category === "Company"
                        ? "#2563EB"
                        : category === "Support"
                        ? "#10B981"
                        : "#A855F7",
                    }}
                  />
                </h4>
                <ul className="flex flex-col gap-2.5">
                  {links.map((link) => {
                    const key = `${category}-${link.label}`;
                    return (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-sm transition-all duration-200 flex items-center gap-1.5 group"
                          style={{
                            color: hoveredLink === key ? "#fff" : "#6b7280",
                          }}
                          onMouseEnter={() => setHoveredLink(key)}
                          onMouseLeave={() => setHoveredLink(null)}
                        >
                          <span
                            className="transition-all duration-200"
                            style={{
                              opacity: hoveredLink === key ? 1 : 0,
                              transform: hoveredLink === key ? "translateX(0)" : "translateX(-4px)",
                              color:
                                category === "Product" ? "#F59E0B"
                                : category === "Company" ? "#2563EB"
                                : category === "Support" ? "#10B981"
                                : "#A855F7",
                              fontSize: "10px",
                            }}
                          >
                            →
                          </span>
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── STATS BAR ── */}
        {/* <div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 py-6 px-6 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {[
            { value: "1M+", label: "Invoices Generated", icon: "🧾", color: "#F59E0B" },
            { value: "500+", label: "Businesses Onboard", icon: "🏢", color: "#2563EB" },
            { value: "99.9%", label: "Uptime Guaranteed", icon: "⚡", color: "#10B981" },
            { value: "4.9★", label: "Average Rating", icon: "⭐", color: "#A855F7" },
          ].map((stat, i) => (
            <div key={i} className="flex flex-col items-center text-center py-2">
              <span className="text-2xl mb-1">{stat.icon}</span>
              <span
                className="text-2xl font-black bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(135deg, ${stat.color}, ${stat.color}99)` }}
              >
                {stat.value}
              </span>
              <span className="text-gray-600 text-xs mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div> */}

        {/* ── BOTTOM BAR ── */}
        <div
          className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-gray-600 text-xs text-center md:text-left">
            © {new Date().getFullYear()} Novexa ERP (Novexa). All rights reserved.
          </p>

          {/* Bottom quick links */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {[
              { label: "Privacy Policy",   href: "/privacy-policy" },
              { label: "Terms of Service", href: "/terms" },
              { label: "Security",         href: "/security" },
            ].map((item) => (
              <Link key={item.label} href={item.href}
                className="text-gray-600 hover:text-gray-400 text-xs transition-colors duration-200">
                {item.label}
              </Link>
            ))}
          </div>

          {/* Scroll to top */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 hover:scale-105"
            style={{
              background: "rgba(37,99,235,0.08)",
              border: "1px solid rgba(37,99,235,0.25)",
              color: "#93C5FD",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(37,99,235,0.18)";
              e.currentTarget.style.borderColor = "rgba(96,165,250,0.5)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(37,99,235,0.08)";
              e.currentTarget.style.borderColor = "rgba(37,99,235,0.25)";
              e.currentTarget.style.color = "#93C5FD";
            }}
          >
            ↑ Back to top
          </button>
        </div>
      </div>
    </footer>
  );
}
