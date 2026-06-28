"use client";

import { useState, useEffect } from "react";

/**
 * Custom Sweet Alert Component for Novexa ERP
 * 
 * @param {boolean} show - Control visibility
 * @param {string} type - "success" | "error" | "warning" | "info"
 * @param {string} title - Alert heading
 * @param {string} message - Alert description
 * @param {function} onClose - Close handler
 */
export default function SweetAlert({ show, type = "success", title, message, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsLeaving(false);
    }
  }, [show]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  };

  if (!show && !isVisible) return null;

  const config = {
    success: {
      gradient: "from-emerald-500 to-green-600",
      icon: "✓",
      iconBg: "rgba(16, 185, 129, 0.15)",
      iconColor: "#10b981",
      borderColor: "rgba(16, 185, 129, 0.3)",
    },
    error: {
      gradient: "from-red-500 to-rose-600",
      icon: "✕",
      iconBg: "rgba(239, 68, 68, 0.15)",
      iconColor: "#ef4444",
      borderColor: "rgba(239, 68, 68, 0.3)",
    },
    warning: {
      gradient: "from-amber-500 to-orange-600",
      icon: "⚠",
      iconBg: "rgba(245, 158, 11, 0.15)",
      iconColor: "#f59e0b",
      borderColor: "rgba(245, 158, 11, 0.3)",
    },
    info: {
      gradient: "from-blue-500 to-cyan-600",
      icon: "ℹ",
      iconBg: "rgba(37, 99, 235, 0.15)",
      iconColor: "#3b82f6",
      borderColor: "rgba(37, 99, 235, 0.3)",
    },
  };

  const style = config[type] || config.success;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        animation: isLeaving ? "fadeOut 0.3s ease-out" : "fadeIn 0.3s ease-out",
      }}
      onClick={handleClose}
    >
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px) scale(0.9); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(0) scale(1); opacity: 1; }
          to { transform: translateY(30px) scale(0.9); opacity: 0; }
        }
        @keyframes ripple {
          0% { transform: scale(0); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes iconPop {
          0% { transform: scale(0) rotate(-180deg); }
          50% { transform: scale(1.2) rotate(10deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
      `}</style>

      <div
        className="relative w-full max-w-sm rounded-3xl p-8 flex flex-col items-center gap-6"
        style={{
          background: "linear-gradient(135deg, rgba(13,17,23,0.98) 0%, rgba(8,13,20,0.98) 100%)",
          border: `1.5px solid ${style.borderColor}`,
          boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${style.borderColor}`,
          animation: isLeaving ? "slideDown 0.3s ease-out" : "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Line */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r ${style.gradient}`}
        />

        {/* Icon Container */}
        <div className="relative">
          {/* Ripple Effect */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: style.iconBg,
              animation: "ripple 1.5s infinite",
            }}
          />
          
          {/* Icon */}
          <div
            className="relative w-20 h-20 rounded-full flex items-center justify-center text-4xl font-bold"
            style={{
              background: style.iconBg,
              border: `2px solid ${style.borderColor}`,
              color: style.iconColor,
              animation: "iconPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s backwards",
            }}
          >
            {style.icon}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h3
            className="text-white font-bold text-2xl"
            style={{
              animation: "slideUp 0.5s ease-out 0.3s backwards",
            }}
          >
            {title}
          </h3>
          <p
            className="text-gray-400 text-sm leading-relaxed max-w-xs"
            style={{
              animation: "slideUp 0.5s ease-out 0.4s backwards",
            }}
          >
            {message}
          </p>
        </div>

        {/* Button */}
        <button
          onClick={handleClose}
          className={`relative group w-full py-3.5 rounded-xl text-white font-semibold text-sm overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]`}
          style={{
            background: `linear-gradient(135deg, ${style.gradient})`,
            boxShadow: `0 4px 20px ${style.iconBg}`,
            animation: "slideUp 0.5s ease-out 0.5s backwards",
          }}
        >
          <span className="relative z-10">Got it!</span>
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%)",
            }}
          />
        </button>
      </div>
    </div>
  );
}
