"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const navLinks = [
  { label: "Home",     href: "/" },
  { label: "Features", href: "/pages/features" },
  { label: "Modules",  href: "/pages/modules" },
  { label: "Pricing",  href: "#pricing" },
  { label: "About",    href: "/pages/about" },
  { label: "Contact",  href: "/pages/contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0d1117]/95 backdrop-blur-md shadow-lg shadow-blue-900/20 border-b border-[#1e3a5f]/50"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-16 h-16 md:w-20 md:h-20 drop-shadow-[0_0_8px_rgba(37,99,235,0.6)]">
              <Image
                src="/images/Novexa N Logo.png"
                alt="Novexa ERP Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col leading-tight ml-[-10px]">
              <span className="text-white font-bold text-lg md:text-xl tracking-wide">
                NOVEXA
              </span>
              <span className="text-[#F59E0B] text-xs font-semibold tracking-[0.25em] uppercase">
                ERP System
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="relative px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors duration-200 group"
              >
                {link.label}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-[#2563EB] to-[#F59E0B] group-hover:w-full transition-all duration-300 rounded-full" />
              </Link>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200">
              Sign In
            </Link>
            <Link href="/register"
              className="group relative inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-full overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(245,158,11,0.5)]"
              style={{
                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #B45309 100%)",
                boxShadow: "0 4px 15px rgba(245,158,11,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              <span className="relative z-10">Get Started</span>
              <span className="relative z-10 text-xs">→</span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Toggle menu"
          >
            <span
              className={`block w-6 h-0.5 bg-white transition-all duration-300 ${
                menuOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              className={`block w-6 h-0.5 bg-white transition-all duration-300 ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-6 h-0.5 bg-white transition-all duration-300 ${
                menuOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      <div
        className={`md:hidden transition-all duration-300 overflow-hidden ${
          menuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        } bg-[#0d1117]/98 backdrop-blur-md border-t border-[#1e3a5f]/50`}
      >
        <div className="px-4 py-4 flex flex-col gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 mt-1 border-t border-white/10 flex flex-col gap-2">
            <Link href="/login" className="px-4 py-3 text-sm font-medium text-center text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              Sign In
            </Link>
            <Link href="/register" className="px-4 py-3 text-sm font-semibold text-center text-white rounded-full"
              style={{
                background: "linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #B45309 100%)",
                boxShadow: "0 4px 15px rgba(245,158,11,0.3)",
              }}
            >
              Get Started →
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
