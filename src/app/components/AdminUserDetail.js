"use client";
import { useState, useEffect, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════════════════ */
function fmtDate(val) {
  if (!val) return "—";
  try { const d = new Date(val); return isNaN(d) ? "—" : d.toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" }); }
  catch { return "—"; }
}
function fmtDT(val) {
  if (!val) return "—";
  try { const d = new Date(val); return isNaN(d) ? "—" : d.toLocaleString("en-PK"); }
  catch { return "—"; }
}
function Rs(n) {
  if (!n && n !== 0) return "—";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}
function daysLeft(activeTo) {
  if (!activeTo) return null;
  return Math.ceil((new Date(activeTo + "T23:59:59") - new Date()) / 86400000);
}
function initials(name) {
  return (name||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
}
const COLORS = [
  "linear-gradient(135deg,#2563EB,#60A5FA)",
  "linear-gradient(135deg,#F59E0B,#FCD34D)",
  "linear-gradient(135deg,#8B5CF6,#C4B5FD)",
  "linear-gradient(135deg,#10B981,#34D399)",
  "linear-gradient(135deg,#EF4444,#FCA5A5)",
  "linear-gradient(135deg,#F97316,#FDBA74)",
];
function avatarGrad(id) {
  const n = (id||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  return COLORS[n % COLORS.length];
}

const STATUS_STYLE = {
  active:      { color:"#34d399", bg:"rgba(52,211,153,0.12)",  border:"rgba(52,211,153,0.3)"  },
  frozen:      { color:"#60a5fa", bg:"rgba(96,165,250,0.12)",  border:"rgba(96,165,250,0.3)"  },
  deleted:     { color:"#f87171", bg:"rgba(248,113,113,0.12)", border:"rgba(248,113,113,0.3)" },
  not_started: { color:"#fbbf24", bg:"rgba(251,191,36,0.12)",  border:"rgba(251,191,36,0.3)"  },
  Paid:        { color:"#34d399", bg:"rgba(52,211,153,0.1)",   border:"rgba(52,211,153,0.25)" },
  Partial:     { color:"#fbbf24", bg:"rgba(251,191,36,0.1)",   border:"rgba(251,191,36,0.25)" },
  Unpaid:      { color:"#f87171", bg:"rgba(248,113,113,0.1)",  border:"rgba(248,113,113,0.25)"},
};

/* ── small UI pieces ─────────────────────────────────────────────────── */
function InfoCell({ label, value, highlight }) {
  return (
    <div className="rounded-xl px-4 py-3"
      style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-1">{label}</p>
      <p className="text-sm font-semibold truncate" style={{ color: highlight||"#fff" }}>{value||"—"}</p>
    </div>
  );
}
function SectionHead({ icon, label, count }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span>{icon}</span>
      <span className="text-white font-bold text-sm">{label}</span>
      {count !== undefined && (
        <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background:"rgba(255,255,255,0.07)", color:"#9ca3af" }}>{count}</span>
      )}
    </div>
  );
}
function Empty({ icon="📭", label="Nothing here yet" }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2">
      <span className="text-4xl">{icon}</span>
      <p className="text-gray-500 text-sm">{label}</p>
    </div>
  );
}
function StatusBadge({ status }) {
  const s = STATUS_STYLE[status];
  if (!s) return <span className="text-gray-500 text-xs">{status||"—"}</span>;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
      style={{ color:s.color, background:s.bg, border:`1px solid ${s.border}` }}>
      {status}
    </span>
  );
}
/* Back arrow within detail panels */
function BackBtn({ onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold mb-5 transition-all hover:bg-white/10"
      style={{ border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
      ← Back
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PROFILE TAB
══════════════════════════════════════════════════════════════════════ */
function ProfileTab({ data }) {
  const { user, authRecord } = data;
  const ss = STATUS_STYLE[user.status] || STATUS_STYLE.active;
  const dl = daysLeft(user.activeTo);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionHead icon="🪪" label="Identity" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <InfoCell label="Full Name"       value={user.name} />
          <InfoCell label="Email"           value={user.email} />
          <InfoCell label="Phone"           value={user.phone} />
          <InfoCell label="Address"         value={user.address} />
          <InfoCell label="Registered"      value={fmtDT(user.createdAt)} />
          <InfoCell label="Email Verified"  value={authRecord?.emailVerified ? "✅ Yes" : "❌ No"} />
        </div>
      </div>
      <div>
        <SectionHead icon="📅" label="Subscription" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InfoCell label="Status"       value={ss.label||user.status} highlight={ss.color} />
          <InfoCell label="Active From"  value={fmtDate(user.activeFrom)} />
          <InfoCell label="Active Until" value={fmtDate(user.activeTo)} />
          <InfoCell label="Days Left"
            value={dl===null?"—":dl<0?`Expired ${Math.abs(dl)}d ago`:dl===0?"Today!":dl+" days"}
            highlight={dl!==null&&dl<=7?"#fbbf24":dl!==null&&dl<0?"#f87171":undefined} />
          <InfoCell label="Device Limit" value={`${user.maxDevices||1} device${(user.maxDevices||1)>1?"s":""}`} />
          <InfoCell label="Freeze Time"  value={user.activeToTime||"11:59 PM (default)"} />
          <InfoCell label="Last Login"   value={fmtDT(user.lastLogin||authRecord?.lastSignInTime)} />
          <InfoCell label="Last Active"  value={fmtDT(user.lastActiveAt)} />
        </div>
      </div>
      <div>
        <SectionHead icon="🖥️" label="Last Session" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <InfoCell label="Login IP" value={user.lastLoginIP} />
          <InfoCell label="Browser"  value={user.lastBrowser} />
          <InfoCell label="Device"   value={user.lastDevice} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CUSTOMER DETAIL (nested inside Customers tab)
══════════════════════════════════════════════════════════════════════ */
function CustomerDetail({ customer, invoices, payments, onBack }) {
  // invoices for this customer
  const custInvoices = invoices.filter(i => i.customerId === customer.id && !i.deleted);
  // payments for this customer
  const custPayments = payments.filter(p => p.customerId === customer.id && !p.deleted);
  // "returns" from payments where type==="return"
  const custReturns  = custPayments.filter(p => p.type === "return");
  // Find invoices whose balance was carried forward into a newer invoice
  // (to avoid double-counting — the carried-forward balance already lives in the newer invoice)
  const carriedForwardIds = new Set();
  custInvoices.forEach(inv => {
    (inv.items || []).forEach(it => {
      const desc = it.description || "";
      if (desc.startsWith("Previous Balance · INV-")) {
        const suffix = desc.replace("Previous Balance · INV-", "").trim().slice(0, 4).toUpperCase();
        const matched = custInvoices.find(i => (i.id || "").slice(-4).toUpperCase() === suffix);
        if (matched) carriedForwardIds.add(matched.id);
      }
    });
  });

  // totalBilled: only actual sale amounts, skip carry-forward invoices
  const totalBilled  = custInvoices.reduce((s, i) => {
    if (carriedForwardIds.has(i.id)) return s;
    const amt = i.actualAmount != null ? Number(i.actualAmount) : (Number(i.amount) || 0);
    return s + amt;
  }, 0);
  // totalPaid: sum of amountPaid (all invoices — payments are real)
  const totalPaid    = custInvoices.reduce((s, i) => s + (Number(i.amountPaid) || 0), 0);
  // totalBalance: skip carried-forward invoices — their balance is already in the newer invoice
  const totalBalance = custInvoices.reduce((s, i) => {
    if (carriedForwardIds.has(i.id)) return s;
    return s + (Number(i.balance) || 0);
  }, 0);

  const [tab, setTab] = useState("invoices");
  const CTABS = [
    { id:"invoices",  label:"Invoices",  icon:"🧾", count: custInvoices.length },
    { id:"payments",  label:"Payments",  icon:"💳", count: custPayments.filter(p=>p.type!=="return").length },
    { id:"returns",   label:"Returns",   icon:"↩️", count: custReturns.length },
  ];

  return (
    <div>
      <BackBtn onClick={onBack} />
      {/* Customer header card */}
      <div className="flex items-center gap-4 p-5 rounded-2xl mb-6"
        style={{ background:"linear-gradient(135deg,rgba(37,99,235,0.08),rgba(245,158,11,0.04))", border:"1px solid rgba(37,99,235,0.2)" }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
          style={{ background: avatarGrad(customer.id), color:"#fff" }}>
          {initials(customer.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-base">{customer.name}</p>
          {customer.shopName && <p className="text-gray-500 text-xs">{customer.shopName}</p>}
          <p className="text-gray-500 text-xs mt-0.5">{customer.phone||""}{customer.email?` · ${customer.email}`:""}</p>
        </div>
        <div className="hidden md:flex gap-4">
          {[{ l:"Total Billed",color:"#fff",v:Rs(totalBilled)},{ l:"Total Paid",color:"#34d399",v:Rs(totalPaid)},{ l:"Balance",color:"#fbbf24",v:Rs(totalBalance)}].map(x=>(
            <div key={x.l} className="text-center">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest">{x.l}</p>
              <p className="text-sm font-bold" style={{ color:x.color }}>{x.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-5">
        {CTABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background:tab===t.id?"rgba(37,99,235,0.15)":"rgba(255,255,255,0.04)", border:`1px solid ${tab===t.id?"rgba(37,99,235,0.35)":"rgba(255,255,255,0.07)"}`, color:tab===t.id?"#60a5fa":"#6b7280" }}>
            {t.icon} {t.label}
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background:"rgba(255,255,255,0.07)", color:"#9ca3af" }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Invoices */}
      {tab==="invoices" && (
        custInvoices.length===0 ? <Empty icon="🧾" label="No invoices" /> : (
          <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
            <div className="hidden md:grid px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
              style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.05)", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr" }}>
              <span>INV #</span><span>Date</span><span>Amount</span><span>Paid</span><span>Status</span>
            </div>
            {custInvoices.map((inv,i)=>(
              <div key={inv.id} className="grid px-4 py-3 hover:bg-white/[0.02] transition-colors items-center"
                style={{ gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", borderBottom:i<custInvoices.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                <p className="text-blue-400 text-xs font-mono font-bold">#{inv.id.slice(-4).toUpperCase()}</p>
                <p className="text-gray-400 text-xs">{fmtDate(inv.invoiceDate||inv.createdAt)}</p>
                <p className="text-white text-xs font-semibold">{Rs(inv.amount)}</p>
                <p className="text-green-400 text-xs">{Rs(inv.amountPaid)}</p>
                <StatusBadge status={inv.status} />
              </div>
            ))}
          </div>
        )
      )}

      {/* Payments (non-return) */}
      {tab==="payments" && (() => {
        const list = custPayments.filter(p=>p.type!=="return");
        return list.length===0 ? <Empty icon="💳" label="No payments" /> : (
          <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
            <div className="hidden md:grid px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
              style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.05)", gridTemplateColumns:"2fr 1fr 1fr 1fr" }}>
              <span>Description</span><span>Paid</span><span>Balance</span><span>Method</span>
            </div>
            {list.map((p,i)=>(
              <div key={p.id} className="grid px-4 py-3 hover:bg-white/[0.02] transition-colors items-center"
                style={{ gridTemplateColumns:"2fr 1fr 1fr 1fr", borderBottom:i<list.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                <p className="text-white text-xs truncate">{p.description||p.invoiceId||"Payment"}</p>
                <p className="text-green-400 text-xs font-semibold">{Rs(p.paid)}</p>
                <p className="text-amber-400 text-xs">{Rs(p.balance)}</p>
                <p className="text-gray-400 text-xs capitalize">{p.method||"cash"}</p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Returns */}
      {tab==="returns" && (
        custReturns.length===0 ? <Empty icon="↩️" label="No returns" /> : (
          <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
            <div className="hidden md:grid px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
              style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.05)", gridTemplateColumns:"2fr 1fr 1fr 1fr" }}>
              <span>Description</span><span>Return Amt</span><span>Qty</span><span>Date</span>
            </div>
            {custReturns.map((r,i)=>(
              <div key={r.id} className="grid px-4 py-3 hover:bg-white/[0.02] transition-colors items-center"
                style={{ gridTemplateColumns:"2fr 1fr 1fr 1fr", borderBottom:i<custReturns.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                <p className="text-white text-xs truncate">{r.description||"Return"}</p>
                <p className="text-red-400 text-xs font-semibold">{Rs(r.returnAmount||r.paid)}</p>
                <p className="text-gray-400 text-xs">{r.qty||"—"}</p>
                <p className="text-gray-400 text-xs">{fmtDate(r.createdAt)}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CUSTOMERS TAB  (list → click → CustomerDetail)
══════════════════════════════════════════════════════════════════════ */
function CustomersTab({ customers, invoices, payments }) {
  const [selected, setSelected] = useState(null);
  const active = customers.filter(c => !c.deleted);

  if (selected) {
    return (
      <CustomerDetail
        customer={selected}
        invoices={invoices}
        payments={payments}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div>
      <SectionHead icon="👥" label="Customers" count={active.length} />
      {active.length === 0 ? <Empty icon="👥" label="No customers yet" /> : (
        <div className="flex flex-col gap-2">
          {active.map(c => {
            const custInvoices = invoices.filter(i => i.customerId === c.id && !i.deleted);
            // Skip carried-forward invoices to avoid double-counting
            const cfIds = new Set();
            custInvoices.forEach(inv => {
              (inv.items || []).forEach(it => {
                const desc = it.description || "";
                if (desc.startsWith("Previous Balance · INV-")) {
                  const suffix = desc.replace("Previous Balance · INV-", "").trim().slice(0, 4).toUpperCase();
                  const matched = custInvoices.find(i => (i.id || "").slice(-4).toUpperCase() === suffix);
                  if (matched) cfIds.add(matched.id);
                }
              });
            });
            const balance = custInvoices.reduce((s, i) => {
              if (cfIds.has(i.id)) return s;
              return s + (Number(i.balance) || 0);
            }, 0);
            return (
              <button key={c.id} onClick={() => setSelected(c)}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all hover:scale-[1.005] hover:bg-white/[0.03] group w-full"
                style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                  style={{ background: avatarGrad(c.id), color:"#fff" }}>
                  {initials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{c.name}</p>
                  <p className="text-gray-500 text-xs truncate">{c.shopName||c.phone||c.email||"—"}</p>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest">Balance</p>
                  <p className="text-sm font-bold" style={{ color: balance>0?"#fbbf24":"#34d399" }}>{Rs(balance)}</p>
                </div>
                <span className="text-gray-600 group-hover:text-gray-400 transition-colors ml-2">›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SUPPLIER DETAIL (nested inside Suppliers tab)
══════════════════════════════════════════════════════════════════════ */
function itemEffQty(item) {
  if (!item.hasVariant || item.variantType === "none") return Number(item.qty) || 1;
  return (Number(item.variantQty)||0) * (Number(item.qty)||1);
}
function itemUnit(item) {
  const MAP = { kg:"kg", meter:"mtr", liter:"ltr", length:"ft", piece:"pcs" };
  return item.hasVariant && item.variantType!=="none" ? (MAP[item.variantType]||item.variantType) : "pcs";
}

function ItemsTable({ items, accent="#c4b5fd" }) {
  if (!items?.length) return <p className="text-gray-600 text-xs px-1 py-2">No items</p>;
  return (
    <div className="rounded-lg overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
      <div className="grid px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest"
        style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.05)",
          gridTemplateColumns:"3fr 1fr 1fr 1fr 1fr" }}>
        <span>Item</span><span className="text-right">Qty</span>
        <span className="text-right">Unit</span><span className="text-right">Rate</span><span className="text-right">Total</span>
      </div>
      {items.map((it,i)=>{
        const effQty = itemEffQty(it);
        const unit   = itemUnit(it);
        const rate   = Number(it.unitPrice)||0;
        const total  = effQty * rate;
        return (
          <div key={i} className="grid px-3 py-2 hover:bg-white/[0.02] transition-colors"
            style={{ gridTemplateColumns:"3fr 1fr 1fr 1fr 1fr",
              borderBottom:i<items.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
            <div>
              <p className="text-white text-xs font-medium truncate">{it.description||"—"}</p>
              {it.hasVariant && it.variantType!=="none" && (
                <p className="text-[10px]" style={{ color:accent }}>
                  {it.variantType} · {it.variantQty} {unit}/unit × {it.qty} units
                </p>
              )}
            </div>
            <p className="text-gray-300 text-xs text-right">{effQty}</p>
            <p className="text-gray-500 text-xs text-right">{unit}</p>
            <p className="text-gray-300 text-xs text-right">{Rs(rate)}</p>
            <p className="text-white text-xs font-semibold text-right">{Rs(total)}</p>
          </div>
        );
      })}
    </div>
  );
}

function SupplierDetail({ supplier, orders, receipts, supplierReturns, onBack }) {
  const [tab,      setTab]      = useState("orders");
  const [expanded, setExpanded] = useState({});

  const suppOrders    = orders.filter(o => o._supplierId === supplier.id && !o.deleted);
  const suppPurchases = receipts.filter(r => r._supplierId === supplier.id && r.receiptTotal != null);
  const suppReturns   = (supplierReturns||[]).filter(r => r._supplierId === supplier.id);

  const totalAmount  = suppOrders.reduce((s,o)=>s+(Number(o.totalAmount)||0),0)
                     + suppPurchases.reduce((s,r)=>s+(Number(r.receiptTotal)||0),0);
  const totalPaid    = suppOrders.reduce((s,o)=>s+(Number(o.paidAmount)||0),0);
  const totalBalance = suppOrders.reduce((s,o)=>s+(Number(o.balance)||0),0);
  const totalReturns = suppReturns.reduce((s,r)=>s+(Number(r.returnTotal)||0),0);

  const STABS = [
    { id:"orders",    icon:"📋", label:"Orders",        count:suppOrders.length    },
    { id:"purchases", icon:"🛒", label:"Add. Purchases", count:suppPurchases.length },
    { id:"returns",   icon:"↩️", label:"Returns",       count:suppReturns.length   },
  ];

  function toggle(id) { setExpanded(p=>({...p,[id]:!p[id]})); }

  return (
    <div>
      <BackBtn onClick={onBack} />
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 p-5 rounded-2xl mb-5"
        style={{ background:"linear-gradient(135deg,rgba(139,92,246,0.08),rgba(245,158,11,0.04))", border:"1px solid rgba(139,92,246,0.2)" }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
          style={{ background:avatarGrad(supplier.id+"s"), color:"#fff" }}>
          {initials(supplier.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-base">{supplier.name}</p>
          {supplier.shopName && <p className="text-purple-400 text-xs font-semibold">{supplier.shopName}</p>}
          <div className="flex flex-wrap gap-3 mt-1">
            {supplier.phone && <span className="text-gray-500 text-xs">📞 {supplier.phone}</span>}
            {supplier.city  && <span className="text-gray-500 text-xs">📍 {supplier.city}</span>}
            {supplier.email && <span className="text-gray-500 text-xs">✉️ {supplier.email}</span>}
          </div>
          {supplier.notes && <p className="text-gray-600 text-xs mt-1">{supplier.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            { l:"Total Purchased", c:"#fff",    v:Rs(totalAmount)  },
            { l:"Total Paid",      c:"#34d399", v:Rs(totalPaid)    },
            { l:"Balance Due",     c:"#fbbf24", v:Rs(totalBalance) },
            ...(totalReturns>0?[{l:"Total Returns",c:"#a78bfa",v:Rs(totalReturns)}]:[]),
          ].map(x=>(
            <div key={x.l} className="text-center px-3 py-2 rounded-xl"
              style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-0.5">{x.l}</p>
              <p className="text-sm font-bold" style={{ color:x.c }}>{x.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {STABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background:tab===t.id?"rgba(139,92,246,0.15)":"rgba(255,255,255,0.04)",
              border:`1px solid ${tab===t.id?"rgba(139,92,246,0.35)":"rgba(255,255,255,0.07)"}`,
              color:tab===t.id?"#c4b5fd":"#6b7280" }}>
            {t.icon} {t.label}
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background:"rgba(255,255,255,0.07)", color:"#9ca3af" }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── ORDERS ── */}
      {tab==="orders" && (
        suppOrders.length===0 ? <Empty icon="📋" label="No orders yet" /> : (
          <div className="flex flex-col gap-3">
            {suppOrders.map(o=>{
              const isOpen    = !!expanded[o.id];
              const origAmt   = Number(o.initialAmount??o.totalAmount)||0;
              const orderRecs = suppPurchases.filter(r=>r.orderId===o.id);
              const orderRets = suppReturns.filter(r=>r.orderId===o.id);
              const addlAmt   = orderRecs.reduce((s,r)=>s+(Number(r.receiptTotal)||0),0);
              const retAmt    = orderRets.reduce((s,r)=>s+(Number(r.returnTotal)||0),0);
              return (
                <div key={o.id} className="rounded-xl overflow-hidden"
                  style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
                  {/* Row */}
                  <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={()=>toggle(o.id)}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background:"rgba(139,92,246,0.15)", color:"#c4b5fd", border:"1px solid rgba(139,92,246,0.25)" }}>
                      📋
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-purple-400 text-sm font-mono font-bold">PO-{o.id.slice(-4).toUpperCase()}</p>
                        <StatusBadge status={o.status} />
                        {addlAmt>0 && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background:"rgba(245,158,11,0.1)", color:"#fbbf24", border:"1px solid rgba(245,158,11,0.2)" }}>
                          +{Rs(addlAmt)} added</span>}
                        {retAmt>0 && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background:"rgba(167,139,250,0.1)", color:"#a78bfa", border:"1px solid rgba(167,139,250,0.2)" }}>
                          ↩ {Rs(retAmt)} returned</span>}
                      </div>
                      <p className="text-gray-600 text-[10px] mt-0.5">
                        {(o.items||[]).length} item{(o.items||[]).length!==1?"s":""} · {fmtDate(o.createdAt||o.orderDate)}
                      </p>
                    </div>
                    <div className="hidden md:flex gap-4 flex-shrink-0">
                      {[{l:"Original",v:Rs(origAmt),c:"#fff"},{l:"Paid",v:Rs(o.paidAmount),c:"#34d399"},{l:"Balance",v:Rs(o.balance),c:"#fbbf24"}].map(x=>(
                        <div key={x.l} className="text-right">
                          <p className="text-[9px] text-gray-600 uppercase tracking-widest">{x.l}</p>
                          <p className="text-xs font-bold" style={{ color:x.c }}>{x.v}</p>
                        </div>
                      ))}
                    </div>
                    <span className="text-gray-600 text-xs ml-2 flex-shrink-0 transition-transform"
                      style={{ display:"inline-block", transform:isOpen?"rotate(90deg)":"rotate(0deg)" }}>›</span>
                  </div>
                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-4 pb-4" style={{ borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mt-3 mb-2">📦 Original Order Items</p>
                      <ItemsTable items={o.items} accent="#c4b5fd" />
                      {o.note && <p className="text-gray-500 text-xs mt-2">📝 {o.note}</p>}
                      {orderRecs.map((r,ri)=>(
                        <div key={r.id} className="mt-4">
                          <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color:"#fbbf24" }}>
                            🛒 Additional Purchase #{ri+1} — {fmtDate(r.createdAt)} — {Rs(r.receiptTotal)}
                          </p>
                          <ItemsTable items={r.items} accent="#fbbf24" />
                        </div>
                      ))}
                      {orderRets.map((r,ri)=>(
                        <div key={r.id} className="mt-4">
                          <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color:"#a78bfa" }}>
                            ↩️ Return #{ri+1} — {fmtDate(r.returnDate||r.createdAt)} — {Rs(r.returnTotal)}
                          </p>
                          <ItemsTable items={r.items} accent="#a78bfa" />
                          {r.note && <p className="text-gray-500 text-xs mt-1">📝 {r.note}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── ADDITIONAL PURCHASES ── */}
      {tab==="purchases" && (
        suppPurchases.length===0 ? <Empty icon="🛒" label="No additional purchases" /> : (
          <div className="flex flex-col gap-3">
            {suppPurchases.map(r=>(
              <div key={r.id} className="rounded-xl overflow-hidden"
                style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(245,158,11,0.15)" }}>
                <div className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom:"1px solid rgba(255,255,255,0.05)", background:"rgba(245,158,11,0.04)" }}>
                  <span className="text-amber-400">🛒</span>
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold">
                      {r.orderRef||`PO-${(r.orderId||"").slice(-4).toUpperCase()}`}
                      <span className="text-amber-400 ml-2">{Rs(r.receiptTotal)}</span>
                    </p>
                    <p className="text-gray-500 text-xs">{fmtDate(r.createdAt)} · Balance after: {Rs(r.balanceAfter)}</p>
                  </div>
                </div>
                <div className="px-4 py-3"><ItemsTable items={r.items} accent="#fbbf24" /></div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── RETURNS ── */}
      {tab==="returns" && (
        suppReturns.length===0 ? <Empty icon="↩️" label="No returns recorded" /> : (
          <div className="flex flex-col gap-3">
            {suppReturns.map(r=>(
              <div key={r.id} className="rounded-xl overflow-hidden"
                style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(167,139,250,0.15)" }}>
                <div className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom:"1px solid rgba(255,255,255,0.05)", background:"rgba(167,139,250,0.04)" }}>
                  <span className="text-purple-400">↩️</span>
                  <div className="flex-1">
                    <p className="text-white text-sm font-bold">
                      {r.orderRef||`PO-${(r.orderId||"").slice(-4).toUpperCase()}`}
                      <span className="text-purple-400 ml-2">-{Rs(r.returnTotal)}</span>
                    </p>
                    <p className="text-gray-500 text-xs">
                      {fmtDate(r.returnDate||r.createdAt)}
                      {r.balanceBefore!=null&&` · Before: ${Rs(r.balanceBefore)}`}
                      {r.balanceAfter!=null&&` → After: ${Rs(r.balanceAfter)}`}
                    </p>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <ItemsTable items={r.items} accent="#a78bfa" />
                  {r.note && <p className="text-gray-500 text-xs mt-2">📝 {r.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SUPPLIERS TAB  (list → click → SupplierDetail)
══════════════════════════════════════════════════════════════════════ */
function SuppliersTab({ suppliers, orders, receipts, supplierReturns }) {
  const [selected, setSelected] = useState(null);
  const active = suppliers.filter(s => !s.deleted);

  if (selected) {
    return (
      <SupplierDetail
        supplier={selected}
        orders={orders}
        receipts={receipts}
        supplierReturns={supplierReturns}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div>
      <SectionHead icon="🏭" label="Suppliers" count={active.length} />
      {active.length === 0 ? <Empty icon="🏭" label="No suppliers yet" /> : (
        <div className="flex flex-col gap-2">
          {active.map(s => {
            const suppOrders   = orders.filter(o => o._supplierId === s.id && !o.deleted);
            const suppReceipts = receipts.filter(r => r._supplierId === s.id);
            const total    = suppOrders.reduce((sum,o)=>sum+(Number(o.totalAmount)||0),0)
                           + suppReceipts.reduce((sum,r)=>sum+(Number(r.receiptTotal)||0),0);
            const balance  = suppOrders.reduce((sum,o)=>sum+(Number(o.balance)||0),0);
            return (
              <button key={s.id} onClick={() => setSelected(s)}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all hover:scale-[1.005] hover:bg-white/[0.03] group w-full"
                style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                  style={{ background: avatarGrad(s.id+"s"), color:"#fff" }}>
                  {initials(s.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{s.name}</p>
                  <p className="text-gray-500 text-xs">{s.phone||s.city||"—"} · {suppOrders.length} order{suppOrders.length!==1?"s":""}</p>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest">Total · Balance</p>
                  <p className="text-white text-xs font-semibold">{Rs(total)}</p>
                  <p className="text-xs font-bold" style={{ color: balance>0?"#fbbf24":"#34d399" }}>{Rs(balance)}</p>
                </div>
                <span className="text-gray-600 group-hover:text-gray-400 transition-colors ml-2">›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   INVOICES TAB  — only direct invoices (no customerId)
══════════════════════════════════════════════════════════════════════ */
function InvoicesTab({ invoices }) {
  const direct = invoices.filter(i => !i.customerId && !i.deleted);
  return (
    <div>
      <SectionHead icon="🧾" label="Direct Invoices" count={direct.length} />
      <p className="text-gray-600 text-xs mb-4">Invoices not linked to any customer. Customer invoices are shown inside each customer&apos;s detail.</p>
      {direct.length === 0 ? <Empty icon="🧾" label="No direct invoices" /> : (
        <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
          <div className="hidden md:grid px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.05)", gridTemplateColumns:"1fr 2fr 1fr 1fr 1fr 1fr" }}>
            <span>INV #</span><span>Name</span><span>Date</span><span>Amount</span><span>Paid</span><span>Status</span>
          </div>
          {direct.map((inv,i)=>(
            <div key={inv.id} className="grid px-4 py-3 hover:bg-white/[0.02] transition-colors items-center"
              style={{ gridTemplateColumns:"1fr 2fr 1fr 1fr 1fr 1fr", borderBottom:i<direct.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
              <p className="text-blue-400 text-xs font-mono font-bold">#{inv.id.slice(-4).toUpperCase()}</p>
              <p className="text-white text-xs font-medium truncate">{inv.customerName||inv.customer||"—"}</p>
              <p className="text-gray-400 text-xs">{fmtDate(inv.invoiceDate||inv.createdAt)}</p>
              <p className="text-white text-xs font-semibold">{Rs(inv.amount)}</p>
              <p className="text-green-400 text-xs">{Rs(inv.amountPaid)}</p>
              <StatusBadge status={inv.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PRODUCTS TAB
══════════════════════════════════════════════════════════════════════ */
function ProductsTab({ products }) {
  const [expanded, setExpanded] = useState({});
  const active = products.filter(p => !p.deleted);

  const totalStock = active.reduce((sum, p) => {
    if (p.variantType === "none" || !p.variantType) return sum + (Number(p.stock) || 0);
    return sum + (p.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0);
  }, 0);

  function toggle(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span>📦</span>
        <span className="text-white font-bold text-sm">Inventory / Products</span>
        <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background:"rgba(255,255,255,0.07)", color:"#9ca3af" }}>{active.length}</span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background:"rgba(245,158,11,0.1)", color:"#fbbf24", border:"1px solid rgba(245,158,11,0.2)" }}>
          Total Stock: {totalStock}
        </span>
      </div>

      {active.length === 0 ? <Empty icon="📦" label="No products yet" /> : (
        <div className="flex flex-col gap-2">
          {active.map(p => {
            const hasVariants = p.variantType && p.variantType !== "none";
            const variants    = p.variants || [];
            const totalV      = variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
            const isOpen      = !!expanded[p.id];

            return (
              <div key={p.id} className="rounded-xl overflow-hidden"
                style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)" }}>

                {/* Product row */}
                <div
                  className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${hasVariants ? "cursor-pointer hover:bg-white/[0.03]" : ""}`}
                  onClick={() => hasVariants && toggle(p.id)}>

                  {/* icon */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                    style={{ background:"rgba(139,92,246,0.15)", border:"1px solid rgba(139,92,246,0.2)" }}>
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                    ) : "📦"}
                  </div>

                  {/* name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{p.name}</p>
                    {p.description && <p className="text-gray-600 text-[10px] truncate">{p.description}</p>}
                  </div>

                  {/* type badge */}
                  <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-lg capitalize flex-shrink-0"
                    style={{ background:"rgba(139,92,246,0.1)", color:"#c4b5fd", border:"1px solid rgba(139,92,246,0.2)" }}>
                    {p.variantType || "none"}
                  </span>

                  {/* price */}
                  <div className="text-right flex-shrink-0 min-w-[70px]">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">Price</p>
                    <p className="text-white text-xs font-semibold">
                      {hasVariants
                        ? variants.length > 0
                          ? `${Rs(Math.min(...variants.map(v=>v.price||0)))} – ${Rs(Math.max(...variants.map(v=>v.price||0)))}`
                          : "—"
                        : Rs(p.price)}
                    </p>
                  </div>

                  {/* stock */}
                  <div className="text-right flex-shrink-0 min-w-[60px]">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">Stock</p>
                    <p className="text-sm font-bold" style={{ color: (hasVariants ? totalV : (p.stock??0)) > 0 ? "#fbbf24" : "#f87171" }}>
                      {hasVariants ? totalV : (p.stock ?? 0)}
                    </p>
                  </div>

                  {/* expand chevron */}
                  {hasVariants && (
                    <span className="text-gray-500 text-xs ml-1 transition-transform flex-shrink-0"
                      style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", display:"inline-block" }}>
                      ›
                    </span>
                  )}
                </div>

                {/* Variants expanded */}
                {hasVariants && isOpen && (
                  <div className="px-4 pb-3" style={{ borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[10px] uppercase tracking-widest text-gray-600 font-bold mt-3 mb-2">
                      Variants ({variants.length})
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {variants.length === 0 ? (
                        <p className="text-gray-600 text-xs">No variants defined</p>
                      ) : (
                        variants.map((v, vi) => (
                          <div key={vi} className="flex items-center justify-between px-3 py-2 rounded-lg"
                            style={{ background:"rgba(139,92,246,0.06)", border:"1px solid rgba(139,92,246,0.12)" }}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background:"linear-gradient(135deg,#8B5CF6,#C4B5FD)" }} />
                              <span className="text-white text-xs font-semibold">{v.label || `Variant ${vi+1}`}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-[10px] text-gray-600 uppercase tracking-widest">Price</p>
                                <p className="text-white text-xs font-semibold">{Rs(v.price)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-gray-600 uppercase tracking-widest">Stock</p>
                                <p className="text-sm font-bold"
                                  style={{ color: (Number(v.stock)||0) > 0 ? "#fbbf24" : "#f87171" }}>
                                  {v.stock ?? 0}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PAYMENTS TAB — all payments with full Firestore fields
══════════════════════════════════════════════════════════════════════ */
function PaymentsTab({ payments }) {
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const active = payments.filter(p => !p.deleted);

  // Summary stats
  const totalReceived = active.filter(p => p.type === "received").reduce((s,p) => s+(Number(p.paid)||Number(p.amount)||0), 0);
  const totalSent     = active.filter(p => p.type === "sent").reduce((s,p) => s+(Number(p.paid)||Number(p.amount)||0), 0);
  const returns       = active.filter(p => p.type === "return").reduce((s,p) => s+(Number(p.returnAmount)||Number(p.paid)||0), 0);
  const purchases     = active.filter(p => p.type === "purchase").reduce((s,p) => s+(Number(p.purchaseAmount)||Number(p.paid)||0), 0);

  const TYPE_COLORS = {
    received: { color:"#34d399", bg:"rgba(52,211,153,0.1)",  border:"rgba(52,211,153,0.25)",  label:"Received" },
    sent:     { color:"#f87171", bg:"rgba(248,113,113,0.1)", border:"rgba(248,113,113,0.25)", label:"Sent"     },
    return:   { color:"#a78bfa", bg:"rgba(167,139,250,0.1)", border:"rgba(167,139,250,0.25)", label:"Return"   },
    purchase: { color:"#fbbf24", bg:"rgba(251,191,36,0.1)",  border:"rgba(251,191,36,0.25)",  label:"Purchase" },
  };

  const TYPES = ["all","received","sent","purchase","return"];

  const filtered = active.filter(p => {
    const matchType = typeFilter === "all" || p.type === typeFilter;
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (p.customer||"").toLowerCase().includes(q) ||
      (p.payerName||"").toLowerCase().includes(q) ||
      (p.description||"").toLowerCase().includes(q) ||
      (p.invoiceNumber||"").toLowerCase().includes(q) ||
      (p.method||"").toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  // Helper: get display amount from a payment record
  function getPaid(p) {
    if (p.type === "return")   return Number(p.returnAmount) || Number(p.paid) || 0;
    if (p.type === "purchase") return Number(p.purchaseAmount) || Number(p.paid) || 0;
    return Number(p.paid) || Number(p.amount) || 0;
  }
  function getName(p) {
    return p.payerName || p.customer || p.description || "—";
  }

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label:"Total Received", value:totalReceived, color:"#34d399", bg:"rgba(52,211,153,0.08)",  border:"rgba(52,211,153,0.2)",  icon:"💰" },
          { label:"Total Sent",     value:totalSent,     color:"#f87171", bg:"rgba(248,113,113,0.08)", border:"rgba(248,113,113,0.2)", icon:"💸" },
          { label:"Purchases",      value:purchases,     color:"#fbbf24", bg:"rgba(251,191,36,0.08)",  border:"rgba(251,191,36,0.2)",  icon:"🛒" },
          { label:"Returns",        value:returns,       color:"#a78bfa", bg:"rgba(167,139,250,0.08)", border:"rgba(167,139,250,0.2)", icon:"↩️" },
        ].map(s=>(
          <div key={s.label} className="rounded-xl px-4 py-3"
            style={{ background:s.bg, border:`1px solid ${s.border}` }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{s.icon}</span>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color:s.color }}>{s.label}</p>
            </div>
            <p className="text-white font-black text-lg">{Rs(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search name, invoice, description..."
            className="w-full rounded-xl text-white text-sm outline-none"
            style={{ background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(255,255,255,0.09)", padding:"9px 13px 9px 34px" }} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {TYPES.map(t=>(
            <button key={t} onClick={()=>setTypeFilter(t)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize"
              style={{
                background: typeFilter===t ? (TYPE_COLORS[t]?.bg||"rgba(37,99,235,0.15)") : "rgba(255,255,255,0.04)",
                border: `1px solid ${typeFilter===t ? (TYPE_COLORS[t]?.border||"rgba(37,99,235,0.3)") : "rgba(255,255,255,0.07)"}`,
                color: typeFilter===t ? (TYPE_COLORS[t]?.color||"#60a5fa") : "#6b7280",
              }}>
              {t === "all" ? `All (${active.length})` : `${TYPE_COLORS[t]?.label||t} (${active.filter(p=>p.type===t).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? <Empty icon="💳" label="No payments found" /> : (
        <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
          {/* header */}
          <div className="hidden md:grid px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.06)",
              gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr" }}>
            <span>Name / Description</span>
            <span>Type</span>
            <span>Invoice</span>
            <span>Amount</span>
            <span>Balance</span>
            <span>Method · Date</span>
          </div>

          {filtered.map((p, i) => {
            const tc = TYPE_COLORS[p.type] || { color:"#9ca3af", bg:"rgba(255,255,255,0.06)", border:"rgba(255,255,255,0.1)", label:p.type };
            const paidAmt = getPaid(p);
            const balAmt  = Number(p.balance) || Number(p.historyBalance) || 0;
            const dateStr = p.createdAt ? fmtDate(p.createdAt) : "—";
            return (
              <div key={p.id}
                className="grid px-4 py-3.5 hover:bg-white/[0.025] transition-colors items-center"
                style={{ gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",
                  borderBottom: i<filtered.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>

                {/* Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background:tc.bg, border:`1px solid ${tc.border}` }}>
                    {p.type==="received"?"💰":p.type==="sent"?"💸":p.type==="return"?"↩️":"🛒"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-semibold truncate">{getName(p)}</p>
                    {p.description && p.description !== getName(p) && (
                      <p className="text-gray-600 text-[10px] truncate">{p.description}</p>
                    )}
                  </div>
                </div>

                {/* Type badge */}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg w-fit capitalize"
                  style={{ color:tc.color, background:tc.bg, border:`1px solid ${tc.border}` }}>
                  {tc.label}
                </span>

                {/* Invoice # */}
                <p className="text-blue-400 text-xs font-mono">
                  {p.invoiceNumber || (p.invoiceId ? `#${p.invoiceId.slice(-4).toUpperCase()}` : "—")}
                </p>

                {/* Amount paid */}
                <p className="text-sm font-bold" style={{ color:tc.color }}>
                  {paidAmt > 0 ? Rs(paidAmt) : "—"}
                </p>

                {/* Balance */}
                <p className="text-amber-400 text-xs font-semibold">
                  {balAmt > 0 ? Rs(balAmt) : <span className="text-green-400">Settled</span>}
                </p>

                {/* Method + Date */}
                <div>
                  <p className="text-gray-400 text-xs capitalize">{p.method||"cash"}</p>
                  <p className="text-gray-600 text-[10px]">{dateStr}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ACTIVITY TAB
══════════════════════════════════════════════════════════════════════ */
function ActivityTab({ activityLogs }) {
  return (
    <div>
      <SectionHead icon="⚡" label="Login History" count={activityLogs.length} />
      {activityLogs.length === 0 ? <Empty icon="📋" label="No activity logs yet" /> : (
        <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
          <div className="hidden md:grid px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.05)", gridTemplateColumns:"2fr 1fr 1fr 1fr" }}>
            <span>Date & Time</span><span>IP</span><span>Browser</span><span>Device</span>
          </div>
          {activityLogs.map((log,i)=>(
            <div key={log.id} className="grid px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
              style={{ gridTemplateColumns:"2fr 1fr 1fr 1fr", borderBottom:i<activityLogs.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
              <span className="text-gray-400 text-xs">{fmtDT(log.timestamp)}</span>
              <span className="text-gray-500 font-mono text-[10px]">{log.ip||"—"}</span>
              <span className="text-gray-400 text-xs">{log.browser||"—"}</span>
              <span className="text-gray-400 text-xs">{log.device||"—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TRASH TAB
══════════════════════════════════════════════════════════════════════ */
const TRASH_TABS = [
  { id:"invoices",  icon:"🧾", label:"Invoices"  },
  { id:"customers", icon:"👥", label:"Customers" },
  { id:"products",  icon:"📦", label:"Products"  },
  { id:"payments",  icon:"💳", label:"Payments"  },
  { id:"suppliers", icon:"🏭", label:"Suppliers" },
  { id:"orders",    icon:"📋", label:"Orders"    },
];
function trashLabel(item) {
  if (item._col==="invoices")  return item.customerName||item.customer||"Invoice";
  if (item._col==="customers") return item.name||"Customer";
  if (item._col==="products")  return item.name||"Product";
  if (item._col==="payments")  return item.payerName||item.description||"Payment";
  if (item._col==="suppliers") return item.name||"Supplier";
  if (item._col==="orders")    return `PO-${item.id.slice(-4).toUpperCase()} — ${item._supplierName}`;
  return "Item";
}
function trashSub(item) {
  if (item._col==="invoices")  return `INV-${item.id.slice(-4).toUpperCase()} · ${Rs(item.amount)} · ${item.status||""}`;
  if (item._col==="customers") return `${item.phone||""} · ${item.email||""}`.replace(/^·\s|·\s$/,"").trim()||"—";
  if (item._col==="products")  return `Stock: ${item.stock??0} · Price: ${Rs(item.price)}`;
  if (item._col==="payments")  return `${Rs(item.paid)} · ${item.method||"cash"}`;
  if (item._col==="suppliers") return `${item.phone||""} · ${item.city||""}`;
  if (item._col==="orders")    return `Total: ${Rs(item.totalAmount)} · Paid: ${Rs(item.paidAmount)} · Balance: ${Rs(item.balance)}`;
  return "";
}

function TrashTab({ uid, data, getToken, onToast, onRefresh }) {
  const [trashTab,  setTrashTab]  = useState("invoices");
  const [restoreId, setRestoreId] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Include both soft-deleted (deleted:true) AND admin-trashed (adminTrash:true) items
  const buckets = {
    invoices:  data.invoices.filter(i=>i.deleted||i.adminTrash).map(i=>({...i,_col:"invoices"})),
    customers: data.customers.filter(c=>c.deleted||c.adminTrash).map(c=>({...c,_col:"customers"})),
    products:  data.products.filter(p=>p.deleted||p.adminTrash).map(p=>({...p,_col:"products"})),
    payments:  data.payments.filter(p=>p.deleted||p.adminTrash).map(p=>({...p,_col:"payments"})),
    suppliers: data.suppliers.filter(s=>s.deleted||s.adminTrash).map(s=>({...s,_col:"suppliers"})),
    orders:    data.orders.filter(o=>o.deleted||o.adminTrash).map(o=>({...o,_col:"orders"})),
  };
  const total   = Object.values(buckets).reduce((s,a)=>s+a.length,0);
  const current = buckets[trashTab]||[];

  // Admin restores item → goes back to user's trash (deleted:true, adminTrash:false)
  // User can then restore from their own trash to original section
  async function handleRestore(item) {
    setRestoring(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/restore-item", {
        method:"POST",
        headers:{"Content-Type":"application/json", authorization:`Bearer ${token}`},
        body: JSON.stringify({
          uid,
          itemId:         item.id,
          collection:     item._col,
          supplierId:     item._supplierId||null,
          restoreToTrash: false,   // ← restore directly to original section
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onToast(`${trashLabel(item)} restored to original section ✓`);
      onRefresh();
    } catch (err) { onToast(err.message||"Restore failed","error"); }
    setRestoring(false);
    setRestoreId(null);
  }

  return (
    <div>
      {/* header */}
      <div className="mb-4 px-4 py-3 rounded-xl"
        style={{ background:"rgba(248,113,113,0.06)", border:"1px solid rgba(248,113,113,0.18)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">🗑️ User Trash Archive</p>
            <p className="text-gray-500 text-xs mt-0.5">All deleted items — admin can fully restore to original section</p>
          </div>
          <span className="px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", color:"#f87171" }}>
            {total} item{total!==1?"s":""}
          </span>
        </div>
        {/* Legend */}
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-gray-500 text-[10px]">In user&apos;s trash (user can restore)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-gray-500 text-[10px]">Permanently deleted by user (admin only)</span>
          </div>
        </div>
      </div>

      {/* sub-tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TRASH_TABS.map(t=>(
          <button key={t.id} onClick={()=>setTrashTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background:trashTab===t.id?"rgba(248,113,113,0.15)":"rgba(255,255,255,0.04)",
              border:`1px solid ${trashTab===t.id?"rgba(248,113,113,0.4)":"rgba(255,255,255,0.07)"}`,
              color:trashTab===t.id?"#f87171":"#6b7280" }}>
            {t.icon} {t.label}
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background:"rgba(255,255,255,0.07)", color:"#9ca3af" }}>{buckets[t.id]?.length||0}</span>
          </button>
        ))}
      </div>

      {/* list */}
      {current.length === 0 ? <Empty icon="✨" label={`No deleted ${trashTab}`} /> : (
        <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
          {current.map((item,idx)=>{
            const isAdminTrash = !!item.adminTrash;
            return (
              <div key={item.id}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
                style={{ borderBottom:idx<current.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>

                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{
                    background: isAdminTrash?"rgba(167,139,250,0.12)":"rgba(248,113,113,0.1)",
                    border:`1px solid ${isAdminTrash?"rgba(167,139,250,0.3)":"rgba(248,113,113,0.2)"}`,
                  }}>
                  {TRASH_TABS.find(t=>t.id===item._col)?.icon||"🗑"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-semibold truncate">{trashLabel(item)}</p>
                    {isAdminTrash && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background:"rgba(167,139,250,0.15)", color:"#a78bfa", border:"1px solid rgba(167,139,250,0.3)" }}>
                        Permanently deleted
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-[11px] truncate">{trashSub(item)}</p>
                </div>

                {/* Date */}
                <div className="hidden sm:flex flex-col items-end flex-shrink-0 mr-2">
                  <p className="text-gray-600 text-[10px]">{isAdminTrash?"Perm. deleted":"In trash"}</p>
                  <p className="text-gray-400 text-xs">{fmtDate(item.adminTrashedAt||item.deletedAt)}</p>
                </div>

                {/* Restore button — always shown, restores to user's trash */}
                <button onClick={()=>setRestoreId(item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 flex-shrink-0"
                  style={{ background:"rgba(52,211,153,0.08)", color:"#34d399", border:"1px solid rgba(52,211,153,0.2)" }}>
                  ↩ Restore
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* confirm modal */}
      {restoreId && (()=>{
        const item = current.find(i=>i.id===restoreId);
        if (!item) return null;
        const isAdminTrash = !!item.adminTrash;
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)" }}>
            <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
              style={{ background:"#0d1117", border:"1px solid rgba(52,211,153,0.3)", boxShadow:"0 24px 64px rgba(0,0,0,0.7)" }}>
              <span className="text-5xl">↩️</span>
              <h3 className="text-white font-black text-lg">Restore Item?</h3>
              <div className="rounded-xl px-4 py-3" style={{ background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.15)" }}>
                <p className="text-white font-semibold text-sm">{trashLabel(item)}</p>
                <p className="text-gray-500 text-xs mt-0.5">{trashSub(item)}</p>
              </div>
              <p className="text-gray-400 text-sm">
                Item will be fully restored to its original section on the user&apos;s dashboard.
              </p>
              {item._col==="customers" && <p className="text-gray-500 text-xs">Their invoices &amp; payments will also be restored.</p>}
              {item._col==="suppliers" && <p className="text-gray-500 text-xs">Their orders will also be restored.</p>}
              <div className="flex gap-3">
                <button onClick={()=>setRestoreId(null)} disabled={restoring}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
                  Cancel
                </button>
                <button onClick={()=>handleRestore(item)} disabled={restoring}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                  style={{ background:"rgba(52,211,153,0.15)", border:"1px solid rgba(52,211,153,0.4)", color:"#34d399" }}>
                  {restoring?"Restoring...":"↩ Yes, Restore"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SIDEBAR TABS config  (no "Orders" tab — orders live inside Suppliers)
══════════════════════════════════════════════════════════════════════ */
const TABS = [
  { id:"profile",   icon:"👤", label:"Profile"   },
  { id:"customers", icon:"👥", label:"Customers"  },
  { id:"invoices",  icon:"🧾", label:"Invoices"   },
  { id:"products",  icon:"📦", label:"Products"   },
  { id:"payments",  icon:"💳", label:"Payments"   },
  { id:"suppliers", icon:"🏭", label:"Suppliers"  },
  { id:"trash",     icon:"🗑️", label:"Trash"      },
  { id:"activity",  icon:"⚡", label:"Activity"   },
];

/* ══════════════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════════════ */
export default function AdminUserDetail({ uid, getToken, onClose, onToast }) {
  const [activeTab, setActiveTab] = useState("profile");
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = await getToken();
      const res   = await fetch(`/api/admin/user-full-detail?uid=${uid}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setData(d);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }, [uid, getToken]);

  useEffect(() => { loadData(); }, [loadData]);

  const ss = data ? (STATUS_STYLE[data.user?.status] || STATUS_STYLE.active) : null;

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background:"rgba(0,0,0,0.96)", backdropFilter:"blur(12px)" }}>
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#0d1117]">

        {/* ── top bar ── */}
        <div className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.07)", background:"linear-gradient(135deg,rgba(37,99,235,0.07),rgba(245,158,11,0.03))" }}>
          <button onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-white/10 flex-shrink-0"
            style={{ border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
            ← Back
          </button>
          {data && (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                style={{ background:avatarGrad(uid), color:"#fff" }}>
                {initials(data.user?.name)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-black text-base leading-tight">{data.user?.name}</p>
                  {ss && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                      style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}` }}>
                      {ss.label||data.user?.status}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs truncate">{data.user?.email} · {data.user?.phone||"No phone"}</p>
              </div>
            </div>
          )}
          <button onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-white/10 flex-shrink-0"
            style={{ border:"1px solid rgba(255,255,255,0.1)", color:"#6b7280" }}>
            <span className={loading?"animate-spin":""}>↻</span> Refresh
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* ── sidebar ── */}
          <nav className="flex-shrink-0 flex flex-col gap-1 px-3 py-4 overflow-y-auto"
            style={{ width:180, borderRight:"1px solid rgba(255,255,255,0.06)", background:"rgba(8,13,20,0.6)" }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              let badge = null;
              if (tab.id==="trash" && data) {
                const n = [data.invoices,data.customers,data.products,data.payments,data.suppliers,data.orders]
                  .flat().filter(i=>i.deleted).length;
                if (n>0) badge = n;
              }
              return (
                <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative text-left w-full"
                  style={{ background:isActive?"linear-gradient(135deg,rgba(37,99,235,0.18),rgba(245,158,11,0.07))":"transparent", border:isActive?"1px solid rgba(37,99,235,0.25)":"1px solid transparent", color:isActive?"#fff":"#6b7280" }}>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                      style={{ background:"linear-gradient(to bottom,#2563EB,#F59E0B)" }} />
                  )}
                  <span className="text-base">{tab.icon}</span>
                  <span className="text-xs">{tab.label}</span>
                  {badge!==null && (
                    <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background:"rgba(248,113,113,0.2)", color:"#f87171", border:"1px solid rgba(248,113,113,0.3)" }}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* ── main content ── */}
          <main className="flex-1 overflow-y-auto p-6">
            {loading && (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="w-10 h-10 rounded-full border-4 border-transparent animate-spin"
                  style={{ borderTopColor:"#2563EB", borderRightColor:"#F59E0B" }} />
                <p className="text-gray-500 text-sm">Loading user data...</p>
              </div>
            )}
            {error && (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <span className="text-5xl">⚠️</span>
                <p className="text-red-400 font-semibold">{error}</p>
                <button onClick={loadData} className="px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={{ background:"rgba(37,99,235,0.1)", border:"1px solid rgba(37,99,235,0.3)", color:"#60a5fa" }}>
                  Retry
                </button>
              </div>
            )}
            {!loading && !error && data && (
              <>
                {activeTab==="profile"   && <ProfileTab data={data} />}
                {activeTab==="customers" && <CustomersTab customers={data.customers} invoices={data.invoices} payments={data.payments} />}
                {activeTab==="invoices"  && <InvoicesTab invoices={data.invoices} />}
                {activeTab==="products"  && <ProductsTab products={data.products} />}
                {activeTab==="payments"  && <PaymentsTab payments={data.payments} />}
                {activeTab==="suppliers" && <SuppliersTab suppliers={data.suppliers} orders={data.orders} receipts={data.receipts||[]} supplierReturns={data.supplierReturns||[]} />}
                {activeTab==="trash"     && <TrashTab uid={uid} data={data} getToken={getToken} onToast={onToast} onRefresh={loadData} />}
                {activeTab==="activity"  && <ActivityTab activityLogs={data.activityLogs} />}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
