"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { encryptJson, decryptFile, isEncryptedFile, encryptedFileName, NOVEXA_DEFAULT_KEY } from "@/lib/backupCrypto";

/* ══════════════════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════════════════ */
function fmtDate(val) {
  if (!val) return "—";
  try { const d = new Date(val); return isNaN(d) ? "—" : d.toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" }); }
  catch { return "—"; }
}

/* ── 15-day countdown for adminTrash items ───────────────────────────────── */
function calc15DayCountdown(adminTrashedAt) {
  // If no adminTrashedAt at all — item was promoted before this field existed.
  // Treat as already expired so it gets cleaned up instead of getting a fresh 15-day window.
  if (!adminTrashedAt) return { expired: true, daysLeft: 0, hoursLeft: 0, display: "⚠️ Expired" };
  const trashedDate = new Date(adminTrashedAt);
  const expiryDate  = new Date(trashedDate.getTime() + (15 * 24 * 60 * 60 * 1000));
  const now         = new Date();
  const msLeft      = expiryDate - now;
  if (msLeft <= 0) {
    return { expired: true, daysLeft: 0, hoursLeft: 0, display: "⚠️ Expired" };
  }
  const daysLeft  = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  const hoursLeft = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (daysLeft === 0) return { expired: false, daysLeft: 0, hoursLeft, display: `⏰ ${hoursLeft}h left` };
  if (daysLeft === 1) return { expired: false, daysLeft: 1, hoursLeft, display: `⏰ 1d ${hoursLeft}h left` };
  return { expired: false, daysLeft, hoursLeft, display: `⏰ ${daysLeft}d ${hoursLeft}h left` };
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
      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-300 mb-1">{label}</p>
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
      <p className="text-gray-300 text-sm">{label}</p>
    </div>
  );
}
function StatusBadge({ status }) {
  const s = STATUS_STYLE[status];
  if (!s) return <span className="text-gray-300 text-xs">{status||"—"}</span>;
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
function ProfileTab({ data, uid, getToken, onToast }) {
  const { user, authRecord } = data;
  const ss = STATUS_STYLE[user.status] || STATUS_STYLE.active;
  const dl = daysLeft(user.activeTo);

  // ── Password change state ─────────────────────────────────────────────────
  const [newPass,      setNewPass]      = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [savingPass,   setSavingPass]   = useState(false);
  const [passChanged,  setPassChanged]  = useState(false);

  // ── parse gmail history (stored as array in Firestore) ───────────────────
  const gmailHistory = Array.isArray(user.gmailHistory)
    ? [...user.gmailHistory].sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
    : [];

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
          <InfoCell label="Billing Period"
            value={user.billingPeriod === "yearly" ? "📆 Yearly" : user.billingPeriod === "monthly" ? "📅 Monthly" : user.billingPeriod || "—"} />
          <InfoCell label="Payment Method"
            value={user.paymentMethod === "online" ? "🌐 Online" : user.paymentMethod === "cheque" ? "🧾 Cheque" : user.paymentMethod === "cash" ? "💵 Cash" : user.paymentMethod || "—"} />
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

      {/* ── Extra Monthly Limits ── */}
      {(() => {
        const extras = user.extraLimits;
        const EXTRA_FIELDS = [
          { key: "invoicesPerMonth",            label: "Invoices / Month",               icon: "🧾" },
          { key: "invoicesPerCustomerPerMonth", label: "Invoices per Customer / Month",  icon: "👥" },
          { key: "customersPerMonth",           label: "Customers / Month",              icon: "👤" },
          { key: "suppliersPerMonth",           label: "Suppliers / Month",              icon: "🏭" },
          { key: "ordersPerSupplierPerMonth",   label: "Orders per Supplier / Month",    icon: "🛒" },
          { key: "extraUsers",                  label: "Extra User Seats",               icon: "👤" },
        ];
        const hasAny = extras && EXTRA_FIELDS.some(f => Number(extras[f.key]) > 0);
        return (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span>⚡</span>
              <span className="text-white font-bold text-sm">Extra Monthly Limits</span>
              {hasAny
                ? <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(245,158,11,0.15)", border:"1px solid rgba(245,158,11,0.35)", color:"#fbbf24" }}>Active</span>
                : <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(255,255,255,0.05)", color:"#4b5563" }}>None</span>
              }
            </div>
            {hasAny ? (
              <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(245,158,11,0.2)", background:"rgba(245,158,11,0.03)" }}>
                <div className="grid px-4 py-2 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.05)", gridTemplateColumns:"2fr 1fr" }}>
                  <span>Limit Type</span><span className="text-right">Extra Quota</span>
                </div>
                {EXTRA_FIELDS.filter(f => Number(extras?.[f.key]) > 0).map((f, i, arr) => (
                  <div key={f.key} className="flex items-center gap-3 px-4 py-2.5"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <span className="text-sm">{f.icon}</span>
                    <span className="text-gray-300 text-xs flex-1">{f.label}</span>
                    <span className="font-black text-sm" style={{ color:"#fbbf24" }}>+{Number(extras[f.key]).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-300 text-xs px-1">Koi extra limits nahi hain is user ke liye.</p>
            )}
          </div>
        );
      })()}

      {/* ── Gmail App Password Section ── */}
      <div>
        <SectionHead icon="📧" label="Gmail App Password" />
        {/* Current status */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <InfoCell label="Gmail Address"
            value={user.gmailSender || "—"}
            highlight={user.gmailSender ? "#34d399" : undefined} />
          <InfoCell label="App Password"
            value={user.gmailAppPassword || "Not set"} />
          <InfoCell label="Email Feature"
            value={user.emailFeatureEnabled === false ? "❌ Disabled" : "✅ Enabled"}
            highlight={user.emailFeatureEnabled === false ? "#f87171" : "#34d399"} />
        </div>

        {/* History table */}
        {gmailHistory.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-gray-300 text-sm">No password change history yet.</span>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
            {/* Table header */}
            <div className="grid gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ gridTemplateColumns:"1.2fr 1.4fr 1.4fr 1.4fr 1.4fr 2fr", background:"rgba(37,99,235,0.1)", color:"#6b7280", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
              <span>Changed At</span>
              <span>Old Gmail</span>
              <span>New Gmail</span>
              <span>Old Password</span>
              <span>New Password</span>
              <span>Device</span>
            </div>
            {gmailHistory.map((h, i) => (
              <div key={i}
                className="grid gap-3 px-4 py-3 text-xs items-start"
                style={{
                  gridTemplateColumns:"1.2fr 1.4fr 1.4fr 1.4fr 1.4fr 2fr",
                  background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                  borderBottom: i < gmailHistory.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                {/* Changed At */}
                <span className="font-mono text-[11px]" style={{ color:"#94a3b8" }}>
                  {h.changedAt ? fmtDT(h.changedAt) : "—"}
                </span>
                {/* Old Gmail */}
                <span className="break-all" style={{ color: h.prevSender ? "#f87171" : "#4b5563" }}>
                  {h.prevSender || <span className="italic" style={{color:"#4b5563"}}>First time</span>}
                </span>
                {/* New Gmail */}
                <span className="break-all" style={{ color:"#34d399" }}>{h.newSender || "—"}</span>
                {/* Old Password */}
                <span className="font-mono break-all" style={{ color: h.prevPass ? "#f87171" : "#4b5563" }}>
                  {h.prevPass || <span className="italic" style={{color:"#4b5563"}}>—</span>}
                </span>
                {/* New Password */}
                <span className="font-mono break-all" style={{ color:"#fbbf24" }}>
                  {h.newPass || "—"}
                </span>
                {/* Device */}
                <span className="truncate" style={{ color:"#6b7280" }} title={h.device}>
                  {h.device
                    ? (h.device.includes("Windows") ? "🖥 " : h.device.includes("iPhone") ? "📱 " : h.device.includes("Android") ? "📱 " : h.device.includes("Mac") ? "🍎 " : "💻 ")
                      + (h.device.match(/Chrome\/[\d]+/)?.[0] || h.device.match(/Firefox\/[\d]+/)?.[0] || h.device.match(/Safari\/[\d]+/)?.[0] || h.device.slice(0,40))
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Change Password Section ── */}
      <div>
        <SectionHead icon="🔑" label="Account Password" />
        <div className="rounded-xl p-4 flex flex-col gap-4"
          style={{ background:"rgba(37,99,235,0.04)", border:"1px solid rgba(37,99,235,0.18)" }}>

          {/* Info row */}
          <div className="flex items-start gap-3 px-1">
            <span className="text-lg mt-0.5">ℹ️</span>
            <p className="text-gray-300 text-xs leading-relaxed">
              Yahan se user ka Firebase login password seedha reset kar saktay hain. User ko koi email nahi
              jayegi — password turant update ho jata hai. Minimum 8 characters required.
            </p>
          </div>

          {/* New password input */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-gray-300">
              New Password
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPass ? "text" : "password"}
                  value={newPass}
                  onChange={e => { setNewPass(e.target.value); setPassChanged(false); }}
                  placeholder="Minimum 8 characters..."
                  className="w-full px-4 py-3 rounded-xl text-sm font-mono pr-12 outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff",
                    caretColor: "#60a5fa",
                  }}
                  onFocus={e => e.target.style.borderColor = "rgba(37,99,235,0.6)"}
                  onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white transition-colors text-base"
                  title={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
              <button
                onClick={async () => {
                  const trimmed = newPass.trim();
                  if (trimmed.length < 8) {
                    onToast?.("Password kam se kam 8 characters ka hona chahiye", "error");
                    return;
                  }
                  setSavingPass(true);
                  try {
                    const token = await getToken();
                    const res   = await fetch("/api/admin/update-user", {
                      method:  "POST",
                      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
                      body:    JSON.stringify({ uid, newPassword: trimmed }),
                    });
                    const d = await res.json();
                    if (!res.ok) throw new Error(d.error);
                    setPassChanged(true);
                    setNewPass("");
                    onToast?.("Password successfully update ho gaya ✓", "success");
                  } catch (err) {
                    onToast?.(err.message || "Password update fail ho gaya", "error");
                  }
                  setSavingPass(false);
                }}
                disabled={savingPass || newPass.trim().length === 0}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all flex-shrink-0"
                style={{
                  background: savingPass || newPass.trim().length === 0
                    ? "rgba(255,255,255,0.05)"
                    : "linear-gradient(135deg,rgba(37,99,235,0.3),rgba(245,158,11,0.15))",
                  border: savingPass || newPass.trim().length === 0
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid rgba(37,99,235,0.4)",
                  color: savingPass || newPass.trim().length === 0 ? "#4b5563" : "#fff",
                  cursor: savingPass || newPass.trim().length === 0 ? "not-allowed" : "pointer",
                }}
              >
                {savingPass
                  ? <><span className="w-4 h-4 rounded-full border-2 border-t-white border-transparent animate-spin inline-block" /> Updating...</>
                  : "Update Password"
                }
              </button>
            </div>

            {/* Strength indicator */}
            {newPass.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-1 w-8 rounded-full transition-all"
                      style={{
                        background: newPass.length >= i * 3
                          ? i <= 1 ? "#f87171" : i <= 2 ? "#fbbf24" : i <= 3 ? "#60a5fa" : "#34d399"
                          : "rgba(255,255,255,0.1)"
                      }} />
                  ))}
                </div>
                <span className="text-[10px] font-semibold"
                  style={{
                    color: newPass.length < 4 ? "#f87171"
                         : newPass.length < 7  ? "#fbbf24"
                         : newPass.length < 10 ? "#60a5fa"
                         : "#34d399"
                  }}>
                  {newPass.length < 4 ? "Weak" : newPass.length < 7 ? "Fair" : newPass.length < 10 ? "Good" : "Strong"}
                </span>
                <span className="text-[10px] text-gray-300 ml-auto">{newPass.length} chars</span>
              </div>
            )}

            {/* Success feedback */}
            {passChanged && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.25)" }}>
                <span>✅</span>
                <span className="text-xs font-semibold" style={{ color:"#34d399" }}>
                  Password update ho gaya — ab se user naya password use karay ga
                </span>
              </div>
            )}
          </div>
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
          {customer.shopName && <p className="text-gray-300 text-xs">{customer.shopName}</p>}
          <p className="text-gray-300 text-xs mt-0.5">{customer.phone||""}{customer.email?` · ${customer.email}`:""}</p>
        </div>
        <div className="hidden md:flex gap-4">
          {[{ l:"Total Billed",color:"#fff",v:Rs(totalBilled)},{ l:"Total Paid",color:"#34d399",v:Rs(totalPaid)},{ l:"Balance",color:"#fbbf24",v:Rs(totalBalance)}].map(x=>(
            <div key={x.l} className="text-center">
              <p className="text-[10px] text-gray-300 uppercase tracking-widest">{x.l}</p>
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
                <p className="text-gray-300 text-xs">{fmtDate(inv.invoiceDate||inv.createdAt)}</p>
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
                <p className="text-gray-300 text-xs capitalize">{p.method||"cash"}</p>
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
                <p className="text-gray-300 text-xs">{r.qty||"—"}</p>
                <p className="text-gray-300 text-xs">{fmtDate(r.createdAt)}</p>
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
                  <p className="text-gray-300 text-xs truncate">{c.shopName||c.phone||c.email||"—"}</p>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                  <p className="text-[10px] text-gray-300 uppercase tracking-widest">Balance</p>
                  <p className="text-sm font-bold" style={{ color: balance>0?"#fbbf24":"#34d399" }}>{Rs(balance)}</p>
                </div>
                <span className="text-gray-300 group-hover:text-gray-300 transition-colors ml-2">›</span>
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
  if (!items?.length) return <p className="text-gray-300 text-xs px-1 py-2">No items</p>;
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
            <p className="text-gray-300 text-xs text-right">{unit}</p>
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
            {supplier.phone && <span className="text-gray-300 text-xs">📞 {supplier.phone}</span>}
            {supplier.city  && <span className="text-gray-300 text-xs">📍 {supplier.city}</span>}
            {supplier.email && <span className="text-gray-300 text-xs">✉️ {supplier.email}</span>}
          </div>
          {supplier.notes && <p className="text-gray-300 text-xs mt-1">{supplier.notes}</p>}
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
              <p className="text-[9px] text-gray-300 uppercase tracking-widest mb-0.5">{x.l}</p>
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
                      <p className="text-gray-300 text-[10px] mt-0.5">
                        {(o.items||[]).length} item{(o.items||[]).length!==1?"s":""} · {fmtDate(o.createdAt||o.orderDate)}
                      </p>
                    </div>
                    <div className="hidden md:flex gap-4 flex-shrink-0">
                      {[{l:"Original",v:Rs(origAmt),c:"#fff"},{l:"Paid",v:Rs(o.paidAmount),c:"#34d399"},{l:"Balance",v:Rs(o.balance),c:"#fbbf24"}].map(x=>(
                        <div key={x.l} className="text-right">
                          <p className="text-[9px] text-gray-300 uppercase tracking-widest">{x.l}</p>
                          <p className="text-xs font-bold" style={{ color:x.c }}>{x.v}</p>
                        </div>
                      ))}
                    </div>
                    <span className="text-gray-300 text-xs ml-2 flex-shrink-0 transition-transform"
                      style={{ display:"inline-block", transform:isOpen?"rotate(90deg)":"rotate(0deg)" }}>›</span>
                  </div>
                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-4 pb-4" style={{ borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                      <p className="text-[10px] text-gray-300 uppercase tracking-widest font-bold mt-3 mb-2">📦 Original Order Items</p>
                      <ItemsTable items={o.items} accent="#c4b5fd" />
                      {o.note && <p className="text-gray-300 text-xs mt-2">📝 {o.note}</p>}
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
                          {r.note && <p className="text-gray-300 text-xs mt-1">📝 {r.note}</p>}
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
                    <p className="text-gray-300 text-xs">{fmtDate(r.createdAt)} · Balance after: {Rs(r.balanceAfter)}</p>
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
                    <p className="text-gray-300 text-xs">
                      {fmtDate(r.returnDate||r.createdAt)}
                      {r.balanceBefore!=null&&` · Before: ${Rs(r.balanceBefore)}`}
                      {r.balanceAfter!=null&&` → After: ${Rs(r.balanceAfter)}`}
                    </p>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <ItemsTable items={r.items} accent="#a78bfa" />
                  {r.note && <p className="text-gray-300 text-xs mt-2">📝 {r.note}</p>}
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
                  <p className="text-gray-300 text-xs">{s.phone||s.city||"—"} · {suppOrders.length} order{suppOrders.length!==1?"s":""}</p>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                  <p className="text-[10px] text-gray-300 uppercase tracking-widest">Total · Balance</p>
                  <p className="text-white text-xs font-semibold">{Rs(total)}</p>
                  <p className="text-xs font-bold" style={{ color: balance>0?"#fbbf24":"#34d399" }}>{Rs(balance)}</p>
                </div>
                <span className="text-gray-300 group-hover:text-gray-300 transition-colors ml-2">›</span>
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
      <p className="text-gray-300 text-xs mb-4">Invoices not linked to any customer. Customer invoices are shown inside each customer&apos;s detail.</p>
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
              <p className="text-gray-300 text-xs">{fmtDate(inv.invoiceDate||inv.createdAt)}</p>
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
                    {p.description && <p className="text-gray-300 text-[10px] truncate">{p.description}</p>}
                  </div>

                  {/* type badge */}
                  <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-lg capitalize flex-shrink-0"
                    style={{ background:"rgba(139,92,246,0.1)", color:"#c4b5fd", border:"1px solid rgba(139,92,246,0.2)" }}>
                    {p.variantType || "none"}
                  </span>

                  {/* price */}
                  <div className="text-right flex-shrink-0 min-w-[70px]">
                    <p className="text-[10px] text-gray-300 uppercase tracking-widest">Price</p>
                    <p className="text-gray-300 text-xs font-semibold tracking-widest">
                      ••••••
                    </p>
                  </div>

                  {/* stock */}
                  <div className="text-right flex-shrink-0 min-w-[60px]">
                    <p className="text-[10px] text-gray-300 uppercase tracking-widest">Stock</p>
                    <p className="text-sm font-bold" style={{ color: (hasVariants ? totalV : (p.stock??0)) > 0 ? "#fbbf24" : "#f87171" }}>
                      {hasVariants ? totalV : (p.stock ?? 0)}
                    </p>
                  </div>

                  {/* expand chevron */}
                  {hasVariants && (
                    <span className="text-gray-300 text-xs ml-1 transition-transform flex-shrink-0"
                      style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", display:"inline-block" }}>
                      ›
                    </span>
                  )}
                </div>

                {/* Variants expanded */}
                {hasVariants && isOpen && (
                  <div className="px-4 pb-3" style={{ borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[10px] uppercase tracking-widest text-gray-300 font-bold mt-3 mb-2">
                      Variants ({variants.length})
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {variants.length === 0 ? (
                        <p className="text-gray-300 text-xs">No variants defined</p>
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
                                <p className="text-[10px] text-gray-300 uppercase tracking-widest">Price</p>
                                <p className="text-gray-300 text-xs font-semibold tracking-widest">••••••</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-gray-300 uppercase tracking-widest">Stock</p>
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm pointer-events-none">🔍</span>
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
                      <p className="text-gray-300 text-[10px] truncate">{p.description}</p>
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
                  <p className="text-gray-300 text-xs capitalize">{p.method||"cash"}</p>
                  <p className="text-gray-300 text-[10px]">{dateStr}</p>
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
              <span className="text-gray-300 text-xs">{fmtDT(log.timestamp)}</span>
              <span className="text-gray-300 font-mono text-[10px]">{log.ip||"—"}</span>
              <span className="text-gray-300 text-xs">{log.browser||"—"}</span>
              <span className="text-gray-300 text-xs">{log.device||"—"}</span>
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
  if (item._col==="products")  return `Stock: ${item.stock??0} · Price: ••••••`;
  if (item._col==="payments")  return `${Rs(item.paid)} · ${item.method||"cash"}`;
  if (item._col==="suppliers") return `${item.phone||""} · ${item.city||""}`;
  if (item._col==="orders")    return `Total: ${Rs(item.totalAmount)} · Paid: ${Rs(item.paidAmount)} · Balance: ${Rs(item.balance)}`;
  return "";
}

function TrashTab({ uid, data, getToken, onToast, onRefresh }) {
  const [trashTab,  setTrashTab]  = useState("invoices");
  const [restoreId, setRestoreId] = useState(null);
  const [restoring, setRestoring] = useState(false);
  // Ticker to refresh countdown every minute
  const [tick,      setTick]      = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-purge expired adminTrash items (15-day window elapsed) ──────────
  // Runs on mount + every minute (tick). Uses dataRef to always have latest data without
  // re-creating the effect on every data refresh.
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    if (!uid) return;
    const d = dataRef.current;
    if (!d) return;

    // Build flat list with explicit _col tags
    const allAdminTrash = [
      ...(d.invoices||[]).filter(i=>i.adminTrash).map(i=>({...i, _col:"invoices"})),
      ...(d.customers||[]).filter(i=>i.adminTrash).map(i=>({...i, _col:"customers"})),
      ...(d.products||[]).filter(i=>i.adminTrash).map(i=>({...i, _col:"products"})),
      ...(d.payments||[]).filter(i=>i.adminTrash).map(i=>({...i, _col:"payments"})),
      ...(d.suppliers||[]).filter(i=>i.adminTrash).map(i=>({...i, _col:"suppliers"})),
      ...(d.orders||[]).filter(i=>i.adminTrash).map(i=>({...i, _col:"orders"})),
    ];

    const expired = allAdminTrash.filter(item => calc15DayCountdown(item.adminTrashedAt).expired);
    if (expired.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        await Promise.allSettled(
          expired.map(item =>
            fetch("/api/admin/permanent-delete", {
              method:  "POST",
              headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
              body:    JSON.stringify({
                uid,
                itemId:     item.id,
                collection: item._col,
                supplierId: item._supplierId || null,
              }),
            })
          )
        );
        if (!cancelled) onRefresh();
      } catch { /* silently ignore */ }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, uid]);

  // Admin trash shows ONLY items permanently deleted by user (adminTrash:true)
  // Regular user trash (deleted:true, adminTrash:false) is NOT shown here — that's the user's own trash
  const buckets = {
    invoices:  data.invoices.filter(i=>i.adminTrash).map(i=>({...i,_col:"invoices"})),
    customers: data.customers.filter(c=>c.adminTrash).map(c=>({...c,_col:"customers"})),
    products:  data.products.filter(p=>p.adminTrash).map(p=>({...p,_col:"products"})),
    payments:  data.payments.filter(p=>p.adminTrash).map(p=>({...p,_col:"payments"})),
    suppliers: data.suppliers.filter(s=>s.adminTrash).map(s=>({...s,_col:"suppliers"})),
    orders:    data.orders.filter(o=>o.adminTrash).map(o=>({...o,_col:"orders"})),
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
            <p className="text-white font-bold text-sm">🗑️ Admin Trash Archive</p>
            <p className="text-gray-300 text-xs mt-0.5">Items permanently deleted by user — admin can still restore within 15 days. After expiry they are deleted from database forever.</p>
          </div>
          <span className="px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", color:"#f87171" }}>
            {total} item{total!==1?"s":""}
          </span>
        </div>
        {/* Legend */}
        <div className="flex gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-gray-300 text-[10px]">Permanently deleted by user — ⏰ 15-day recovery window (admin can restore)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-gray-300 text-[10px]">⚠️ Expired — will be permanently deleted from database</span>
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
      {current.length === 0 ? <Empty icon="✨" label={`No items in admin trash`} /> : (
        <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.07)" }}>
          {current.map((item,idx)=>{
            // All items here are adminTrash:true
            // eslint-disable-next-line no-unused-expressions
            tick; // re-evaluate every minute
            const countdown = calc15DayCountdown(item.adminTrashedAt);
            return (
              <div key={item.id}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
                style={{ borderBottom:idx<current.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>

                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{
                    background: countdown.expired ? "rgba(248,113,113,0.12)" : "rgba(167,139,250,0.12)",
                    border:`1px solid ${countdown.expired ? "rgba(248,113,113,0.3)" : "rgba(167,139,250,0.3)"}`,
                  }}>
                  {TRASH_TABS.find(t=>t.id===item._col)?.icon||"🗑"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-semibold truncate">{trashLabel(item)}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background:"rgba(167,139,250,0.15)", color:"#a78bfa", border:"1px solid rgba(167,139,250,0.3)" }}>
                      Perm. deleted by user
                    </span>
                  </div>
                  <p className="text-gray-300 text-[11px] truncate">{trashSub(item)}</p>
                </div>

                {/* Date + countdown */}
                <div className="hidden sm:flex flex-col items-end flex-shrink-0 mr-2 gap-0.5">
                  <p className="text-gray-300 text-[10px] uppercase tracking-wide">Auto-delete in</p>
                  <p className={`text-xs font-bold ${countdown.expired ? "text-red-400" : countdown.daysLeft <= 3 ? "text-amber-400" : "text-purple-400"}`}>
                    {countdown.display}
                  </p>
                  <p className="text-gray-300 text-[10px]">Deleted: {fmtDate(item.adminTrashedAt)}</p>
                </div>

                {/* Restore button */}
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
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)" }}>
            <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
              style={{ background:"#0d1117", border:"1px solid rgba(52,211,153,0.3)", boxShadow:"0 24px 64px rgba(0,0,0,0.7)" }}>
              <span className="text-5xl">↩️</span>
              <h3 className="text-white font-black text-lg">Restore Item?</h3>
              <div className="rounded-xl px-4 py-3" style={{ background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.15)" }}>
                <p className="text-white font-semibold text-sm">{trashLabel(item)}</p>
                <p className="text-gray-300 text-xs mt-0.5">{trashSub(item)}</p>
              </div>
              <p className="text-gray-300 text-sm">
                Item will be fully restored to its original section on the user&apos;s dashboard.
              </p>
              {item._col==="customers" && <p className="text-gray-300 text-xs">Their invoices &amp; payments will also be restored.</p>}
              {item._col==="suppliers" && <p className="text-gray-300 text-xs">Their orders will also be restored.</p>}
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
   TICKETS TAB
══════════════════════════════════════════════════════════════════════ */
const TICKET_STATUS_META = {
  "Open":        { color:"#3b82f6", bg:"rgba(59,130,246,0.12)",  border:"rgba(59,130,246,0.3)",  icon:"🔵" },
  "In Progress": { color:"#f59e0b", bg:"rgba(245,158,11,0.12)",  border:"rgba(245,158,11,0.3)",  icon:"🟡" },
  "Resolved":    { color:"#34d399", bg:"rgba(52,211,153,0.12)",  border:"rgba(52,211,153,0.3)",  icon:"✅" },
  "Closed":      { color:"#6b7280", bg:"rgba(107,114,128,0.12)", border:"rgba(107,114,128,0.3)", icon:"⬛" },
};

function TicketStatusBadge({ status }) {
  const m = TICKET_STATUS_META[status] || TICKET_STATUS_META["Open"];
  return (
    <span style={{ background:m.bg, border:`1px solid ${m.border}`, color:m.color,
      padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
      {m.icon} {status}
    </span>
  );
}

function TicketConversation({ ticket, getToken, onToast, onRefresh }) {
  const [reply,         setReply]         = useState("");
  const [sending,       setSending]       = useState(false);
  const [acting,        setActing]        = useState(false);
  const [resolvePopup,  setResolvePopup]  = useState(false);
  const [resolveMsg,    setResolveMsg]    = useState("");

  async function handleReply() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/ticket-action", {
        method: "POST",
        headers: { authorization:`Bearer ${token}`, "Content-Type":"application/json" },
        body: JSON.stringify({ ticketId: ticket.ticketId, action:"reply", replyText: reply.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setReply("");
      onToast("Reply sent!", "success");
      onRefresh();
    } catch (err) { onToast(err.message, "error"); }
    setSending(false);
  }

  async function handleStatus(newStatus) {
    setActing(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/ticket-action", {
        method: "POST",
        headers: { authorization:`Bearer ${token}`, "Content-Type":"application/json" },
        body: JSON.stringify({ ticketId: ticket.ticketId, action:"status", newStatus }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onToast(`Status → ${newStatus}`, "success");
      onRefresh();
    } catch (err) { onToast(err.message, "error"); }
    setActing(false);
  }

  async function handleResolve() {
    setActing(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/ticket-action", {
        method: "POST",
        headers: { authorization:`Bearer ${token}`, "Content-Type":"application/json" },
        body: JSON.stringify({ ticketId: ticket.ticketId, action:"status", newStatus:"Resolved", resolveNote: resolveMsg.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);

      // Auto-close after 3s
      setTimeout(async () => {
        try {
          const t2 = await getToken();
          await fetch("/api/admin/ticket-action", {
            method: "POST",
            headers: { authorization:`Bearer ${t2}`, "Content-Type":"application/json" },
            body: JSON.stringify({ ticketId: ticket.ticketId, action:"status", newStatus:"Closed" }),
          });
          onRefresh();
        } catch {}
      }, 3000);

      onToast("Resolved! Auto-closing in 3s...", "success");
      setResolvePopup(false);
      setResolveMsg("");
      onRefresh();
    } catch (err) { onToast(err.message, "error"); }
    setActing(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete ticket ${ticket.ticketId}?`)) return;
    setActing(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/ticket-action", {
        method: "POST",
        headers: { authorization:`Bearer ${token}`, "Content-Type":"application/json" },
        body: JSON.stringify({ ticketId: ticket.ticketId, action:"delete" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onToast("Ticket deleted", "success");
      onRefresh();
    } catch (err) { onToast(err.message, "error"); }
    setActing(false);
  }

  return (
    <div className="rounded-2xl overflow-hidden mb-4"
      style={{ border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.02)" }}>

      {/* Resolve popup */}
      {resolvePopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
            style={{ background:"#0d1117", border:"1px solid rgba(52,211,153,0.3)", boxShadow:"0 24px 64px rgba(0,0,0,0.7)" }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.3)" }}>✅</div>
              <div>
                <p className="text-white font-black text-base">Mark as Resolved</p>
                <p className="text-gray-300 text-xs mt-0.5">{ticket.ticketId} · {ticket.name}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-300">
                Resolution Summary <span className="text-gray-300 normal-case tracking-normal font-normal">(sent to user)</span>
              </label>
              <textarea rows={4} value={resolveMsg} onChange={e => setResolveMsg(e.target.value)}
                placeholder="Describe what was the issue and how it was resolved..."
                style={{ width:"100%", outline:"none", resize:"vertical",
                  background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(52,211,153,0.3)",
                  borderRadius:12, padding:"10px 14px", color:"#fff", fontSize:13, lineHeight:1.7 }} />
              <p className="text-gray-300 text-[10px]">Ticket auto-closes after marking resolved.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setResolvePopup(false); setResolveMsg(""); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
                Cancel
              </button>
              <button onClick={handleResolve} disabled={acting || !resolveMsg.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background:"linear-gradient(135deg,#34d399,#059669)", color:"#fff",
                  opacity:(acting||!resolveMsg.trim())?0.5:1, cursor:(acting||!resolveMsg.trim())?"not-allowed":"pointer" }}>
                {acting ? "Resolving..." : "Resolve & Notify →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3 flex-wrap"
        style={{ background:"rgba(37,99,235,0.07)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs font-black" style={{ color:"#60a5fa" }}>{ticket.ticketId}</span>
            <TicketStatusBadge status={ticket.status} />
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background:"rgba(255,255,255,0.05)", color:"#6b7280", border:"1px solid rgba(255,255,255,0.08)" }}>
              {ticket.category}
            </span>
          </div>
          <p className="text-white text-sm font-semibold">{ticket.subject}</p>
          <p className="text-gray-300 text-[10px] mt-0.5">{fmtDT(ticket.createdAt)}</p>
        </div>
        <button onClick={handleDelete} disabled={acting}
          className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all hover:scale-105"
          style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#f87171",
            cursor: acting ? "not-allowed":"pointer", opacity: acting ? 0.5:1 }}>
          🗑 Delete
        </button>
      </div>

      {/* Status action buttons */}
      <div className="px-4 py-2.5 flex flex-wrap gap-2"
        style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
        {["Open","In Progress","Closed"].map(s => {
          const m   = TICKET_STATUS_META[s];
          const isA = ticket.status === s;
          return (
            <button key={s} disabled={acting || isA}
              onClick={() => handleStatus(s)}
              style={{ padding:"5px 12px", borderRadius:8, fontSize:11, fontWeight:700,
                border:`1px solid ${isA ? m.border : "rgba(255,255,255,0.07)"}`,
                background: isA ? m.bg : "rgba(255,255,255,0.03)",
                color: isA ? m.color : "#6b7280",
                cursor:(acting||isA)?"not-allowed":"pointer", opacity:acting?0.6:1 }}>
              {m.icon} {s}
            </button>
          );
        })}
        {/* Resolved — special with popup */}
        <button disabled={acting || ticket.status === "Resolved"}
          onClick={() => setResolvePopup(true)}
          style={{ padding:"5px 12px", borderRadius:8, fontSize:11, fontWeight:700,
            border:`1px solid ${ticket.status==="Resolved" ? TICKET_STATUS_META["Resolved"].border : "rgba(52,211,153,0.35)"}`,
            background: ticket.status==="Resolved" ? TICKET_STATUS_META["Resolved"].bg : "rgba(52,211,153,0.1)",
            color: ticket.status==="Resolved" ? TICKET_STATUS_META["Resolved"].color : "#34d399",
            cursor:(acting||ticket.status==="Resolved")?"not-allowed":"pointer", opacity:acting?0.6:1 }}>
          ✅ Resolved
        </button>
      </div>

      {/* Messages */}
      <div className="px-4 py-3 flex flex-col gap-2 max-h-56 overflow-y-auto">
        {(ticket.messages||[]).map((msg, i) => {
          const isAdmin = msg.from === "admin";
          return (
            <div key={i} className={`flex ${isAdmin?"justify-end":"justify-start"}`}>
              <div style={{
                maxWidth:"82%", padding:"9px 13px",
                borderRadius: isAdmin ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                background: isAdmin ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.04)",
                border:`1px solid ${isAdmin ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.07)"}`,
              }}>
                <p className="text-[10px] font-bold mb-1" style={{ color: isAdmin?"#60a5fa":"#9ca3af" }}>
                  {isAdmin ? "🛡 Novexa Support" : "👤 User"}
                </p>
                <p className="text-xs text-white leading-relaxed" style={{ whiteSpace:"pre-wrap" }}>{msg.text}</p>
                <p className="text-[9px] text-gray-300 mt-1">{fmtDT(msg.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply box */}
      <div className="px-4 py-3 flex gap-2"
        style={{ borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <textarea rows={2} value={reply} onChange={e => setReply(e.target.value)}
          placeholder="Reply to user..."
          style={{ flex:1, outline:"none", resize:"none",
            background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(37,99,235,0.25)",
            borderRadius:10, padding:"8px 12px", color:"#fff", fontSize:12 }} />
        <button onClick={handleReply} disabled={sending || !reply.trim()}
          style={{ padding:"8px 16px", borderRadius:10, fontSize:12, fontWeight:800,
            background:"linear-gradient(135deg,#2563eb,#1d4ed8)", color:"#fff",
            border:"none", cursor:(sending||!reply.trim())?"not-allowed":"pointer",
            opacity:(sending||!reply.trim())?0.5:1, flexShrink:0, alignSelf:"flex-end" }}>
          {sending ? "..." : "Send →"}
        </button>
      </div>
    </div>
  );
}

function TicketsTab({ uid, getToken, onToast }) {
  const [tickets,  setTickets]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch(`/api/admin/get-tickets?uid=${uid}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setTickets(d.tickets || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [uid, getToken]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
    </div>
  );

  if (tickets.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <span className="text-5xl">📭</span>
      <p className="text-gray-300 text-sm">No support tickets from this user yet.</p>
    </div>
  );

  // Summary counts
  const counts = tickets.reduce((a,t) => { a[t.status]=(a[t.status]||0)+1; return a; }, {});

  return (
    <div className="flex flex-col gap-5">
      <SectionHead icon="🎫" label="Support Tickets" count={tickets.length} />

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(counts).map(([status, n]) => {
          const m = TICKET_STATUS_META[status] || TICKET_STATUS_META["Open"];
          return (
            <div key={status} style={{ background:m.bg, border:`1px solid ${m.border}`,
              borderRadius:10, padding:"6px 14px", display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:12 }}>{m.icon}</span>
              <span style={{ color:m.color, fontSize:12, fontWeight:700 }}>{status}: {n}</span>
            </div>
          );
        })}
        <button onClick={load}
          className="ml-auto text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:bg-white/10"
          style={{ border:"1px solid rgba(255,255,255,0.1)", color:"#6b7280" }}>
          ↻ Refresh
        </button>
      </div>

      {/* Tickets list */}
      {tickets.map(t => (
        <TicketConversation
          key={t.id}
          ticket={t}
          getToken={getToken}
          onToast={onToast}
          onRefresh={load}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ADD-ONS TAB
══════════════════════════════════════════════════════════════════════ */
const ADDON_CATS = [
  {
    limitKey: "invoicesPerMonth", label: "Extra Invoices / Month", icon: "🧾", perUnitKey: "invoicesPerMonth_per", defaultPerUnit: 10,
    packages: [{qty:50,key:"invoicesPerMonth_50",def:500},{qty:100,key:"invoicesPerMonth_100",def:900},{qty:250,key:"invoicesPerMonth_250",def:2000},{qty:500,key:"invoicesPerMonth_500",def:3500},{qty:1000,key:"invoicesPerMonth_1000",def:6000}],
  },
  {
    limitKey: "invoicesPerCustomerPerMonth", label: "Extra Invoices per Customer / Month", icon: "👥", perUnitKey: "invoicesPerCustomerPerMonth_per", defaultPerUnit: 10,
    packages: [{qty:50,key:"invoicesPerCustomerPerMonth_50",def:500},{qty:100,key:"invoicesPerCustomerPerMonth_100",def:900},{qty:250,key:"invoicesPerCustomerPerMonth_250",def:2000},{qty:500,key:"invoicesPerCustomerPerMonth_500",def:3500},{qty:1000,key:"invoicesPerCustomerPerMonth_1000",def:6000}],
  },
  {
    limitKey: "customersPerMonth", label: "Extra Customers", icon: "👤", perUnitKey: "customersPerMonth_per", defaultPerUnit: 30,
    packages: [{qty:50,key:"customersPerMonth_50",def:1200},{qty:100,key:"customersPerMonth_100",def:2200},{qty:250,key:"customersPerMonth_250",def:5000},{qty:500,key:"customersPerMonth_500",def:9000},{qty:1000,key:"customersPerMonth_1000",def:16000}],
  },
  {
    limitKey: "suppliersPerMonth", label: "Extra Suppliers", icon: "🏭", perUnitKey: "suppliersPerMonth_per", defaultPerUnit: 30,
    packages: [{qty:20,key:"suppliersPerMonth_20",def:500},{qty:50,key:"suppliersPerMonth_50",def:1200},{qty:100,key:"suppliersPerMonth_100",def:2200},{qty:250,key:"suppliersPerMonth_250",def:5000},{qty:500,key:"suppliersPerMonth_500",def:9000},{qty:1000,key:"suppliersPerMonth_1000",def:16000}],
  },
  {
    limitKey: "ordersPerSupplierPerMonth", label: "Extra Orders per Supplier / Month", icon: "🛒", perUnitKey: "ordersPerSupplierPerMonth_per", defaultPerUnit: 10,
    packages: [{qty:50,key:"ordersPerSupplierPerMonth_50",def:500},{qty:100,key:"ordersPerSupplierPerMonth_100",def:900},{qty:250,key:"ordersPerSupplierPerMonth_250",def:2000},{qty:500,key:"ordersPerSupplierPerMonth_500",def:3500},{qty:1000,key:"ordersPerSupplierPerMonth_1000",def:6000}],
  },
];

function calcTieredAddon(qty, perUnit, packages, prices) {
  if (qty <= 0) return 0;
  const sorted = [...packages].sort((a,b) => b.qty - a.qty);
  let rem = qty, total = 0;
  for (const pkg of sorted) {
    if (rem >= pkg.qty) {
      const c = Math.floor(rem / pkg.qty);
      total += c * (prices[pkg.key] ?? pkg.def);
      rem   -= c * pkg.qty;
    }
  }
  if (rem > 0) total += rem * (prices[perUnit] ?? perUnit);
  return total;
}

function AddonsTab({ uid, user, getToken, onToast }) {
  const [addonPrices,  setAddonPrices]  = useState(null);
  const [existingLims, setExistingLims] = useState({});
  const [userMeta,     setUserMeta]     = useState(null); // fresh from Firestore: expiry, purchasedAt etc
  const [addQtys,      setAddQtys]      = useState({ invoicesPerMonth:"0", invoicesPerCustomerPerMonth:"0", customersPerMonth:"0", suppliersPerMonth:"0", ordersPerSupplierPerMonth:"0", extraUsers:"0" });
  const [payMethod,    setPayMethod]    = useState("cash");
  const [saving,       setSaving]       = useState(false);
  const [done,         setDone]         = useState(false);
  const [confirm,      setConfirm]      = useState(false);
  const [success,      setSuccess]      = useState(null);

  // Load prices + existing limits fresh from Firestore
  useEffect(() => {
    if (!uid) return;
    import("firebase/firestore").then(({ getDoc, doc: fsDoc }) => {
      import("@/lib/firebase").then(({ db: fdb }) => {
        // Load addon prices
        getDoc(fsDoc(fdb, "adminConfig", "plans")).then(snap => {
          setAddonPrices(snap.exists() && snap.data().addonPrices ? snap.data().addonPrices : {});
        }).catch(() => setAddonPrices({}));
        // Load existing user limits + meta fresh from Firestore
        getDoc(fsDoc(fdb, "users", uid)).then(snap => {
          if (snap.exists()) {
            const d   = snap.data();
            const lim = d.extraLimits || {};
            setExistingLims({
              invoicesPerMonth:            Number(lim.invoicesPerMonth            || 0),
              invoicesPerCustomerPerMonth: Number(lim.invoicesPerCustomerPerMonth || 0),
              customersPerMonth:           Number(lim.customersPerMonth           || 0),
              suppliersPerMonth:           Number(lim.suppliersPerMonth           || 0),
              ordersPerSupplierPerMonth:   Number(lim.ordersPerSupplierPerMonth   || 0),
              extraUsers:                  Number(lim.extraUsers                  || 0),
            });
            setUserMeta({
              extraLimitsExpiresAt:    d.extraLimitsExpiresAt    || null,
              extraLimitsPurchasedAt:  d.extraLimitsPurchasedAt  || null,
              extraLimitsPaymentMethod:d.extraLimitsPaymentMethod|| null,
            });
          }
        }).catch(() => {});
      });
    });
  }, [uid]);

  const p = addonPrices || {};

  // Price for any qty in a category
  function priceForQty(cat, qty) {
    return calcTieredAddon(qty, cat.defaultPerUnit, cat.packages, p);
  }

  // Build invoice lines from addQtys
  const lines = ADDON_CATS.map(cat => {
    const adding = Number(addQtys[cat.limitKey]) || 0;
    if (adding <= 0) return null;
    const total = priceForQty(cat, adding);
    return { cat, adding, total };
  }).filter(Boolean);
  // Extra user seats — flat rate
  const extraUsersAdding = Number(addQtys["extraUsers"]) || 0;
  const extraUserPrice   = p["extraUser_monthly"] ?? 1000;
  if (extraUsersAdding > 0) {
    lines.push({ cat: { limitKey:"extraUsers", label:"Extra User Seats", icon:"🧑‍💼" }, adding: extraUsersAdding, total: extraUsersAdding * extraUserPrice });
  }
  const grandTotal = lines.reduce((s,l) => s + l.total, 0);

  async function doSave() {
    setSaving(true);
    try {
      const token   = await getToken();
      const headers = { "Content-Type":"application/json", authorization:`Bearer ${token}` };

      // ── Fresh read from Firestore before calculating totals ──────────────
      // This prevents stale state from causing overwrite issues
      const { getDoc, doc: fsDoc } = await import("firebase/firestore");
      const { db: fdb } = await import("@/lib/firebase");
      const freshSnap = await getDoc(fsDoc(fdb, "users", uid));
      const freshLims = freshSnap.exists() ? (freshSnap.data().extraLimits || {}) : {};

      const cleaned = {};
      ADDON_CATS.forEach(cat => {
        cleaned[cat.limitKey] = (Number(freshLims[cat.limitKey]) || 0) + (Number(addQtys[cat.limitKey]) || 0);
      });
      // Extra user seats
      cleaned["extraUsers"] = (Number(freshLims["extraUsers"]) || 0) + extraUsersAdding;
      const purchasedAt   = new Date().toISOString();
      const expiresAtDate = new Date(); expiresAtDate.setMonth(expiresAtDate.getMonth() + 1);
      const expiresAt     = expiresAtDate.toISOString();
      // If adding extra user seats, also bump maxDevices on the user doc
      const extraUsersUpdate = {};
      if (extraUsersAdding > 0) {
        const currentMaxDevices = Number(user?.maxDevices) || 1;
        extraUsersUpdate.maxDevices = currentMaxDevices + extraUsersAdding;
      }
      const res  = await fetch("/api/admin/update-user", { method:"POST", headers, body: JSON.stringify({ uid, extraLimits: cleaned, extraLimitsExpiresAt: expiresAt, extraLimitsPurchasedAt: purchasedAt, extraLimitsPaymentMethod: payMethod, ...extraUsersUpdate }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
      // Re-read fresh from Firestore (reuse same imports from above)
      const afterSnap = await getDoc(fsDoc(fdb, "users", uid));
      if (afterSnap.exists()) {
        const fd  = afterSnap.data();
        const lim = fd.extraLimits || {};
        setExistingLims({ invoicesPerMonth: Number(lim.invoicesPerMonth||0), invoicesPerCustomerPerMonth: Number(lim.invoicesPerCustomerPerMonth||0), customersPerMonth: Number(lim.customersPerMonth||0), suppliersPerMonth: Number(lim.suppliersPerMonth||0), ordersPerSupplierPerMonth: Number(lim.ordersPerSupplierPerMonth||0), extraUsers: Number(lim.extraUsers||0) });
        setUserMeta({ extraLimitsExpiresAt: fd.extraLimitsExpiresAt||null, extraLimitsPurchasedAt: fd.extraLimitsPurchasedAt||null, extraLimitsPaymentMethod: fd.extraLimitsPaymentMethod||null });
      }
      // Send invoice email
      if (user?.email && lines.length > 0) {
        const invoiceLines = lines.map(l => ({ key: l.cat.limitKey, icon: l.cat.icon, label: l.cat.label, qty: l.adding, unitPrice: Math.round(l.total/l.adding*10)/10, total: l.total }));
        fetch("/api/admin/send-addon-invoice", { method:"POST", headers, body: JSON.stringify({ uid, userName: user.name||user.email, userEmail: user.email, lineItems: invoiceLines, grandTotal, paymentMethod: payMethod, purchasedAt, expiresAt }) }).catch(()=>{});
      }

      // Record admin grant in history — so user sees it in Purchase History
      if (lines.length > 0) {
        const invoiceLines = lines.map(l => ({ limitKey: l.cat.limitKey, icon: l.cat.icon, label: l.cat.label, qty: l.adding, total: l.total }));
        fetch("/api/admin/record-addon-grant", {
          method:  "POST",
          headers,
          body: JSON.stringify({
            uid,
            userName:      user?.name || user?.email || "",
            userEmail:     user?.email || "",
            lineItems:     invoiceLines,
            grandTotal,
            paymentMethod: payMethod,
            purchasedAt,
            expiresAt,
          }),
        }).catch(() => {});
      }
      setSuccess({ lines, grandTotal, payMethod, expiresAt });
      setAddQtys({ invoicesPerMonth:"0", invoicesPerCustomerPerMonth:"0", customersPerMonth:"0", suppliersPerMonth:"0", ordersPerSupplierPerMonth:"0", extraUsers:"0" });
      onToast?.("Add-ons activated! Invoice sent. ✓", "success");
      setTimeout(() => setDone(false), 3000);
    } catch (err) { onToast?.(err.message || "Save failed", "error"); }
    setSaving(false);
    setConfirm(false);
  }

  if (!addonPrices) {
    return <div className="flex items-center justify-center h-32"><div className="w-7 h-7 rounded-full border-2 border-t-amber-500 border-transparent animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-white font-black text-lg flex items-center gap-2">⚡ Add-on Quota</h2>
          <p className="text-gray-300 text-xs mt-1">User ke existing plan limits ke upar extra quota add karein. 1 mahine ke liye valid.</p>
        </div>
        {/* Recalculate button — fixes any data inconsistency */}
        <button
          type="button"
          onClick={async () => {
            try {
              const token   = await getToken();
              const headers = { "Content-Type":"application/json", authorization:`Bearer ${token}` };
              const res  = await fetch("/api/admin/recalculate-addon-limits", { method:"POST", headers, body: JSON.stringify({ uid }) });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              // Re-read fresh limits
              const { getDoc, doc: fsDoc } = await import("firebase/firestore");
              const { db: fdb } = await import("@/lib/firebase");
              const freshSnap = await getDoc(fsDoc(fdb, "users", uid));
              if (freshSnap.exists()) {
                const fd  = freshSnap.data();
                const lim = fd.extraLimits || {};
                setExistingLims({ invoicesPerMonth: Number(lim.invoicesPerMonth||0), invoicesPerCustomerPerMonth: Number(lim.invoicesPerCustomerPerMonth||0), customersPerMonth: Number(lim.customersPerMonth||0), suppliersPerMonth: Number(lim.suppliersPerMonth||0), ordersPerSupplierPerMonth: Number(lim.ordersPerSupplierPerMonth||0), extraUsers: Number(lim.extraUsers||0) });
              }
              onToast?.(`Recalculated! ${data.approvedRequestsCount} approved requests summed. ✓`, "success");
            } catch (err) { onToast?.(err.message || "Recalculate failed", "error"); }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0 transition-all hover:scale-105"
          style={{ background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.3)", color:"#a5b4fc" }}>
          🔄 Recalculate
        </button>
      </div>

      {/* Current active add-ons */}
      {(() => {
        const any = ADDON_CATS.some(cat => (existingLims[cat.limitKey] || 0) > 0) || (existingLims["extraUsers"] || 0) > 0;
        if (!any) return null;
        const exp     = userMeta?.extraLimitsExpiresAt ? new Date(userMeta.extraLimitsExpiresAt) : null;
        const expired = exp ? exp < new Date() : false;
        const dLeft   = exp ? Math.ceil((exp - new Date()) / 86400000) : null;
        const purchAt = userMeta?.extraLimitsPurchasedAt;
        const pymeth  = userMeta?.extraLimitsPaymentMethod;
        const fmtD    = iso => iso ? new Date(iso).toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"}) : "—";
        return (
          <div className="rounded-2xl p-4" style={{ background: expired ? "rgba(248,113,113,0.05)" : "rgba(245,158,11,0.05)", border: `1.5px solid ${expired ? "rgba(248,113,113,0.3)" : "rgba(245,158,11,0.3)"}` }}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-base">{expired ? "⏰" : "✅"}</span>
              <p className="text-sm font-black" style={{ color: expired ? "#f87171" : "#fbbf24" }}>
                {expired ? "Add-on Expired" : `Active Add-on — ${dLeft}d left`}
              </p>
              <div className="ml-auto flex gap-3 text-xs text-gray-300 flex-wrap">
                {purchAt && <span>Purchased: <span className="text-gray-300 font-medium">{fmtD(purchAt)}</span>{pymeth ? ` · ${pymeth === "online" ? "🌐 Online" : pymeth === "cheque" ? "🧾 Cheque" : "💵 Cash"}` : ""}</span>}
                {exp     && <span>Expires: <span className="font-medium" style={{ color: expired ? "#f87171" : "#fbbf24" }}>{fmtD(userMeta.extraLimitsExpiresAt)}</span></span>}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {ADDON_CATS.filter(cat => (existingLims[cat.limitKey] || 0) > 0).map(cat => (
                <div key={cat.limitKey} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", opacity: expired ? 0.55 : 1 }}>
                  <span className="text-sm">{cat.icon}</span>
                  <div className="min-w-0">
                    <p className="text-gray-300 text-[10px] truncate">{cat.label}</p>
                    <p className="font-black text-sm" style={{ color: expired ? "#f87171" : "#fbbf24" }}>+{(existingLims[cat.limitKey]||0).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {(existingLims["extraUsers"] || 0) > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", opacity: expired ? 0.55 : 1 }}>
                  <span className="text-sm">🧑‍💼</span>
                  <div className="min-w-0">
                    <p className="text-gray-300 text-[10px] truncate">Extra User Seats</p>
                    <p className="font-black text-sm" style={{ color: expired ? "#f87171" : "#6366f1" }}>+{(existingLims["extraUsers"]||0).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Add new quota — per category — 2 column grid */}
      <div className="flex flex-col gap-4">
        <p className="text-gray-300 text-[11px] uppercase tracking-widest font-bold">⚡ Add New Quota</p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {ADDON_CATS.map(cat => {
          const adding = Number(addQtys[cat.limitKey]) || 0;
          const cost   = adding > 0 ? priceForQty(cat, adding) : 0;
          return (
            <div key={cat.limitKey} className="rounded-2xl p-4"
              style={{ background: adding > 0 ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${adding > 0 ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.07)"}` }}>
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{cat.icon}</span>
                <p className="text-gray-200 text-sm font-bold flex-1">{cat.label}</p>
                {cost > 0 && <span className="text-amber-300 font-black text-sm">Rs. {cost.toLocaleString()}</span>}
              </div>

              {/* Package buttons */}
              <div className="flex flex-wrap gap-2 mb-3">
                {/* Per-unit info */}
                <div className="px-2.5 py-1.5 rounded-lg text-[10px]"
                  style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#6b7280" }}>
                  Per unit: Rs.{p[cat.perUnitKey] ?? cat.defaultPerUnit}
                </div>
                {cat.packages.map(pkg => {
                  const pkgPrice = p[pkg.key] ?? pkg.def;
                  const isSelected = adding === pkg.qty;
                  return (
                    <button key={pkg.key} type="button"
                      onClick={() => setAddQtys(prev => ({ ...prev, [cat.limitKey]: String(adding === pkg.qty ? 0 : pkg.qty) }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-[1.03]"
                      style={{ background: isSelected ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${isSelected ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`, color: isSelected ? "#fbbf24" : "#9ca3af" }}>
                      +{pkg.qty.toLocaleString()}
                      <span className="ml-1 text-[10px] opacity-70">Rs.{pkgPrice.toLocaleString()}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom qty input */}
              <div className="flex items-center gap-3">
                <span className="text-gray-300 text-xs w-24 flex-shrink-0">Custom qty:</span>
                <button type="button" onClick={() => setAddQtys(prev => ({ ...prev, [cat.limitKey]: String(Math.max(0, adding - 1)) }))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.25)", color:"#fbbf24" }}>−</button>
                <input type="number" min="0" value={addQtys[cat.limitKey]}
                  onChange={e => setAddQtys(prev => ({ ...prev, [cat.limitKey]: String(Math.max(0, Number(e.target.value.replace(/[^0-9]/g,""))||0)) }))}
                  className="flex-1 text-center font-bold text-sm outline-none"
                  style={{ background:"rgba(245,158,11,0.06)", border:`1.5px solid ${adding>0?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.08)"}`, borderRadius:8, padding:"6px", color: adding>0?"#fbbf24":"#6b7280", MozAppearance:"textfield" }} />
                <button type="button" onClick={() => setAddQtys(prev => ({ ...prev, [cat.limitKey]: String(adding + 1) }))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.25)", color:"#fbbf24" }}>+</button>
                {adding > 0 && (
                  <button type="button" onClick={() => setAddQtys(prev => ({ ...prev, [cat.limitKey]: "0" }))}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
                    style={{ background:"rgba(248,113,113,0.12)", border:"1px solid rgba(248,113,113,0.25)", color:"#f87171" }}>✕</button>
                )}
                <div className="text-gray-300 text-[10px] flex-shrink-0">
                  Existing: <span className="text-gray-300 font-bold">{existingLims[cat.limitKey]||0}</span>
                  {adding > 0 && <> → Total: <span className="text-emerald-400 font-bold">{(existingLims[cat.limitKey]||0)+adding}</span></>}
                </div>
              </div>
            </div>
          );
        })}
        </div>{/* end grid */}

        {/* ── Extra User Seats card ── */}
        {(() => {
          const adding    = Number(addQtys["extraUsers"]) || 0;
          const perPrice  = p["extraUser_monthly"] ?? 1000;
          const cost      = adding * perPrice;
          const presets   = [1, 2, 3, 5, 10];
          return (
            <div className="rounded-2xl p-4"
              style={{ background: adding > 0 ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.02)", border: `1px solid ${adding > 0 ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.07)"}` }}>
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🧑‍💼</span>
                <p className="text-gray-200 text-sm font-bold flex-1">Extra User Seats</p>
                {cost > 0 && <span className="text-indigo-300 font-black text-sm">Rs. {cost.toLocaleString()}</span>}
              </div>
              <p className="text-gray-300 text-[10px] mb-3">Flat rate: Rs.{perPrice.toLocaleString()} / user / month. User ka maxDevices bhi automatically update hoga.</p>

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-2 mb-3">
                {presets.map(n => {
                  const isSel = adding === n;
                  return (
                    <button key={n} type="button"
                      onClick={() => setAddQtys(prev => ({ ...prev, extraUsers: String(adding === n ? 0 : n) }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-[1.03]"
                      style={{ background: isSel ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${isSel ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`, color: isSel ? "#a5b4fc" : "#9ca3af" }}>
                      +{n} {n === 1 ? "user" : "users"}
                      <span className="ml-1 text-[10px] opacity-70">Rs.{(n * perPrice).toLocaleString()}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom qty input */}
              <div className="flex items-center gap-3">
                <span className="text-gray-300 text-xs w-24 flex-shrink-0">Custom qty:</span>
                <button type="button" onClick={() => setAddQtys(prev => ({ ...prev, extraUsers: String(Math.max(0, adding - 1)) }))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.25)", color:"#a5b4fc" }}>−</button>
                <input type="number" min="0" value={addQtys["extraUsers"]}
                  onChange={e => setAddQtys(prev => ({ ...prev, extraUsers: String(Math.max(0, Number(e.target.value.replace(/[^0-9]/g,""))||0)) }))}
                  className="flex-1 text-center font-bold text-sm outline-none"
                  style={{ background:"rgba(99,102,241,0.06)", border:`1.5px solid ${adding>0?"rgba(99,102,241,0.4)":"rgba(255,255,255,0.08)"}`, borderRadius:8, padding:"6px", color: adding>0?"#a5b4fc":"#6b7280", MozAppearance:"textfield" }} />
                <button type="button" onClick={() => setAddQtys(prev => ({ ...prev, extraUsers: String(adding + 1) }))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.25)", color:"#a5b4fc" }}>+</button>
                {adding > 0 && (
                  <button type="button" onClick={() => setAddQtys(prev => ({ ...prev, extraUsers: "0" }))}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
                    style={{ background:"rgba(248,113,113,0.12)", border:"1px solid rgba(248,113,113,0.25)", color:"#f87171" }}>✕</button>
                )}
                <div className="text-gray-300 text-[10px] flex-shrink-0">
                  Existing: <span className="text-gray-300 font-bold">{existingLims["extraUsers"]||0}</span>
                  {adding > 0 && <> → Total: <span className="text-indigo-400 font-bold">{(existingLims["extraUsers"]||0)+adding}</span></>}
                </div>
              </div>
            </div>
          );
        })()}
      </div>{/* end flex-col gap-4 */}

      {/* Grand total + payment */}
      {grandTotal > 0 && (
        <div className="rounded-2xl p-4" style={{ background:"rgba(245,158,11,0.07)", border:"1.5px solid rgba(245,158,11,0.3)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">Total Amount</p>
              <p className="text-amber-300 text-[11px] mt-0.5">{lines.length} category · 1 month validity</p>
            </div>
            <p className="text-amber-300 font-black text-2xl">Rs. {grandTotal.toLocaleString()}</p>
          </div>
          <p className="text-gray-300 text-[10px] uppercase tracking-widest font-bold mb-2">💳 Payment Method</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[{id:"online",label:"🌐 Online",desc:"Card / Bank"},{id:"cash",label:"💵 Cash",desc:"Naqad"},{id:"cheque",label:"🧾 Cheque",desc:"Cheque"}].map(opt => (
              <button key={opt.id} type="button" onClick={() => setPayMethod(opt.id)}
                className="flex flex-col items-start px-3 py-2 rounded-xl text-left transition-all"
                style={{ background: payMethod===opt.id?"rgba(245,158,11,0.18)":"rgba(255,255,255,0.03)", border:`1.5px solid ${payMethod===opt.id?"#F59E0B":"rgba(255,255,255,0.08)"}` }}>
                <span className="text-xs font-bold" style={{ color:payMethod===opt.id?"#fbbf24":"#9ca3af" }}>{opt.label}</span>
                <span className="text-[10px]" style={{ color:payMethod===opt.id?"#d1d5db":"#4b5563" }}>{opt.desc}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setConfirm(true)} disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.01]"
            style={{ background:"linear-gradient(135deg,#F59E0B,#D97706)", color:"#000", boxShadow:"0 4px 16px rgba(245,158,11,0.35)", opacity:saving?0.7:1 }}>
            {done ? "✅ Saved!" : saving ? "Saving..." : "⚡ Activate Add-on & Send Invoice"}
          </button>
        </div>
      )}

      {/* Confirm popup */}
      {confirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background:"rgba(0,0,0,0.85)", backdropFilter:"blur(10px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background:"#0d1117", border:"1.5px solid rgba(245,158,11,0.45)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div className="px-6 pt-6 pb-4 text-center" style={{ background:"linear-gradient(135deg,rgba(245,158,11,0.1),transparent)" }}>
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="text-white font-black text-lg">Confirm Add-on</h3>
              <p className="text-gray-300 text-sm mt-1">{user?.name} ke liye activate karein?</p>
            </div>
            <div className="px-6 py-4 flex flex-col gap-1.5">
              {lines.map(l => (
                <div key={l.cat.limitKey} className="flex items-center gap-2 py-1.5" style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-sm">{l.cat.icon}</span>
                  <span className="text-gray-300 text-xs flex-1">{l.cat.label}</span>
                  <span className="text-gray-300 text-xs">+{l.adding}</span>
                  <span className="text-amber-300 text-xs font-bold">Rs. {l.total.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <span className="text-gray-300 text-xs font-bold uppercase tracking-widest">Total</span>
                <span className="text-amber-300 font-black text-base">Rs. {grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg mt-1" style={{ background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.2)" }}>
                <span className="text-amber-400 text-xs">⏰</span>
                <p className="text-amber-400 text-[11px]">1 month validity — {payMethod === "online" ? "🌐 Online" : payMethod === "cheque" ? "🧾 Cheque" : "💵 Cash"}</p>
              </div>
              {user?.email && <p className="text-blue-400 text-[11px] text-center">✉️ Invoice will be sent to {user.email}</p>}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button type="button" onClick={() => setConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>Cancel</button>
              <button type="button" onClick={doSave}
                className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background:"linear-gradient(135deg,#F59E0B,#D97706)", color:"#000" }}>✓ Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Success popup */}
      {success && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background:"rgba(0,0,0,0.85)", backdropFilter:"blur(12px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background:"#0d1117", border:"1.5px solid rgba(245,158,11,0.5)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:5, background:"linear-gradient(to right,#F59E0B,#fbbf24)" }} />
            <div className="px-6 pt-6 pb-3 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-3xl mx-auto mb-3" style={{ background:"rgba(245,158,11,0.15)", border:"2px solid rgba(245,158,11,0.4)" }}>✅</div>
              <h3 className="text-white font-black text-xl">Add-on Activated!</h3>
              <p className="text-gray-300 text-sm mt-1">{user?.name}&apos;s extra quota is now active.</p>
            </div>
            <div className="px-6 py-3 mx-2 rounded-xl mb-4" style={{ background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.2)" }}>
              {success.lines.map(l => (
                <div key={l.cat.limitKey} className="flex items-center justify-between py-1.5" style={{ borderBottom:"1px solid rgba(245,158,11,0.1)" }}>
                  <span className="text-gray-300 text-[11px]">{l.cat.icon} +{l.adding} {l.cat.label}</span>
                  <span className="text-amber-300 text-xs font-bold">Rs. {l.total.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-1.5" style={{ borderBottom:"1px solid rgba(245,158,11,0.1)" }}>
                <span className="text-gray-300 text-[11px] uppercase font-bold">Total Paid</span>
                <span className="text-amber-300 font-black">Rs. {success.grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-gray-300 text-[11px] uppercase font-bold">Expires On</span>
                <span className="text-amber-300 text-xs font-semibold">⏰ {new Date(success.expiresAt).toLocaleDateString("en-PK",{day:"2-digit",month:"long",year:"numeric"})}</span>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button type="button" onClick={() => setSuccess(null)}
                className="w-full py-3 rounded-xl text-sm font-black"
                style={{ background:"linear-gradient(135deg,#F59E0B,#D97706)", color:"#000" }}>Done ✓</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   BACKUP TAB — Admin can export / restore any user's data
══════════════════════════════════════════════════════════════════════ */
function BackupTab({ uid: targetUid, userName, getToken }) {
  const fileInputRef = useRef(null);
  // export
  const [exporting,   setExporting]   = useState(false);
  const [exportMsg,   setExportMsg]   = useState({ type:"", text:"" });
  const [exportProg,  setExportProg]  = useState(0);
  const [exportLabel, setExportLabel] = useState("");
  // folder
  const [dirHandle,   setDirHandle]   = useState(null);
  const [folderName,  setFolderName]  = useState("");
  const [folderModal, setFolderModal] = useState(false); // ask same/new
  const pendingRef = useRef(null); // { json, fileName, docCount }
  // restore
  const [restoring,    setRestoring]    = useState(false);
  const [restoreMsg,   setRestoreMsg]   = useState({ type:"", text:"" });
  const [restoreProg,  setRestoreProg]  = useState(0);
  const [restoreLabel, setRestoreLabel] = useState("");
  const [modalStep,    setModalStep]    = useState(null);
  const [pendingFile,  setPendingFile]  = useState(null);
  const [fileInfo,     setFileInfo]     = useState(null);

  const FLAT_COLS = [
    "invoices","customers","products","payments","purchases",
    "suppliers","supplierPayments","supplierReceipts","supplierReturns",
    "expenses","quotations",
  ];
  const SUPPLIER_NESTED = ["orders","payments","receipts","returns"];
  const CUSTOMER_NESTED = ["invoices"];

  // ── Auto-backup state ──────────────────────────────────────────────────────
  const [autoEnabled,    setAutoEnabled]    = useState(false);
  const [autoIntervalId, setAutoIntervalId] = useState("daily");
  const [autoNextAt,     setAutoNextAt]     = useState(null);
  const [autoMsg,        setAutoMsg]        = useState({ type:"", text:"" });
  const [countdown,      setCountdown]      = useState("");
  const [autoDestModal,  setAutoDestModal]  = useState(false);
  const autoTimerRef   = useRef(null);
  const autoNextAtRef  = useRef(null);
  const folderPurposeRef = useRef("manual"); // "manual" | "auto-enable"

  // ── History state ──────────────────────────────────────────────────────────
  const [history, setHistory] = useState([]);

  // ── Password protection ──────────────────────────────────────────────────────
  const [pwModal,    setPwModal]    = useState("idle");
  const [pwInput,    setPwInput]    = useState("");
  const [pwConfirm,  setPwConfirm]  = useState("");
  const [pwShow,     setPwShow]     = useState(false);
  const [pwError,    setPwError]    = useState("");
  const pwPendingRef = useRef(null);
  const pwRestoreRef = useRef(null);

  // ── Per-user IDB keys ──────────────────────────────────────────────────────
  const IDB_AUTO_KEY  = `adminBackup_auto_${targetUid}`;
  const IDB_HIST_KEY  = `adminBackup_hist_${targetUid}`;
  const IDB_DIR_KEY   = `adminBackup_dir_${targetUid}`;

  // ── Auto-backup intervals ──────────────────────────────────────────────────
  const AUTO_INTERVALS = [
    { id:"1h",      label:"Every 1 Hour",   ms: 1  * 60 * 60 * 1000 },
    { id:"6h",      label:"Every 6 Hours",  ms: 6  * 60 * 60 * 1000 },
    { id:"12h",     label:"Every 12 Hours", ms: 12 * 60 * 60 * 1000 },
    { id:"daily",   label:"Daily (24 hrs)", ms: 24 * 60 * 60 * 1000 },
    { id:"weekly",  label:"Weekly",         ms: 7  * 24 * 60 * 60 * 1000 },
    { id:"monthly", label:"Monthly (30d)",  ms: 30 * 24 * 60 * 60 * 1000 },
  ];

  function fmtDTLocal(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  function serDoc(id, data) {
    const out = { _id: id };
    for (const [k, v] of Object.entries(data)) {
      out[k] = v && typeof v.toDate === "function" ? { _type:"Timestamp", _ms: v.toDate().getTime() } : v;
    }
    return out;
  }

  function deserDoc(obj) {
    const { _id, ...rest } = obj;
    const out = {};
    for (const [k, v] of Object.entries(rest)) {
      out[k] = v && typeof v === "object" && v._type === "Timestamp" ? new Date(v._ms) : v;
    }
    return { id: _id, data: out };
  }

  // ── The rest of this component is defined below ──

  // ── IDB helpers (reuse novexa_backup store, per-user keys) ────────────────
  function openBtIDB() {
    return new Promise((res, rej) => {
      const req = indexedDB.open("novexa_backup", 2);
      req.onupgradeneeded = (e) => { if (!e.target.result.objectStoreNames.contains("handles")) e.target.result.createObjectStore("handles"); };
      req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
    });
  }
  async function btIdbPut(key, val) { try { const db = await openBtIDB(); const tx = db.transaction("handles","readwrite"); tx.objectStore("handles").put(val,key); await new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=j;}); } catch {} }
  async function btIdbGet(key) { try { const db = await openBtIDB(); const tx = db.transaction("handles","readonly"); const req = tx.objectStore("handles").get(key); return await new Promise(r=>{req.onsuccess=()=>r(req.result??null);req.onerror=()=>r(null);}); } catch { return null; } }
  async function btIdbDel(key) { try { const db = await openBtIDB(); const tx = db.transaction("handles","readwrite"); tx.objectStore("handles").delete(key); } catch {} }

  function fmtCd(ms) {
    if (ms <= 0) return "now";
    const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60),d=Math.floor(h/24);
    if (d>0) return `${d}d ${h%24}h`; if (h>0) return `${h}h ${m%60}m`; if (m>0) return `${m}m ${s%60}s`; return `${s}s`;
  }

  // ── Load saved state on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("showDirectoryPicker" in window) {
      btIdbGet(IDB_DIR_KEY).then(h => { if (h) { setDirHandle(h); setFolderName(h.name || "Saved Folder"); } });
    }
    btIdbGet(IDB_AUTO_KEY).then(s => {
      if (s?.intervalId) { setAutoEnabled(true); setAutoIntervalId(s.intervalId); setAutoNextAt(s.nextAt); autoNextAtRef.current = s.nextAt; }
    });
    btIdbGet(IDB_HIST_KEY).then(h => { if (Array.isArray(h)) setHistory(h); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUid]);

  // ── Auto countdown + fire ──────────────────────────────────────────────────
  useEffect(() => {
    if (autoTimerRef.current) { clearInterval(autoTimerRef.current); autoTimerRef.current = null; }
    if (!autoEnabled || !autoNextAt) { setCountdown(""); return; }
    const tick = () => {
      const rem = (autoNextAtRef.current||0) - Date.now();
      setCountdown(fmtCd(rem));
      if (rem <= 0) {
        runAutoBackupSilent();
        const ms = AUTO_INTERVALS.find(i=>i.id===autoIntervalId)?.ms || 24*3600*1000;
        const next = Date.now()+ms; autoNextAtRef.current=next; setAutoNextAt(next);
        btIdbPut(IDB_AUTO_KEY, {intervalId:autoIntervalId, nextAt:next});
      }
    };
    tick(); autoTimerRef.current = setInterval(tick, 1000);
    return () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnabled, autoNextAt, autoIntervalId]);

  // ── History helpers ────────────────────────────────────────────────────────
  async function addHistEntry(fileName, docCount, type) {
    const entry = { at: new Date().toISOString(), fileName, docCount, type };
    const cur = await btIdbGet(IDB_HIST_KEY);
    const arr = Array.isArray(cur) ? [entry,...cur].slice(0,50) : [entry];
    await btIdbPut(IDB_HIST_KEY, arr); setHistory(arr);
  }

  async function doAutoExport(dh) {
    const { collection: col, getDocs } = await import("firebase/firestore");
    const { db: fdb } = await import("@/lib/firebase");
    const backup = { version:2, exportedAt:new Date().toISOString(), uid:targetUid, collections:{} };
    for (const colId of FLAT_COLS) { try { const s=await getDocs(col(fdb,"users",targetUid,colId)); backup.collections[colId]=s.docs.map(d=>serDoc(d.id,d.data())); } catch {} }
    backup.customerNested = {};
    const cSnap = await getDocs(col(fdb,"users",targetUid,"customers"));
    for (const cd of cSnap.docs) { backup.customerNested[cd.id]={}; for (const sub of CUSTOMER_NESTED) { try { const ss=await getDocs(col(fdb,"users",targetUid,"customers",cd.id,sub)); if(ss.docs.length) backup.customerNested[cd.id][sub]=ss.docs.map(d=>serDoc(d.id,d.data())); } catch {} } }
    backup.supplierNested = {};
    const sSnap = await getDocs(col(fdb,"users",targetUid,"suppliers"));
    for (const sd of sSnap.docs) { backup.supplierNested[sd.id]={}; for (const sub of SUPPLIER_NESTED) { try { const ss=await getDocs(col(fdb,"users",targetUid,"suppliers",sd.id,sub)); if(ss.docs.length) backup.supplierNested[sd.id][sub]=ss.docs.map(d=>serDoc(d.id,d.data())); } catch {} } }
    let totalDocs=0;
    Object.values(backup.collections).forEach(a=>{totalDocs+=a.length;});
    if(backup.customerNested) Object.values(backup.customerNested).forEach(s=>Object.values(s).forEach(a=>{totalDocs+=a.length;}));
    if(backup.supplierNested) Object.values(backup.supplierNested).forEach(s=>Object.values(s).forEach(a=>{totalDocs+=a.length;}));
    const json=JSON.stringify(backup,null,2);
    const now=new Date(); const baseFileName=`novexa-backup-${targetUid.slice(0,8)}-${now.toISOString().split("T")[0]}_${now.toTimeString().slice(0,8).replace(/:/g,"-")}`;
    // Always encrypt auto-backups with default hidden key
    const savedName = await writeToDirEncrypted(dh, json, baseFileName, NOVEXA_DEFAULT_KEY);
    await addHistEntry(savedName, totalDocs, "auto");
    return { fileName: savedName, totalDocs };
  }

  async function runAutoBackupSilent() {
    const dh = dirHandle; if (!dh) return;
    try {
      const perm = await dh.requestPermission({ mode:"readwrite" });
      if (perm!=="granted") { setAutoMsg({type:"error",text:"Auto-backup failed: folder permission denied."}); return; }
      const { fileName, totalDocs } = await doAutoExport(dh);
      setAutoMsg({type:"success",text:`Auto backup saved: ${fileName} (${totalDocs.toLocaleString()} records)`});
    } catch(err) { setAutoMsg({type:"error",text:"Auto backup failed: "+err.message}); }
  }

  // ── Auto enable/disable ────────────────────────────────────────────────────
  function handleEnableAuto() {
    if (!("showDirectoryPicker" in window)) { setAutoMsg({type:"error",text:"Auto-backup requires File System Access API support."}); return; }
    if (dirHandle) { setAutoDestModal(true); }
    else { activateAutoNewFolder(); }
  }

  async function activateAutoSameFolder() {
    setAutoDestModal(false);
    try { const p=await dirHandle.requestPermission({mode:"readwrite"}); if(p!=="granted") throw new Error("Permission denied."); commitAutoEnable(dirHandle); }
    catch(err) { setAutoMsg({type:"error",text:"Folder error: "+err.message}); }
  }

  async function activateAutoNewFolder() {
    setAutoDestModal(false);
    try {
      const dh=await window.showDirectoryPicker({mode:"readwrite"});
      setDirHandle(dh); setFolderName(dh.name||"Saved Folder"); await btIdbPut(IDB_DIR_KEY, dh);
      commitAutoEnable(dh);
    } catch(err) { if(err.name!=="AbortError") setAutoMsg({type:"error",text:"Folder error: "+err.message}); }
  }

  function commitAutoEnable(dh) {
    const ms=AUTO_INTERVALS.find(i=>i.id===autoIntervalId)?.ms||24*3600*1000;
    const nextAt=Date.now()+ms; autoNextAtRef.current=nextAt;
    setAutoNextAt(nextAt); setAutoEnabled(true);
    btIdbPut(IDB_AUTO_KEY, {intervalId:autoIntervalId, nextAt});
    setAutoMsg({type:"success",text:`Auto-backup enabled. First backup in ${fmtCd(ms)}.`});
    if (dh && dh!==dirHandle) { setDirHandle(dh); setFolderName(dh.name||"Saved Folder"); }
  }

  function handleDisableAuto() {
    setAutoEnabled(false); setAutoNextAt(null); autoNextAtRef.current=null;
    setCountdown(""); setAutoMsg({type:"",text:""}); btIdbDel(IDB_AUTO_KEY);
  }

  async function doExport() {
    setExporting(true); setExportMsg({ type:"", text:"" }); setExportProg(0);
    try {
      // ── Step 1: Pick folder FIRST (while still in user gesture) ──────────
      let dh = dirHandle;
      if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
        if (!dh) {
          // No saved folder — open picker NOW (still inside click gesture)
          try {
            dh = await window.showDirectoryPicker({ mode: "readwrite" });
            setDirHandle(dh); setFolderName(dh.name || "Saved Folder");
            await btIdbPut(IDB_DIR_KEY, dh);
          } catch (err) {
            if (err.name !== "AbortError")
              setExportMsg({ type:"error", text:"Folder error: " + err.message });
            setExporting(false); setExportProg(0); setExportLabel("");
            return;
          }
        } else {
          // Saved folder exists — verify permission NOW (still in gesture)
          try {
            const perm = await dh.requestPermission({ mode:"readwrite" });
            if (perm !== "granted") throw new Error("Folder permission was not granted.");
          } catch (err) {
            // Permission denied — ask to pick new folder (still in gesture)
            try {
              dh = await window.showDirectoryPicker({ mode: "readwrite" });
              setDirHandle(dh); setFolderName(dh.name || "Saved Folder");
              await btIdbPut(IDB_DIR_KEY, dh);
            } catch (e2) {
              if (e2.name !== "AbortError")
                setExportMsg({ type:"error", text:"Folder error: " + e2.message });
              setExporting(false); setExportProg(0); setExportLabel("");
              return;
            }
          }
        }
      }

      // ── Step 2: Now read Firestore data ───────────────────────────────────
      const { collection: col, getDocs } = await import("firebase/firestore");
      const { db: fdb } = await import("@/lib/firebase");
      const backup = { version: 2, exportedAt: new Date().toISOString(), uid: targetUid, collections: {} };
      const total = FLAT_COLS.length + 2;
      let done = 0;
      for (const colId of FLAT_COLS) {
        setExportLabel(`Reading ${colId}...`); setExportProg(Math.round((done/total)*100));
        const snap = await getDocs(col(fdb, "users", targetUid, colId));
        backup.collections[colId] = snap.docs.map(d => serDoc(d.id, d.data()));
        done++;
      }
      setExportLabel("Reading customer invoices..."); setExportProg(Math.round((done/total)*100));
      backup.customerNested = {};
      const custSnap = await getDocs(col(fdb, "users", targetUid, "customers"));
      for (const custDoc of custSnap.docs) {
        backup.customerNested[custDoc.id] = {};
        for (const sub of CUSTOMER_NESTED) {
          const subSnap = await getDocs(col(fdb, "users", targetUid, "customers", custDoc.id, sub));
          if (subSnap.docs.length) backup.customerNested[custDoc.id][sub] = subSnap.docs.map(d => serDoc(d.id, d.data()));
        }
      }
      done++;
      setExportLabel("Reading supplier data..."); setExportProg(Math.round((done/total)*100));
      backup.supplierNested = {};
      const supSnap = await getDocs(col(fdb, "users", targetUid, "suppliers"));
      for (const supDoc of supSnap.docs) {
        backup.supplierNested[supDoc.id] = {};
        for (const sub of SUPPLIER_NESTED) {
          const subSnap = await getDocs(col(fdb, "users", targetUid, "suppliers", supDoc.id, sub));
          if (subSnap.docs.length) backup.supplierNested[supDoc.id][sub] = subSnap.docs.map(d => serDoc(d.id, d.data()));
        }
      }
      done++;
      setExportLabel("Done!"); setExportProg(100);
      let totalDocs = 0;
      Object.values(backup.collections).forEach(a => { totalDocs += a.length; });
      if (backup.customerNested) Object.values(backup.customerNested).forEach(s => Object.values(s).forEach(a => { totalDocs += a.length; }));
      if (backup.supplierNested) Object.values(backup.supplierNested).forEach(s => Object.values(s).forEach(a => { totalDocs += a.length; }));
      const json = JSON.stringify(backup, null, 2);
      const now = new Date();
      const fileName = `novexa-backup-${targetUid.slice(0,8)}-${now.toISOString().split("T")[0]}_${now.toTimeString().slice(0,8).replace(/:/g,"-")}.json`;

      // ── Step 3: Write to folder or download ───────────────────────────────
      if (dh) {
        askPasswordThenWrite(dh, json, fileName, totalDocs, "manual");
        setExporting(false); setExportProg(0); setExportLabel("");
        return;
      }

      // Fallback: browser download (encrypted with default key)
      const encName   = encryptedFileName(fileName.replace(/\.json$/, ""));
      const buffer    = await encryptJson(json, NOVEXA_DEFAULT_KEY);
      const blob      = new Blob([buffer], { type: "application/octet-stream" });
      const url       = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = encName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setExportMsg({ type:"success", text:`✅ Downloaded! ${totalDocs.toLocaleString()} records.` });
      await addHistEntry(encName, totalDocs, "manual");
    } catch (err) { setExportMsg({ type:"error", text:"Export failed: " + err.message }); }
    setExporting(false); setExportProg(0); setExportLabel("");
  }

  // ── Folder helpers ────────────────────────────────────────────────────────
  async function openNewFolderPicker(pending) {
    try {
      const dh = await window.showDirectoryPicker({ mode: "readwrite" });
      setDirHandle(dh); setFolderName(dh.name || "Saved Folder");
      await btIdbPut(IDB_DIR_KEY, dh);
      askPasswordThenWrite(dh, pending.json, pending.fileName, pending.totalDocs, "manual");
    } catch (err) {
      if (err.name !== "AbortError") setExportMsg({ type:"error", text:"Folder error: " + err.message });
      pendingRef.current = null;
    }
  }

  async function useSameFolder() {
    setFolderModal(false);
    const p = pendingRef.current; if (!p || !dirHandle) return;
    pendingRef.current = null;
    try {
      const perm = await dirHandle.requestPermission({ mode:"readwrite" });
      if (perm !== "granted") throw new Error("Permission denied.");
      askPasswordThenWrite(dirHandle, p.json, p.fileName, p.totalDocs, "manual");
    } catch (err) {
      if (err.name !== "AbortError") setExportMsg({ type:"error", text:"Folder error: " + err.message });
    }
  }

  async function chooseNewFolder() {
    setFolderModal(false);
    const p = pendingRef.current; if (!p) return;
    pendingRef.current = null;
    await openNewFolderPicker(p);
  }

  async function writeToDirHandle(dh, json, fileName) {
    const fh = await dh.getFileHandle(fileName, { create: true });
    const w  = await fh.createWritable();
    await w.write(json); await w.close();
  }

  async function writeToDirEncrypted(dh, json, baseFileName, password) {
    const encFileName = encryptedFileName(baseFileName);
    const buffer = await encryptJson(json, password);
    const fh = await dh.getFileHandle(encFileName, { create: true });
    const w  = await fh.createWritable();
    await w.write(buffer); await w.close();
    return encFileName;
  }

  function askPasswordThenWrite(dh, json, fileName, totalDocs, type) {
    pwPendingRef.current = { dh, json, fileName, totalDocs, type };
    setPwInput(""); setPwConfirm(""); setPwError(""); setPwShow(false);
    setPwModal("ask");
  }

  async function handleAskSkip() {
    setPwModal("idle");
    const { dh, json, fileName, totalDocs, type } = pwPendingRef.current || {};
    if (!json || !dh) return;
    setExporting(true);
    try {
      // Always encrypt with default hidden key — same as BackupView "skip password" flow
      const savedName = await writeToDirEncrypted(dh, json, fileName, NOVEXA_DEFAULT_KEY);
      setExportMsg({ type:"success", text:`✅ Saved to "${dh.name}" — ${totalDocs?.toLocaleString()} records.` });
      await addHistEntry(savedName, totalDocs, type || "manual");
    } catch (err) {
      setExportMsg({ type:"error", text:"Save failed: " + err.message });
    }
    setExporting(false); pwPendingRef.current = null;
  }

  async function handlePwSet() {
    if (!pwInput) { setPwError("Please enter a password."); return; }
    if (pwInput !== pwConfirm) { setPwError("Passwords don't match."); return; }
    if (pwInput.length < 6) { setPwError("Password must be at least 6 characters."); return; }
    setPwModal("idle");
    const { dh, json, fileName, totalDocs, type } = pwPendingRef.current || {};
    if (!json || !dh) return;
    setExporting(true);
    try {
      const savedName = await writeToDirEncrypted(dh, json, fileName, pwInput);
      setExportMsg({
        type:"success",
        text:`🔐 Encrypted backup saved as "${savedName}" (${totalDocs?.toLocaleString()} records). Restore via "Select Backup File" on this page.`,
      });
      await addHistEntry(savedName, totalDocs, type || "manual");
    } catch (err) {
      setExportMsg({ type:"error", text:"Encrypted save failed: " + err.message });
    }
    setExporting(false); pwPendingRef.current = null;
    setPwInput(""); setPwConfirm("");
  }

  async function handlePwEnter() {
    if (!pwInput) { setPwError("Please enter the password."); return; }
    setPwError("");
    const { rawBuffer, fileName } = pwRestoreRef.current || {};
    if (!rawBuffer) return;
    try {
      const json = await decryptFile(rawBuffer, pwInput);
      const parsed = JSON.parse(json);
      setPwModal("idle"); setPwInput("");
      processBackupFile(parsed, fileName);
    } catch {
      setPwError("Wrong password or corrupted file. Please try again.");
    }
  }

  function processBackupFile(parsed, fileName) {
    if (!parsed?.version || !parsed?.collections) {
      setRestoreMsg({ type:"error", text:"Invalid backup file. Select a valid Novexa backup." }); return;
    }
    let count = 0;
    Object.values(parsed.collections).forEach(a => { count += a?.length || 0; });
    if (parsed.customerNested) Object.values(parsed.customerNested).forEach(s => Object.values(s).forEach(a => { count += a?.length || 0; }));
    if (parsed.supplierNested) Object.values(parsed.supplierNested).forEach(s => Object.values(s).forEach(a => { count += a?.length || 0; }));
    setPendingFile(parsed);
    setFileInfo({ name: fileName, exportedAt: parsed.exportedAt, docCount: count, originalUid: parsed.uid, encrypted: isEncryptedFile(fileName) });
    setRestoreMsg({ type:"", text:"" }); setModalStep("choose");
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";

    if (isEncryptedFile(file.name)) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const rawBuffer = ev.target.result;
        // Try silent default-key decrypt first
        try {
          const json   = await decryptFile(rawBuffer, NOVEXA_DEFAULT_KEY);
          const parsed = JSON.parse(json);
          processBackupFile(parsed, file.name);
          return;
        } catch { /* not default-key — ask user password */ }
        // User-password backup
        pwRestoreRef.current = { rawBuffer, fileName: file.name };
        setPwInput(""); setPwError(""); setPwShow(false);
        setPwModal("enter");
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        processBackupFile(parsed, file.name);
      } catch {
        setRestoreMsg({ type:"error", text:"Error reading file. Select a valid JSON or .novexa backup file." });
      }
    };
    reader.readAsText(file);
  }

  async function executeRestore(mode) {
    setModalStep(null); setRestoring(true); setRestoreMsg({ type:"", text:"" }); setRestoreProg(0);
    try {
      const { collection: col, getDocs, doc: fsDoc, writeBatch } = await import("firebase/firestore");
      const { db: fdb } = await import("@/lib/firebase");

      async function batchWrite(writes) {
        let batch = writeBatch(fdb); let cnt = 0;
        for (const { ref, data } of writes) {
          batch.set(ref, data, { merge: false }); cnt++;
          if (cnt === 490) { await batch.commit(); batch = writeBatch(fdb); cnt = 0; }
        }
        if (cnt > 0) await batch.commit();
      }
      async function batchDel(refs) {
        let batch = writeBatch(fdb); let cnt = 0;
        for (const ref of refs) {
          batch.delete(ref); cnt++;
          if (cnt === 490) { await batch.commit(); batch = writeBatch(fdb); cnt = 0; }
        }
        if (cnt > 0) await batch.commit();
      }

      const backupDate = pendingFile.exportedAt ? new Date(pendingFile.exportedAt) : new Date(0);
      const allCols = Object.keys(pendingFile.collections);
      const total = allCols.length + 2; let done = 0;

      for (const colId of allCols) {
        setRestoreLabel(`Restoring ${colId}...`); setRestoreProg(Math.round((done/total)*100));
        const bDocs = pendingFile.collections[colId] || [];
        const bIds  = new Set(bDocs.map(d => d._id));
        if (mode === "replace") {
          const live = await getDocs(col(fdb, "users", targetUid, colId));
          const del  = live.docs.filter(d => !bIds.has(d.id)).map(d => fsDoc(fdb, "users", targetUid, colId, d.id));
          if (del.length) await batchDel(del);
        } else {
          const live = await getDocs(col(fdb, "users", targetUid, colId));
          const del  = live.docs.filter(d => {
            if (bIds.has(d.id)) return false;
            const ct = d.data().createdAt;
            const ms = ct?.toDate ? ct.toDate().getTime() : ct ? new Date(ct).getTime() : 0;
            return ms <= backupDate.getTime();
          }).map(d => fsDoc(fdb, "users", targetUid, colId, d.id));
          if (del.length) await batchDel(del);
        }
        const writes = bDocs.map(raw => { const { id, data } = deserDoc(raw); return { ref: fsDoc(fdb, "users", targetUid, colId, id), data }; });
        if (writes.length) await batchWrite(writes);
        done++;
      }

      setRestoreLabel("Restoring customer invoices..."); setRestoreProg(Math.round((done/total)*100));
      if (pendingFile.customerNested) {
        for (const [custId, subs] of Object.entries(pendingFile.customerNested)) {
          for (const [sub, docs] of Object.entries(subs || {})) {
            const bIds = new Set(docs.map(d => d._id));
            if (mode === "replace") {
              const live = await getDocs(col(fdb, "users", targetUid, "customers", custId, sub));
              const del  = live.docs.filter(d => !bIds.has(d.id)).map(d => fsDoc(fdb, "users", targetUid, "customers", custId, sub, d.id));
              if (del.length) await batchDel(del);
            } else {
              const live = await getDocs(col(fdb, "users", targetUid, "customers", custId, sub));
              const del  = live.docs.filter(d => {
                if (bIds.has(d.id)) return false;
                const ct = d.data().createdAt;
                const ms = ct?.toDate ? ct.toDate().getTime() : ct ? new Date(ct).getTime() : 0;
                return ms <= backupDate.getTime();
              }).map(d => fsDoc(fdb, "users", targetUid, "customers", custId, sub, d.id));
              if (del.length) await batchDel(del);
            }
            const writes = docs.map(raw => { const { id, data } = deserDoc(raw); return { ref: fsDoc(fdb, "users", targetUid, "customers", custId, sub, id), data }; });
            if (writes.length) await batchWrite(writes);
          }
        }
      }
      done++;

      setRestoreLabel("Restoring supplier data..."); setRestoreProg(Math.round((done/total)*100));
      if (pendingFile.supplierNested) {
        for (const [supId, subs] of Object.entries(pendingFile.supplierNested)) {
          for (const [sub, docs] of Object.entries(subs || {})) {
            const bIds = new Set(docs.map(d => d._id));
            if (mode === "replace") {
              const live = await getDocs(col(fdb, "users", targetUid, "suppliers", supId, sub));
              const del  = live.docs.filter(d => !bIds.has(d.id)).map(d => fsDoc(fdb, "users", targetUid, "suppliers", supId, sub, d.id));
              if (del.length) await batchDel(del);
            } else {
              const live = await getDocs(col(fdb, "users", targetUid, "suppliers", supId, sub));
              const del  = live.docs.filter(d => {
                if (bIds.has(d.id)) return false;
                const ct = d.data().createdAt;
                const ms = ct?.toDate ? ct.toDate().getTime() : ct ? new Date(ct).getTime() : 0;
                return ms <= backupDate.getTime();
              }).map(d => fsDoc(fdb, "users", targetUid, "suppliers", supId, sub, d.id));
              if (del.length) await batchDel(del);
            }
            const writes = docs.map(raw => { const { id, data } = deserDoc(raw); return { ref: fsDoc(fdb, "users", targetUid, "suppliers", supId, sub, id), data }; });
            if (writes.length) await batchWrite(writes);
          }
        }
      }
      done++;
      setRestoreProg(100);
      const modeLabel = mode === "replace" ? "Full replace" : "Smart merge";

      // ── Auto re-enable Firebase Auth if user was disabled (deleted) ──────
      let reEnableNote = "";
      try {
        const token = await getToken();
        const reRes = await fetch("/api/admin/re-enable-user", {
          method:  "POST",
          headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
          body:    JSON.stringify({ uid: targetUid }),
        });
        const reData = await reRes.json();
        if (reData.success) {
          reEnableNote = " | ✅ Auth re-enabled — user can now log in.";
        }
      } catch {
        reEnableNote = " | ⚠️ Data restored but Auth re-enable failed — manually enable from Firebase Console.";
      }

      setRestoreMsg({ type:"success", text:`✅ ${modeLabel} complete! ${fileInfo?.docCount?.toLocaleString()} records restored to ${userName || targetUid}.${reEnableNote}` });
    } catch (err) { setRestoreMsg({ type:"error", text:"Restore failed: " + err.message }); }
    setRestoring(false); setRestoreProg(0); setRestoreLabel("");
    setPendingFile(null); setFileInfo(null);
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  const cardS = { background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" };

  return (
    <>
      {/* ── Password modals ── */}
      {pwModal === "ask" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(99,102,241,0.4)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔐</span>
                <div>
                  <p className="text-white font-black text-sm">Protect this backup?</p>
                  <p className="text-gray-300 text-xs">Encrypt with a password before saving</p>
                </div>
                <button onClick={() => { setPwModal("idle"); pwPendingRef.current = null; }}
                  className="ml-auto text-gray-300 hover:text-gray-300 text-lg">✕</button>
              </div>
              <div className="rounded-xl px-4 py-3 text-xs leading-relaxed text-gray-300"
                style={{ background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.18)" }}>
                🔒 <span className="text-indigo-300 font-semibold">Encrypted (.novexa)</span> — unlock via restore on this page.<br />
                📄 <span className="text-gray-300 font-semibold">Unencrypted (.json)</span> — plain readable JSON.
              </div>
              <div className="flex gap-3">
                <button onClick={handleAskSkip}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
                  📄 Skip, save plain
                </button>
                <button onClick={() => setPwModal("set")}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black"
                  style={{ background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"#fff" }}>
                  🔐 Yes, add password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pwModal === "set" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(99,102,241,0.4)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔑</span>
                <div>
                  <p className="text-white font-black text-sm">Set Backup Password</p>
                  <p className="text-gray-300 text-xs">AES-256 encryption — remember this password!</p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Password</label>
                <div className="relative">
                  <input type={pwShow ? "text" : "password"} value={pwInput}
                    onChange={e => { setPwInput(e.target.value); setPwError(""); }}
                    onKeyDown={e => e.key === "Enter" && handlePwSet()}
                    placeholder="Enter password (min 6 chars)"
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none pr-10"
                    style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)" }}
                    autoFocus
                  />
                  <button type="button" onClick={() => setPwShow(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-300 text-xs">
                    {pwShow ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Confirm Password</label>
                <input type={pwShow ? "text" : "password"} value={pwConfirm}
                  onChange={e => { setPwConfirm(e.target.value); setPwError(""); }}
                  onKeyDown={e => e.key === "Enter" && handlePwSet()}
                  placeholder="Repeat password"
                  className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                  style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)" }}
                />
              </div>
              {pwError && <p className="text-red-400 text-xs font-semibold">{pwError}</p>}
              <div className="rounded-xl px-3 py-2 text-[11px] text-amber-500"
                style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)" }}>
                ⚠️ If you forget this password, the backup cannot be recovered.
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPwModal("ask")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>← Back</button>
                <button onClick={handlePwSet} className="flex-1 py-2.5 rounded-xl text-sm font-black"
                  style={{ background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"#fff" }}>🔐 Encrypt &amp; Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pwModal === "enter" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(245,158,11,0.35)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#F59E0B,#f97316)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔐</span>
                <div>
                  <p className="text-white font-black text-sm">Encrypted Backup</p>
                  <p className="text-gray-300 text-xs truncate max-w-[180px]">{pwRestoreRef.current?.fileName}</p>
                </div>
                <button onClick={() => { setPwModal("idle"); pwRestoreRef.current = null; }}
                  className="ml-auto text-gray-300 hover:text-gray-300 text-lg">✕</button>
              </div>
              <p className="text-gray-300 text-xs">Enter the password used when creating this backup.</p>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">Password</label>
                <div className="relative">
                  <input type={pwShow ? "text" : "password"} value={pwInput}
                    onChange={e => { setPwInput(e.target.value); setPwError(""); }}
                    onKeyDown={e => e.key === "Enter" && handlePwEnter()}
                    placeholder="Enter backup password"
                    className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none pr-10"
                    style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)" }}
                    autoFocus
                  />
                  <button type="button" onClick={() => setPwShow(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-300 text-xs">
                    {pwShow ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              {pwError && <p className="text-red-400 text-xs font-semibold">{pwError}</p>}
              <button onClick={handlePwEnter} className="w-full py-3 rounded-xl text-sm font-black"
                style={{ background:"linear-gradient(135deg,#F59E0B,#D97706)", color:"#000" }}>
                🔓 Unlock &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Folder ask modal ── */}
      {folderModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.80)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(245,158,11,0.35)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#F59E0B,#f97316)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📁</span>
                <div>
                  <p className="text-white font-black text-sm">Where to save?</p>
                  <p className="text-gray-300 text-xs">A folder is already saved</p>
                </div>
                <button onClick={() => { setFolderModal(false); pendingRef.current = null; }}
                  className="ml-auto text-gray-300 hover:text-gray-300 text-lg">✕</button>
              </div>
              <div className="px-4 py-3 rounded-xl flex items-center gap-3"
                style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)" }}>
                <span className="text-xl">🗂️</span>
                <p className="text-amber-300 font-bold text-sm truncate">{folderName}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={useSameFolder}
                  className="w-full py-3 rounded-xl text-sm font-black"
                  style={{ background:"linear-gradient(135deg,#F59E0B,#D97706)", color:"#000" }}>
                  ✅ Yes, save to this folder
                </button>
                <button onClick={chooseNewFolder}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
                  📂 Choose a different folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Restore mode chooser ── */}
      {modalStep === "choose" && fileInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.80)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(255,255,255,0.1)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#3b82f6,#8b5cf6,#F59E0B)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">♻️</span>
                <div>
                  <p className="text-white font-black text-sm">Choose Restore Mode</p>
                  <p className="text-gray-300 text-xs">Restoring to: <span className="text-amber-300 font-semibold">{userName || targetUid}</span></p>
                </div>
                <button onClick={() => { setModalStep(null); setPendingFile(null); setFileInfo(null); }}
                  className="ml-auto text-gray-300 hover:text-gray-300 text-lg">✕</button>
              </div>
              <div className="rounded-xl px-4 py-3 flex flex-col gap-1.5"
                style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex gap-2 text-xs"><span className="text-gray-300 w-20">File:</span><span className="text-white font-medium truncate">{fileInfo.name}</span>{fileInfo.encrypted && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0" style={{ background:"rgba(99,102,241,0.15)", color:"#818cf8", border:"1px solid rgba(99,102,241,0.3)" }}>🔐 Encrypted</span>}</div>
                <div className="flex gap-2 text-xs"><span className="text-gray-300 w-20">Backup Date:</span><span className="text-amber-300 font-medium">{fmtDTLocal(fileInfo.exportedAt)}</span></div>
                <div className="flex gap-2 text-xs"><span className="text-gray-300 w-20">Records:</span><span className="text-green-400 font-bold">{fileInfo.docCount?.toLocaleString()}</span></div>
                {fileInfo.originalUid && fileInfo.originalUid !== targetUid && (
                  <div className="flex gap-2 text-xs mt-1 px-2 py-1.5 rounded-lg" style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.25)" }}>
                    <span className="text-amber-400">⚠️</span>
                    <span className="text-amber-300 text-[11px]">This backup is from a different user UID. Admin override — proceed with caution.</span>
                  </div>
                )}
              </div>
              <button onClick={() => setModalStep("confirm-merge")}
                className="w-full text-left rounded-2xl p-4 flex items-start gap-3 transition-all hover:scale-[1.01]"
                style={{ background:"rgba(52,211,153,0.06)", border:"2px solid rgba(52,211,153,0.35)" }}>
                <span className="text-xl mt-0.5 flex-shrink-0">🔀</span>
                <div>
                  <p className="text-white font-black text-sm">Smart Merge — Recommended</p>
                  <p className="text-gray-300 text-xs leading-relaxed mt-1">Backup data restored. Records created <span className="text-green-400 font-semibold">after</span> the backup date remain safe.</p>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(52,211,153,0.12)", color:"#34d399" }}>✅ New data safe</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(52,211,153,0.12)", color:"#34d399" }}>✅ Backup restored</span>
                  </div>
                </div>
              </button>
              <button onClick={() => setModalStep("confirm-replace")}
                className="w-full text-left rounded-2xl p-4 flex items-start gap-3 transition-all hover:scale-[1.01]"
                style={{ background:"rgba(239,68,68,0.05)", border:"1.5px solid rgba(239,68,68,0.25)" }}>
                <span className="text-xl mt-0.5 flex-shrink-0">🔄</span>
                <div>
                  <p className="text-white font-black text-sm">Full Replace</p>
                  <p className="text-gray-300 text-xs leading-relaxed mt-1">User&apos;s <span className="text-red-400 font-semibold">entire current data deleted</span> and replaced with backup. Any work after the backup is <span className="text-red-400 font-semibold">permanently lost</span>.</p>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(239,68,68,0.12)", color:"#f87171" }}>⚠️ New data deleted</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Merge ── */}
      {modalStep === "confirm-merge" && fileInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.80)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(52,211,153,0.35)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#34d399,#059669)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔀</span>
                <div>
                  <p className="text-white font-black text-sm">Confirm Smart Merge</p>
                  <p className="text-gray-300 text-xs">Into: <span className="text-amber-300">{userName || targetUid}</span></p>
                </div>
              </div>
              <div className="rounded-xl px-4 py-3 text-xs leading-relaxed text-gray-300"
                style={{ background:"rgba(52,211,153,0.05)", border:"1px solid rgba(52,211,153,0.2)" }}>
                📅 Backup date: <span className="text-amber-300 font-semibold">{fmtDTLocal(fileInfo.exportedAt)}</span><br />
                Records created <span className="text-green-400 font-medium">after this date</span> will be kept.<br />
                Backup records will be overwritten.
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModalStep("choose")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>← Back</button>
                <button onClick={() => executeRestore("merge")} className="flex-1 py-2.5 rounded-xl text-sm font-black"
                  style={{ background:"linear-gradient(135deg,#34d399,#059669)", color:"#000" }}>Smart Merge →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Replace ── */}
      {modalStep === "confirm-replace" && fileInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.80)", backdropFilter:"blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background:"#0d1117", border:"1px solid rgba(239,68,68,0.4)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ height:4, background:"linear-gradient(90deg,#ef4444,#f97316)" }} />
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-white font-black text-sm">Full Replace — Danger!</p>
                  <p className="text-gray-300 text-xs">Into: <span className="text-amber-300">{userName || targetUid}</span></p>
                </div>
              </div>
              <div className="rounded-xl px-4 py-3 text-xs leading-relaxed"
                style={{ background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.2)", color:"#fca5a5" }}>
                ❌ Everything after backup date (<span className="font-semibold text-amber-300">{fmtDTLocal(fileInfo.exportedAt)}</span>) in this user&apos;s account will be <span className="font-bold text-red-300">permanently deleted</span>.<br /><br />
                Are you sure you want to proceed?
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModalStep("choose")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>← Back</button>
                <button onClick={() => executeRestore("replace")} className="flex-1 py-2.5 rounded-xl text-sm font-black"
                  style={{ background:"linear-gradient(135deg,#ef4444,#c62828)", color:"#fff" }}>Yes, Delete &amp; Replace</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGE BODY ── */}
      <div className="flex flex-col gap-5 w-full max-w-4xl">

        {/* ── Row 1: Export + Restore side by side on lg ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Export */}
          <div className="rounded-2xl p-5 flex flex-col gap-4" style={cardS}>
            <div className="pb-2 border-b border-white/10">
              <p className="text-xs font-black uppercase tracking-widest" style={{ color:"#34d399" }}>📦 Export Backup</p>
            </div>
            <div className="rounded-xl p-4 flex flex-col gap-2"
              style={{ background:"rgba(52,211,153,0.04)", border:"1px solid rgba(52,211,153,0.15)" }}>
              <p className="text-gray-300 text-sm leading-relaxed">
                Download a full backup of <span className="text-green-400 font-semibold">{userName || targetUid}</span>&apos;s data — invoices, customers, inventory, payments, suppliers, and all nested records.
              </p>
              <p className="text-gray-300 text-xs">Saved directly to your machine. Use it later to restore this user&apos;s data.</p>
            </div>

            {folderName && (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.2)" }}>
                <span className="text-base flex-shrink-0">🗂️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-300 uppercase tracking-widest font-bold mb-0.5">Saved Folder</p>
                  <p className="text-amber-300 font-semibold text-xs truncate">{folderName}</p>
                </div>
                <button onClick={() => { setDirHandle(null); setFolderName(""); btIdbDel(IDB_DIR_KEY); }}
                  title="Forget folder" className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0">✕</button>
              </div>
            )}

            {exporting && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300 truncate">{exportLabel}</span>
                  <span className="text-green-400 font-bold ml-2 flex-shrink-0">{exportProg}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width:`${exportProg}%`, background:"linear-gradient(90deg,#34d399,#059669)" }} />
                </div>
              </div>
            )}

            {exportMsg.text && (
              <div className="px-3 py-2.5 rounded-xl text-xs font-medium"
                style={{
                  background: exportMsg.type==="success" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                  border:`1px solid ${exportMsg.type==="success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                  color: exportMsg.type==="success" ? "#34d399" : "#f87171",
                }}>
                {exportMsg.text}
              </div>
            )}

            <button onClick={doExport} disabled={exporting}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-95 mt-auto"
              style={{
                background: exporting ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg,#34d399,#059669)",
                color: exporting ? "#34d399" : "#000",
                border: exporting ? "1px solid rgba(52,211,153,0.3)" : "none",
                cursor: exporting ? "not-allowed" : "pointer",
              }}>
              {exporting
                ? <><svg className="w-4 h-4 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/></svg>Exporting...</>
                : "⬇️ Export Backup"
              }
            </button>
          </div>

          {/* Restore */}
          <div className="rounded-2xl p-5 flex flex-col gap-4" style={cardS}>
            <div className="pb-2 border-b border-white/10">
              <p className="text-xs font-black uppercase tracking-widest" style={{ color:"#F59E0B" }}>♻️ Restore to User</p>
            </div>
            <div className="rounded-xl p-4 flex flex-col gap-2"
              style={{ background:"rgba(245,158,11,0.04)", border:"1px solid rgba(245,158,11,0.15)" }}>
              <p className="text-gray-300 text-sm leading-relaxed">
                Upload a backup file and restore it directly into <span className="text-amber-400 font-semibold">{userName || targetUid}</span>&apos;s account. Encrypted <span className="text-indigo-300 font-semibold">.novexa</span> files will ask for password here.
              </p>
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)" }}>
                  <span className="flex-shrink-0">🔀</span>
                  <div><p className="text-green-400 font-bold">Smart Merge</p><p className="text-gray-300">New work after backup date stays safe.</p></div>
                </div>
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.2)" }}>
                  <span className="flex-shrink-0">🔄</span>
                  <div><p className="text-red-400 font-bold">Full Replace</p><p className="text-gray-300">All current data deleted, replaced with backup.</p></div>
                </div>
              </div>
            </div>

            {restoring && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300 truncate">{restoreLabel}</span>
                  <span className="text-amber-400 font-bold ml-2 flex-shrink-0">{restoreProg}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width:`${restoreProg}%`, background:"linear-gradient(90deg,#F59E0B,#D97706)" }} />
                </div>
              </div>
            )}

            {restoreMsg.text && (
              <div className="px-3 py-2.5 rounded-xl text-xs font-medium"
                style={{
                  background: restoreMsg.type==="success" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                  border:`1px solid ${restoreMsg.type==="success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                  color: restoreMsg.type==="success" ? "#34d399" : "#f87171",
                }}>
                {restoreMsg.text}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept=".json,.novexa,application/json" className="hidden" onChange={handleFileSelect} />
            <button onClick={() => fileInputRef.current?.click()} disabled={restoring}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-95 mt-auto"
              style={{
                background: restoring ? "rgba(245,158,11,0.15)" : "linear-gradient(135deg,#F59E0B,#D97706)",
                color: restoring ? "#F59E0B" : "#000",
                border: restoring ? "1px solid rgba(245,158,11,0.3)" : "none",
                cursor: restoring ? "not-allowed" : "pointer",
              }}>
              {restoring
                ? <><svg className="w-4 h-4 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/></svg>Restoring...</>
                : "⬆️ Select Backup File to Restore"
              }
            </button>

            <div className="rounded-xl p-3 flex flex-col gap-1"
              style={{ background:"rgba(239,68,68,0.04)", border:"1px solid rgba(239,68,68,0.15)" }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-red-500">⚠️ Admin Notes</p>
              <ul className="flex flex-col gap-0.5 mt-1">
                {["Always export a fresh backup before restoring.","Encrypted .novexa files unlock only via restore on this page.","Smart Merge preserves data added after the backup.","Full Replace permanently deletes post-backup data.","Cross-user restores allowed (admin override)."]
                  .map((t,i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-300">
                    <span className="text-red-700 mt-0.5 flex-shrink-0">•</span>{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ══ AUTO-BACKUP ══ */}
        <div className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <div className="pb-2 border-b border-white/10">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color:"#8b5cf6" }}>⏱️ Auto-Backup — {userName || targetUid}</p>
          </div>
          <div className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background:"rgba(139,92,246,0.04)", border:"1px solid rgba(139,92,246,0.15)" }}>
            <p className="text-gray-300 text-sm">Automatically back up this user&apos;s data at a set interval. Each backup saves as a new file — nothing is overwritten.</p>
            <p className="text-gray-300 text-xs">✅ Requires a saved folder. ✅ Works only while this tab is open.</p>
          </div>

          {/* Auto-dest modal */}
          {autoDestModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
              style={{ background:"rgba(0,0,0,0.80)", backdropFilter:"blur(8px)" }}>
              <div className="w-full max-w-sm rounded-2xl overflow-hidden"
                style={{ background:"#0d1117", border:"1px solid rgba(139,92,246,0.35)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
                <div style={{ height:4, background:"linear-gradient(90deg,#8b5cf6,#6d28d9)" }} />
                <div className="px-6 py-5 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⏱️</span>
                    <div>
                      <p className="text-white font-black text-sm">Auto-Backup Destination</p>
                      <p className="text-gray-300 text-xs">Where should auto-backups be saved?</p>
                    </div>
                    <button onClick={() => setAutoDestModal(false)} className="ml-auto text-gray-300 hover:text-gray-300 text-lg">✕</button>
                  </div>
                  <div className="px-4 py-3 rounded-xl flex items-center gap-3"
                    style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)" }}>
                    <span className="text-xl">🗂️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-300 uppercase font-bold mb-0.5">Current Folder</p>
                      <p className="text-amber-300 font-bold text-sm truncate">{folderName}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={activateAutoSameFolder}
                      className="w-full py-3 rounded-xl text-sm font-black"
                      style={{ background:"linear-gradient(135deg,#8b5cf6,#6d28d9)", color:"#fff" }}>
                      ✅ Use this folder
                    </button>
                    <button onClick={activateAutoNewFolder}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
                      📂 Choose a different folder
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interval picker */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-300 font-semibold uppercase tracking-wider">Backup Frequency</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AUTO_INTERVALS.map(opt => (
                <button key={opt.id} onClick={() => setAutoIntervalId(opt.id)} disabled={autoEnabled}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: autoIntervalId===opt.id ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)",
                    border: autoIntervalId===opt.id ? "2px solid rgba(139,92,246,0.6)" : "1px solid rgba(255,255,255,0.07)",
                    color: autoIntervalId===opt.id ? "#c4b5fd" : "#6b7280",
                    cursor: autoEnabled ? "not-allowed" : "pointer",
                    opacity: autoEnabled && autoIntervalId!==opt.id ? 0.4 : 1,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active status */}
          {autoEnabled && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background:"rgba(139,92,246,0.06)", border:"1px solid rgba(139,92,246,0.25)" }}>
              <span className="text-xl flex-shrink-0">🟣</span>
              <div className="flex-1">
                <p className="text-purple-300 font-black text-xs uppercase tracking-wider">Auto-Backup Active</p>
                <p className="text-gray-300 text-xs mt-0.5">
                  Next backup in <span className="text-purple-200 font-bold">{countdown || "…"}</span>
                  {folderName && <> → <span className="text-amber-300 font-semibold">{folderName}</span></>}
                </p>
              </div>
            </div>
          )}

          {autoMsg.text && (
            <div className="px-4 py-3 rounded-xl text-sm font-medium"
              style={{
                background: autoMsg.type==="success" ? "rgba(139,92,246,0.08)" : "rgba(248,113,113,0.08)",
                border:`1px solid ${autoMsg.type==="success" ? "rgba(139,92,246,0.35)" : "rgba(248,113,113,0.3)"}`,
                color: autoMsg.type==="success" ? "#c4b5fd" : "#f87171",
              }}>
              {autoMsg.text}
            </div>
          )}

          <div className="flex gap-3">
            {!autoEnabled
              ? <button onClick={handleEnableAuto}
                  className="flex-1 py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                  style={{ background:"linear-gradient(135deg,#8b5cf6,#6d28d9)", color:"#fff" }}>
                  ▶ Enable Auto-Backup
                </button>
              : <button onClick={handleDisableAuto}
                  className="flex-1 py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                  style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", color:"#f87171" }}>
                  ⏹ Disable Auto-Backup
                </button>
            }
          </div>
        </div>

        {/* ══ BACKUP HISTORY ══ */}
        <div className="rounded-2xl p-5 flex flex-col gap-4"
          style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <div className="pb-2 border-b border-white/10">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color:"#60a5fa" }}>📋 Backup History — {userName || targetUid}</p>
          </div>
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="text-4xl opacity-20">🗂️</span>
              <p className="text-gray-300 text-sm">No backups yet</p>
              <p className="text-gray-300 text-xs">Every backup (manual or auto) for this user will appear here.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {history.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex-shrink-0">
                      {entry.type === "auto"
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                            style={{ background:"rgba(139,92,246,0.15)", color:"#c4b5fd", border:"1px solid rgba(139,92,246,0.3)" }}>⏱ Auto</span>
                        : <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                            style={{ background:"rgba(52,211,153,0.12)", color:"#34d399", border:"1px solid rgba(52,211,153,0.3)" }}>✋ Manual</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{entry.fileName}</p>
                      <p className="text-gray-300 text-[11px] mt-0.5">{fmtDTLocal(entry.at)}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-green-400 text-xs font-bold">{entry.docCount?.toLocaleString()}</p>
                      <p className="text-gray-300 text-[10px]">records</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={async () => { await btIdbDel(IDB_HIST_KEY); setHistory([]); }}
                className="self-end text-xs text-gray-300 hover:text-red-400 transition-colors underline underline-offset-2">
                Clear history
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   DEVICES TAB
══════════════════════════════════════════════════════════════════════ */
function DevicesTab({ uid, getToken, onToast, maxDevices }) {
  const [sessions,  setSessions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [evicting,  setEvicting]  = useState(null); // sessionId being evicted

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = await getToken();
      const res   = await fetch(`/api/admin/get-user-sessions?uid=${uid}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load sessions");
      setSessions(d.sessions || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [uid, getToken]);

  useEffect(() => { load(); }, [load]);

  async function handleEvict(sessionId) {
    setEvicting(sessionId);
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/evict-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body:    JSON.stringify({ uid, sessionId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Evict failed");
      onToast("Session evict kar di ✓");
      await load();
    } catch (e) { onToast(e.message || "Evict failed", "error"); }
    setEvicting(null);
  }

  function fmtDT(val) {
    if (!val) return "—";
    try {
      const d = new Date(val);
      if (isNaN(d)) return "—";
      return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
        + " " + d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
    } catch { return "—"; }
  }

  function timeAgo(val) {
    if (!val) return "—";
    try {
      const diff = Date.now() - new Date(val).getTime();
      if (isNaN(diff)) return "—";
      const s = Math.floor(diff / 1000);
      if (s < 60)   return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60)   return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24)   return `${h}h ago`;
      const day = Math.floor(h / 24);
      return `${day}d ago`;
    } catch { return "—"; }
  }

  function getDeviceIcon(device = "") {
    const d = device.toLowerCase();
    if (d.includes("iphone"))          return "📱";
    if (d.includes("ipad"))            return "📱";
    if (d.includes("android phone"))   return "📱";
    if (d.includes("android tablet"))  return "📱";
    if (d.includes("mac"))             return "💻";
    if (d.includes("windows"))         return "🖥️";
    if (d.includes("linux"))           return "🖥️";
    return "💻";
  }

  function getEvictReason(s) {
    if (s.evictedBy === "admin_force_evict")       return "Admin ne hatayi";
    if (s.evictedBy === "new_login_exceeded_limit") return "Naya login (limit paar)";
    if (s.evictedBy === "subscription_expired")     return "Subscription khatam";
    if (s.evictedBy === "password_changed")         return "Password badla";
    if (s.loggedOutAt)                              return "Logout";
    return s.evictedBy || "Inactive";
  }

  const active   = sessions.filter(s => s.active);
  const inactive = sessions.filter(s => !s.active);

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3">
      <div className="w-8 h-8 rounded-full border-4 border-transparent animate-spin"
        style={{ borderTopColor: "#2563EB", borderRightColor: "#F59E0B" }} />
      <span className="text-gray-400 text-sm">Sessions load ho rahi hain...</span>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <span className="text-4xl">⚠️</span>
      <p className="text-red-400 text-sm font-semibold">{error}</p>
      <button onClick={load} className="px-4 py-2 rounded-xl text-xs font-semibold"
        style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", color: "#60a5fa" }}>
        Retry
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Header stats ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Sessions",  value: active.length,   color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.2)"  },
          { label: "Max Devices",      value: maxDevices || 1, color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)"  },
          { label: "Total Sessions",   value: sessions.length, color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)"  },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4 text-center"
            style={{ background: stat.bg, border: `1px solid ${stat.border}` }}>
            <div className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs text-gray-400 mt-1 font-semibold">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Active sessions ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Active Sessions ({active.length})
          </h3>
          <button onClick={load} className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
            ↻ Refresh
          </button>
        </div>

        {active.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-4xl mb-3">📵</p>
            <p className="text-gray-400 text-sm font-semibold">Koi active session nahi hai</p>
            <p className="text-gray-600 text-xs mt-1">User abhi logged out hai</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map(s => (
              <div key={s.id} className="rounded-xl p-4"
                style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
                      {getDeviceIcon(s.device)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-sm">{s.device || "Unknown Device"}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                          ● ACTIVE
                        </span>
                      </div>
                      <div className="text-gray-400 text-xs mt-0.5">{s.browser || "Unknown Browser"}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        <span className="text-gray-500 text-[11px]">🌐 {s.ip || "—"}</span>
                        <span className="text-gray-500 text-[11px]">🕐 Login: {fmtDT(s.createdAt)}</span>
                        <span className="text-gray-500 text-[11px]">👁 Last seen: {timeAgo(s.lastSeen)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleEvict(s.id)}
                    disabled={evicting === s.id}
                    className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                    {evicting === s.id ? "..." : "⊘ Kick"}
                  </button>
                </div>
                {/* UA string */}
                {s.ua && (
                  <div className="mt-2 px-3 py-2 rounded-lg text-[10px] text-gray-600 font-mono break-all"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    {s.ua}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Inactive / history ── */}
      {inactive.length > 0 && (
        <div>
          <h3 className="text-gray-500 font-bold text-sm mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />
            Session History ({inactive.length})
          </h3>
          <div className="space-y-2">
            {inactive.map(s => (
              <div key={s.id} className="rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0 opacity-50"
                    style={{ background: "rgba(255,255,255,0.04)" }}>
                    {getDeviceIcon(s.device)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-400 font-semibold text-xs">{s.device || "Unknown Device"}</span>
                      <span className="text-gray-500 text-[10px]">·</span>
                      <span className="text-gray-500 text-[10px]">{s.browser || "Unknown Browser"}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(107,114,128,0.15)", color: "#6b7280", border: "1px solid rgba(107,114,128,0.2)" }}>
                        {getEvictReason(s)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      <span className="text-gray-600 text-[11px]">🌐 {s.ip || "—"}</span>
                      <span className="text-gray-600 text-[11px]">Login: {fmtDT(s.createdAt)}</span>
                      {s.loggedOutAt && <span className="text-gray-600 text-[11px]">Logout: {fmtDT(s.loggedOutAt)}</span>}
                      {s.evictedAt   && <span className="text-gray-600 text-[11px]">Evicted: {fmtDT(s.evictedAt)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SIDEBAR TABS config
══════════════════════════════════════════════════════════════════════ */
const TABS = [
  { id:"profile",   icon:"👤", label:"Profile"   },
  { id:"customers", icon:"👥", label:"Customers"  },
  { id:"invoices",  icon:"🧾", label:"Invoices"   },
  { id:"products",  icon:"📦", label:"Products"   },
  { id:"payments",  icon:"💳", label:"Payments"   },
  { id:"suppliers", icon:"🏭", label:"Suppliers"  },
  { id:"addons",    icon:"⚡", label:"Add-ons"    },
  { id:"tickets",   icon:"🎫", label:"Tickets"    },
  { id:"devices",   icon:"🖥️", label:"Devices"    },
  { id:"trash",     icon:"🗑️", label:"Trash"      },
  { id:"activity",  icon:"📋", label:"Activity"   },
  { id:"backup",    icon:"💾", label:"Backup"     },
];

/* ══════════════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════════════ */
// Which API scope each tab needs
const TAB_SCOPE = {
  profile:   "profile",
  customers: "customers",
  invoices:  "invoices",
  products:  "products",
  payments:  "payments",
  suppliers: "suppliers",
  activity:  "activity",
  trash:     "trash",
  // addons / tickets / devices / backup fetch their own data independently
};

export default function AdminUserDetail({ uid, getToken, onClose, onToast }) {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`adminUserDetailTab_${uid}`) || "profile";
    }
    return "profile";
  });

  // profileData: user + authRecord — always loaded first, shown in header
  const [profileData,  setProfileData]  = useState(null);
  const [profileLoad,  setProfileLoad]  = useState(true);
  const [profileErr,   setProfileErr]   = useState(null);

  // per-tab cache: { customers: {...}, invoices: {...}, ... }
  const [tabCache,     setTabCache]     = useState({});
  // which tabs are currently loading
  const [tabLoading,   setTabLoading]   = useState({});
  const [tabError,     setTabError]     = useState({});

  // ── fetch a specific scope and merge into cache ────────────────────────────
  const fetchScope = useCallback(async (scope, force = false) => {
    if (!force && tabCache[scope]) return; // already cached
    setTabLoading(prev => ({ ...prev, [scope]: true }));
    setTabError(prev => ({ ...prev, [scope]: null }));
    try {
      const token = await getToken();
      const res   = await fetch(`/api/admin/user-full-detail?uid=${uid}&scope=${scope}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      // also refresh profileData (user field) so header stays current
      if (d.user) setProfileData(prev => prev ? { ...prev, user: d.user, authRecord: d.authRecord } : d);
      setTabCache(prev => ({ ...prev, [scope]: d }));
    } catch (err) {
      setTabError(prev => ({ ...prev, [scope]: err.message }));
    }
    setTabLoading(prev => ({ ...prev, [scope]: false }));
  }, [uid, getToken, tabCache]);

  // ── initial load: only profile scope ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      setProfileLoad(true); setProfileErr(null);
      try {
        const token = await getToken();
        const res   = await fetch(`/api/admin/user-full-detail?uid=${uid}&scope=profile`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setProfileData(d);
        setTabCache(prev => ({ ...prev, profile: d }));
      } catch (err) { setProfileErr(err.message); }
      setProfileLoad(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // ── fetch tab data when tab becomes active ─────────────────────────────────
  useEffect(() => {
    const scope = TAB_SCOPE[activeTab];
    if (scope && scope !== "profile") fetchScope(scope);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── refresh current tab ────────────────────────────────────────────────────
  const refreshCurrent = useCallback(async () => {
    // always refresh profile (header data)
    setProfileLoad(true);
    try {
      const token = await getToken();
      const res   = await fetch(`/api/admin/user-full-detail?uid=${uid}&scope=profile`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setProfileData(d);
      setTabCache(prev => ({ ...prev, profile: d }));
    } catch { /* ignore */ }
    setProfileLoad(false);
    // also force-refresh the active tab's scope
    const scope = TAB_SCOPE[activeTab];
    if (scope && scope !== "profile") {
      setTabCache(prev => { const n = { ...prev }; delete n[scope]; return n; });
      fetchScope(scope, true);
    }
  }, [uid, getToken, activeTab, fetchScope]);

  const ss = profileData ? (STATUS_STYLE[profileData.user?.status] || STATUS_STYLE.active) : null;

  // ── helper: tab content loader wrapper ────────────────────────────────────
  // For tabs that use TAB_SCOPE, wrap render in loading/error state
  function TabWrapper({ scope, children }) {
    const isLoading = tabLoading[scope];
    const err       = tabError[scope];
    const cached    = tabCache[scope];
    if (isLoading || !cached) return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-transparent animate-spin"
          style={{ borderTopColor:"#2563EB", borderRightColor:"#F59E0B" }} />
        <p className="text-gray-300 text-sm">Loading...</p>
      </div>
    );
    if (err) return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <span className="text-5xl">⚠️</span>
        <p className="text-red-400 font-semibold">{err}</p>
        <button onClick={() => { setTabCache(prev => { const n={...prev}; delete n[scope]; return n; }); fetchScope(scope, true); }}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background:"rgba(37,99,235,0.1)", border:"1px solid rgba(37,99,235,0.3)", color:"#60a5fa" }}>
          Retry
        </button>
      </div>
    );
    return children(cached);
  }

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background:"rgba(0,0,0,0.96)", backdropFilter:"blur(12px)" }}>
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#0d1117]">

        {/* ── top bar ── */}
        <div className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.07)", background:"linear-gradient(135deg,rgba(37,99,235,0.07),rgba(245,158,11,0.03))" }}>
          <button onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.removeItem(`adminUserDetailTab_${uid}`);
            }
            onClose();
          }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-white/10 flex-shrink-0"
            style={{ border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
            ← Back
          </button>
          {profileLoad && !profileData ? (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl flex-shrink-0 animate-pulse" style={{ background:"rgba(255,255,255,0.07)" }} />
              <div className="flex flex-col gap-1.5">
                <div className="h-3.5 w-36 rounded animate-pulse" style={{ background:"rgba(255,255,255,0.07)" }} />
                <div className="h-2.5 w-52 rounded animate-pulse" style={{ background:"rgba(255,255,255,0.05)" }} />
              </div>
            </div>
          ) : profileData && (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                style={{ background:avatarGrad(uid), color:"#fff" }}>
                {initials(profileData.user?.name)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-black text-base leading-tight">{profileData.user?.name}</p>
                  {ss && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                      style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}` }}>
                      {ss.label||profileData.user?.status}
                    </span>
                  )}
                </div>
                <p className="text-gray-300 text-xs truncate">{profileData.user?.email} · {profileData.user?.phone||"No phone"}</p>
              </div>
            </div>
          )}
          <button onClick={refreshCurrent}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-white/10 flex-shrink-0"
            style={{ border:"1px solid rgba(255,255,255,0.1)", color:"#6b7280" }}>
            <span className={(profileLoad || tabLoading[TAB_SCOPE[activeTab]])?"animate-spin":""}>↻</span> Refresh
          </button>
        </div>

        {/* ── profile initial load error ── */}
        {profileErr && !profileData && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4">
            <span className="text-5xl">⚠️</span>
            <p className="text-red-400 font-semibold">{profileErr}</p>
            <button onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background:"rgba(37,99,235,0.1)", border:"1px solid rgba(37,99,235,0.3)", color:"#60a5fa" }}>
              Retry
            </button>
          </div>
        )}

        {profileData && (
          <div className="flex flex-1 min-h-0">
            {/* ── sidebar ── */}
            <nav className="flex-shrink-0 flex flex-col gap-1 px-3 py-4 overflow-y-auto"
              style={{ width:180, borderRight:"1px solid rgba(255,255,255,0.06)", background:"rgba(8,13,20,0.6)" }}>
              {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                let badge = null;
                // trash badge — count from cached trash data
                if (tab.id==="trash" && tabCache.trash) {
                  const td = tabCache.trash;
                  const n  = [td.invoices,td.customers,td.products,td.payments,td.suppliers,td.orders]
                    .flat().filter(i=>i?.adminTrash).length;
                  if (n>0) badge = n;
                }
                // devices badge
                if (tab.id==="devices" && profileData.user?.lastDevice) badge = "●";
                const badgeColor = tab.id==="devices"
                  ? { bg:"rgba(16,185,129,0.2)", color:"#10b981", border:"1px solid rgba(16,185,129,0.3)" }
                  : tab.id==="tickets"
                    ? { bg:"rgba(59,130,246,0.2)", color:"#60a5fa", border:"1px solid rgba(59,130,246,0.3)" }
                    : { bg:"rgba(248,113,113,0.2)", color:"#f87171", border:"1px solid rgba(248,113,113,0.3)" };
                // show a small dot on tabs that are loading
                const isTabLoading = tabLoading[TAB_SCOPE[tab.id]];
                return (
                  <button key={tab.id} onClick={() => {
                    setActiveTab(tab.id);
                    if (typeof window !== "undefined") localStorage.setItem(`adminUserDetailTab_${uid}`, tab.id);
                  }}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative text-left w-full"
                    style={{ background:isActive?"linear-gradient(135deg,rgba(37,99,235,0.18),rgba(245,158,11,0.07))":"transparent", border:isActive?"1px solid rgba(37,99,235,0.25)":"1px solid transparent", color:isActive?"#fff":"#6b7280" }}>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                        style={{ background:"linear-gradient(to bottom,#2563EB,#F59E0B)" }} />
                    )}
                    <span className="text-base">{tab.icon}</span>
                    <span className="text-xs">{tab.label}</span>
                    {isTabLoading && (
                      <span className="ml-auto w-2.5 h-2.5 rounded-full border-2 border-t-blue-400 border-transparent animate-spin" />
                    )}
                    {!isTabLoading && badge!==null && (
                      <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background:badgeColor.bg, color:badgeColor.color, border:badgeColor.border }}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* ── main content ── */}
            <main className="flex-1 overflow-y-auto p-6">
              {activeTab==="profile" && (
                <ProfileTab data={tabCache.profile || profileData} uid={uid} getToken={getToken} onToast={onToast} />
              )}
              {activeTab==="customers" && (
                <TabWrapper scope="customers">{d =>
                  <CustomersTab customers={d.customers} invoices={d.invoices} payments={d.payments} />
                }</TabWrapper>
              )}
              {activeTab==="invoices" && (
                <TabWrapper scope="invoices">{d =>
                  <InvoicesTab invoices={d.invoices} />
                }</TabWrapper>
              )}
              {activeTab==="products" && (
                <TabWrapper scope="products">{d =>
                  <ProductsTab products={d.products} />
                }</TabWrapper>
              )}
              {activeTab==="payments" && (
                <TabWrapper scope="payments">{d =>
                  <PaymentsTab payments={d.payments} />
                }</TabWrapper>
              )}
              {activeTab==="suppliers" && (
                <TabWrapper scope="suppliers">{d =>
                  <SuppliersTab suppliers={d.suppliers} orders={d.orders} receipts={d.receipts||[]} supplierReturns={d.supplierReturns||[]} />
                }</TabWrapper>
              )}
              {activeTab==="addons" && (
                <AddonsTab uid={uid} user={profileData.user} getToken={getToken} onToast={onToast} />
              )}
              {activeTab==="tickets" && (
                <TicketsTab uid={uid} getToken={getToken} onToast={onToast} />
              )}
              {activeTab==="devices" && (
                <DevicesTab uid={uid} getToken={getToken} onToast={onToast} maxDevices={profileData.user?.maxDevices} />
              )}
              {activeTab==="trash" && (
                <TabWrapper scope="trash">{d =>
                  <TrashTab uid={uid} data={d} getToken={getToken} onToast={onToast}
                    onRefresh={() => { setTabCache(prev => { const n={...prev}; delete n.trash; return n; }); fetchScope("trash", true); }} />
                }</TabWrapper>
              )}
              {activeTab==="activity" && (
                <TabWrapper scope="activity">{d =>
                  <ActivityTab activityLogs={d.activityLogs} />
                }</TabWrapper>
              )}
              {activeTab==="backup" && (
                <BackupTab uid={uid} userName={profileData.user?.name} getToken={getToken} />
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
