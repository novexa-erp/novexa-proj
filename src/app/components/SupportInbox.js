"use client";
import { useState, useEffect, useCallback } from "react";

const STATUS_META = {
  "Open":        { color:"#3b82f6", bg:"rgba(59,130,246,0.12)",  border:"rgba(59,130,246,0.3)",  icon:"🔵" },
  "In Progress": { color:"#f59e0b", bg:"rgba(245,158,11,0.12)",  border:"rgba(245,158,11,0.3)",  icon:"🟡" },
  "Resolved":    { color:"#34d399", bg:"rgba(52,211,153,0.12)",  border:"rgba(52,211,153,0.3)",  icon:"✅" },
  "Closed":      { color:"#6b7280", bg:"rgba(107,114,128,0.12)", border:"rgba(107,114,128,0.3)", icon:"⬛" },
};

const PRIORITY_META = {
  "High":   { color:"#f87171", bg:"rgba(248,113,113,0.12)", border:"rgba(248,113,113,0.3)"  },
  "Medium": { color:"#fbbf24", bg:"rgba(251,191,36,0.12)",  border:"rgba(251,191,36,0.3)"   },
  "Low":    { color:"#34d399", bg:"rgba(52,211,153,0.12)",  border:"rgba(52,211,153,0.3)"   },
};

