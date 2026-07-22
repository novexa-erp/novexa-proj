"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ── Payment accounts ──────────────────────────────────────────────────── */
const PAYMENT_ACCOUNTS = [
  { id: "easypaisa", name: "EasyPaisa",    emoji: "💚", color: "#00c96b", glow: "rgba(0,201,107,0.3)",   gradient: "linear-gradient(135deg,#00c96b,#00a651)", accountNo: "0325-1507557", accountName: "Muhammad Aqdas", tip: "EasyPaisa app → Send Money" },
  { id: "jazzcash",  name: "JazzCash",     emoji: "🔴", color: "#ff3355", glow: "rgba(255,51,85,0.3)",   gradient: "linear-gradient(135deg,#ff3355,#e31837)", accountNo: "0332-0262457", accountName: "Muhammad Aqdas", tip: "JazzCash app → Send Money" },
  { id: "meezan",   name: "Meezan Bank",  emoji: "🏦", color: "#00b894", glow: "rgba(0,184,148,0.3)",   gradient: "linear-gradient(135deg,#00b894,#006633)", accountNo: "99350110348124", accountName: "Muhammad Aqdas", tip: "Online transfer or bank deposit" },
];

/* ── Add-on categories ─────────────────────────────────────────────────── */
const ADDON_CATEGORIES = [
  { limitKey: "invoicesPerMonth",            label: "Extra Invoices / Month",          sublabel: "Boost monthly invoice creation limit",       icon: "🧾", color: "#3b82f6", glow: "rgba(59,130,246,0.3)",   perUnitKey: "invoicesPerMonth_per",            defaultPerUnit: 10, packages: [{ key: "invoicesPerMonth_50",   qty:50,defaultPrice:500},{ key:"invoicesPerMonth_100",  qty:100,defaultPrice:900},{ key:"invoicesPerMonth_250",  qty:250,defaultPrice:2000},{ key:"invoicesPerMonth_500",  qty:500,defaultPrice:3500},{ key:"invoicesPerMonth_1000", qty:1000,defaultPrice:6000}] },
  { limitKey: "invoicesPerCustomerPerMonth", label: "Invoices per Customer / Month",   sublabel: "Extra invoices per customer each month",     icon: "👥", color: "#8b5cf6", glow: "rgba(139,92,246,0.3)",  perUnitKey: "invoicesPerCustomerPerMonth_per", defaultPerUnit: 10, packages: [{ key: "invoicesPerCustomerPerMonth_50",   qty:50,defaultPrice:500},{ key:"invoicesPerCustomerPerMonth_100",  qty:100,defaultPrice:900},{ key:"invoicesPerCustomerPerMonth_250",  qty:250,defaultPrice:2000},{ key:"invoicesPerCustomerPerMonth_500",  qty:500,defaultPrice:3500},{ key:"invoicesPerCustomerPerMonth_1000", qty:1000,defaultPrice:6000}] },
  { limitKey: "customersPerMonth",           label: "Extra Customers / Month",         sublabel: "Add more new customers every month",         icon: "👤", color: "#10b981", glow: "rgba(16,185,129,0.3)",  perUnitKey: "customersPerMonth_per",           defaultPerUnit: 30, packages: [{ key: "customersPerMonth_50",   qty:50,defaultPrice:1200},{ key:"customersPerMonth_100",  qty:100,defaultPrice:2200},{ key:"customersPerMonth_250",  qty:250,defaultPrice:5000},{ key:"customersPerMonth_500",  qty:500,defaultPrice:9000},{ key:"customersPerMonth_1000", qty:1000,defaultPrice:16000}] },
  { limitKey: "suppliersPerMonth",           label: "Extra Suppliers / Month",         sublabel: "Expand your supplier network monthly",       icon: "🏭", color: "#f59e0b", glow: "rgba(245,158,11,0.3)",  perUnitKey: "suppliersPerMonth_per",           defaultPerUnit: 30, packages: [{ key: "suppliersPerMonth_20",   qty:20,defaultPrice:500},{ key:"suppliersPerMonth_50",   qty:50,defaultPrice:1200},{ key:"suppliersPerMonth_100",  qty:100,defaultPrice:2200},{ key:"suppliersPerMonth_250",  qty:250,defaultPrice:5000},{ key:"suppliersPerMonth_500",  qty:500,defaultPrice:9000},{ key:"suppliersPerMonth_1000", qty:1000,defaultPrice:16000}] },
  { limitKey: "ordersPerSupplierPerMonth",   label: "Orders per Supplier / Month",     sublabel: "More orders per supplier each month",        icon: "🛒", color: "#ec4899", glow: "rgba(236,72,153,0.3)",  perUnitKey: "ordersPerSupplierPerMonth_per",   defaultPerUnit: 10, packages: [{ key: "ordersPerSupplierPerMonth_50",   qty:50,defaultPrice:500},{ key:"ordersPerSupplierPerMonth_100",  qty:100,defaultPrice:900},{ key:"ordersPerSupplierPerMonth_250",  qty:250,defaultPrice:2000},{ key:"ordersPerSupplierPerMonth_500",  qty:500,defaultPrice:3500},{ key:"ordersPerSupplierPerMonth_1000", qty:1000,defaultPrice:6000}] },
];

/* ── Helpers ───────────────────────────────────────────────────────────── */
function fmtRs(n) { return "Rs. " + Number(n || 0).toLocaleString("en-PK"); }
function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return "—"; }
}
function calcTieredPrice(qty, perUnit, packages) {
  if (qty <= 0) return 0;
  const sorted = [...packages].sort((a, b) => b.qty - a.qty);
  let remaining = qty, total = 0;
  for (const pkg of sorted) {
    if (remaining >= pkg.qty) { const c = Math.floor(remaining / pkg.qty); total += c * pkg.price; remaining -= c * pkg.qty; }
  }
  if (remaining > 0) total += remaining * perUnit;
  return total;
}

