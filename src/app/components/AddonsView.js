"use client";

import { useState, useEffect, useRef } from "react";
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
  const maxQty = Math.max(...activeRows.map(r => Number(extras?.[r.limitKey]) || 0), 1);

  /* ── Pie chart — spend by category ── */
  const approvedReqs = myRequests.filter(r => r.status === "approved");
  const spendByCat = {};
  approvedReqs.forEach(req => {
    (req.lineItems || []).forEach(item => {
      const cat = ADDON_CATEGORIES.find(c => c.limitKey === item.limitKey);
      if (cat) spendByCat[cat.limitKey] = (spendByCat[cat.limitKey] || 0) + (item.total || 0);
    });
  });
  const pieData = ADDON_CATEGORIES.filter(c => spendByCat[c.limitKey] > 0)
    .map(c => ({ label: c.label, icon: c.icon, color: c.color, value: spendByCat[c.limitKey] }));
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
            {ADDON_CATEGORIES.map((cat, i) => (
              <div key={cat.limitKey} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full rounded-t-lg" style={{ height: `${20 + i * 8}px`, background: `${cat.color}15`, border: `1px solid ${cat.color}20` }} />
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
  const [screenshot,     setScreenshot]     = useState(null);
  const [screenshotName, setScreenshotName] = useState("");
  const [submitting,     setSubmitting]     = useState(false);
  const [submitError,    setSubmitError]    = useState("");
  const [myRequests,     setMyRequests]     = useState([]);
  const [reqLoading,     setReqLoading]     = useState(true);
  const [showReqPanel,   setShowReqPanel]   = useState(false); // mobile requests drawer

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

  function handleScreenshot(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setSubmitError("Screenshot must be under 3MB."); return; }
    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setScreenshot(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!screenshot) { setSubmitError("Please upload your payment screenshot first."); return; }
    if (!hasSelections) { setSubmitError("No add-ons selected."); return; }
    setSubmitError("");
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/addon-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid, lineItems, grandTotal, paymentMethod: selectedPay, paymentScreenshot: screenshot, userName: userDoc?.name || user?.email, userEmail: user?.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setStep(3);
    } catch (err) {
      setSubmitError(err.message || "Could not submit. Please try again.");
    }
    setSubmitting(false);
  }

  function resetFlow() {
    setSelections({}); setStep(1); setSelectedPay("easypaisa");
    setScreenshot(null); setScreenshotName(""); setSubmitError("");
  }

  const pendingCount = myRequests.filter(r => r.status === "pending").length;

  if (!addonPrices) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-t-indigo-500 border-r-purple-500 border-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative" style={{ fontFamily: "var(--font-poppins,sans-serif)", minHeight: "100vh" }}>

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
                    style={{ background: screenshot ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.02)", border: `2px dashed ${screenshot ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)"}`, boxShadow: screenshot ? "0 0 32px rgba(16,185,129,0.1)" : "none" }}>
                    <input type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
                    {screenshot ? (
                      <>
                        <img src={screenshot} alt="ss" className="max-h-44 rounded-xl object-contain shadow-xl" />
                        <p className="text-emerald-400 font-black text-sm">✓ {screenshotName}</p>
                        <p className="text-gray-600 text-xs">Click to replace</p>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-transform group-hover:scale-110" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>📱</div>
                        <p className="text-gray-300 font-bold text-sm">Click to upload screenshot</p>
                        <p className="text-gray-600 text-xs text-center">Take a screenshot after payment and upload it here (max 3MB)</p>
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
                  <button onClick={handleSubmit} disabled={submitting || !screenshot}
                    className="flex-1 py-3.5 rounded-xl text-sm font-black transition-all"
                    style={{ background: screenshot && !submitting ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.05)", color: screenshot && !submitting ? "#fff" : "#4b5563", boxShadow: screenshot && !submitting ? "0 4px 24px rgba(99,102,241,0.5)" : "none", cursor: screenshot && !submitting ? "pointer" : "not-allowed" }}>
                    {submitting ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-t-white border-transparent animate-spin"/>Submitting...</span> : "🚀 Submit Request"}
                  </button>
                </div>
              </div>
            )}

            {/* ─── STEP 3 ─── */}
            {step === 3 && (
              <div className="flex flex-col items-center text-center gap-6 py-10" style={{ animation: "fsu 0.5s ease both" }}>
                <div className="relative">
                  <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl"
                    style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.1))", border: "2px solid rgba(16,185,129,0.4)", boxShadow: "0 0 60px rgba(16,185,129,0.3)" }}>
                    ✅
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30" style={{ animation: "pulse-ring 2s ease-in-out infinite" }} />
                  </div>
                </div>
                <div>
                  <h2 className="text-white font-black text-2xl mb-2">Request Submitted!</h2>
                  <p className="text-gray-400 text-sm leading-relaxed max-w-sm">Your add-on request and payment screenshot have been submitted. Our team will review and activate your add-ons as soon as possible. Check your email for confirmation.</p>
                </div>
                <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  {lineItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: i < lineItems.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <span className="text-gray-300 text-sm">{item.icon} {item.label} <span className="text-emerald-400 font-bold">(+{item.qty.toLocaleString()})</span></span>
                      <span className="text-amber-400 font-bold text-sm">{fmtRs(item.total)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: "rgba(16,185,129,0.15)", background: "rgba(16,185,129,0.06)" }}>
                    <span className="text-white font-black">Total Paid</span>
                    <span className="text-white font-black text-lg">{fmtRs(grandTotal)}</span>
                  </div>
                </div>
                <button onClick={resetFlow}
                  className="px-8 py-3 rounded-xl font-black text-sm transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}>
                  ⚡ Add More Add-ons
                </button>
              </div>
            )}
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

              {/* Recent requests list */}
              {myRequests.length > 0 && (
                <div className="mt-4 rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Recent Requests</p>
                  </div>
                  <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    {myRequests.slice(0, 4).map((req, i) => {
                      const stCol = { pending: "#fbbf24", approved: "#34d399", rejected: "#f87171" }[req.status] || "#fbbf24";
                      const stLbl = { pending: "Pending", approved: "Approved", rejected: "Rejected" }[req.status] || "Pending";
                      const ts = req.createdAt?.toDate ? req.createdAt.toDate().toISOString() : req.createdAt;
                      return (
                        <div key={req.id} className="flex items-center justify-between px-4 py-3 gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-bold">{fmtRs(req.grandTotal)}</p>
                            <p className="text-gray-600 text-[10px]">{fmtDate(ts)}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: stCol }} />
                            <span className="text-[10px] font-semibold" style={{ color: stCol }}>{stLbl}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