function fmtDT(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", hour12:true }); }
  catch { return iso; }
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META["Open"];
  return (
    <span style={{ background:m.bg, border:`1px solid ${m.border}`, color:m.color,
      padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
      {m.icon} {status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META["Medium"];
  return (
    <span style={{ background:m.bg, border:`1px solid ${m.border}`, color:m.color,
      padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700 }}>
      {priority}
    </span>
  );
}

// ── Ticket Detail Modal ───────────────────────────────────────────────────────
function TicketDetail({ ticket, getToken, onClose, onRefresh, onToast }) {
  const [reply,          setReply]          = useState("");
  const [sending,        setSending]        = useState(false);
  const [actioning,      setActioning]      = useState(false);
  const [resolvePopup,   setResolvePopup]   = useState(false);
  const [resolveMsg,     setResolveMsg]     = useState("");

  async function doAction(action, extra = {}) {
    setActioning(true);
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/ticket-action", {
        method:  "POST",
        headers: { authorization:`Bearer ${token}`, "Content-Type":"application/json" },
        body:    JSON.stringify({ ticketId: ticket.ticketId, action, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onToast(action === "delete" ? "Ticket deleted" : "Updated successfully", "success");
      onRefresh();
      if (action === "delete") onClose();
    } catch (err) { onToast(err.message, "error"); }
    setActioning(false);
  }

  async function handleResolve() {
    // Step 1: Resolved
    setActioning(true);
    try {
      const token = await getToken();
      // Send Resolved status with custom message
      const res1 = await fetch("/api/admin/ticket-action", {
        method: "POST",
        headers: { authorization:`Bearer ${token}`, "Content-Type":"application/json" },
        body: JSON.stringify({
          ticketId: ticket.ticketId, action: "status", newStatus: "Resolved",
          resolveNote: resolveMsg.trim(),
        }),
      });
      const d1 = await res1.json();
      if (!res1.ok) throw new Error(d1.error);

      // Step 2: Auto-close after 3 seconds
      setTimeout(async () => {
        try {
          const token2 = await getToken();
          await fetch("/api/admin/ticket-action", {
            method: "POST",
            headers: { authorization:`Bearer ${token2}`, "Content-Type":"application/json" },
            body: JSON.stringify({ ticketId: ticket.ticketId, action: "status", newStatus: "Closed" }),
          });
          onRefresh();
        } catch {}
      }, 3000);

      onToast("Ticket resolved! Auto-closing in 3s...", "success");
      setResolvePopup(false);
      setResolveMsg("");
      onRefresh();
    } catch (err) { onToast(err.message, "error"); }
    setActioning(false);
  }

  async function handleReply() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/ticket-action", {
        method:  "POST",
        headers: { authorization:`Bearer ${token}`, "Content-Type":"application/json" },
        body:    JSON.stringify({ ticketId: ticket.ticketId, action:"reply", replyText: reply.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setReply("");
      onToast("Reply sent!", "success");
      onRefresh();
    } catch (err) { onToast(err.message, "error"); }
    setSending(false);
  }

  const sm = STATUS_META[ticket.status] || STATUS_META["Open"];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl my-6 rounded-2xl overflow-hidden flex flex-col"
        style={{ background:"#0d1117", border:"1px solid rgba(255,255,255,0.1)", boxShadow:"0 32px 80px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.07)", background:"linear-gradient(135deg,rgba(37,99,235,0.1),rgba(245,158,11,0.04))" }}>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-white font-black text-lg">{ticket.ticketId}</p>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <p className="text-gray-500 text-xs mt-1">{ticket.subject}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">✕</button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* User info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label:"👤 User",     value: ticket.name      },
              { label:"📧 Email",    value: ticket.email     },
              { label:"🏢 Business", value: ticket.business  || "—" },
              { label:"🏷️ Category",value: ticket.category  },
              { label:"📅 Created",  value: fmtDT(ticket.createdAt) },
              { label:"🔄 Updated",  value: fmtDT(ticket.updatedAt) },
            ].map(r => (
              <div key={r.label} className="rounded-xl px-3 py-2.5"
                style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-gray-600 text-[9px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                <p className="text-white text-xs font-semibold truncate">{r.value}</p>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {["Open","In Progress","Closed"].map(s => {
              const m = STATUS_META[s];
              const isActive = ticket.status === s;
              return (
                <button key={s} disabled={actioning || isActive}
                  onClick={() => doAction("status", { newStatus: s })}
                  style={{
                    padding:"7px 14px", borderRadius:10, fontSize:12, fontWeight:700,
                    border: `1px solid ${isActive ? m.border : "rgba(255,255,255,0.08)"}`,
                    background: isActive ? m.bg : "rgba(255,255,255,0.03)",
                    color: isActive ? m.color : "#6b7280",
                    cursor: (actioning || isActive) ? "not-allowed" : "pointer",
                    opacity: actioning ? 0.6 : 1,
                  }}>
                  {m.icon} {s}
                </button>
              );
            })}
            {/* Resolved — special button with popup */}
            <button
              disabled={actioning || ticket.status === "Resolved"}
              onClick={() => setResolvePopup(true)}
              style={{
                padding:"7px 14px", borderRadius:10, fontSize:12, fontWeight:700,
                border: `1px solid ${ticket.status === "Resolved" ? STATUS_META["Resolved"].border : "rgba(52,211,153,0.35)"}`,
                background: ticket.status === "Resolved" ? STATUS_META["Resolved"].bg : "rgba(52,211,153,0.1)",
                color: ticket.status === "Resolved" ? STATUS_META["Resolved"].color : "#34d399",
                cursor: (actioning || ticket.status === "Resolved") ? "not-allowed" : "pointer",
                opacity: actioning ? 0.6 : 1,
              }}>
              ✅ Resolved
            </button>
            <button onClick={() => doAction("delete")} disabled={actioning}
              style={{ padding:"7px 14px", borderRadius:10, fontSize:12, fontWeight:700,
                border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.08)",
                color:"#f87171", cursor: actioning ? "not-allowed" : "pointer", marginLeft:"auto" }}>
              🗑 Delete
            </button>
          </div>

          {/* Resolve popup */}
          {resolvePopup && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              style={{ background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)" }}>
              <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
                style={{ background:"#0d1117", border:"1px solid rgba(52,211,153,0.3)", boxShadow:"0 24px 64px rgba(0,0,0,0.7)" }}>
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.3)" }}>
                    ✅
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Mark as Resolved</p>
                    <p className="text-gray-500 text-xs mt-0.5">{ticket.ticketId} · {ticket.name}</p>
                  </div>
                </div>

                {/* Resolution message */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                    Resolution Summary <span className="text-gray-600 normal-case tracking-normal font-normal">(sent to user in email)</span>
                  </label>
                  <textarea rows={4} value={resolveMsg}
                    onChange={e => setResolveMsg(e.target.value)}
                    placeholder="e.g. We identified the issue with your invoice generation. A fix has been applied to your account. Please try again and let us know if the issue persists."
                    style={{ width:"100%", outline:"none", resize:"vertical",
                      background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(52,211,153,0.3)",
                      borderRadius:12, padding:"10px 14px", color:"#fff", fontSize:13, lineHeight:1.7 }} />
                  <p className="text-gray-600 text-[10px]">
                    Ticket will be automatically <strong className="text-gray-500">Closed</strong> after marking resolved.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button onClick={() => { setResolvePopup(false); setResolveMsg(""); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                    style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
                    Cancel
                  </button>
                  <button onClick={handleResolve} disabled={actioning || !resolveMsg.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                    style={{ background:"linear-gradient(135deg,#34d399,#059669)", color:"#fff",
                      opacity:(actioning || !resolveMsg.trim()) ? 0.5 : 1,
                      cursor:(actioning || !resolveMsg.trim()) ? "not-allowed" : "pointer" }}>
                    {actioning ? "Resolving..." : "Mark Resolved & Notify User →"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Conversation */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">💬 Conversation</p>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {(ticket.messages || []).map((msg, i) => {
                const isAdmin = msg.from === "admin";
                return (
                  <div key={i} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                    <div style={{
                      maxWidth:"80%", padding:"10px 14px", borderRadius: isAdmin ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: isAdmin ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${isAdmin ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                      <p className="text-xs font-bold mb-1" style={{ color: isAdmin ? "#60a5fa" : "#9ca3af" }}>
                        {isAdmin ? "🛡 Novexa Support" : `👤 ${ticket.name}`}
                      </p>
                      <p className="text-sm text-white leading-relaxed" style={{ whiteSpace:"pre-wrap" }}>{msg.text}</p>
                      <p className="text-[10px] text-gray-600 mt-1.5">{fmtDT(msg.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reply box */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">✍️ Reply to User</p>
            <textarea
              rows={3} value={reply} onChange={e => setReply(e.target.value)}
              placeholder="Type your reply..."
              style={{ width:"100%", outline:"none", resize:"vertical",
                background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(37,99,235,0.3)",
                borderRadius:12, padding:"10px 14px", color:"#fff", fontSize:13 }} />
            <button onClick={handleReply} disabled={sending || !reply.trim()}
              style={{ padding:"10px 24px", borderRadius:12, fontSize:13, fontWeight:800,
                background:"linear-gradient(135deg,#2563eb,#1d4ed8)", color:"#fff",
                border:"none", cursor:(sending || !reply.trim()) ? "not-allowed":"pointer",
                opacity:(sending || !reply.trim()) ? 0.5 : 1, alignSelf:"flex-start" }}>
              {sending ? "Sending..." : "Send Reply →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main SupportInbox ─────────────────────────────────────────────────────────
export default function SupportInbox({ getToken, onToast }) {
  const [tickets,      setTickets]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [search,       setSearch]       = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/get-tickets", {
        headers: { authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setTickets(d.tickets || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [getToken]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const filtered = tickets.filter(t => {
    const matchStatus = filterStatus === "All" || t.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || t.name?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q)
      || t.subject?.toLowerCase().includes(q) || t.ticketId?.toLowerCase().includes(q)
      || t.business?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const counts = tickets.reduce((acc, t) => { acc[t.status] = (acc[t.status]||0)+1; return acc; }, {});

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-black text-xl">📬 Support Inbox</h2>
          <p className="text-gray-500 text-xs mt-1">{tickets.length} total tickets</p>
        </div>
        <button onClick={loadTickets}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-white/10"
          style={{ border:"1px solid rgba(255,255,255,0.1)", color:"#6b7280" }}>
          {loading ? <span className="animate-spin">↻</span> : "↻"} Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"Open",        val: counts["Open"]        || 0, color:"#3b82f6" },
          { label:"In Progress", val: counts["In Progress"] || 0, color:"#f59e0b" },
          { label:"Resolved",    val: counts["Resolved"]    || 0, color:"#34d399" },
          { label:"Closed",      val: counts["Closed"]      || 0, color:"#6b7280" },
        ].map(s => (
          <div key={s.label} className="rounded-xl px-4 py-3"
            style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1">{s.label}</p>
            <p className="font-black text-2xl" style={{ color:s.color }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, subject, ID..."
          style={{ flex:1, minWidth:200, outline:"none",
            background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(255,255,255,0.08)",
            borderRadius:10, padding:"9px 14px", color:"#fff", fontSize:13 }} />
        <div className="flex gap-2 flex-wrap">
          {["All","Open","In Progress","Resolved","Closed"].map(s => {
            const m = STATUS_META[s] || { color:"#9ca3af", bg:"rgba(255,255,255,0.05)", border:"rgba(255,255,255,0.1)" };
            return (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{
                  padding:"7px 14px", borderRadius:10, fontSize:12, fontWeight:700,
                  background: filterStatus === s ? m.bg : "rgba(255,255,255,0.03)",
                  border: `1px solid ${filterStatus === s ? m.border : "rgba(255,255,255,0.07)"}`,
                  color: filterStatus === s ? m.color : "#6b7280",
                  cursor:"pointer",
                }}>
                {s} {s !== "All" ? `(${counts[s]||0})` : `(${tickets.length})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="text-5xl">📭</span>
          <p className="text-gray-500 text-sm">No tickets found</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
          {/* Table head */}
          <div className="grid gap-3 px-5 py-3 text-[10px] font-bold uppercase tracking-wider"
            style={{ gridTemplateColumns:"1fr 1.5fr 2fr 1fr 1fr 0.8fr 1.2fr",
              background:"rgba(37,99,235,0.1)", color:"#6b7280",
              borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <span>Ticket ID</span><span>User</span><span>Subject</span>
            <span>Status</span><span>Priority</span><span>Category</span><span>Created</span>
          </div>

          {filtered.map((t, i) => (
            <div key={t.id}
              className="grid gap-3 px-5 py-3.5 items-center cursor-pointer transition-all hover:bg-white/[0.03]"
              style={{
                gridTemplateColumns:"1fr 1.5fr 2fr 1fr 1fr 0.8fr 1.2fr",
                background: i%2===0 ? "rgba(255,255,255,0.015)" : "transparent",
                borderBottom: i < filtered.length-1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
              onClick={() => setSelected(t)}>
              <span className="font-mono text-xs font-bold" style={{ color:"#60a5fa" }}>{t.ticketId}</span>
              <div>
                <p className="text-white text-xs font-semibold truncate">{t.name}</p>
                <p className="text-gray-600 text-[10px] truncate">{t.business || t.email}</p>
              </div>
              <p className="text-gray-300 text-xs truncate">{t.subject}</p>
              <StatusBadge status={t.status} />
              <PriorityBadge priority={t.priority} />
              <span className="text-gray-500 text-[10px] truncate">{t.category?.split(" ")[0]}</span>
              <span className="text-gray-600 text-[10px]">
                {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-PK",{day:"2-digit",month:"short"}) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selected && (
        <TicketDetail
          ticket={selected}
          getToken={getToken}
          onClose={() => setSelected(null)}
          onRefresh={() => { loadTickets(); setSelected(null); }}
          onToast={onToast}
        />
      )}
    </div>
  );
}