/* ── CSS animations ────────────────────────────────────────────────────── */
const CSS = `
@keyframes orb1{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(60px,-40px) scale(1.1);}66%{transform:translate(-30px,50px) scale(0.95);}}
@keyframes orb2{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(-50px,30px) scale(1.08);}66%{transform:translate(40px,-60px) scale(0.92);}}
@keyframes orb3{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(30px,40px) scale(1.05);}}
@keyframes fsu{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-7px);}}
@keyframes pulse-ring{0%{transform:scale(1);opacity:.7;}100%{transform:scale(1.7);opacity:0;}}
@keyframes bar-grow{from{height:0;}to{height:var(--h);}}
@keyframes dash{to{stroke-dashoffset:0;}}
@keyframes modal-in{from{opacity:0;transform:scale(0.92) translateY(24px);}to{opacity:1;transform:scale(1) translateY(0);}}
@keyframes overlay-in{from{opacity:0;}to{opacity:1;}}
`;
function injectCSS(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const s = document.createElement("style"); s.id = id; s.textContent = css;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════════
   RIGHT PANEL — Current Add-on Status + Charts
══════════════════════════════════════════════════════════════ */
function RightPanel({ userDoc, myRequests, addonPrices }) {
  const extras  = userDoc?.extraLimits;
  const expAt   = userDoc?.extraLimitsExpiresAt;
  const hasAny  = extras && (ADDON_CATEGORIES.some(c => Number(extras[c.limitKey]) > 0) || Number(extras?.["extraUsers"]) > 0);
  const expired = expAt ? new Date(expAt) < new Date() : false;
  const dLeft   = expAt ? Math.ceil((new Date(expAt) - new Date()) / 86400000) : null;

  const activeRows = ADDON_CATEGORIES.filter(c => Number(extras?.[c.limitKey]) > 0);
  // Include extra users if active
  const extraUsersActive = Number(extras?.["extraUsers"]) || 0;
  const totalSpent = myRequests.filter(r => r.status === "approved").reduce((s, r) => s + (r.grandTotal || 0), 0);
  const pendingAmt = myRequests.filter(r => r.status === "pending").reduce((s, r) => s + (r.grandTotal || 0), 0);

  /* ── Bar chart data — quota per category ── */
  const maxQty = Math.max(...activeRows.map(r => Number(extras?.[r.limitKey]) || 0), extraUsersActive, 1);

  /* ── Pie chart — spend by category ── */
  const approvedReqs = myRequests.filter(r => r.status === "approved");
  const spendByCat = {};
  approvedReqs.forEach(req => {
    (req.lineItems || []).forEach(item => {
      const cat = ADDON_CATEGORIES.find(c => c.limitKey === item.limitKey);
      if (cat) spendByCat[cat.limitKey] = (spendByCat[cat.limitKey] || 0) + (item.total || 0);
      // Track extra user seats spend separately
      if (item.limitKey === "extraUsers") {
        spendByCat["extraUsers"] = (spendByCat["extraUsers"] || 0) + (item.total || 0);
      }
    });
  });
  const pieData = [
    ...ADDON_CATEGORIES.filter(c => spendByCat[c.limitKey] > 0)
      .map(c => ({ label: c.label, icon: c.icon, color: c.color, value: spendByCat[c.limitKey] })),
    // Add extra users if there's spend
    ...(spendByCat["extraUsers"] > 0 ? [{ label: "Extra User Seats", icon: "👤", color: "#6366f1", value: spendByCat["extraUsers"] }] : []),
  ];
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  /* ── Line chart — requests over last 6 months ── */
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: d.toLocaleString("en", { month: "short" }), year: d.getFullYear(), month: d.getMonth(), count: 0, amt: 0 };
  });
  myRequests.forEach(req => {
    const d = req.createdAt?.toDate ? req.createdAt.toDate() : new Date(req.createdAt || 0);
    const idx = months.findIndex(m => m.year === d.getFullYear() && m.month === d.getMonth());
    if (idx >= 0) { months[idx].count++; months[idx].amt += req.grandTotal || 0; }
  });
  const maxAmt = Math.max(...months.map(m => m.amt), 1);
  const W = 260, H = 90, PAD = 12;
  const pts = months.map((m, i) => ({
    x: PAD + i * ((W - PAD * 2) / 5),
    y: H - PAD - ((m.amt / maxAmt) * (H - PAD * 2)),
    amt: m.amt, label: m.label,
  }));
  const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");
  const area = `M${pts[0].x},${H - PAD} ` + pts.map(p => `L${p.x},${p.y}`).join(" ") + ` L${pts[pts.length-1].x},${H-PAD} Z`;

  /* ── No data state ── */
  if (!hasAny && myRequests.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {/* Empty state card */}
        <div className="rounded-2xl p-6 flex flex-col items-center text-center gap-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(99,102,241,0.25)", minHeight: 260 }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", animation: "float 3s ease-in-out infinite" }}>
            📦
          </div>
          <div>
            <p className="text-white font-bold text-base">No Add-ons Yet</p>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">
              You haven't purchased any add-ons yet. Pick a package from the left to expand your limits.
            </p>
          </div>
          <div className="w-full rounded-xl px-4 py-3"
            style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
            <p className="text-indigo-300 text-xs font-semibold">💡 Add-ons last 1 month from activation</p>
          </div>
        </div>

        {/* Placeholder charts */}
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-gray-600 text-xs font-bold uppercase tracking-widest mb-3">Quota Overview</p>
          <div className="flex items-end justify-around gap-2 h-20">
            {[...ADDON_CATEGORIES, { limitKey: "extraUsers", icon: "👤", color: "#6366f1" }].map((cat, i) => (
              <div key={cat.limitKey} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full rounded-t-lg" style={{ height: `${20 + i * 7}px`, background: `${cat.color}15`, border: `1px solid ${cat.color}20` }} />
                <span className="text-[9px]">{cat.icon}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-700 text-[10px] mt-2">No data yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Status card ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: expired ? "rgba(239,68,68,0.07)" : "linear-gradient(135deg,rgba(16,185,129,0.09),rgba(6,182,212,0.05))", border: `1px solid ${expired ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`, boxShadow: expired ? "none" : "0 0 32px rgba(16,185,129,0.06)" }}>
        <div className="px-4 py-3 flex items-center justify-between border-b"
          style={{ borderColor: expired ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)" }}>
          <span className="font-bold text-xs uppercase tracking-widest" style={{ color: expired ? "#f87171" : "#34d399" }}>
            {expired ? "⏰ Expired" : "⚡ Active Add-on"}
          </span>
          <span className="text-xs font-bold" style={{ color: expired ? "#f87171" : "#fbbf24" }}>
            {expired ? fmtDate(expAt) : dLeft !== null ? `${dLeft}d left` : "—"}
          </span>
        </div>
        {hasAny ? (
          <div className="p-4 flex flex-col gap-2">
            {activeRows.map(cat => {
              const qty = Number(extras?.[cat.limitKey]) || 0;
              const pct = Math.min(100, Math.round((qty / maxQty) * 100));
              return (
                <div key={cat.limitKey}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs flex items-center gap-1.5" style={{ color: "#9ca3af" }}>
                      {cat.icon} <span className="truncate max-w-[100px]">{cat.label.replace(" / Month", "").replace("Extra ", "")}</span>
                    </span>
                    <span className="font-black text-sm" style={{ color: cat.color }}>+{qty.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg,${cat.color}99,${cat.color})` }} />
                  </div>
                </div>
              );
            })}
            {/* Extra user seats row */}
            {extraUsersActive > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs flex items-center gap-1.5" style={{ color: "#9ca3af" }}>
                    👤 <span className="truncate max-w-[100px]">User Seats</span>
                  </span>
                  <span className="font-black text-sm" style={{ color: "#6366f1" }}>+{extraUsersActive} user{extraUsersActive > 1 ? "s" : ""}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.round((extraUsersActive / Math.max(maxQty, extraUsersActive)) * 100))}%`, background: "linear-gradient(90deg,#6366f199,#6366f1)" }} />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mt-1 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-gray-600 text-[10px] uppercase tracking-widest">Expires</span>
              <span className="text-xs font-semibold" style={{ color: expired ? "#f87171" : "#d1d5db" }}>{fmtDate(expAt)}</span>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 text-gray-600 text-xs">No active quota.</div>
        )}
      </div>

      {/* ── Bar chart — quota by category ── */}
      {hasAny && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">📊 Active Quota</p>
          <div className="flex items-end justify-around gap-2" style={{ height: 90 }}>
            {ADDON_CATEGORIES.map(cat => {
              const qty = Number(extras?.[cat.limitKey]) || 0;
              const pct = qty > 0 ? Math.max(8, Math.round((qty / maxQty) * 80)) : 4;
              return (
                <div key={cat.limitKey} className="flex flex-col items-center gap-1.5 flex-1 group relative">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    style={{ background: "rgba(13,15,25,0.95)", border: `1px solid ${cat.color}40`, color: cat.color }}>
                    {qty > 0 ? `+${qty.toLocaleString()}` : "0"}
                  </div>
                  <div className="w-full rounded-t-xl transition-all duration-700"
                    style={{ height: `${pct}px`, background: qty > 0 ? `linear-gradient(to top,${cat.color},${cat.color}80)` : "rgba(255,255,255,0.05)", boxShadow: qty > 0 ? `0 0 12px ${cat.glow}` : "none" }} />
                  <span className="text-sm">{cat.icon}</span>
                </div>
              );
            })}
            {/* Extra user seats bar */}
            {(() => {
              const qty = extraUsersActive;
              const pct = qty > 0 ? Math.max(8, Math.round((qty / maxQty) * 80)) : 4;
              return (
                <div className="flex flex-col items-center gap-1.5 flex-1 group relative">
                  <div className="absolute bottom-full mb-2 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    style={{ background: "rgba(13,15,25,0.95)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}>
                    {qty > 0 ? `+${qty} user${qty > 1 ? "s" : ""}` : "0"}
                  </div>
                  <div className="w-full rounded-t-xl transition-all duration-700"
                    style={{ height: `${pct}px`, background: qty > 0 ? "linear-gradient(to top,#6366f1,#a5b4fc80)" : "rgba(255,255,255,0.05)", boxShadow: qty > 0 ? "0 0 12px rgba(99,102,241,0.4)" : "none" }} />
                  <span className="text-sm">👤</span>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Pie chart — spend distribution ── */}
      {pieData.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">🥧 Spend Distribution</p>
          <div className="flex items-center gap-4">
            {/* SVG Pie */}
            <svg width="80" height="80" viewBox="0 0 80 80" className="flex-shrink-0">
              {(() => {
                let offset = 0;
                const r = 28, cx = 40, cy = 40, circ = 2 * Math.PI * r;
                return pieData.map((d, i) => {
                  const pct  = d.value / pieTotal;
                  const dash = pct * circ;
                  const gap  = circ - dash;
                  const rot  = -90 + offset * 360;
                  offset += pct;
                  return (
                    <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                      stroke={d.color} strokeWidth="18"
                      strokeDasharray={`${dash} ${gap}`}
                      strokeDashoffset={-((offset - pct) * circ)}
                      style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px` }}
                      transform={`rotate(${rot} ${cx} ${cy})`} />
                  );
                });
              })()}
              <circle cx="40" cy="40" r="19" fill="rgba(8,10,20,0.9)" />
              <text x="40" y="44" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">
                {fmtRs(pieTotal).replace("Rs. ", "Rs.")}
              </text>
            </svg>
            {/* Legend */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {pieData.map(d => (
                <div key={d.label} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-[10px] text-gray-400 truncate flex-1">{d.icon} {d.label.replace(" / Month","").replace("Extra ","")}</span>
                  <span className="text-[10px] font-bold flex-shrink-0" style={{ color: d.color }}>
                    {Math.round((d.value / pieTotal) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Line chart — monthly spend ── */}
      {myRequests.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-3">📈 Monthly Spend</p>
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map(f => (
              <line key={f} x1={PAD} y1={H - PAD - f * (H - PAD * 2)} x2={W - PAD} y2={H - PAD - f * (H - PAD * 2)}
                stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            ))}
            {/* Area fill */}
            <path d={area} fill="url(#lineGrad)" />
            {/* Line */}
            <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* Dots + labels */}
            {pts.map((p, i) => (
              <g key={i}>
                {p.amt > 0 && <circle cx={p.x} cy={p.y} r="4" fill="#6366f1" stroke="rgba(8,10,20,0.9)" strokeWidth="2" />}
                <text x={p.x} y={H - 1} textAnchor="middle" fill="#4b5563" fontSize="8">{p.label}</text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* ── Stats summary ── */}
      {myRequests.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Spent",    value: fmtRs(totalSpent), color: "#10b981", icon: "💰" },
            { label: "Pending Amt",    value: fmtRs(pendingAmt), color: "#fbbf24", icon: "⏳" },
            { label: "Total Requests", value: myRequests.length,  color: "#6366f1", icon: "📋" },
            { label: "Approved",       value: myRequests.filter(r=>r.status==="approved").length, color: "#34d399", icon: "✅" },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-3 py-2.5 flex items-center gap-2"
              style={{ background: `${s.color}0d`, border: `1px solid ${s.color}25` }}>
              <span className="text-base">{s.icon}</span>
              <div className="min-w-0">
                <p className="font-black text-sm leading-tight truncate" style={{ color: s.color }}>{s.value}</p>
                <p className="text-gray-600 text-[10px] font-semibold">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ADDON INVOICE MODAL
══════════════════════════════════════════════════════════════ */
function AddonInvoiceModal({ req, onClose }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

  if (!req || !mounted) return null;

  const ts       = req.createdAt?.toDate ? req.createdAt.toDate().toISOString() : req.createdAt;
  const approved = req.processedAt || req.createdAt;
  const approvedTs = approved?.toDate ? approved.toDate().toISOString() : approved;

  // Expiry = approvedAt + 1 month
  const expiryDate = approvedTs
    ? (() => { const d = new Date(approvedTs); d.setMonth(d.getMonth() + 1); return d.toISOString(); })()
    : null;

  const payLabel = {
    easypaisa: "💚 EasyPaisa",
    jazzcash:  "🔴 JazzCash",
    meezan:    "🏦 Meezan Bank",
    cash:      "💵 Cash",
    online:    "🌐 Online",
    cheque:    "🧾 Cheque",
  }[req.paymentMethod] || req.paymentMethod || "—";

  const invoiceNo = req.requestNumber || `ADD-${(req.id || "").slice(-6).toUpperCase()}`;

  function fmtDT(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }); }
    catch { return "—"; }
  }

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        animation: "overlay-in 0.2s ease both",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div style={{
        width: "100%",
        maxWidth: 520,
        maxHeight: "90vh",
        borderRadius: 20,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "#0d1117",
        border: "1.5px solid rgba(99,102,241,0.4)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(99,102,241,0.1)",
        animation: "modal-in 0.28s cubic-bezier(0.34,1.56,0.64,1) both",
      }}>

        {/* Top gradient bar */}
        <div style={{ height: 5, background: "linear-gradient(to right,#6366f1,#8b5cf6,#fbbf24)", flexShrink: 0 }} />

        {/* Header */}
        <div style={{
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          background: req.source === "admin"
            ? "linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.05))"
            : "linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.05))",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div>
            <p style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 4 }}>
              {req.source === "admin" ? "👑 Admin Grant" : "Add-on Invoice"}
            </p>
            <p style={{ color: "#fff", fontWeight: 900, fontSize: 22, lineHeight: 1 }}>{invoiceNo}</p>
            {req.source === "admin" && (
              <p style={{ color: "#fbbf24", fontSize: 11, fontWeight: 600, marginTop: 6 }}>
                ✨ Given by Super Admin — no payment required
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              padding: "6px 14px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 800,
              background: req.status === "approved" ? "rgba(52,211,153,0.15)" : req.status === "rejected" ? "rgba(248,113,113,0.15)" : "rgba(251,191,36,0.15)",
              border: `1px solid ${req.status === "approved" ? "rgba(52,211,153,0.45)" : req.status === "rejected" ? "rgba(248,113,113,0.45)" : "rgba(251,191,36,0.45)"}`,
              color: req.status === "approved" ? "#34d399" : req.status === "rejected" ? "#f87171" : "#fbbf24",
            }}>
              {req.status === "approved" ? "✅ Approved" : req.status === "rejected" ? "❌ Rejected" : "⏳ Pending"}
            </span>
            {/* Close X */}
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#9ca3af", fontSize: 16, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Dates grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Requested On",  value: fmtDT(ts) },
              { label: "Approved On",   value: req.status === "approved" ? fmtDT(approvedTs) : "—" },
              { label: "Payment Via",   value: req.source === "admin" ? "👑 Given by Super Admin" : payLabel },
              { label: "Expires On",    value: req.status === "approved" ? fmtDate(expiryDate) : "—" },
            ].map(r => (
              <div key={r.label} style={{ borderRadius: 12, padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>{r.label}</p>
                <p style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{r.value}</p>
              </div>
            ))}
          </div>

          {/* Line items */}
          <div>
            <p style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 12 }}>⚡ Add-ons Purchased</p>
            <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "10px 16px", background: "rgba(99,102,241,0.12)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Add-on", "Qty Added", "Amount"].map((h, i) => (
                  <p key={h} style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", textAlign: i > 0 ? "center" : "left" }}>{h}</p>
                ))}
              </div>
              {(req.lineItems || []).map((item, i, arr) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr",
                  padding: "12px 16px", alignItems: "center",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{item.icon || "⚡"}</span>
                    <span style={{ color: "#d1d5db", fontSize: 13, fontWeight: 500 }}>{item.label}</span>
                  </div>
                  <p style={{ color: "#a5b4fc", fontWeight: 900, fontSize: 15, textAlign: "center" }}>+{Number(item.qty).toLocaleString()}</p>
                  <p style={{ color: "#fbbf24", fontWeight: 700, fontSize: 14, textAlign: "center" }}>{fmtRs(item.total)}</p>
                </div>
              ))}
              {/* Grand total */}
              <div style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr",
                padding: "14px 16px", alignItems: "center",
                background: "rgba(99,102,241,0.1)",
                borderTop: "1.5px solid rgba(99,102,241,0.25)",
              }}>
                <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", gridColumn: "span 2" }}>Total Paid</p>
                <p style={{ color: "#fff", fontWeight: 900, fontSize: 18, textAlign: "center" }}>{fmtRs(req.grandTotal)}</p>
              </div>
            </div>
          </div>

          {/* Payment screenshot */}
          {req.paymentScreenshot && (
            <div>
              <p style={{ color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 12 }}>📸 Payment Screenshot</p>
              <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
                <img src={req.paymentScreenshot} alt="Payment proof"
                  style={{ width: "100%", maxHeight: 220, objectFit: "contain", background: "#111", display: "block" }} />
              </div>
            </div>
          )}

          {/* Admin note */}
          {req.adminNote && (
            <div style={{ borderRadius: 12, padding: "12px 16px", background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <p style={{ color: "#60a5fa", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>📝 Note from Novexa</p>
              <p style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.6 }}>{req.adminNote}</p>
            </div>
          )}

          {/* Validity */}
          {req.status === "approved" && expiryDate && (
            <div style={{ borderRadius: 12, padding: "12px 16px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⏰</span>
              <p style={{ color: "#34d399", fontSize: 13, fontWeight: 600 }}>
                Valid for 1 month · Expires {fmtDate(expiryDate)}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button onClick={onClose} style={{
            width: "100%", padding: "12px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
            transition: "transform 0.15s",
          }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

/* ══════════════════════════════════════════════════════════════
   PURCHASE HISTORY SECTION
══════════════════════════════════════════════════════════════ */
function PurchaseHistory({ myRequests }) {
  const [viewInvoice, setViewInvoice] = useState(null);

  // Show all requests, sorted newest first (already sorted from Firestore)
  if (myRequests.length === 0) return null;

  function fmtDT(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }); }
    catch { return "—"; }
  }

  return (
    <>
      {/* Invoice Modal */}
      {viewInvoice && (
        <AddonInvoiceModal req={viewInvoice} onClose={() => setViewInvoice(null)} />
      )}

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {/* Section header */}
        <div className="px-5 py-4 flex items-center gap-3"
          style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.04))", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-xl">🧾</span>
          <div className="flex-1">
            <p className="text-white font-black text-sm">Add-on Purchase History</p>
            <p className="text-gray-500 text-[11px] mt-0.5">All your add-on requests — click View to see invoice</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black"
            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
            {myRequests.length}
          </span>
        </div>

        {/* Table header — desktop */}
        <div className="hidden md:grid px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ gridTemplateColumns: "0.9fr 1.4fr 1.2fr 1fr 1fr 1fr 0.8fr", color: "#4b5563", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.015)" }}>
          <span>Request #</span>
          <span>Add-ons</span>
          <span>Purchased On</span>
          <span>Amount</span>
          <span>Expires On</span>
          <span>Status</span>
          <span className="text-right">Invoice</span>
        </div>

        {/* Rows */}
        {myRequests.map((req, i) => {
          const ts         = req.createdAt?.toDate ? req.createdAt.toDate().toISOString() : req.createdAt;
          const approvedTs = req.processedAt?.toDate ? req.processedAt.toDate().toISOString() : req.processedAt;
          const expiryDate = (req.status === "approved" && approvedTs)
            ? (() => { const d = new Date(approvedTs); d.setMonth(d.getMonth() + 1); return d.toISOString(); })()
            : null;

          const stMeta = {
            approved: { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.3)",  label: "✅ Approved" },
            rejected: { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", label: "❌ Rejected" },
            pending:  { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  label: "⏳ Pending"  },
          }[req.status] || { color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)", label: "Pending" };

          // Summarize line items as short pill list
          const summary = (req.lineItems || []).map(it => `${it.icon || "⚡"} +${Number(it.qty).toLocaleString()} ${it.label?.replace(" / Month","").replace("Extra ","")}`);

          return (
            <div key={req.id}
              className="grid md:grid-cols-[0.9fr_1.4fr_1.2fr_1fr_1fr_1fr_0.8fr] grid-cols-1 items-start gap-2 md:gap-0 px-5 py-4 hover:bg-white/[0.018] transition-colors"
              style={{ borderBottom: i < myRequests.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>

              {/* Request number */}
              <div className="flex flex-col justify-center">
                <p className="text-indigo-400 font-black text-xs font-mono">
                  {req.requestNumber || `#${(req.id || "").slice(-6).toUpperCase()}`}
                </p>
                {req.source === "admin" && (
                  <span className="mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md inline-block"
                    style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" }}>
                    👑 Admin
                  </span>
                )}
              </div>

              {/* Add-ons summary */}
              <div className="flex flex-col gap-1 min-w-0">
                {summary.slice(0, 3).map((s, si) => (
                  <p key={si} className="text-gray-300 text-xs truncate">{s}</p>
                ))}
                {summary.length > 3 && (
                  <p className="text-gray-600 text-[10px]">+{summary.length - 3} more</p>
                )}
              </div>

              {/* Purchased on */}
              <div className="flex flex-col justify-center">
                <p className="text-gray-400 text-xs">{fmtDT(ts)}</p>
              </div>

              {/* Amount */}
              <div className="flex flex-col justify-center">
                <p className="text-amber-300 font-black text-sm">{fmtRs(req.grandTotal)}</p>
                <p className="text-gray-600 text-[10px] capitalize">{req.paymentMethod || "—"}</p>
              </div>

              {/* Expires */}
              <div className="flex flex-col justify-center">
                {req.status === "approved" && expiryDate ? (
                  <>
                    <p className="text-emerald-400 text-xs font-semibold">{fmtDate(expiryDate)}</p>
                    {(() => {
                      const dl = Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
                      return dl > 0
                        ? <p className="text-gray-600 text-[10px]">{dl}d left</p>
                        : <p className="text-red-400 text-[10px] font-bold">Expired</p>;
                    })()}
                  </>
                ) : (
                  <p className="text-gray-600 text-xs">—</p>
                )}
              </div>

              {/* Status */}
              <div className="flex items-start pt-0.5">
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap"
                  style={{ background: stMeta.bg, border: `1px solid ${stMeta.border}`, color: stMeta.color }}>
                  {stMeta.label}
                </span>
              </div>

              {/* View Invoice button */}
              <div className="flex items-start justify-end pt-0.5">
                <button onClick={() => setViewInvoice(req)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                  style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
                  View →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   PACKAGE CARD
══════════════════════════════════════════════════════════════ */
function PkgCard({ pkg, cat, addonPrices, selected, onSelect }) {
  const perUnit    = addonPrices?.[cat.perUnitKey] ?? cat.defaultPerUnit;
  const pkgs       = cat.packages.map(p => ({ qty: p.qty, price: addonPrices?.[p.key] ?? p.defaultPrice }));
  const price      = calcTieredPrice(pkg.qty, perUnit, pkgs);
  const perUnitStr = (price / pkg.qty).toFixed(1);
  const isSel      = selected === pkg.qty;
  const isPopular  = pkg.qty === 250 || pkg.qty === 100;
  return (
    <button type="button" onClick={() => onSelect(isSel ? 0 : pkg.qty)}
      className="relative flex flex-col items-center p-3 rounded-2xl text-center transition-all duration-250"
      style={{ background: isSel ? `${cat.color}18` : "rgba(255,255,255,0.03)", border: `1.5px solid ${isSel ? cat.color : "rgba(255,255,255,0.07)"}`, boxShadow: isSel ? `0 0 22px ${cat.glow}` : "none", transform: isSel ? "scale(1.04)" : "scale(1)" }}>
      {isPopular && !isSel && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8px] font-black whitespace-nowrap"
          style={{ background: cat.color, color: "#fff" }}>HOT</div>
      )}
      {isSel && <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: cat.color, color: "#fff" }}>✓</div>}
      <div className="font-black text-base leading-none mb-1" style={{ color: isSel ? cat.color : "#e5e7eb" }}>
        +{pkg.qty >= 1000 ? `${pkg.qty / 1000}K` : pkg.qty}
      </div>
      <div className="font-black text-sm" style={{ color: isSel ? "#fbbf24" : "#d1d5db" }}>{fmtRs(price)}</div>
      <div className="text-[9px] mt-0.5" style={{ color: "#6b7280" }}>~{fmtRs(perUnitStr)}/ea</div>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP INDICATOR
══════════════════════════════════════════════════════════════ */
const PAD = 12; // reused in line chart
function Steps({ current }) {
  const steps = ["Select Add-ons", "Payment", "Done!"];
  return (
    <div className="flex items-center mb-7">
      {steps.map((label, i) => {
        const n = i + 1, done = current > n, active = current === n;
        return (
          <div key={n} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black relative transition-all duration-500"
                style={{ background: done ? "#10b981" : active ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.06)", border: `2px solid ${done ? "#10b981" : active ? "#6366f1" : "rgba(255,255,255,0.1)"}`, color: done || active ? "#fff" : "#4b5563", boxShadow: active ? "0 0 18px rgba(99,102,241,0.6)" : "none" }}>
                {done ? "✓" : n}
                {active && <span className="absolute inset-0 rounded-full opacity-30 animate-ping" style={{ background: "#6366f1" }} />}
              </div>
              <span className="text-[10px] font-semibold mt-1.5 whitespace-nowrap hidden sm:block"
                style={{ color: active ? "#c7d2fe" : done ? "#10b981" : "#4b5563" }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 mt-[-12px] sm:mt-[-16px] rounded-full transition-all duration-700"
                style={{ background: current > n ? "linear-gradient(90deg,#10b981,#6366f1)" : "rgba(255,255,255,0.07)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function AddonsView({ uid, userDoc, user }) {
  const [addonPrices,    setAddonPrices]    = useState(null);
  const [selections,     setSelections]     = useState({});
  const [step,           setStep]           = useState(1);
  const [selectedPay,    setSelectedPay]    = useState("easypaisa");
  const [screenshot,          setScreenshot]          = useState(null);   // base64 — sirf preview ke liye
  const [screenshotUrl,       setScreenshotUrl]       = useState("");     // Cloudinary URL — Firestore mein yahi jayega
  const [screenshotName,      setScreenshotName]      = useState("");
  const [screenshotUploading, setScreenshotUploading] = useState(false);  // upload spinner
  const [submitting,          setSubmitting]          = useState(false);
  const [submitError,         setSubmitError]         = useState("");
  const [myRequests,     setMyRequests]     = useState([]);
  const [reqLoading,     setReqLoading]     = useState(true);
  const [showReqPanel,   setShowReqPanel]   = useState(false); // mobile requests drawer
  const [successPopup,   setSuccessPopup]   = useState(null);  // { lineItems, grandTotal }

  useEffect(() => { injectCSS("addons-v3", CSS); }, []);

  useEffect(() => {
    const DEFAULT = {};
    ADDON_CATEGORIES.forEach(cat => { DEFAULT[cat.perUnitKey] = cat.defaultPerUnit; cat.packages.forEach(pkg => { DEFAULT[pkg.key] = pkg.defaultPrice; }); });
    getDoc(doc(db, "adminConfig", "plans"))
      .then(snap => setAddonPrices(snap.exists() && snap.data().addonPrices ? snap.data().addonPrices : DEFAULT))
      .catch(() => setAddonPrices(DEFAULT));
  }, []);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "users", uid, "addonRequests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => { setMyRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setReqLoading(false); }, () => setReqLoading(false));
    return () => unsub();
  }, [uid]);

  const lineItems = ADDON_CATEGORIES.flatMap(cat => {
    const qty = Number(selections[cat.limitKey]) || 0;
    if (qty <= 0) return [];
    const pu = addonPrices?.[cat.perUnitKey] ?? cat.defaultPerUnit;
    const pkgs = cat.packages.map(p => ({ qty: p.qty, price: addonPrices?.[p.key] ?? p.defaultPrice }));
    const total = calcTieredPrice(qty, pu, pkgs);
    return total > 0 ? [{ limitKey: cat.limitKey, icon: cat.icon, label: cat.label, qty, total, color: cat.color }] : [];
  });
  // Extra user seats (flat rate)
  const extraUsersQty   = Number(selections["extraUsers"]) || 0;
  const extraUserPrice  = addonPrices?.["extraUser_monthly"] ?? 1000;
  if (extraUsersQty > 0) {
    lineItems.push({ limitKey: "extraUsers", icon: "👤", label: "Extra User Seats / Month", qty: extraUsersQty, total: extraUsersQty * extraUserPrice, color: "#6366f1" });
  }
  const grandTotal    = lineItems.reduce((s, i) => s + i.total, 0);
  const hasSelections = lineItems.length > 0;

  const selectedAccount = PAYMENT_ACCOUNTS.find(a => a.id === selectedPay) || PAYMENT_ACCOUNTS[0];

  async function handleScreenshot(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setSubmitError("Screenshot must be under 5MB."); return; }
    setSubmitError("");
    setScreenshotName(file.name);
    setScreenshotUrl("");

    // Pehle local preview set karo
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setScreenshot(dataUrl);

      // Phir Cloudinary par upload karo
      setScreenshotUploading(true);
      try {
        const token = await user.getIdToken();
        const res   = await fetch("/api/upload-screenshot", {
          method:  "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body:    JSON.stringify({ dataUrl, uid }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setScreenshotUrl(data.url);
      } catch (err) {
        setSubmitError("Image upload failed: " + (err.message || "please try again"));
        setScreenshot(null);
        setScreenshotName("");
      } finally {
        setScreenshotUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!screenshotUrl) { setSubmitError("Please upload your payment screenshot first."); return; }
    if (screenshotUploading) { setSubmitError("Image is still uploading, please wait."); return; }
    if (!hasSelections) { setSubmitError("No add-ons selected."); return; }
    setSubmitError("");
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/addon-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          uid,
          lineItems,
          grandTotal,
          paymentMethod:     selectedPay,
          paymentScreenshot: screenshotUrl,   // Cloudinary URL — base64 nahi
          userName:          userDoc?.name || user?.email,
          userEmail:         user?.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      // Show success popup, reset back to step 1 so history is visible
      setSuccessPopup({ lineItems, grandTotal });
      resetFlow();
    } catch (err) {
      setSubmitError(err.message || "Could not submit. Please try again.");
    }
    setSubmitting(false);
  }

  function resetFlow() {
    setSelections({}); setStep(1); setSelectedPay("easypaisa");
    setScreenshot(null); setScreenshotUrl(""); setScreenshotName(""); setSubmitError("");
  }

  const pendingCount = myRequests.filter(r => r.status === "pending").length;

  // ── Success Popup Portal ─────────────────────────────────────────────────
  const SuccessPopup = successPopup ? createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      background: "rgba(0,0,0,0.85)",
      backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      animation: "overlay-in 0.2s ease both",
    }}>
      <div style={{
        width: "100%", maxWidth: 460, borderRadius: 24, overflow: "hidden",
        background: "#0d1117",
        border: "1.5px solid rgba(16,185,129,0.4)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(16,185,129,0.08)",
        animation: "modal-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
      }}>
        {/* Top bar */}
        <div style={{ height: 5, background: "linear-gradient(to right,#10b981,#34d399,#6366f1)" }} />

        {/* Body */}
        <div style={{ padding: "32px 28px 24px", textAlign: "center" }}>
          {/* Icon */}
          <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
              background: "linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.1))",
              border: "2px solid rgba(16,185,129,0.4)",
              boxShadow: "0 0 50px rgba(16,185,129,0.35)",
              margin: "0 auto",
            }}>✅</div>
            <div style={{
              position: "absolute", inset: -4, borderRadius: "50%",
              border: "2px solid rgba(16,185,129,0.25)",
              animation: "pulse-ring 2s ease-in-out infinite",
            }} />
          </div>

          <h2 style={{ color: "#fff", fontWeight: 900, fontSize: 22, margin: "0 0 10px" }}>
            Request Sent!
          </h2>
          <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.7, margin: "0 0 24px", maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
            Your request has been submitted and a confirmation email has been sent to you.
            Once approved, the credits you requested will be added to your account automatically.
          </p>

          {/* Line items summary */}
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(16,185,129,0.2)", marginBottom: 24 }}>
            {successPopup.lineItems.map((item, i, arr) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 18px",
                borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                background: i % 2 === 0 ? "rgba(16,185,129,0.04)" : "transparent",
              }}>
                <span style={{ color: "#d1d5db", fontSize: 13 }}>
                  {item.icon} {item.label}
                  <span style={{ color: "#34d399", fontWeight: 700, marginLeft: 6 }}>+{Number(item.qty).toLocaleString()}</span>
                </span>
                <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: 13 }}>{fmtRs(item.total)}</span>
              </div>
            ))}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "13px 18px",
              background: "rgba(16,185,129,0.08)",
              borderTop: "1.5px solid rgba(16,185,129,0.2)",
            }}>
              <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Paid</span>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>{fmtRs(successPopup.grandTotal)}</span>
            </div>
          </div>

          {/* Info note */}
          <div style={{
            borderRadius: 12, padding: "12px 16px", marginBottom: 24,
            background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)",
            display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left",
          }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📧</span>
            <p style={{ color: "#a5b4fc", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
              Check your email for a confirmation. Our team will review your payment and activate your add-ons as soon as possible.
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={() => setSuccessPopup(null)}
            style={{
              width: "100%", padding: "13px", borderRadius: 14, border: "none",
              background: "linear-gradient(135deg,#10b981,#059669)",
              color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer",
              boxShadow: "0 4px 20px rgba(16,185,129,0.4)",
            }}>
            Got it — view my history ↓
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  if (!addonPrices) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-t-indigo-500 border-r-purple-500 border-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative" style={{ fontFamily: "var(--font-poppins,sans-serif)", minHeight: "100vh" }}>
      {/* Success popup portal */}
      {SuccessPopup}

      {/* ── Animated bg ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#060811 0%,#0a0d1a 45%,#080b16 75%,#050810 100%)" }} />
        <div className="absolute rounded-full" style={{ width:600,height:600,top:"-10%",left:"0%",background:"radial-gradient(circle,rgba(99,102,241,0.13) 0%,transparent 70%)",animation:"orb1 18s ease-in-out infinite",filter:"blur(45px)" }} />
        <div className="absolute rounded-full" style={{ width:500,height:500,top:"30%",right:"-5%",background:"radial-gradient(circle,rgba(139,92,246,0.1) 0%,transparent 70%)",animation:"orb2 22s ease-in-out infinite",filter:"blur(55px)" }} />
        <div className="absolute rounded-full" style={{ width:350,height:350,bottom:"5%",left:"25%",background:"radial-gradient(circle,rgba(59,130,246,0.08) 0%,transparent 70%)",animation:"orb3 16s ease-in-out infinite",filter:"blur(60px)" }} />
        <div className="absolute inset-0 opacity-[0.022]" style={{ backgroundImage:"linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)", backgroundSize:"60px 60px" }} />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 px-4 pt-1 pb-16">

        {/* ── Header row ── */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap" style={{ animation: "fsu 0.5s ease both" }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.15))", border: "1px solid rgba(99,102,241,0.4)", boxShadow: "0 0 24px rgba(99,102,241,0.25)" }}>
              ⚡
            </div>
            <div>
              <h1 className="text-white font-black text-2xl leading-none">Add-ons</h1>
              <p className="text-gray-500 text-sm mt-0.5">Supercharge your plan with extra quota</p>
            </div>
          </div>
          {/* Mobile: show requests button */}
          <button onClick={() => setShowReqPanel(v => !v)}
            className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
            📊 My Status
            {pendingCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black" style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>{pendingCount}</span>}
          </button>
        </div>

        {/* ── Two-column grid ── */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ════ LEFT: Shop flow ════ */}
          <div className="flex-1 min-w-0" style={{ animation: "fsu 0.45s ease both" }}>

            {step < 3 && <Steps current={step} />}

            {/* ─── STEP 1 ─── */}
            {step === 1 && (
              <div className="flex flex-col gap-4">
                {ADDON_CATEGORIES.map((cat, catIdx) => {
                  const sel      = Number(selections[cat.limitKey]) || 0;
                  const pu       = addonPrices?.[cat.perUnitKey] ?? cat.defaultPerUnit;
                  const pkgs     = cat.packages.map(p => ({ qty: p.qty, price: addonPrices?.[p.key] ?? p.defaultPrice }));
                  const selPrice = sel > 0 ? calcTieredPrice(sel, pu, pkgs) : 0;
                  const isCustom = sel > 0 && !cat.packages.some(p => p.qty === sel);
                  return (
                    <div key={cat.limitKey}
                      className="rounded-2xl overflow-hidden transition-all duration-300"
                      style={{ background: sel > 0 ? `${cat.color}0b` : "rgba(255,255,255,0.025)", border: `1px solid ${sel > 0 ? `${cat.color}40` : "rgba(255,255,255,0.07)"}`, boxShadow: sel > 0 ? `0 0 36px ${cat.glow}` : "none", animation: `fsu 0.4s ease ${catIdx * 0.06}s both` }}>
                      <div className="flex items-center gap-3 px-4 py-3.5 border-b"
                        style={{ borderColor: sel > 0 ? `${cat.color}20` : "rgba(255,255,255,0.05)" }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: `${cat.color}15`, border: `1px solid ${cat.color}30` }}>{cat.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm">{cat.label}</p>
                          <p className="text-gray-500 text-xs truncate">{cat.sublabel}</p>
                        </div>
                        {sel > 0 && (
                          <div className="text-right flex-shrink-0 px-3 py-1.5 rounded-xl"
                            style={{ background: `${cat.color}15`, border: `1px solid ${cat.color}25` }}>
                            <p className="font-black text-sm" style={{ color: cat.color }}>+{sel.toLocaleString()}</p>
                            <p className="text-amber-400 text-xs font-bold">{fmtRs(selPrice)}</p>
                          </div>
                        )}
                      </div>
                      <div className="p-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {cat.packages.map(pkg => (
                          <PkgCard key={pkg.key} pkg={pkg} cat={cat} addonPrices={addonPrices}
                            selected={sel} onSelect={qty => setSelections(p => ({ ...p, [cat.limitKey]: qty }))} />
                        ))}
                      </div>
                      <div className="px-3 pb-3">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <span className="text-gray-600 text-xs flex-shrink-0">Custom qty:</span>
                          <input type="number" min="1" placeholder="Enter any amount..."
                            value={isCustom ? sel : ""}
                            onChange={e => setSelections(p => ({ ...p, [cat.limitKey]: parseInt(e.target.value) || 0 }))}
                            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-700" />
                          {isCustom && <span className="text-amber-400 text-xs font-bold flex-shrink-0">{fmtRs(selPrice)}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* ── Extra User Seats card (flat rate, no tiers) ── */}
                {(() => {
                  const userPrice = addonPrices?.["extraUser_monthly"] ?? 1000;
                  const userQty   = Number(selections["extraUsers"]) || 0;
                  const userTotal = userQty * userPrice;
                  const isSel     = userQty > 0;
                  return (
                    <div className="rounded-2xl overflow-hidden transition-all duration-300"
                      style={{ background: isSel ? "rgba(99,102,241,0.09)" : "rgba(255,255,255,0.025)", border: `1px solid ${isSel ? "rgba(99,102,241,0.45)" : "rgba(255,255,255,0.07)"}`, boxShadow: isSel ? "0 0 36px rgba(99,102,241,0.2)" : "none", animation: "fsu 0.4s ease 0.3s both" }}>
                      <div className="flex items-center gap-3 px-4 py-3.5 border-b"
                        style={{ borderColor: isSel ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)" }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>👤</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white font-bold text-sm">Extra User Seats / Month</p>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black"
                              style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.35)" }}>
                              Rs. {userPrice.toLocaleString("en-PK")}/user
                            </span>
                          </div>
                          <p className="text-gray-500 text-xs mt-0.5">Add more login seats to your account — flat rate per user per month</p>
                        </div>
                        {isSel && (
                          <div className="text-right flex-shrink-0 px-3 py-1.5 rounded-xl"
                            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
                            <p className="font-black text-sm" style={{ color: "#a5b4fc" }}>{userQty} user{userQty > 1 ? "s" : ""}</p>
                            <p className="text-amber-400 text-xs font-bold">{fmtRs(userTotal)}</p>
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex flex-col gap-4">
                        {/* Quick pick buttons */}
                        <div className="grid grid-cols-5 gap-2">
                          {[1, 2, 3, 5, 10].map(n => {
                            const isBtnSel = userQty === n;
                            return (
                              <button key={n} type="button"
                                onClick={() => setSelections(p => ({ ...p, extraUsers: isBtnSel ? 0 : n }))}
                                className="relative flex flex-col items-center p-3 rounded-2xl text-center transition-all duration-250"
                                style={{ background: isBtnSel ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.03)", border: `1.5px solid ${isBtnSel ? "#6366f1" : "rgba(255,255,255,0.07)"}`, boxShadow: isBtnSel ? "0 0 20px rgba(99,102,241,0.3)" : "none", transform: isBtnSel ? "scale(1.04)" : "scale(1)" }}>
                                {isBtnSel && <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: "#6366f1", color: "#fff" }}>✓</div>}
                                <div className="font-black text-base leading-none mb-1" style={{ color: isBtnSel ? "#a5b4fc" : "#e5e7eb" }}>
                                  +{n}
                                </div>
                                <div className="font-black text-sm" style={{ color: isBtnSel ? "#fbbf24" : "#d1d5db" }}>
                                  {fmtRs(n * userPrice)}
                                </div>
                                <div className="text-[9px] mt-0.5" style={{ color: "#6b7280" }}>
                                  /month
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {/* Custom input */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <span className="text-gray-600 text-xs flex-shrink-0">Custom:</span>
                          <input type="number" min="1" max="100" placeholder="Enter number of users..."
                            value={![0,1,2,3,5,10].includes(userQty) && userQty > 0 ? userQty : ""}
                            onChange={e => setSelections(p => ({ ...p, extraUsers: parseInt(e.target.value) || 0 }))}
                            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-700" />
                          {![0,1,2,3,5,10].includes(userQty) && userQty > 0 && (
                            <span className="text-amber-400 text-xs font-bold flex-shrink-0">{fmtRs(userTotal)}</span>
                          )}
                        </div>
                        {/* Info note */}
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                          style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                          <span className="text-indigo-400 flex-shrink-0 text-sm">ℹ️</span>
                          <p className="text-indigo-300 text-xs leading-relaxed">
                            Each extra user seat allows one additional person to log in to your Novexa account.
                            Valid for 1 month from activation. Price: <strong className="text-white">Rs. {userPrice.toLocaleString("en-PK")}</strong> per user per month.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Floating checkout bar */}
                <div className="sticky bottom-4 mt-1">                  <div className="rounded-2xl px-5 py-4 flex items-center gap-4"
                    style={{ background: "rgba(8,10,20,0.96)", border: hasSelections ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", boxShadow: hasSelections ? "0 -2px 40px rgba(99,102,241,0.18), 0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.4)" }}>
                    <div className="flex-1 min-w-0">
                      {!hasSelections ? (
                        <p className="text-gray-600 text-sm">Select packages above to get started</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-1.5 mb-1">
                            {lineItems.map(i => (
                              <span key={i.limitKey} className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: `${i.color}18`, color: i.color }}>{i.icon} ×{i.qty.toLocaleString()}</span>
                            ))}
                          </div>
                          <p className="text-white font-black text-xl">{fmtRs(grandTotal)}</p>
                        </>
                      )}
                    </div>
                    {hasSelections && (
                      <button onClick={() => setSelections({})}
                        className="px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-red-500/10"
                        style={{ color: "#6b7280", border: "1px solid rgba(255,255,255,0.07)" }}>Clear</button>
                    )}
                    <button disabled={!hasSelections} onClick={() => setStep(2)}
                      className="px-6 py-3 rounded-xl font-black text-sm transition-all flex-shrink-0"
                      style={{ background: hasSelections ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.05)", color: hasSelections ? "#fff" : "#4b5563", boxShadow: hasSelections ? "0 4px 20px rgba(99,102,241,0.5)" : "none", cursor: hasSelections ? "pointer" : "not-allowed" }}>
                      Proceed to Payment →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── STEP 2 ─── */}
            {step === 2 && (
              <div className="flex flex-col gap-5" style={{ animation: "fsu 0.4s ease both" }}>
                {/* Order summary */}
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)" }}>
                  <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "rgba(99,102,241,0.15)" }}>
                    <p className="text-indigo-300 font-bold text-sm">🧾 Order Summary</p>
                    <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">← Edit</button>
                  </div>
                  {lineItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3"
                      style={{ borderBottom: i < lineItems.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: `${item.color}15`, border: `1px solid ${item.color}25` }}>{item.icon}</div>
                        <div>
                          <p className="text-white text-sm font-semibold">{item.label}</p>
                          <p className="text-gray-500 text-xs">+{item.qty.toLocaleString()} units · 1 month</p>
                        </div>
                      </div>
                      <span className="font-black text-sm" style={{ color: item.color }}>{fmtRs(item.total)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: "rgba(99,102,241,0.15)", background: "rgba(99,102,241,0.07)" }}>
                    <p className="text-white font-black">Total</p>
                    <p className="text-white font-black text-2xl">{fmtRs(grandTotal)}</p>
                  </div>
                </div>

                {/* Payment methods */}
                <div>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-3">Choose Payment Method</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PAYMENT_ACCOUNTS.map(acc => {
                      const isSel = selectedPay === acc.id;
                      return (
                        <button key={acc.id} type="button" onClick={() => setSelectedPay(acc.id)}
                          className="relative flex flex-col p-4 rounded-2xl text-left transition-all duration-300"
                          style={{ background: isSel ? `${acc.color}12` : "rgba(255,255,255,0.025)", border: `1.5px solid ${isSel ? acc.color : "rgba(255,255,255,0.07)"}`, boxShadow: isSel ? `0 0 26px ${acc.glow}` : "none", transform: isSel ? "scale(1.02)" : "scale(1)" }}>
                          {isSel && <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: acc.gradient, color: "#fff" }}>✓</div>}
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl mb-2.5" style={{ background: `${acc.color}15`, border: `1px solid ${acc.color}28` }}>{acc.emoji}</div>
                          <p className="font-bold text-sm mb-1" style={{ color: isSel ? acc.color : "#d1d5db" }}>{acc.name}</p>
                          <p className="font-mono font-black text-sm" style={{ color: acc.color }}>{acc.accountNo}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{acc.accountName}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Account detail box */}
                <div className="rounded-2xl p-5" style={{ background: `${selectedAccount.color}08`, border: `1px solid ${selectedAccount.color}22` }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: selectedAccount.color }}>
                    {selectedAccount.emoji} {selectedAccount.name} — Payment Details
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Account Number", value: selectedAccount.accountNo, mono: true },
                      { label: "Account Name",   value: selectedAccount.accountName },
                      { label: "Amount to Pay",  value: fmtRs(grandTotal), highlight: "#fbbf24" },
                      { label: "Instructions",   value: selectedAccount.tip },
                    ].map(row => (
                      <div key={row.label}>
                        <p className="text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: selectedAccount.color }}>{row.label}</p>
                        <p className={`text-sm break-all ${row.mono ? "font-mono font-black" : "font-semibold"}`} style={{ color: row.highlight || "#fff" }}>{row.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Screenshot */}
                <div>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-3">📸 Upload Payment Screenshot</p>
                  <label className="flex flex-col items-center justify-center gap-4 p-7 rounded-2xl cursor-pointer transition-all duration-300 group"
                    style={{
                      background: screenshotUrl ? "rgba(16,185,129,0.07)" : screenshotUploading ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.02)",
                      border: `2px dashed ${screenshotUrl ? "rgba(16,185,129,0.4)" : screenshotUploading ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.1)"}`,
                      boxShadow: screenshotUrl ? "0 0 32px rgba(16,185,129,0.1)" : "none",
                      cursor: screenshotUploading ? "not-allowed" : "pointer",
                    }}>
                    <input type="file" accept="image/*" className="hidden" onChange={handleScreenshot} disabled={screenshotUploading} />

                    {screenshotUploading ? (
                      /* Uploading state */
                      <>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)" }}>
                          <div className="w-7 h-7 rounded-full border-[3px] border-t-indigo-400 border-transparent animate-spin" />
                        </div>
                        <p className="text-indigo-300 font-bold text-sm">Uploading your image...</p>
                        <p className="text-gray-600 text-xs">{screenshotName}</p>
                      </>
                    ) : screenshotUrl ? (
                      /* Upload done */
                      <>
                        <img src={screenshot} alt="payment screenshot" className="max-h-44 rounded-xl object-contain shadow-xl" />
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 text-lg">✓</span>
                          <p className="text-emerald-400 font-black text-sm">{screenshotName}</p>
                        </div>
                        <p className="text-gray-600 text-xs">Uploaded — click to replace</p>
                      </>
                    ) : (
                      /* Empty state */
                      <>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-transform group-hover:scale-110" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>📱</div>
                        <p className="text-gray-300 font-bold text-sm">Click to upload payment screenshot</p>
                        <p className="text-gray-600 text-xs text-center">Take a screenshot after payment and upload it here (max 5MB)</p>
                      </>
                    )}
                  </label>
                </div>

                {submitError && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                    <span>⚠️</span><p className="text-sm font-medium">{submitError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="px-5 py-3.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>← Back</button>
                  <button onClick={handleSubmit} disabled={submitting || screenshotUploading || !screenshotUrl}
                    className="flex-1 py-3.5 rounded-xl text-sm font-black transition-all"
                    style={{
                      background: screenshotUrl && !submitting && !screenshotUploading
                        ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                        : "rgba(255,255,255,0.05)",
                      color: screenshotUrl && !submitting && !screenshotUploading ? "#fff" : "#4b5563",
                      boxShadow: screenshotUrl && !submitting && !screenshotUploading ? "0 4px 24px rgba(99,102,241,0.5)" : "none",
                      cursor: screenshotUrl && !submitting && !screenshotUploading ? "pointer" : "not-allowed",
                    }}>
                    {submitting
                      ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-t-white border-transparent animate-spin"/>Submitting...</span>
                      : screenshotUploading
                      ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-t-indigo-400 border-transparent animate-spin"/>Uploading image...</span>
                      : "🚀 Submit Request"}
                  </button>
                </div>
              </div>
            )}

            {/* ─── STEP 3 removed — replaced by successPopup portal ─── */}
          </div>

          {/* ════ RIGHT: Status + Charts ════ */}
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0" style={{ animation: "fsu 0.55s ease both" }}>
            {/* Mobile: collapsible */}
            <div className={`${showReqPanel ? "block" : "hidden"} lg:block`}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">My Add-on Status</p>
                <button onClick={() => setShowReqPanel(false)} className="lg:hidden text-gray-600 hover:text-gray-400 text-xs">✕</button>
              </div>
              {reqLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 rounded-full border-2 border-t-indigo-500 border-transparent animate-spin" />
                </div>
              ) : (
                <RightPanel userDoc={userDoc} myRequests={myRequests} addonPrices={addonPrices} />
              )}

              {/* Recent requests list — replaced by full history below */}
            </div>
          </div>
        </div>

        {/* ════ PURCHASE HISTORY — full width below main layout ════ */}
        {!reqLoading && myRequests.length > 0 && (
          <div className="px-6 pb-10" style={{ animation: "fsu 0.65s ease both" }}>
            <PurchaseHistory myRequests={myRequests} />
          </div>
        )}
      </div>
    </div>
  );
}
