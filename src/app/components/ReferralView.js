"use client";

import { useState, useEffect } from "react";

/**
 * ReferralView Component
 * Displays user's referral code, stats, referred users, and credit history
 */

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return "—";
  }
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

function Rs(n) {
  if (!n && n !== 0) return "—";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}

export default function ReferralView({ getToken, onToast }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [copying, setCopying] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      
      if (!token) {
        setError("Authentication required");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/referral/stats", {
        headers: { authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setStats(data);
        setError(null);
      } else {
        setError(data.error || "Failed to load referral stats");
        onToast?.(data.error || "Failed to load referral stats", "error");
      }
    } catch (err) {
      setError("Network error - please check your connection");
      onToast?.("Failed to load referral stats", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyCode() {
    if (!stats?.referralCode) return;
    
    setCopying(true);
    try {
      await navigator.clipboard.writeText(stats.referralCode);
      onToast?.("Referral code copied to clipboard! ✓", "success");
    } catch {
      onToast?.("Failed to copy code", "error");
    } finally {
      setTimeout(() => setCopying(false), 1000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-t-purple-500 border-transparent animate-spin" />
          <p className="text-gray-300 text-sm">Loading referral stats...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-4xl mb-3">😕</p>
          <p className="text-white font-semibold mb-2">Failed to load referral data</p>
          {error && <p className="text-gray-400 text-sm mb-4">{error}</p>}
          <button onClick={loadStats}
            className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.4)", color: "#c4b5fd" }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hasReferralCode = !!stats.referralCode;
  const totalReferrals = stats.totalReferrals || 0;
  const availableCredits = stats.availableCredits || 0;
  const totalEarned = stats.totalCreditsEarned || 0;
  const totalRedeemed = stats.totalCreditsRedeemed || 0;
  const referredUsers = stats.referredUsers || [];
  const creditsHistory = stats.creditsHistory || [];

  return (
    <div className="flex flex-col gap-6 pb-8" style={{
      minHeight: "100vh",
      padding: "20px"
    }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-black text-xl flex items-center gap-2">
            <span>🎁</span> Referral Program
          </h2>
          <p className="text-gray-300 text-xs mt-0.5">
            Refer friends and earn credits on every successful referral
          </p>
        </div>
      </div>

      {/* Referral Code Card */}
      {!hasReferralCode ? (
        <div className="rounded-2xl p-6 text-center"
          style={{ background: "rgba(245,158,11,0.08)", border: "1.5px solid rgba(245,158,11,0.25)" }}>
          <span className="text-4xl mb-3 block">⏳</span>
          <h3 className="text-white font-bold text-lg mb-2">Referral Code Coming Soon</h3>
          <p className="text-gray-300 text-sm max-w-md mx-auto">
            Your unique referral code will be generated automatically. Please check back later.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.12),rgba(168,85,247,0.08))", border: "1.5px solid rgba(139,92,246,0.3)" }}>
          <div className="px-6 py-4"
            style={{ borderBottom: "1px solid rgba(139,92,246,0.2)" }}>
            <p className="text-purple-300 text-xs font-bold uppercase tracking-widest mb-1">
              Your Referral Code
            </p>
            <p className="text-gray-300 text-[11px]">
              Share this code with friends to earn 10% credits
            </p>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 rounded-xl font-mono font-black text-lg tracking-wider"
                style={{ background: "rgba(139,92,246,0.15)", border: "1.5px solid rgba(139,92,246,0.4)", color: "#c4b5fd" }}>
                {stats.referralCode}
              </div>
              <button onClick={handleCopyCode}
                disabled={copying}
                className="px-5 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105 flex items-center gap-2"
                style={{
                  background: copying ? "rgba(52,211,153,0.2)" : "rgba(139,92,246,0.2)",
                  border: `1.5px solid ${copying ? "rgba(52,211,153,0.5)" : "rgba(139,92,246,0.4)"}`,
                  color: copying ? "#34d399" : "#c4b5fd",
                  cursor: copying ? "not-allowed" : "pointer"
                }}>
                {copying ? (
                  <>
                    <span>✓</span>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <span>📋</span>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-purple-300 text-xs mt-3 flex items-center gap-1.5">
              <span>💡</span>
              <span>Share this code when referring new users to earn instant credits</span>
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Referrals */}
        <div className="rounded-xl p-5"
          style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">👥</span>
            <span className="text-blue-300 text-xs font-bold uppercase tracking-widest">Total Referrals</span>
          </div>
          <p className="text-white font-black text-3xl">{totalReferrals}</p>
          <p className="text-gray-300 text-xs mt-1">Users you've referred</p>
        </div>

        {/* Available Credits */}
        <div className="rounded-xl p-5"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">💰</span>
            <span className="text-emerald-300 text-xs font-bold uppercase tracking-widest">Available</span>
          </div>
          <p className="text-white font-black text-3xl">{Rs(availableCredits)}</p>
          <p className="text-gray-300 text-xs mt-1">Ready to use</p>
        </div>

        {/* Total Earned */}
        <div className="rounded-xl p-5"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">🏆</span>
            <span className="text-amber-300 text-xs font-bold uppercase tracking-widest">Total Earned</span>
          </div>
          <p className="text-white font-black text-3xl">{Rs(totalEarned)}</p>
          <p className="text-gray-300 text-xs mt-1">Lifetime earnings</p>
        </div>
      </div>

      {/* Use Credits Section */}
      {availableCredits > 0 && (
        <div className="rounded-xl overflow-hidden"
          style={{ background: "rgba(16,185,129,0.08)", border: "1.5px solid rgba(16,185,129,0.3)" }}>
          <div className="px-6 py-4"
            style={{ borderBottom: "1px solid rgba(16,185,129,0.2)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-300 text-xs font-bold uppercase tracking-widest mb-1">
                  💳 Use Your Credits
                </p>
                <p className="text-gray-300 text-[11px]">
                  Apply your credits to billing, upgrades, or add-ons
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Available</p>
                <p className="text-emerald-300 font-black text-xl">{Rs(availableCredits)}</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-emerald-300 text-sm font-semibold mb-3">Where to use credits:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <span className="text-lg flex-shrink-0">📅</span>
                <div>
                  <p className="text-white font-semibold text-sm mb-0.5">Monthly Billing</p>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Apply credits when renewing your subscription
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <span className="text-lg flex-shrink-0">⚡</span>
                <div>
                  <p className="text-white font-semibold text-sm mb-0.5">Add-ons</p>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Purchase extra limits with your credits
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <span className="text-lg flex-shrink-0">⬆️</span>
                <div>
                  <p className="text-white font-semibold text-sm mb-0.5">Plan Upgrades</p>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Use credits when upgrading your plan
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <span className="text-lg flex-shrink-0">💰</span>
                <div>
                  <p className="text-white font-semibold text-sm mb-0.5">Future Purchases</p>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Credits never expire - save them!
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-lg"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <span className="text-amber-400">💡</span>
              <p className="text-amber-300 text-xs font-medium">
                Contact admin during renewal or add-on purchase to redeem your credits
              </p>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="rounded-xl p-5"
        style={{ background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.15)" }}>
        <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">
          📖 How It Works
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)" }}>
              <span className="text-sm">1️⃣</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">Share Your Code</p>
              <p className="text-gray-300 text-xs leading-relaxed">
                Give your referral code to friends who want to register
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
              <span className="text-sm">2️⃣</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">They Get 10% Off</p>
              <p className="text-gray-300 text-xs leading-relaxed">
                Your friend gets 10% discount on their first month
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
              <span className="text-sm">3️⃣</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm mb-1">You Earn Credits</p>
              <p className="text-gray-300 text-xs leading-relaxed">
                You get 10% of their package price as credits
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        {[
          { id: "overview", label: "Overview", icon: "📊" },
          { id: "users", label: `Referred Users (${referredUsers.length})`, icon: "👥" },
          { id: "history", label: `Credit History (${creditsHistory.length})`, icon: "📜" },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all relative"
            style={{
              color: activeTab === tab.id ? "#c4b5fd" : "#6b7280",
              borderBottom: activeTab === tab.id ? "2px solid #a855f7" : "2px solid transparent"
            }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-4">
          {totalReferrals === 0 ? (
            <div className="text-center py-12">
              <p className="text-5xl mb-3">🎯</p>
              <p className="text-white font-semibold text-lg mb-2">Start Referring Today!</p>
              <p className="text-gray-300 text-sm max-w-md mx-auto">
                Share your referral code with friends and start earning credits on every successful referral.
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-gray-300 text-sm mb-4">
                🎉 Great job! You've earned <span className="text-white font-bold">{Rs(totalEarned)}</span> in total credits.
                {availableCredits > 0 && (
                  <span> You have <span className="text-emerald-400 font-bold">{Rs(availableCredits)}</span> ready to use.</span>
                )}
              </p>
              {totalRedeemed > 0 && (
                <p className="text-gray-300 text-xs">
                  You've redeemed {Rs(totalRedeemed)} so far.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "users" && (
        <div>
          {referredUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-white font-semibold">No referrals yet</p>
              <p className="text-gray-300 text-sm mt-1">Share your code to get started</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              {/* Table header */}
              <div className="grid gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-wider"
                style={{ gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1.5fr", background: "rgba(139,92,246,0.08)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ color: "#9ca3af" }}>User</span>
                <span style={{ color: "#9ca3af" }}>Email</span>
                <span style={{ color: "#9ca3af" }} className="text-right">Package Price</span>
                <span style={{ color: "#9ca3af" }} className="text-right">Credit Earned</span>
                <span style={{ color: "#9ca3af" }} className="text-right">Referred On</span>
              </div>
              {/* Table rows */}
              {referredUsers.map((user, idx) => (
                <div key={user.uid || idx}
                  className="grid gap-4 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors"
                  style={{
                    gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1.5fr",
                    borderBottom: idx < referredUsers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none"
                  }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#a855f7,#c084fc)", color: "#fff" }}>
                      {(user.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white font-semibold text-sm truncate">{user.name || "—"}</span>
                  </div>
                  <span className="text-gray-300 text-xs truncate">{user.email || "—"}</span>
                  <span className="text-white text-xs font-semibold text-right">{Rs(user.packagePrice)}</span>
                  <span className="text-emerald-400 text-xs font-bold text-right">{Rs(user.creditEarned)}</span>
                  <span className="text-gray-300 text-xs text-right">{fmtDate(user.referredAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div>
          {creditsHistory.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📜</p>
              <p className="text-white font-semibold">No transactions yet</p>
              <p className="text-gray-300 text-sm mt-1">Credit history will appear here</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {creditsHistory.map((entry, idx) => (
                <div key={idx}
                  className="flex items-start gap-4 p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: entry.type === "earned" 
                        ? "rgba(16,185,129,0.15)" 
                        : "rgba(239,68,68,0.15)",
                      border: `1px solid ${entry.type === "earned" 
                        ? "rgba(16,185,129,0.3)" 
                        : "rgba(239,68,68,0.3)"}`
                    }}>
                    <span className="text-lg">{entry.type === "earned" ? "💰" : "💳"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="text-white font-semibold text-sm">
                        {entry.type === "earned" ? "Credit Earned" : "Credit Redeemed"}
                      </p>
                      <p className="font-bold text-sm flex-shrink-0"
                        style={{ color: entry.type === "earned" ? "#34d399" : "#f87171" }}>
                        {entry.type === "earned" ? "+" : "-"}{Rs(entry.amount)}
                      </p>
                    </div>
                    <p className="text-gray-300 text-xs mb-1">{entry.description}</p>
                    <p className="text-gray-500 text-[10px]">{fmtDateTime(entry.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
