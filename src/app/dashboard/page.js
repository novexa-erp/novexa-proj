"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Image from "next/image";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="w-10 h-10 animate-spin text-[#F59E0B]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75" />
          </svg>
          <p className="text-gray-400 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0d1117]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image src="/images/Novexa N Logo.png" alt="Novexa" fill className="object-contain" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-white font-bold text-lg">NOVEXA</span>
              <span className="text-[#F59E0B] text-[10px] font-semibold tracking-[0.2em] uppercase">Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white text-sm font-medium">{user?.displayName || user?.email}</p>
              <p className="text-gray-500 text-xs">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-300 transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                e.currentTarget.style.color = "#FCA5A5";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.color = "#d1d5db";
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-white font-bold text-4xl mb-3">
            Welcome back, {user?.displayName || user?.email?.split('@')[0]}! 👋
          </h1>
          <p className="text-gray-400 text-lg">
            Your business command center is ready.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {[
            { label: "Total Revenue", value: "₨ 0", icon: "💰", color: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)" },
            { label: "Active Customers", value: "0", icon: "👥", color: "rgba(37,99,235,0.1)", border: "rgba(37,99,235,0.25)" },
            { label: "Pending Invoices", value: "0", icon: "📄", color: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" },
            { label: "Products in Stock", value: "0", icon: "📦", color: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.25)" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-6 rounded-2xl transition-all duration-300 hover:scale-105"
              style={{ background: stat.color, border: `1px solid ${stat.border}` }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{stat.icon}</span>
                <span className="text-gray-400 text-xs">Today</span>
              </div>
              <p className="text-white font-bold text-2xl mb-1">{stat.value}</p>
              <p className="text-gray-400 text-sm">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h2 className="text-white font-bold text-2xl mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: "Create Invoice", desc: "Generate a new invoice", icon: "🧾", color: "#2563EB" },
              { title: "Add Customer", desc: "Register a new customer", icon: "➕", color: "#F59E0B" },
              { title: "Add Product", desc: "Add inventory item", icon: "📦", color: "#8B5CF6" },
              { title: "Record Payment", desc: "Log a received payment", icon: "💳", color: "#10B981" },
              { title: "View Reports", desc: "Business analytics", icon: "📊", color: "#EC4899" },
              { title: "Settings", desc: "Configure your account", icon: "⚙️", color: "#6B7280" },
            ].map((action) => (
              <button
                key={action.title}
                className="p-5 rounded-2xl text-left transition-all duration-300 hover:scale-105"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.borderColor = `${action.color}40`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                }}
              >
                <span className="text-3xl mb-3 block">{action.icon}</span>
                <h3 className="text-white font-semibold text-lg mb-1">{action.title}</h3>
                <p className="text-gray-500 text-sm">{action.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-white font-bold text-2xl mb-6">Recent Activity</h2>
          <div className="p-8 rounded-2xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="text-5xl mb-4 block">📋</span>
            <p className="text-gray-400 text-lg mb-2">No activity yet</p>
            <p className="text-gray-600 text-sm">Start by creating your first invoice or adding a customer.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
