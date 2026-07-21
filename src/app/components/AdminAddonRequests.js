"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

function fmtDate(val) {
  if (!val) return "—";
  try {
    const d = typeof val?.toDate === "function" ? val.toDate() : new Date(val);
    return isNaN(d) ? "—" : d.toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return "—"; }
}
function fmtRs(n) { return "Rs. " + Number(n || 0).toLocaleString("en-PK"); }

const STATUS_STYLE = {
  pending:  { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  label: "⏳ Pending"  },
  approved: { color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)",  label: "✅ Approved" },
  rejected: { color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", label: "❌ Rejected" },
};

export default function AdminAddonRequests({ getToken, onToast }) {
  const [requests,    setRequests]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filterStatus,setFilterStatus]= useState("pending");
  const [selected,    setSelected]    = useState(null); // full request object
  const [adminNote,   setAdminNote]   = useState("");
  const [processing,  setProcessing]  = useState(false);
  const [imgZoom,     setImgZoom]     = useState(false);

  // Listen to global addonRequests collection
  useEffect(() => {
    const q = query(collection(db, "addonRequests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const filtered = requests.filter(r =>
    filterStatus === "all" ? true : r.status === filterStatus
  );

  const pendingCount  = requests.filter(r => r.status === "pending").length;
  const approvedCount = requests.filter(r => r.status === "approved").length;
  const rejectedCount = requests.filter(r => r.status === "rejected").length;

  async function handleAction(action) {
    if (!selected) return;
    setProcessing(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/addon-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          uid:       selected.uid,
          requestId: selected.id,
          action,
          adminNote: adminNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onToast?.(action === "approve" ? "Add-on approved! User ko email bhej di. ✓" : "Request reject kar di.", action === "approve" ? "success" : "error");
      setSelected(null);
      setAdminNote("");
    } catch (err) {
      onToast?.(err.message || "Action failed", "error");
    }
    setProcessing(false);
  }

  const payLabel = (m) => m === "easypaisa" ? "💚 EasyPaisa" : m === "jazzcash" ? "🔴 JazzCash" : "🏦 Meezan Bank";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-black text-xl">⚡ Add-on Requests</h2>
          <p className="text-gray-500 text-xs mt-0.5">Users ki add-on requests review aur approve karein</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: "pending",  label: "Pending",  count: pendingCount  },
            { id: "approved", label: "Approved", count: approvedCount },
            { id: "rejected", label: "Rejected", count: rejectedCount },
            { id: "all",      label: "All",      count: requests.length },
          ].map(f => {
            const st = STATUS_STYLE[f.id] || { color: "#9ca3af", bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)" };
            const isActive = filterStatus === f.id;
            return (
              <button key={f.id} onClick={() => setFilterStatus(f.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: isActive ? st.bg : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isActive ? st.border : "rgba(255,255,255,0.08)"}`,
                  color: isActive ? st.color : "#6b7280",
                }}>
                {f.label}
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black"
                  style={{ background: isActive ? st.bg : "rgba(255,255,255,0.06)", color: isActive ? st.color : "#4b5563" }}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Request list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-t-amber-500 border-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <span className="text-5xl">📭</span>
          <p className="text-gray-500 text-sm">
            {filterStatus === "pending" ? "Koi pending request nahi hai." : `Koi ${filterStatus} request nahi.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(req => {
            const st = STATUS_STYLE[req.status] || STATUS_STYLE.pending;
            return (
              <button key={req.id} onClick={() => { setSelected(req); setAdminNote(req.adminNote || ""); }}
                className="w-full text-left rounded-2xl p-4 transition-all hover:border-opacity-60"
                style={{
                  background: selected?.id === req.id ? "rgba(37,99,235,0.08)" : "rgba(255,255,255,0.02)",
                  border: `1.5px solid ${selected?.id === req.id ? "rgba(37,99,235,0.35)" : "rgba(255,255,255,0.07)"}`,
                }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0"
                      style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)", color: "#60a5fa" }}>
                      {(req.userName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{req.userName || "Unknown"}</p>
                      <p className="text-gray-500 text-xs truncate">{req.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-white font-black text-sm">{fmtRs(req.grandTotal)}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                      {st.label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af" }}>
                    {payLabel(req.paymentMethod)}
                  </span>
                  {(req.lineItems || []).slice(0, 3).map((item, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-lg"
                      style={{ background: "rgba(245,158,11,0.08)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.15)" }}>
                      {item.icon} +{Number(item.qty).toLocaleString()}
                    </span>
                  ))}
                  {(req.lineItems || []).length > 3 && (
                    <span className="text-xs text-gray-600">+{req.lineItems.length - 3} more</span>
                  )}
                  <span className="ml-auto text-gray-600 text-xs">{fmtDate(req.createdAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Detail / Action panel ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl flex flex-col"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>

            {/* Panel header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 rounded-t-2xl"
              style={{ background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div>
                <h3 className="text-white font-black text-base">Add-on Request Review</h3>
                <p className="text-gray-500 text-xs mt-0.5">{selected.userName} · {fmtDate(selected.createdAt)}</p>
              </div>
              <button onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">✕</button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* User info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "User",           value: selected.userName     },
                  { label: "Email",          value: selected.userEmail    },
                  { label: "Payment Method", value: payLabel(selected.paymentMethod) },
                  { label: "Total Amount",   value: fmtRs(selected.grandTotal), highlight: "#fbbf24" },
                ].map(row => (
                  <div key={row.label} className="rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-1">{row.label}</p>
                    <p className="text-sm font-semibold" style={{ color: row.highlight || "#fff" }}>{row.value || "—"}</p>
                  </div>
                ))}
              </div>

              {/* Line items */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">⚡ Requested Add-ons</p>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(245,158,11,0.2)" }}>
                  {(selected.lineItems || []).map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3"
                      style={{
                        background: i % 2 === 0 ? "rgba(245,158,11,0.04)" : "transparent",
                        borderBottom: i < selected.lineItems.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      }}>
                      <div className="flex items-center gap-2">
                        <span>{item.icon}</span>
                        <div>
                          <p className="text-white text-sm font-semibold">{item.label}</p>
                          <p className="text-gray-500 text-xs">+{Number(item.qty).toLocaleString()} units</p>
                        </div>
                      </div>
                      <span className="text-amber-400 font-black text-sm">{fmtRs(item.total)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-4 py-3 border-t"
                    style={{ borderColor: "rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.06)" }}>
                    <span className="text-white font-black text-sm">Total</span>
                    <span className="text-white font-black text-lg">{fmtRs(selected.grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Payment screenshot */}
              {selected.paymentScreenshot && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2">📸 Payment Screenshot</p>
                  <div className="relative rounded-xl overflow-hidden cursor-zoom-in"
                    style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                    onClick={() => setImgZoom(true)}>
                    <img src={selected.paymentScreenshot} alt="Payment Screenshot"
                      className="w-full max-h-64 object-contain"
                      style={{ background: "#111" }} />
                    <div className="absolute bottom-2 right-2 px-2 py-1 rounded-lg text-[10px] font-bold"
                      style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>🔍 Zoom</div>
                  </div>
                </div>
              )}

              {/* Admin note */}
              {selected.status === "pending" && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-2 block">
                    📝 Admin Note (Optional)
                  </label>
                  <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                    rows={3} placeholder="Koi note likhna chahein to (user ko email mein dikhega)..."
                    className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.09)", color: "#fff" }} />
                </div>
              )}

              {selected.adminNote && selected.status !== "pending" && (
                <div className="rounded-xl px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-1">📝 Admin Note</p>
                  <p className="text-gray-300 text-sm">{selected.adminNote || "—"}</p>
                </div>
              )}

              {/* Action buttons */}
              {selected.status === "pending" ? (
                <div className="flex gap-3">
                  <button onClick={() => handleAction("reject")} disabled={processing}
                    className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.01]"
                    style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", opacity: processing ? 0.6 : 1 }}>
                    {processing ? "..." : "❌ Reject"}
                  </button>
                  <button onClick={() => handleAction("approve")} disabled={processing}
                    className="flex-1 py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.01]"
                    style={{ background: processing ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg,#10b981,#059669)", color: "#fff", opacity: processing ? 0.7 : 1, boxShadow: processing ? "none" : "0 4px 16px rgba(16,185,129,0.3)" }}>
                    {processing ? "Processing..." : "✅ Approve & Activate"}
                  </button>
                </div>
              ) : (
                <div className="px-4 py-3 rounded-xl text-sm font-semibold text-center"
                  style={{ background: STATUS_STYLE[selected.status]?.bg, border: `1px solid ${STATUS_STYLE[selected.status]?.border}`, color: STATUS_STYLE[selected.status]?.color }}>
                  {STATUS_STYLE[selected.status]?.label} — {fmtDate(selected.processedAt)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-screen image zoom */}
      {imgZoom && selected?.paymentScreenshot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.95)" }}
          onClick={() => setImgZoom(false)}>
          <img src={selected.paymentScreenshot} alt="Screenshot"
            className="max-w-full max-h-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: "rgba(255,255,255,0.1)" }} onClick={() => setImgZoom(false)}>✕</button>
        </div>
      )}
    </div>
  );
}
