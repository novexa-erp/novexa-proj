"use client";
import { useState, useEffect } from "react";

// ── Register service worker once ─────────────────────────────────────────────
function registerSW() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => { /* ignore */ });
  }
}

export default function PWAInstallButton({ className = "", style = {} }) {
  // "idle"      → checking
  // "available" → beforeinstallprompt fired, show button
  // "installed" → already installed / just installed
  // "ios"       → iOS Safari (no prompt, show manual instructions)
  // "unsupported" → browser doesn't support
  const [state,       setState]       = useState("idle");
  const [promptEvent, setPromptEvent] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    registerSW();

    // Already installed?
    if (window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true) {
      setState("installed");
      return;
    }

    // iOS detection
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
    if (isIos && isSafari) {
      setState("ios");
      return;
    }

    // Android / Chrome / Edge — listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setPromptEvent(e);
      setState("available");
    };
    window.addEventListener("beforeinstallprompt", handler);

    // appinstalled event
    const installedHandler = () => setState("installed");
    window.addEventListener("appinstalled", installedHandler);

    // If event doesn't fire in 3s — unsupported browser
    const timer = setTimeout(() => {
      setState(prev => prev === "idle" ? "unsupported" : prev);
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      clearTimeout(timer);
    };
  }, []);

  async function handleInstall() {
    if (!promptEvent) return;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setState("installed");
    setPromptEvent(null);
  }

  // ── iOS manual instructions modal ──────────────────────────────────────────
  if (state === "ios") {
    return (
      <>
        <button
          onClick={() => setShowIosHint(true)}
          className={className}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 10px", borderRadius: 12, cursor: "pointer",
            background: "linear-gradient(135deg,#3b82f6,#6366f1)",
            color: "#fff", fontWeight: 700, fontSize: 12, border: "none",
            ...style,
          }}>
          <span>📲</span>
          <span className="hidden sm:inline">Install App</span>
        </button>

        {showIosHint && (
          <div className="fixed inset-0 z-[9999] flex items-end justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowIosHint(false)}>
            <div className="w-full max-w-sm rounded-2xl overflow-hidden mb-2"
              style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ height: 4, background: "linear-gradient(90deg,#3b82f6,#6366f1)" }} />
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)" }}>
                    📱
                  </div>
                  <div>
                    <p className="text-white font-black text-sm">iPhone/iPad Par Install Karein</p>
                    <p className="text-gray-500 text-xs">Safari browser mein yeh steps follow karein</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {[
                    { step: "1", icon: "⬆️", text: 'Neeche Share button dabayein (bottom mein)' },
                    { step: "2", icon: "➕", text: '"Add to Home Screen" option chunein' },
                    { step: "3", icon: "✅", text: '"Add" dabayein — app homescreen par aa jayegi' },
                  ].map(s => (
                    <div key={s.step} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <span className="text-xl flex-shrink-0">{s.icon}</span>
                      <p className="text-gray-300 text-sm">{s.text}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowIosHint(false)}
                  className="w-full py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                  Theek Hai
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Already installed
  if (state === "installed") {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 10px", borderRadius: 12,
        background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)",
        color: "#34d399", fontWeight: 700, fontSize: 12,
        ...style,
      }} className={className}>
        <span>✅</span>
        <span className="hidden sm:inline">Installed</span>
      </div>
    );
  }

  // Available — show install button
  if (state === "available") {
    return (
      <button onClick={handleInstall} className={className} style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 10px", borderRadius: 12, cursor: "pointer",
        background: "linear-gradient(135deg,#3b82f6,#6366f1)",
        color: "#fff", fontWeight: 700, fontSize: 12, border: "none",
        boxShadow: "0 4px 16px rgba(59,130,246,0.3)",
        transition: "transform .15s",
        ...style,
      }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
        <span>📲</span>
        <span className="hidden sm:inline">Install App</span>
      </button>
    );
  }

  // idle / unsupported — render nothing
  return null;
}
