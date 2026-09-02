"use client";

import { useState, useEffect } from "react";

export default function ReferralViewStable({ getToken, onToast }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    async function loadData() {
      try {
        const token = await getToken();
        if (!token || !mounted) return;

        const res = await fetch("/api/referral/stats", {
          headers: { authorization: `Bearer ${token}` }
        });
        
        const data = await res.json();
        
        if (mounted && res.ok) {
          setStats(data);
        } else if (mounted) {
          setError(data.error || "Failed to load");
        }
      } catch (err) {
        if (mounted) setError("Network error");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    loadData();
    
    return () => {
      mounted = false;
    };
  }, [getToken]);

  if (loading) {
    return (
      <div style={{minHeight: "400px", display: "flex", alignItems: "center", justifyContent: "center"}}>
        <div style={{color: "#9ca3af", fontSize: "14px"}}>Loading referral stats...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{minHeight: "400px", display: "flex", alignItems: "center", justifyContent: "center"}}>
        <div style={{textAlign: "center"}}>
          <div style={{fontSize: "48px", marginBottom: "16px"}}>😕</div>
          <div style={{color: "#fff", fontSize: "18px", fontWeight: "600", marginBottom: "8px"}}>Failed to load</div>
          <div style={{color: "#9ca3af", fontSize: "14px"}}>{error || "Please try again"}</div>
        </div>
      </div>
    );
  }

  const referralCode = stats.referralCode || null;
  const availableCredits = stats.availableCredits || 0;
  const totalReferrals = stats.totalReferrals || 0;

  return (
    <div style={{padding: "32px", minHeight: "100vh"}}>
      {/* Header */}
      <div style={{marginBottom: "32px"}}>
        <h2 style={{color: "#fff", fontSize: "28px", fontWeight: "800", marginBottom: "8px"}}>
          🎁 Referral Program
        </h2>
        <p style={{color: "#9ca3af", fontSize: "14px"}}>
          Refer friends and earn credits on every successful referral
        </p>
      </div>

      {/* Referral Code Card */}
      {!referralCode ? (
        <div style={{
          background: "rgba(245,158,11,0.1)",
          border: "2px solid rgba(245,158,11,0.3)",
          borderRadius: "16px",
          padding: "40px",
          textAlign: "center",
          marginBottom: "24px"
        }}>
          <div style={{fontSize: "64px", marginBottom: "16px"}}>⏳</div>
          <h3 style={{color: "#fff", fontSize: "20px", fontWeight: "700", marginBottom: "8px"}}>
            Referral Code Coming Soon
          </h3>
          <p style={{color: "#9ca3af", fontSize: "14px"}}>
            Your unique referral code will be generated automatically
          </p>
        </div>
      ) : (
        <div style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(168,85,247,0.1))",
          border: "2px solid rgba(139,92,246,0.4)",
          borderRadius: "16px",
          padding: "32px",
          marginBottom: "24px"
        }}>
          <div style={{marginBottom: "16px"}}>
            <p style={{color: "#c4b5fd", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px"}}>
              Your Referral Code
            </p>
          </div>
          <div style={{
            background: "rgba(139,92,246,0.2)",
            border: "2px solid rgba(139,92,246,0.5)",
            borderRadius: "12px",
            padding: "20px",
            fontFamily: "monospace",
            fontSize: "32px",
            fontWeight: "800",
            color: "#c4b5fd",
            textAlign: "center",
            letterSpacing: "4px"
          }}>
            {referralCode}
          </div>
          <div style={{marginTop: "16px", color: "#c4b5fd", fontSize: "13px"}}>
            💡 Share this code with friends to earn credits
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px"}}>
        <div style={{
          background: "rgba(37,99,235,0.1)",
          border: "1px solid rgba(37,99,235,0.3)",
          borderRadius: "12px",
          padding: "24px"
        }}>
          <div style={{fontSize: "32px", marginBottom: "8px"}}>👥</div>
          <div style={{color: "#fff", fontSize: "28px", fontWeight: "800", marginBottom: "4px"}}>{totalReferrals}</div>
          <div style={{color: "#9ca3af", fontSize: "12px"}}>Total Referrals</div>
        </div>

        <div style={{
          background: "rgba(16,185,129,0.1)",
          border: "1px solid rgba(16,185,129,0.3)",
          borderRadius: "12px",
          padding: "24px"
        }}>
          <div style={{fontSize: "32px", marginBottom: "8px"}}>💰</div>
          <div style={{color: "#fff", fontSize: "28px", fontWeight: "800", marginBottom: "4px"}}>
            Rs. {availableCredits.toLocaleString()}
          </div>
          <div style={{color: "#9ca3af", fontSize: "12px"}}>Available Credits</div>
        </div>
      </div>

      {/* How It Works */}
      <div style={{
        background: "rgba(37,99,235,0.05)",
        border: "1px solid rgba(37,99,235,0.2)",
        borderRadius: "12px",
        padding: "24px"
      }}>
        <h3 style={{color: "#60a5fa", fontSize: "14px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "20px"}}>
          📖 How It Works
        </h3>
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px"}}>
          <div>
            <div style={{color: "#fff", fontSize: "16px", fontWeight: "600", marginBottom: "8px"}}>1️⃣ Share Your Code</div>
            <div style={{color: "#9ca3af", fontSize: "13px"}}>Give your referral code to friends who want to register</div>
          </div>
          <div>
            <div style={{color: "#fff", fontSize: "16px", fontWeight: "600", marginBottom: "8px"}}>2️⃣ They Get 10% Off</div>
            <div style={{color: "#9ca3af", fontSize: "13px"}}>Your friend gets 10% discount on their first month</div>
          </div>
          <div>
            <div style={{color: "#fff", fontSize: "16px", fontWeight: "600", marginBottom: "8px"}}>3️⃣ You Earn Credits</div>
            <div style={{color: "#9ca3af", fontSize: "13px"}}>You get 10% of their package price as credits</div>
          </div>
        </div>
      </div>
    </div>
  );
}
