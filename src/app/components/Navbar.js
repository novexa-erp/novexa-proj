"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const navLinks = [
  { label: "Home",     href: "/" },
  { label: "Features", href: "/pages/features" },
  { label: "Modules",  href: "/pages/modules" },
  { label: "Pricing",  href: "/pages/pricing" },
  { label: "About",    href: "/pages/about" },
  { label: "Contact",  href: "/pages/contact" },
];

export default function Navbar() {
  const router                        = useRouter();
  const [scrolled, setScrolled]       = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [user, setUser]               = useState(null);
  const [userDoc, setUserDoc]         = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef                    = useRef(null);
  
  // Logout confirmation state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // scroll listener
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      // Fetch user document for logo
      if (u) {
        try {
          const userSnap = await getDoc(doc(db, "users", u.uid));
          if (userSnap.exists()) {
            setUserDoc(userSnap.data());
          }
        } catch (err) {
          console.error("Error fetching user doc:", err);
        }
      } else {
        setUserDoc(null);
      }
    });
    return () => unsub();
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSignOut() {
    await signOut(auth);
    setProfileOpen(false);
    setShowLogoutConfirm(false);
    router.push("/");
  }
  
  function confirmLogout() {
    setShowLogoutConfirm(true);
    setProfileOpen(false);
    setMenuOpen(false);
  }

  // Initials from display name or email
  const initials = user
    ? (user.displayName
        ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
        : user.email?.[0].toUpperCase())
    : "";

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
              <span className="text-white font-bold text-lg md:text-xl tracking-wide">NOVEXA</span>
              <span className="text-[#F59E0B] text-xs font-semibold tracking-[0.25em] uppercase">ERP System</span>
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

          {/* Desktop CTA / Profile */}
          <div className="hidden md:flex items-center gap-3">
            {authLoading ? (
              /* skeleton while auth resolves */
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
            ) : user ? (
              /* ── Logged in ── */
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-white/8"
                  style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  {/* avatar with logo support */}
                  {userDoc?.logoDataUrl ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                      <img src={userDoc.logoDataUrl} alt="Logo" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #2563EB, #F59E0B)" }}
                    >
                      {initials}
                    </div>
                  )}
                  <span className="text-gray-300 text-sm font-medium max-w-[120px] truncate">
                    {user.displayName || user.email?.split("@")[0]}
                  </span>
                  <svg
                    className="w-3.5 h-3.5 text-gray-500 transition-transform duration-200"
                    style={{ transform: profileOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {/* Profile dropdown */}
                {profileOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden z-50"
                    style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}
                  >
                    {/* user info */}
                    <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                      <p className="text-white text-sm font-semibold truncate">
                        {user.displayName || "User"}
                      </p>
                      <p className="text-gray-500 text-xs truncate">{user.email}</p>
                    </div>

                    <div className="p-1.5 flex flex-col gap-0.5">
                      <Link href="/dashboard" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-white/6 transition-all duration-150">
                        <span>📊</span> Dashboard
                      </Link>
                      <Link href="/dashboard" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-white/6 transition-all duration-150">
                        <span>⚙️</span> Settings
                      </Link>
                      <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                      <button onClick={confirmLogout}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm w-full text-left transition-all duration-150"
                        style={{ color: "#f87171" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.08)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <span>🚪</span> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ── Not logged in ── */
              <>
                <Link href="/pages/login"
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200">
                  Sign In
                </Link>
                <Link
                  href="/pages/contact"
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
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Toggle menu"
          >
            <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-0.5 bg-white transition-all duration-300 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      <div className={`md:hidden transition-all duration-300 overflow-hidden ${menuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"} bg-[#0d1117]/98 backdrop-blur-md border-t border-[#1e3a5f]/50`}>
        <div className="px-4 py-4 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link key={link.label} href={link.href} onClick={() => setMenuOpen(false)}
              className="px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-200">
              {link.label}
            </Link>
          ))}

          <div className="pt-3 mt-1 border-t border-white/10 flex flex-col gap-2">
            {authLoading ? null : user ? (
              <>
                {/* mobile — logged in */}
                <div className="flex items-center gap-3 px-4 py-2">
                  {userDoc?.logoDataUrl ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                      <img src={userDoc.logoDataUrl} alt="Logo" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #2563EB, #F59E0B)" }}>
                      {initials}
                    </div>
                  )}
                  <div>
                    <p className="text-white text-sm font-medium">{user.displayName || "User"}</p>
                    <p className="text-gray-500 text-xs truncate">{user.email}</p>
                  </div>
                </div>
                <Link href="/dashboard" onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 text-sm font-medium text-center text-white rounded-full"
                  style={{ background: "linear-gradient(135deg, #2563EB, #1d4ed8)", boxShadow: "0 4px 15px rgba(37,99,235,0.3)" }}>
                  Go to Dashboard →
                </Link>
                <button onClick={confirmLogout}
                  className="px-4 py-3 text-sm font-medium text-center rounded-full transition-all"
                  style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/pages/login" onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 text-sm font-medium text-center text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                  Sign In
                </Link>
                <Link href="/pages/contact" onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 text-sm font-semibold text-center text-white rounded-full"
                  style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #B45309 100%)", boxShadow: "0 4px 15px rgba(245,158,11,0.3)" }}>
                  Get Started →
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
            style={{ background: "#0d1117", border: "1px solid rgba(239,68,68,0.3)" }}>
            <p className="text-4xl">🚪</p>
            <h3 className="text-white font-bold text-xl">Logout Confirmation</h3>
            <p className="text-gray-400 text-sm">
              Are you sure you want to logout? You'll need to sign in again to access your dashboard.
            </p>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                Cancel
              </button>
              <button onClick={handleSignOut}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105"
                style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444" }}>
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
