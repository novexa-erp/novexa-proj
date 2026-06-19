"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

const quickLinks = [
  { label: "Home",      href: "/",           icon: "→" },
  { label: "Features",  href: "/features",   icon: "→" },
  { label: "Modules",   href: "/modules",    icon: "→" },
  { label: "About",     href: "/about",      icon: "→" },
  { label: "Contact",   href: "/contact",    icon: "→" },
  { label: "Security",  href: "/security",   icon: "→" },
];

export default function NotFound() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="min-h-screen bg-[#0d1117] flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 py-32 relative overflow-hidden">

        {/* subtle bg glow — not overdone */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(to right, transparent, rgba(37,99,235,0.3), transparent)" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.06) 0%, transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>

        <div
          className="relative z-10 max-w-2xl w-full mx-auto text-center"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          {/* 404 — clean large text, no rings */}
          <div className="mb-4">
            <span
              className="font-black select-none block leading-none"
              style={{
                fontSize: "clamp(120px, 22vw, 200px)",
                backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                letterSpacing: "-0.04em",
              }}
            >
              404
            </span>
          </div>

          {/* thin divider with badge */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px flex-1 max-w-16"
              style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.12))" }} />
            <div
              className="px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase"
              style={{
                background: "rgba(37,99,235,0.1)",
                border: "1px solid rgba(37,99,235,0.25)",
                color: "#60A5FA",
              }}
            >
              Page Not Found
            </div>
            <div className="h-px flex-1 max-w-16"
              style={{ background: "linear-gradient(to left, transparent, rgba(255,255,255,0.12))" }} />
          </div>

          {/* headline */}
          <h1
            className="text-white font-bold leading-tight mb-4"
            style={{ fontSize: "clamp(26px, 4.5vw, 42px)" }}
          >
            This page doesn&apos;t exist
          </h1>

          <p className="text-gray-400 text-base leading-relaxed max-w-md mx-auto mb-10">
            The URL you entered might be wrong, the page was removed, or it never existed.
            Here are some helpful places to go instead.
          </p>

          {/* primary actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
            <Link href="/" className="btn-primary">
              ← Back to Home
            </Link>
            <Link href="/contact" className="btn-secondary">
              Contact Support →
            </Link>
          </div>

          {/* sitemap-style links — clean list */}
          <div
            className="rounded-2xl overflow-hidden text-left"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <p className="text-xs font-bold tracking-widest uppercase text-gray-600">
                Helpful pages
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-white/[0.05]">
              {quickLinks.map((link, i) => (
                <NavLink key={link.label} link={link} index={i} />
              ))}
            </div>
          </div>

        </div>
      </div>

      <Footer />
    </main>
  );
}

function NavLink({ link, index }) {
  const [hovered, setHovered] = useState(false);
  const isGold = index % 2 !== 0;

  return (
    <Link
      href={link.href}
      className="group flex items-center justify-between px-5 py-4 transition-all duration-200 no-underline"
      style={{
        background: hovered
          ? isGold ? "rgba(245,158,11,0.05)" : "rgba(37,99,235,0.06)"
          : "transparent",
        color: hovered ? "#fff" : "#6b7280",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="text-sm font-medium">{link.label}</span>
      <span
        className="text-xs transition-all duration-200"
        style={{
          color: isGold ? "#F59E0B" : "#2563EB",
          opacity: hovered ? 1 : 0.3,
          transform: hovered ? "translateX(3px)" : "translateX(0)",
        }}
      >
        →
      </span>
    </Link>
  );
}
