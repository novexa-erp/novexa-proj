"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";

const STATUS_META = {
  "Open":        { color:"#3b82f6", bg:"rgba(59,130,246,0.12)",  border:"rgba(59,130,246,0.3)",  glow:"rgba(59,130,246,0.15)",  icon:"🔵", dot:"#3b82f6" },
  "In Progress": { color:"#f59e0b", bg:"rgba(245,158,11,0.12)",  border:"rgba(245,158,11,0.3)",  glow:"rgba(245,158,11,0.15)",  icon:"⚡", dot:"#f59e0b" },
  "Resolved":    { color:"#34d399", bg:"rgba(52,211,153,0.12)",  border:"rgba(52,211,153,0.3)",  glow:"rgba(52,211,153,0.15)",  icon:"✅", dot:"#34d399" },
  "Closed":      { color:"#6b7280", bg:"rgba(107,114,128,0.12)", border:"rgba(107,114,128,0.3)", glow:"rgba(107,114,128,0.1)",  icon:"🔒", dot:"#6b7280" },
};

const CAT_ICONS = {
  "Subscription / Renewal": "🔄",
  "Account Issue":           "🔐",
  "Billing Query":           "💳",
  "Feature Request":         "✨",
  "Bug Report":              "🐛",
  "Other":                   "💬",
};

function fmtDT(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", hour12:true }); }
  catch { return iso; }
}
function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" }); }
  catch { return iso; }
}

// ── Ticket Detail View ────────────────────────────────────────────────────────
function TicketDetail({ ticket, onBack }) {
  const sm = STATUS_META[ticket.status] || STATUS_META["Open"];

  const STATUS_INFO = {
    "Open":        { headline:"Ticket Received",           body:"Your ticket has been received. Our support team will review it shortly and get back to you." },
    "In Progress": { headline:"We're Working on It",       body:"Our team is actively investigating your issue. We'll update you as soon as we have more information." },
    "Resolved":    { headline:"Issue Resolved",            body:"Your issue has been resolved. Please check the conversation below for details. Feel free to reach out if you need further help." },
    "Closed":      { headline:"Ticket Closed",             body:"This ticket has been closed. If your issue persists, please open a new ticket or contact us on WhatsApp." },
  };
  const info = STATUS_INFO[ticket.status] || STATUS_INFO["Open"];

  return (
    <div className="flex flex-col gap-5 w-full">

      {/* Back button */}
      <button onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold w-fit transition-all hover:text-white group"
        style={{ color:"#6b7280" }}>
        <span className="transition-transform group-hover:-translate-x-1">←</span>
        Back to My Tickets
      </button>

      {/* Ticket header card */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.08)", boxShadow:`0 0 40px ${sm.glow}` }}>

        {/* Top gradient bar */}
        <div style={{ height:3, background:`linear-gradient(90deg,${sm.dot},transparent)` }} />

        <div className="p-5 sm:p-6">
          {/* Ticket ID + status */}
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono font-black text-xl tracking-tight"
                  style={{ color:"#60a5fa" }}>{ticket.ticketId}</span>
                <span style={{
                  background:sm.bg, border:`1px solid ${sm.border}`, color:sm.color,
                  padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:700
                }}>
                  {sm.icon} {ticket.status}
                </span>
              </div>
              <p className="text-white font-bold text-base">{ticket.subject}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1">Submitted</p>
              <p className="text-gray-400 text-xs font-semibold">{fmtDT(ticket.createdAt)}</p>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label:"Category",    value: `${CAT_ICONS[ticket.category] || "💬"} ${ticket.category}` },
              { label:"Priority",    value: ticket.priority || "Medium" },
              { label:"Created",     value: fmtDate(ticket.createdAt) },
              { label:"Last Update", value: fmtDate(ticket.updatedAt) },
            ].map(r => (
              <div key={r.label} className="rounded-xl px-3 py-2.5"
                style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-gray-600 text-[9px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                <p className="text-white text-xs font-semibold">{r.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status banner */}
      <div className="rounded-2xl p-4 flex items-start gap-4"
        style={{ background:sm.bg, border:`1px solid ${sm.border}` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background:"rgba(0,0,0,0.2)" }}>
          {sm.icon}
        </div>
        <div>
          <p className="font-black text-sm mb-0.5" style={{ color:sm.color }}>{info.headline}</p>
          <p className="text-gray-300 text-xs leading-relaxed">{info.body}</p>
        </div>
      </div>

      {/* Conversation */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>

        {/* Section header */}
        <div className="px-5 py-3.5 flex items-center gap-2"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.02)" }}>
          <span className="text-sm">💬</span>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Conversation</p>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background:"rgba(37,99,235,0.15)", color:"#60a5fa", border:"1px solid rgba(37,99,235,0.25)" }}>
            {(ticket.messages||[]).length} messages
          </span>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {(ticket.messages || []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="text-4xl opacity-30">💬</span>
              <p className="text-gray-600 text-sm">No messages yet</p>
            </div>
          ) : (
            (ticket.messages || []).map((msg, i) => {
              const isAdmin = msg.from === "admin";
              return (
                <div key={i} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                  <div style={{
                    maxWidth:"80%",
                    borderRadius: isAdmin ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    padding:"12px 16px",
                    background: isAdmin
                      ? "linear-gradient(135deg,rgba(37,99,235,0.2),rgba(37,99,235,0.12))"
                      : "rgba(255,255,255,0.05)",
                    border:`1px solid ${isAdmin ? "rgba(37,99,235,0.35)" : "rgba(255,255,255,0.08)"}`,
                    boxShadow: isAdmin ? "0 4px 16px rgba(37,99,235,0.1)" : "none",
                  }}>
                    {/* Avatar + name */}
                    <div className="flex items-center gap-2 mb-2">
                      <div style={{
                        width:22, height:22, borderRadius:"50%",
                        background: isAdmin ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.1)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:11, flexShrink:0,
                      }}>
                        {isAdmin ? "🛡" : "👤"}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider"
                        style={{ color: isAdmin ? "#60a5fa" : "#9ca3af" }}>
                        {isAdmin ? "Novexa Support" : "You"}
                      </span>
                    </div>
                    <p className="text-sm text-white leading-relaxed" style={{ whiteSpace:"pre-wrap" }}>{msg.text}</p>
                    <p className="text-[10px] mt-2 text-right" style={{ color: isAdmin ? "rgba(96,165,250,0.6)" : "#4b5563" }}>
                      {fmtDT(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl p-4 flex flex-wrap gap-3 items-center"
        style={{ background:"rgba(37,99,235,0.05)", border:"1px solid rgba(37,99,235,0.15)" }}>
        <span className="text-blue-400 text-sm">💡</span>
        <p className="text-gray-400 text-xs flex-1">Need faster help? Reach us directly.</p>
        <a href="https://wa.me/923320262457" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
          style={{ background:"rgba(22,163,74,0.15)", border:"1px solid rgba(22,163,74,0.3)", color:"#34d399" }}>
          💬 WhatsApp
        </a>
        <a href="tel:+923320262457"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
          style={{ background:"rgba(37,99,235,0.12)", border:"1px solid rgba(37,99,235,0.25)", color:"#60a5fa" }}>
          📞 Call Us
        </a>
      </div>
    </div>
  );
}

// ── Main MyTicketsView ────────────────────────────────────────────────────────
export default function MyTicketsView({ uid, userDoc, user, onNewTicket }) {
  const [tickets,  setTickets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter,   setFilter]   = useState("All");

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "users", uid, "tickets"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [uid]);

  if (selected) return <TicketDetail ticket={selected} onBack={() => setSelected(null)} />;

  const filtered = filter === "All" ? tickets : tickets.filter(t => t.status === filter);
  const counts   = tickets.reduce((a, t) => { a[t.status] = (a[t.status]||0)+1; return a; }, {});

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white font-black text-2xl tracking-tight">My Support Tickets</h2>
          <p className="text-gray-500 text-sm mt-1">Track and manage your support requests</p>
        </div>
        <button onClick={onNewTicket}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] hover:brightness-110"
          style={{ background:"linear-gradient(135deg,#2563eb,#1d4ed8)", color:"#fff",
            boxShadow:"0 4px 16px rgba(37,99,235,0.3)" }}>
          <span className="text-base">+</span> New Ticket
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"Total",       val: tickets.length,          color:"#9ca3af", bg:"rgba(255,255,255,0.04)", border:"rgba(255,255,255,0.08)" },
          { label:"Open",        val: counts["Open"]        ||0, color:"#3b82f6", bg:"rgba(59,130,246,0.08)",  border:"rgba(59,130,246,0.2)"  },
          { label:"In Progress", val: counts["In Progress"] ||0, color:"#f59e0b", bg:"rgba(245,158,11,0.08)",  border:"rgba(245,158,11,0.2)"  },
          { label:"Resolved",    val: counts["Resolved"]    ||0, color:"#34d399", bg:"rgba(52,211,153,0.08)",  border:"rgba(52,211,153,0.2)"  },
        ].map(s => (
          <div key={s.label} className="rounded-2xl px-4 py-3 flex flex-col gap-1"
            style={{ background:s.bg, border:`1px solid ${s.border}` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:s.color+"99" }}>{s.label}</p>
            <p className="font-black text-2xl leading-none" style={{ color:s.color }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {["All","Open","In Progress","Resolved","Closed"].map(f => {
          const m   = STATUS_META[f] || { color:"#9ca3af", bg:"rgba(255,255,255,0.05)", border:"rgba(255,255,255,0.1)" };
          const isA = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: isA ? m.bg : "rgba(255,255,255,0.03)",
                border:`1px solid ${isA ? m.border : "rgba(255,255,255,0.07)"}`,
                color: isA ? m.color : "#6b7280",
              }}>
              {f} {f !== "All" && counts[f] ? `(${counts[f]})` : f === "All" ? `(${tickets.length})` : ""}
            </button>
          );
        })}
      </div>

      {/* ── Ticket list ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-4 border-t-blue-500 border-r-purple-500 border-b-amber-500 border-l-transparent animate-spin" />
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-12 flex flex-col items-center gap-4 text-center"
          style={{ background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.08)" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background:"rgba(37,99,235,0.08)", border:"1px solid rgba(37,99,235,0.15)" }}>📭</div>
          <div>
            <p className="text-white font-bold text-lg mb-1">No tickets yet</p>
            <p className="text-gray-500 text-sm">Submit a support request and track it right here.</p>
          </div>
          <button onClick={onNewTicket}
            className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
            style={{ background:"linear-gradient(135deg,#2563eb,#1d4ed8)", color:"#fff" }}>
            + Create Your First Ticket
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(t => {
            const sm        = STATUS_META[t.status] || STATUS_META["Open"];
            const lastMsg   = t.messages?.[t.messages.length - 1];
            const hasReply  = t.messages?.some(m => m.from === "admin");
            return (
              <div key={t.id} onClick={() => setSelected(t)}
                className="rounded-2xl cursor-pointer transition-all hover:scale-[1.005] group overflow-hidden"
                style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.08)",
                  boxShadow:"0 2px 12px rgba(0,0,0,0.2)" }}>

                {/* Status color bar */}
                <div style={{ height:2, background:`linear-gradient(90deg,${sm.dot},transparent)` }} />

                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: ticket info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-mono text-xs font-black" style={{ color:"#60a5fa" }}>
                          {t.ticketId}
                        </span>
                        <span style={{
                          background:sm.bg, border:`1px solid ${sm.border}`, color:sm.color,
                          padding:"2px 9px", borderRadius:20, fontSize:10, fontWeight:700
                        }}>
                          {sm.icon} {t.status}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background:"rgba(255,255,255,0.05)", color:"#6b7280", border:"1px solid rgba(255,255,255,0.08)" }}>
                          {CAT_ICONS[t.category] || "💬"} {t.category}
                        </span>
                        {hasReply && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background:"rgba(52,211,153,0.1)", color:"#34d399", border:"1px solid rgba(52,211,153,0.25)" }}>
                            ✉ Reply received
                          </span>
                        )}
                      </div>
                      <p className="text-white font-bold text-sm truncate mb-1">{t.subject}</p>
                      {lastMsg && (
                        <p className="text-gray-500 text-xs truncate">
                          <span style={{ color: lastMsg.from==="admin" ? "#60a5fa" : "#9ca3af" }}>
                            {lastMsg.from==="admin" ? "Support: " : "You: "}
                          </span>
                          {lastMsg.text?.slice(0,70)}{lastMsg.text?.length > 70 ? "..." : ""}
                        </p>
                      )}
                    </div>

                    {/* Right: date + arrow */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <p className="text-gray-400 text-xs font-semibold">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-PK",{day:"2-digit",month:"short"}) : "—"}
                      </p>
                      {t.messages?.length > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background:"rgba(37,99,235,0.12)", color:"#60a5fa", border:"1px solid rgba(37,99,235,0.2)" }}>
                          {t.messages.length}
                        </span>
                      )}
                      <span className="text-gray-600 text-sm transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
