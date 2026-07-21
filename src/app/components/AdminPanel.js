"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import AdminUserDetail from "./AdminUserDetail";
import SupportInbox from "./SupportInbox";
import PackageManager from "./PackageManager";
import AdminAddonRequests from "./AdminAddonRequests";

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID;

/* ── helpers ──────────────────────────────────────────────────────────────── */
function todayStr() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}
function daysLeft(activeTo, activeToTime) {
  if (!activeTo) return null;
  const timeStr = activeToTime || "23:59:59";
  const expStr  = `${activeTo}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}`;
  return Math.ceil((new Date(expStr) - new Date()) / 86400000);
}

/* ── Digital Clock ────────────────────────────────────────────────────────── */
function DigitalClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh  = String(time.getHours()).padStart(2, "0");
  const mm  = String(time.getMinutes()).padStart(2, "0");
  const ss  = String(time.getSeconds()).padStart(2, "0");
  const ampm = time.getHours() >= 12 ? "PM" : "AM";
  const hh12 = String(time.getHours() % 12 || 12).padStart(2, "0");

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0"
      style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
      <span className="text-blue-400 text-[10px]">🕐</span>
      <span className="font-mono font-bold tracking-widest"
        style={{ color: "#60a5fa", fontSize: 13, letterSpacing: "0.12em" }}>
        {hh12}:{mm}
        <span className="animate-pulse">:</span>
        {ss}
      </span>
      <span className="text-blue-500 text-[10px] font-bold">{ampm}</span>
    </div>
  );
}

const STATUS_STYLE = {
  active:      { color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)",  label: "Active"   },
  frozen:      { color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)",  label: "Frozen"   },
  deleted:     { color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", label: "Deleted"  },
  not_started: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  label: "Pending"  },
};

const inputStyle = {
  width: "100%", outline: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(255,255,255,0.09)",
  borderRadius: 10, padding: "9px 13px",
  color: "#fff", fontSize: 13,
};
const labelStyle = {
  display: "block", color: "#9ca3af", fontSize: 11,
  fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.07em", marginBottom: 5,
};

/* ── Reusable Input ───────────────────────────────────────────────────────── */
function SInput({ label, type = "text", value, onChange, placeholder, required, min, max }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} required={required} min={min} max={max}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          ...inputStyle,
          ...(focused ? { border: "1.5px solid rgba(37,99,235,0.6)", background: "rgba(37,99,235,0.07)", boxShadow: "0 0 0 3px rgba(37,99,235,0.1)" } : {}),
        }}
      />
    </div>
  );
}

/* ── Toast ────────────────────────────────────────────────────────────────── */
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold"
          style={{
            background: t.type === "success" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
            border: `1px solid ${t.type === "success" ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)"}`,
            color: t.type === "success" ? "#34d399" : "#f87171",
            backdropFilter: "blur(16px)",
            minWidth: 260,
            animation: "slideUp 0.3s ease",
          }}>
          <span className="text-base">{t.type === "success" ? "✓" : "✕"}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Confirm Dialog ───────────────────────────────────────────────────────── */
function ConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <p className="text-4xl">⚠️</p>
        <h3 className="text-white font-bold text-lg">{title}</h3>
        <p className="text-gray-400 text-sm">{message}</p>
        <div className="flex gap-3 mt-1">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
            style={{ background: confirmColor || "rgba(239,68,68,0.15)", border: `1px solid ${confirmColor ? confirmColor.replace("0.15","0.4") : "rgba(239,68,68,0.4)"}`, color: "#fff" }}>
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── User Form Modal ──────────────────────────────────────────────────────── */
const EMPTY_FORM = { name: "", email: "", password: "", phone: "", address: "", activeFrom: "", activeTo: "", activeToTime: "", maxDevices: "1", plan: "starter", subscriptionType: "active", billingPeriod: "monthly", paymentMethod: "cash" };

// Plan default maxDevices — jab plan select ho, yeh automatically set hota hai
const PLAN_DEFAULT_DEVICES = {
  starter:      1,
  business:     5,
  professional: 15,
  enterprise:   50,
};

const PLAN_OPTIONS = [
  { id: "starter",      label: "💎 Starter",      desc: "1 device · 100 invoices · Basic features",        color: "#10B981" },
  { id: "business",     label: "🚀 Business",      desc: "5 devices · Unlimited invoices · Analytics",      color: "#2563EB" },
  { id: "professional", label: "👑 Professional",  desc: "15 devices · All features · Multi-branch",        color: "#F59E0B" },
  { id: "enterprise",   label: "🏢 Enterprise",    desc: "50 devices · Custom setup · Full access",         color: "#A855F7" },
];

// Pure helper — compute end date given a start date string and billing period
// Used for NEW subscriptions (activeFrom → activeTo), applies -1 day so period is inclusive
function calcEndDateStatic(fromDateStr, period) {
  if (!fromDateStr) return "";
  const d = new Date(fromDateStr + "T00:00:00");
  if (period === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
    d.setDate(d.getDate() - 1);
  } else {
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

// Renewal helper — extend an existing end date by 1 month/year (no -1 day)
// e.g. Aug 14 + 1 month = Sep 14
function calcRenewalEndDate(currentEndStr, period) {
  if (!currentEndStr) return "";
  const d = new Date(currentEndStr + "T00:00:00");
  if (period === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

// Get display start of next period (currentEnd + 1 day) — for UI display only
function calcRenewalDisplayStart(currentEndStr) {
  if (!currentEndStr) return "";
  const d = new Date(currentEndStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function UserFormModal({ initial, onClose, onSave, saving, getToken, onToast, onRenewSuccess }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name || "", email: initial.email || "",
    password: "", phone: initial.phone || "",
    address: initial.address || "",
    activeFrom: initial.activeFrom || "", activeTo: initial.activeTo || "",
    activeToTime: initial.activeToTime || "",
    maxDevices: String(initial.maxDevices || "1"),
    plan: initial.plan || "starter",
    subscriptionType: initial.subscriptionType || "active",
    billingPeriod: initial.billingPeriod || "monthly",
    paymentMethod: initial.paymentMethod || "cash",
  } : { ...EMPTY_FORM });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const isEdit = !!initial;

  // ── Extra limits state (edit mode only) ──────────────────────────────────
  const EXTRA_FIELDS_LIST = [
    { key: "invoicesPerMonth",            label: "Extra Invoices / Month",               icon: "🧾" },
    { key: "invoicesPerCustomerPerMonth", label: "Extra Invoices per Customer / Month",  icon: "👥" },
    { key: "customersPerMonth",           label: "Extra Customers / Month",               icon: "👤" },
    { key: "suppliersPerMonth",           label: "Extra Suppliers / Month",               icon: "🏭" },
    { key: "ordersPerSupplierPerMonth",   label: "Extra Orders per Supplier / Month",    icon: "🛒" },
  ];

  // existingLimits = what is already saved on the user
  // stored in state so it updates after each save (without closing modal)
  const [existingLimits, setExistingLimits] = useState({
    invoicesPerMonth:            Number(initial?.extraLimits?.invoicesPerMonth            || 0),
    invoicesPerCustomerPerMonth: Number(initial?.extraLimits?.invoicesPerCustomerPerMonth || 0),
    customersPerMonth:           Number(initial?.extraLimits?.customersPerMonth           || 0),
    suppliersPerMonth:           Number(initial?.extraLimits?.suppliersPerMonth           || 0),
    ordersPerSupplierPerMonth:   Number(initial?.extraLimits?.ordersPerSupplierPerMonth   || 0),
  });

  // On mount, re-fetch fresh extraLimits from Firestore (initial prop may be stale)
  useEffect(() => {
    if (!isEdit || !initial?.uid) return;
    import("firebase/firestore").then(({ getDoc, doc: fsDoc }) => {
      import("@/lib/firebase").then(({ db: fdb }) => {
        getDoc(fsDoc(fdb, "users", initial.uid)).then(snap => {
          if (snap.exists()) {
            const lim = snap.data().extraLimits || {};
            setExistingLimits({
              invoicesPerMonth:            Number(lim.invoicesPerMonth            || 0),
              invoicesPerCustomerPerMonth: Number(lim.invoicesPerCustomerPerMonth || 0),
              customersPerMonth:           Number(lim.customersPerMonth           || 0),
              suppliersPerMonth:           Number(lim.suppliersPerMonth           || 0),
              ordersPerSupplierPerMonth:   Number(lim.ordersPerSupplierPerMonth   || 0),
            });
          }
        }).catch(() => {});
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, initial?.uid]);

  // addLimits = how much NEW quota admin wants to add on top of existing
  // (starts at 0, user types how much more to add)
  const [addLimits, setAddLimits] = useState(
    { invoicesPerMonth: "0", invoicesPerCustomerPerMonth: "0", customersPerMonth: "0", suppliersPerMonth: "0", ordersPerSupplierPerMonth: "0" }
  );

  // extraLimits = TOTAL = existing + new additions (what gets saved)
  const extraLimits = Object.fromEntries(
    EXTRA_FIELDS_LIST.map(f => [f.key, String(existingLimits[f.key] + (Number(addLimits[f.key]) || 0))])
  );

  const [extraSaving,    setExtraSaving]    = useState(false);
  const [extraDone,      setExtraDone]      = useState(false);
  const [addonConfirm,   setAddonConfirm]   = useState(false);
  const [addonSuccess,   setAddonSuccess]   = useState(null);
  const [addonPayMethod, setAddonPayMethod] = useState(initial?.paymentMethod || "cash");
  const [addonPrices,    setAddonPrices]    = useState(null);

  // Default add-on prices (fallback if Firestore not loaded yet)
  const DEFAULT_ADDON_P = {
    invoicesPerMonth_per: 10,
    invoicesPerMonth_50: 500, invoicesPerMonth_100: 900, invoicesPerMonth_250: 2000, invoicesPerMonth_500: 3500, invoicesPerMonth_1000: 6000,
    invoicesPerCustomerPerMonth_per: 10,
    invoicesPerCustomerPerMonth_50: 500, invoicesPerCustomerPerMonth_100: 900, invoicesPerCustomerPerMonth_250: 2000, invoicesPerCustomerPerMonth_500: 3500, invoicesPerCustomerPerMonth_1000: 6000,
    customersPerMonth_per: 30,
    customersPerMonth_50: 1200, customersPerMonth_100: 2200, customersPerMonth_250: 5000, customersPerMonth_500: 9000, customersPerMonth_1000: 16000,
    suppliersPerMonth_per: 30,
    suppliersPerMonth_20: 500, suppliersPerMonth_50: 1200, suppliersPerMonth_100: 2200, suppliersPerMonth_250: 5000, suppliersPerMonth_500: 9000, suppliersPerMonth_1000: 16000,
    ordersPerSupplierPerMonth_per: 10,
    ordersPerSupplierPerMonth_50: 500, ordersPerSupplierPerMonth_100: 900, ordersPerSupplierPerMonth_250: 2000, ordersPerSupplierPerMonth_500: 3500, ordersPerSupplierPerMonth_1000: 6000,
  };

  // ── Load addon prices from Firestore ─────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    import("firebase/firestore").then(({ getDoc, doc: fsDoc }) => {
      import("@/lib/firebase").then(({ db: fdb }) => {
        getDoc(fsDoc(fdb, "adminConfig", "plans")).then(snap => {
          setAddonPrices(snap.exists() && snap.data().addonPrices ? snap.data().addonPrices : DEFAULT_ADDON_P);
        }).catch(() => setAddonPrices(DEFAULT_ADDON_P));
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  // Tiered pricing: fills packages largest→smallest, remainder per-unit
  function calcTieredPrice(qty, perUnitPrice, packages) {
    if (qty <= 0) return { total: 0 };
    const sorted = [...packages].sort((a, b) => b.qty - a.qty);
    let remaining = qty;
    let total = 0;
    for (const pkg of sorted) {
      if (remaining >= pkg.qty) {
        const count = Math.floor(remaining / pkg.qty);
        total     += count * pkg.price;
        remaining -= count * pkg.qty;
      }
    }
    if (remaining > 0) total += remaining * perUnitPrice;
    return { total };
  }

  // calcAddonLineItems — prices only the NEW additions (delta), not existing quota
  function calcAddonLineItems(newAdditions, prices) {
    const p = prices || DEFAULT_ADDON_P;
    const items = [];

    function pushItem(qty, limitKey, icon, label) {
      if (qty <= 0) return;
      const CATS = {
        invoicesPerMonth:            { perKey: "invoicesPerMonth_per",            pkgQtys: [50,100,250,500,1000] },
        invoicesPerCustomerPerMonth: { perKey: "invoicesPerCustomerPerMonth_per", pkgQtys: [50,100,250,500,1000] },
        customersPerMonth:           { perKey: "customersPerMonth_per",           pkgQtys: [50,100,250,500,1000] },
        suppliersPerMonth:           { perKey: "suppliersPerMonth_per",           pkgQtys: [20,50,100,250,500,1000] },
        ordersPerSupplierPerMonth:   { perKey: "ordersPerSupplierPerMonth_per",   pkgQtys: [50,100,250,500,1000] },
      };
      const cat = CATS[limitKey]; if (!cat) return;
      const perUnit  = p[cat.perKey] ?? DEFAULT_ADDON_P[cat.perKey] ?? 10;
      const packages = cat.pkgQtys.map(q => ({ qty: q, price: p[`${limitKey}_${q}`] ?? DEFAULT_ADDON_P[`${limitKey}_${q}`] ?? (perUnit * q) }));
      const { total } = calcTieredPrice(qty, perUnit, packages);
      if (total > 0) items.push({ key: limitKey, icon, label: `${label}`, qty, unitPrice: Math.round(total / qty * 10) / 10, total });
    }

    pushItem(Number(newAdditions.invoicesPerMonth) || 0,            "invoicesPerMonth",            "🧾", "Extra Invoices / Month");
    pushItem(Number(newAdditions.invoicesPerCustomerPerMonth) || 0, "invoicesPerCustomerPerMonth", "👥", "Extra Inv. per Customer / Month");
    pushItem(Number(newAdditions.customersPerMonth) || 0,           "customersPerMonth",           "👤", "Extra Customers");
    pushItem(Number(newAdditions.suppliersPerMonth) || 0,           "suppliersPerMonth",           "🏭", "Extra Suppliers");
    pushItem(Number(newAdditions.ordersPerSupplierPerMonth) || 0,   "ordersPerSupplierPerMonth",   "🛒", "Extra Orders per Supplier / Month");

    return { items, grandTotal: items.reduce((s, i) => s + i.total, 0) };
  }

  // doSaveExtraLimits — saves TOTAL (existing + new) to Firestore
  async function doSaveExtraLimits() {
    setExtraSaving(true);
    setExtraDone(false);
    try {
      const token   = await getToken();
      const headers = { "Content-Type": "application/json", authorization: `Bearer ${token}` };
      // Save total = existing + new
      const cleaned = {};
      EXTRA_FIELDS_LIST.forEach(f => { cleaned[f.key] = existingLimits[f.key] + (Number(addLimits[f.key]) || 0); });
      const purchasedAt   = new Date().toISOString();
      const expiresAtDate = new Date(); expiresAtDate.setMonth(expiresAtDate.getMonth() + 1);
      const expiresAt     = expiresAtDate.toISOString();
      const res  = await fetch("/api/admin/update-user", { method: "POST", headers, body: JSON.stringify({ uid: initial.uid, extraLimits: cleaned, extraLimitsExpiresAt: expiresAt, extraLimitsPurchasedAt: purchasedAt, extraLimitsPaymentMethod: addonPayMethod }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExtraDone(true);

      // ── Re-fetch from Firestore to get confirmed saved values ──────────
      try {
        const { getDoc, doc: fsDoc } = await import("firebase/firestore");
        const { db: fdb }            = await import("@/lib/firebase");
        const freshSnap = await getDoc(fsDoc(fdb, "users", initial.uid));
        if (freshSnap.exists()) {
          const freshLimits = freshSnap.data().extraLimits || {};
          setExistingLimits({
            invoicesPerMonth:            Number(freshLimits.invoicesPerMonth            || 0),
            invoicesPerCustomerPerMonth: Number(freshLimits.invoicesPerCustomerPerMonth || 0),
            customersPerMonth:           Number(freshLimits.customersPerMonth           || 0),
            suppliersPerMonth:           Number(freshLimits.suppliersPerMonth           || 0),
            ordersPerSupplierPerMonth:   Number(freshLimits.ordersPerSupplierPerMonth   || 0),
          });
        } else {
          setExistingLimits({ ...cleaned });
        }
      } catch {
        // fallback: use what we just saved
        setExistingLimits({ ...cleaned });
      }

      // Invoice only for new additions
      const { items: lineItems, grandTotal } = calcAddonLineItems(addLimits, addonPrices);
      if (initial.email && lineItems.length > 0) {
        fetch("/api/admin/send-addon-invoice", { method: "POST", headers, body: JSON.stringify({ uid: initial.uid, userName: initial.name || initial.email, userEmail: initial.email, lineItems, grandTotal, paymentMethod: addonPayMethod, purchasedAt, expiresAt }) }).catch(() => {});
      }
      const expSucc = new Date(); expSucc.setMonth(expSucc.getMonth() + 1);
      setAddonSuccess({ items: lineItems, grandTotal, payMethod: addonPayMethod, expiresAt: expSucc.toISOString(), totalLimits: cleaned });
      // Reset additions to 0 after save
      setAddLimits({ invoicesPerMonth: "0", invoicesPerCustomerPerMonth: "0", customersPerMonth: "0", suppliersPerMonth: "0", ordersPerSupplierPerMonth: "0" });
      onToast?.("Extra limits saved! Invoice sent. ✓", "success");
      setTimeout(() => setExtraDone(false), 3000);
    } catch (err) {
      onToast?.(err.message || "Failed to save extra limits", "error");
    } finally {
      setExtraSaving(false);
    }
  }

  // ── Renewal state (edit mode only) ───────────────────────────────────────
  const [renewPayMethod,  setRenewPayMethod]  = useState(initial?.paymentMethod || "cash");
  const [renewSaving,     setRenewSaving]     = useState(false);
  const [renewDone,       setRenewDone]       = useState(false);
  const [renewConfirm,    setRenewConfirm]    = useState(false);   // "Are you sure?" popup
  const [renewSuccess,    setRenewSuccess]    = useState(null);    // success popup data

  // ── For NEW users: auto-set today as activeFrom + compute activeTo ───────
  useEffect(() => {
    if (!isEdit && !form.activeFrom) {
      const today = new Date().toISOString().slice(0, 10);
      const end   = calcEndDateStatic(today, form.billingPeriod || "monthly");
      setForm(p => ({ ...p, activeFrom: today, activeTo: end }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load plan options dynamically from Firestore ─────────────────────────
  const [dynamicPlans, setDynamicPlans] = useState(null);
  useEffect(() => {
    import("firebase/firestore").then(({ getDoc, doc: fsDoc }) => {
      import("@/lib/firebase").then(({ db: fdb }) => {
        getDoc(fsDoc(fdb, "adminConfig", "plans")).then(snap => {
          if (snap.exists()) {
            const list = snap.data().list || [];
            if (list.length > 0) setDynamicPlans(list);
          }
        }).catch(() => {});
      });
    });
  }, []);

  // Merge Firestore data with static PLAN_OPTIONS (keep color/ctaStyle from static)
  const activePlanOptions = (dynamicPlans || PLAN_OPTIONS).map(p => {
    const staticPlan = PLAN_OPTIONS.find(s => s.id === p.id) || {};
    const afterPrice = p.monthlyPrice || staticPlan.id;
    const beforePrice = p.beforeMonthlyPrice ?? null;
    return {
      ...staticPlan,
      id:    p.id    || staticPlan.id,
      label: `${p.icon || staticPlan.label?.split(" ")[0]} ${p.name || staticPlan.id}`,
      desc:  [
        p.maxDevices ? `${p.maxDevices} device${p.maxDevices > 1 ? "s" : ""}` : null,
        p.limits?.invoicesPerMonth !== undefined
          ? (p.limits.invoicesPerMonth === null ? "Unlimited invoices" : `${p.limits.invoicesPerMonth} invoices/mo`)
          : null,
        afterPrice
          ? (beforePrice
            ? `~~Rs.${Number(beforePrice).toLocaleString()}~~ Rs.${Number(afterPrice).toLocaleString()}/mo`
            : `Rs.${Number(afterPrice).toLocaleString()}/mo`)
          : null,
      ].filter(Boolean).join(" · ") || staticPlan.desc,
      color: staticPlan.color || "#10B981",
    };
  });

  // ── Helper: calculate end date from start date + billing period ─────────
  function calcEndDate(fromDateStr, period) {
    return calcEndDateStatic(fromDateStr, period);
  }

  // ── When subscriptionType changes to trial, auto-set dates ──────────────
  function handleSubscriptionTypeChange(type) {
    if (type === "trial") {
      const today = new Date();
      const trialEnd = new Date(today);
      trialEnd.setDate(today.getDate() + 7);
      const fmt = d => d.toISOString().slice(0, 10);
      setForm(p => ({ ...p, subscriptionType: "trial", activeFrom: fmt(today), activeTo: fmt(trialEnd) }));
    } else {
      setForm(p => ({ ...p, subscriptionType: "active" }));
    }
  }

  // ── When billingPeriod changes, auto-update activeTo ─────────────────────
  function handleBillingPeriodChange(period) {
    setForm(p => {
      const newActiveTo = p.activeFrom ? calcEndDate(p.activeFrom, period) : p.activeTo;
      return { ...p, billingPeriod: period, activeTo: newActiveTo };
    });
  }

  // ── When activeFrom changes, auto-update activeTo ────────────────────────
  function handleActiveFromChange(newFrom) {
    setForm(p => {
      if (p.subscriptionType === "trial") return { ...p, activeFrom: newFrom };
      const newActiveTo = newFrom ? calcEndDate(newFrom, p.billingPeriod || "monthly") : p.activeTo;
      return { ...p, activeFrom: newFrom, activeTo: newActiveTo };
    });
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg my-6 rounded-2xl"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>

        <div className="flex items-center justify-between px-6 py-5 rounded-t-2xl"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(245,158,11,0.04))" }}>
          <div>
            <h2 className="text-white font-black text-xl">{isEdit ? "Edit User" : "Register New User"}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{isEdit ? "Update user details and subscription" : "Create a new Novexa ERP account"}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">✕</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <SInput label="Full Name *" value={form.name} onChange={set("name")} placeholder="e.g. Ahmed Raza" required />
            <SInput label="Phone" value={form.phone} onChange={set("phone")} placeholder="+92 300 0000000" />
          </div>
          <SInput label="Email Address *" type="email" value={form.email} onChange={set("email")} placeholder="user@example.com" required />
          <SInput label={isEdit ? "New Password (leave blank to keep)" : "Password *"} type="password"
            value={form.password} onChange={set("password")} placeholder="Min. 8 characters" required={!isEdit} />
          <SInput label="Address" value={form.address} onChange={set("address")} placeholder="City, Street..." />

          {/* ── Subscription Type ── */}
          <div className="rounded-xl p-4" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.18)" }}>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">🎯 Subscription Type</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Active */}
              <button type="button" onClick={() => handleSubscriptionTypeChange("active")}
                className="flex flex-col items-start px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  background: form.subscriptionType === "active" ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${form.subscriptionType === "active" ? "#2563EB" : "rgba(255,255,255,0.08)"}`,
                  boxShadow: form.subscriptionType === "active" ? "0 0 14px rgba(37,99,235,0.25)" : "none",
                }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">✅</span>
                  <span className="text-sm font-bold" style={{ color: form.subscriptionType === "active" ? "#60a5fa" : "#9ca3af" }}>Active</span>
                </div>
                <span className="text-[10px] leading-tight" style={{ color: form.subscriptionType === "active" ? "#d1d5db" : "#4b5563" }}>
                  Full subscription — dates manually set karein
                </span>
              </button>

              {/* Trial */}
              <button type="button" onClick={() => handleSubscriptionTypeChange("trial")}
                className="flex flex-col items-start px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  background: form.subscriptionType === "trial" ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${form.subscriptionType === "trial" ? "#F59E0B" : "rgba(255,255,255,0.08)"}`,
                  boxShadow: form.subscriptionType === "trial" ? "0 0 14px rgba(245,158,11,0.25)" : "none",
                }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">⏳</span>
                  <span className="text-sm font-bold" style={{ color: form.subscriptionType === "trial" ? "#fbbf24" : "#9ca3af" }}>Trial</span>
                </div>
                <span className="text-[10px] leading-tight" style={{ color: form.subscriptionType === "trial" ? "#d1d5db" : "#4b5563" }}>
                  7 days free — auto dates set, auto freeze
                </span>
              </button>
            </div>
            {form.subscriptionType === "trial" && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <span className="text-amber-400 text-sm">⚠️</span>
                <p className="text-amber-400 text-[11px] font-medium">
                  Trial: {form.activeFrom} → {form.activeTo} (7 days). Account auto-freeze hoga.
                </p>
              </div>
            )}
          </div>

          {/* ── Subscription Period ── */}
          <div className="rounded-xl p-4" style={{ background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.15)" }}>
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">📅 Subscription Period</p>
            <p className="text-gray-600 text-[10px] mb-3">
              Start date change karein — end date automatically {form.billingPeriod === "yearly" ? "1 saal" : "1 mahina"} baad set ho jaayegi. Aap manually bhi change kar sakte hain.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <SInput label="Active From *" type="date" value={form.activeFrom}
                onChange={e => handleActiveFromChange(e.target.value)} required />
              <SInput label="Active Until *" type="date" value={form.activeTo} onChange={set("activeTo")} required />
            </div>
            <div>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                ⏰ Freeze Time
                <span className="text-gray-600 normal-case font-normal tracking-normal" style={{ fontSize: 10 }}>(optional — default 11:59 PM)</span>
              </label>
              <SInput type="time" value={form.activeToTime} onChange={set("activeToTime")} />
              {form.activeToTime && form.activeTo && (
                <p className="text-blue-400 text-[11px] mt-1.5 font-medium">✓ Will freeze on {form.activeTo} at {form.activeToTime}</p>
              )}
            </div>
          </div>

          {/* ── Plan / Package Selector ── */}
          <div className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">📦 Subscription Plan</p>
            <div className="grid grid-cols-2 gap-2">
              {activePlanOptions.map(opt => (
                <button key={opt.id} type="button"
                  onClick={() => {
                    // Use Firestore maxDevices if available, else static default
                    const fsPlan = dynamicPlans?.find(p => p.id === opt.id);
                    const devices = fsPlan?.maxDevices ?? PLAN_DEFAULT_DEVICES[opt.id] ?? 1;
                    setForm(p => ({ ...p, plan: opt.id, maxDevices: String(devices) }));
                  }}
                  className="flex flex-col items-start px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: form.plan === opt.id
                      ? `rgba(${opt.id === "starter" ? "16,185,129" : opt.id === "business" ? "37,99,235" : opt.id === "professional" ? "245,158,11" : "168,85,247"},0.18)`
                      : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${form.plan === opt.id ? opt.color : "rgba(255,255,255,0.08)"}`,
                    boxShadow: form.plan === opt.id ? `0 0 12px ${opt.color}30` : "none",
                  }}>
                  <span className="text-xs font-bold mb-0.5" style={{ color: form.plan === opt.id ? opt.color : "#9ca3af" }}>
                    {opt.label}
                  </span>
                  <span className="text-[10px] leading-tight" style={{ color: form.plan === opt.id ? "#d1d5db" : "#4b5563" }}>
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Device / Session Limit ── */}
          <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)" }}>
            <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-3">📱 Device / Session Limit</p>
            <div className="flex items-center gap-3">
              {/* Decrement */}
              <button type="button"
                onClick={() => setForm(p => ({ ...p, maxDevices: String(Math.max(1, Number(p.maxDevices) - 1)) }))}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all hover:scale-110 flex-shrink-0"
                style={{ background: "rgba(139,92,246,0.15)", border: "1.5px solid rgba(139,92,246,0.35)", color: "#c4b5fd" }}>
                −
              </button>

              {/* Number input */}
              <div className="flex-1 relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.maxDevices}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    const num = Math.max(1, Math.min(100, Number(val) || 1));
                    setForm(p => ({ ...p, maxDevices: String(num) }));
                  }}
                  className="w-full text-center font-black text-lg outline-none"
                  style={{
                    background: "rgba(139,92,246,0.1)",
                    border: "1.5px solid rgba(139,92,246,0.4)",
                    borderRadius: 10,
                    padding: "8px 12px",
                    color: "#c4b5fd",
                    MozAppearance: "textfield",
                  }}
                />
              </div>

              {/* Increment */}
              <button type="button"
                onClick={() => setForm(p => ({ ...p, maxDevices: String(Math.min(100, Number(p.maxDevices) + 1)) }))}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all hover:scale-110 flex-shrink-0"
                style={{ background: "rgba(139,92,246,0.15)", border: "1.5px solid rgba(139,92,246,0.35)", color: "#c4b5fd" }}>
                +
              </button>

              <span className="text-gray-400 text-sm font-medium flex-shrink-0">
                {Number(form.maxDevices) === 1 ? "Device" : "Devices"}
              </span>
            </div>

            {/* Quick presets */}
            <div className="flex gap-2 mt-3">
              {[1, 2, 3, 5, 10].map(n => (
                <button key={n} type="button"
                  onClick={() => setForm(p => ({ ...p, maxDevices: String(n) }))}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: Number(form.maxDevices) === n ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${Number(form.maxDevices) === n ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.06)"}`,
                    color: Number(form.maxDevices) === n ? "#c4b5fd" : "#4b5563",
                  }}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-gray-600 text-[10px] mt-2">Aap koi bhi number set kar sakte hain (1–100)</p>
          </div>

          {/* ── Billing Period ── */}
          <div className="rounded-xl p-4" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.18)" }}>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">🗓️ Billing Period</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "monthly",  label: "📅 Monthly",  desc: "Har mahina renewal" },
                { id: "yearly",   label: "📆 Yearly",   desc: "Saal bhar ki plan" },
              ].map(opt => (
                <button key={opt.id} type="button"
                  onClick={() => handleBillingPeriodChange(opt.id)}
                  className="flex flex-col items-start px-4 py-3 rounded-xl text-left transition-all"
                  style={{
                    background: form.billingPeriod === opt.id ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${form.billingPeriod === opt.id ? "#10B981" : "rgba(255,255,255,0.08)"}`,
                    boxShadow: form.billingPeriod === opt.id ? "0 0 14px rgba(16,185,129,0.2)" : "none",
                  }}>
                  <span className="text-sm font-bold mb-0.5" style={{ color: form.billingPeriod === opt.id ? "#34d399" : "#9ca3af" }}>
                    {opt.label}
                  </span>
                  <span className="text-[10px]" style={{ color: form.billingPeriod === opt.id ? "#d1d5db" : "#4b5563" }}>
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Payment Method ── */}
          <div className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.18)" }}>
            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">💳 Payment Method</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "online",  label: "🌐 Online",  desc: "Card / Bank transfer" },
                { id: "cash",    label: "💵 Cash",     desc: "Naqad ada ki" },
                { id: "cheque",  label: "🧾 Cheque",  desc: "Cheque se payment" },
              ].map(opt => (
                <button key={opt.id} type="button"
                  onClick={() => setForm(p => ({ ...p, paymentMethod: opt.id }))}
                  className="flex flex-col items-start px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: form.paymentMethod === opt.id ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${form.paymentMethod === opt.id ? "#F59E0B" : "rgba(255,255,255,0.08)"}`,
                    boxShadow: form.paymentMethod === opt.id ? "0 0 12px rgba(245,158,11,0.2)" : "none",
                  }}>
                  <span className="text-xs font-bold mb-0.5" style={{ color: form.paymentMethod === opt.id ? "#fbbf24" : "#9ca3af" }}>
                    {opt.label}
                  </span>
                  <span className="text-[10px] leading-tight" style={{ color: form.paymentMethod === opt.id ? "#d1d5db" : "#4b5563" }}>
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Renew Subscription (edit mode only) ── */}
          {isEdit && (() => {
            // Renewal logic:
            // - activeFrom stays the SAME (original start date, never changes)
            // - newEnd   = current activeTo + 1 month/year
            const currentEnd  = form.activeTo;
            const currentFrom = form.activeFrom;   // stays unchanged
            const period      = form.billingPeriod || "monthly";

            // New end = extend current end by 1 month or 1 year
            const newEnd = currentEnd ? calcRenewalEndDate(currentEnd, period) : "";
            // Display start of next period (currentEnd + 1 day) — shown in UI only, not saved
            const displayNewStart = calcRenewalDisplayStart(currentEnd);

            // Days remaining on current plan
            const daysRemaining = currentEnd
              ? Math.ceil((new Date(currentEnd + "T23:59:59") - new Date()) / 86400000)
              : null;

            async function handleRenew() {
              if (!newEnd) return;
              setRenewConfirm(false);
              setRenewSaving(true);
              try {
                const token   = await getToken();
                const headers = { "Content-Type": "application/json", authorization: `Bearer ${token}` };
                const renewedAt = new Date().toISOString();
                const body    = {
                  uid:           initial.uid,
                  // activeFrom intentionally NOT sent — keep original
                  activeTo:      newEnd,
                  paymentMethod: renewPayMethod,
                  lastRenewedAt: renewedAt,
                  lastRenewedBy: "admin",
                };
                const res  = await fetch("/api/admin/update-user", { method: "POST", headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                // Only update activeTo in form, keep activeFrom as-is
                setForm(p => ({ ...p, activeTo: newEnd, paymentMethod: renewPayMethod }));
                setRenewDone(true);

                // ── Send renewal confirmation email ──────────────────────
                if (initial.email) {
                  try {
                    const emailRes  = await fetch("/api/admin/send-renewal-email", {
                      method:  "POST",
                      headers,
                      body: JSON.stringify({
                        uid:           initial.uid,
                        userName:      initial.name || initial.email,
                        userEmail:     initial.email,
                        plan:          form.plan,
                        billingPeriod: form.billingPeriod,
                        paymentMethod: renewPayMethod,
                        activeFrom:    currentFrom,
                        activeTo:      newEnd,
                        periodStart:   displayNewStart,
                        renewedAt,
                      }),
                    });
                    const emailData = await emailRes.json();
                    if (!emailRes.ok) {
                      onToast?.(`Renewed but email failed: ${emailData.error || emailRes.status}`, "error");
                    }
                  } catch (emailErr) {
                    onToast?.(`Renewed but email error: ${emailErr.message}`, "error");
                  }
                }

                setRenewSuccess({ newStart: displayNewStart, newEnd, payMethod: renewPayMethod });
                onRenewSuccess?.();
              } catch (err) {
                onToast?.(err.message || "Renewal failed", "error");
              } finally {
                setRenewSaving(false);
              }
            }

            return (
              <div className="rounded-xl overflow-hidden"
                style={{ border: `1.5px solid ${renewDone ? "rgba(52,211,153,0.5)" : "rgba(52,211,153,0.35)"}`, background: "rgba(52,211,153,0.04)" }}>
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3"
                  style={{ borderBottom: "1px solid rgba(52,211,153,0.15)", background: "rgba(52,211,153,0.08)" }}>
                  <span className="text-base">🔄</span>
                  <div className="flex-1">
                    <p className="text-emerald-400 text-xs font-black uppercase tracking-widest">Subscription Renew Karein</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">
                      Current end date ke baad se automatically next period shuru hoga
                    </p>
                  </div>
                  {daysRemaining !== null && (
                    <div className="flex-shrink-0 px-2 py-1 rounded-lg text-center"
                      style={{
                        background: daysRemaining <= 0 ? "rgba(248,113,113,0.15)" : daysRemaining <= 7 ? "rgba(251,191,36,0.15)" : "rgba(52,211,153,0.12)",
                        border: `1px solid ${daysRemaining <= 0 ? "rgba(248,113,113,0.3)" : daysRemaining <= 7 ? "rgba(251,191,36,0.3)" : "rgba(52,211,153,0.25)"}`,
                      }}>
                      <p className="text-[9px] uppercase tracking-widest font-bold"
                        style={{ color: daysRemaining <= 0 ? "#f87171" : daysRemaining <= 7 ? "#fbbf24" : "#34d399" }}>
                        {daysRemaining <= 0 ? "Expired" : "Baaki"}
                      </p>
                      <p className="text-sm font-black leading-tight"
                        style={{ color: daysRemaining <= 0 ? "#f87171" : daysRemaining <= 7 ? "#fbbf24" : "#34d399" }}>
                        {Math.abs(daysRemaining)}d
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-4 flex flex-col gap-3">
                  {/* New period preview */}
                  {newEnd && (
                    <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl"
                      style={{ background: renewDone ? "rgba(52,211,153,0.1)" : "rgba(37,99,235,0.08)", border: `1px solid ${renewDone ? "rgba(52,211,153,0.3)" : "rgba(37,99,235,0.2)"}` }}>
                      <span className="text-sm">{renewDone ? "✅" : "📅"}</span>
                      <div className="flex-1">
                        <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-1">
                          {renewDone ? "Renewed — Updated End Date" : "New End Date (Preview)"}
                        </p>
                        {/* Start of new period — display only */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">New period starts:</span>
                          <span className="font-semibold" style={{ color: "#93c5fd" }}>
                            {displayNewStart ? new Date(displayNewStart + "T00:00:00").toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </span>
                        </div>
                        {/* End date extended */}
                        <div className="flex items-center gap-2 text-xs mt-1">
                          <span className="text-gray-500">End:</span>
                          <span className="text-gray-500 line-through text-[11px]">
                            {new Date(currentEnd + "T00:00:00").toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          <span className="text-xs">→</span>
                          <span className="font-bold" style={{ color: renewDone ? "#34d399" : "#93c5fd" }}>
                            {new Date(newEnd + "T00:00:00").toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <p className="text-gray-600 text-[10px] mt-1.5">
                          +{period === "yearly" ? "1 year" : "1 month"} from current end date
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Payment method for renewal */}
                  {!renewDone && (
                    <div>
                      <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold mb-2">💳 Renewal Payment Method</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "online", label: "🌐 Online", desc: "Card / Bank" },
                          { id: "cash",   label: "💵 Cash",   desc: "Naqad" },
                          { id: "cheque", label: "🧾 Cheque", desc: "Cheque" },
                        ].map(opt => (
                          <button key={opt.id} type="button"
                            onClick={() => setRenewPayMethod(opt.id)}
                            className="flex flex-col items-start px-3 py-2 rounded-xl text-left transition-all"
                            style={{
                              background: renewPayMethod === opt.id ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.03)",
                              border: `1.5px solid ${renewPayMethod === opt.id ? "#10B981" : "rgba(255,255,255,0.08)"}`,
                            }}>
                            <span className="text-xs font-bold" style={{ color: renewPayMethod === opt.id ? "#34d399" : "#9ca3af" }}>{opt.label}</span>
                            <span className="text-[10px]" style={{ color: renewPayMethod === opt.id ? "#d1d5db" : "#4b5563" }}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Renew / Renewed button */}
                  {renewDone ? (
                    <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }}>
                      ✅ Subscription Successfully Renewed!
                    </div>
                  ) : (
                    <button type="button" disabled={!newEnd}
                      onClick={() => setRenewConfirm(true)}
                      className="w-full py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.01] active:scale-[0.99]"
                      style={{
                        background: "linear-gradient(135deg,#10B981,#059669)",
                        color: "#fff",
                        opacity: !newEnd ? 0.5 : 1,
                        boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
                      }}>
                      🔄 Renew Subscription (+{period === "yearly" ? "1 Year" : "1 Month"})
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Extra Monthly Limits — moved to User Detail → Add-ons tab ── */}
          {isEdit && (() => {
            const hasAnyExtra = EXTRA_FIELDS_LIST.some(f => (existingLimits[f.key] || 0) > 0);
            const exp   = initial?.extraLimitsExpiresAt ? new Date(initial.extraLimitsExpiresAt) : null;
            const dLeft = exp ? Math.ceil((exp - new Date()) / 86400000) : null;
            return (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <span className="text-xl flex-shrink-0">⚡</span>
                <div className="flex-1 min-w-0">
                  <p className="text-amber-400 text-xs font-bold">Extra Add-on Quota</p>
                  <p className="text-gray-500 text-[10px] mt-0.5">
                    {hasAnyExtra
                      ? `Active — ${dLeft !== null && dLeft > 0 ? `${dLeft}d left` : dLeft !== null && dLeft <= 0 ? "Expired" : "Set"}`
                      : "No active add-ons"}
                    {" · "}
                    <span className="text-amber-500">User Detail → Add-ons tab</span> mein manage karein
                  </p>
                </div>
                {hasAnyExtra && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0"
                    style={{ background: dLeft !== null && dLeft <= 0 ? "rgba(248,113,113,0.15)" : "rgba(245,158,11,0.15)", border: `1px solid ${dLeft !== null && dLeft <= 0 ? "rgba(248,113,113,0.35)" : "rgba(245,158,11,0.35)"}`, color: dLeft !== null && dLeft <= 0 ? "#f87171" : "#fbbf24" }}>
                    {dLeft !== null && dLeft <= 0 ? "Expired" : `${dLeft}d`}
                  </span>
                )}
              </div>
            );
          })()}

          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl text-white font-bold text-sm mt-1 transition-all hover:scale-[1.01]"
            style={{ background: saving ? "rgba(37,99,235,0.4)" : "linear-gradient(135deg,#2563EB,#1d4ed8)", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving..." : isEdit ? "Save Changes →" : "Register User →"}
          </button>
        </form>
      </div>
    </div>

    {/* ── Confirm Renewal Popup ── */}
    {renewConfirm && isEdit && (() => {
      const period     = form.billingPeriod || "monthly";
      const currentEnd = form.activeTo;
      const currentFrom = form.activeFrom;   // stays unchanged
      // newEnd = extend current activeTo by 1 month/year (no -1 day)
      const newEnd = currentEnd ? calcRenewalEndDate(currentEnd, period) : "";
      // Display start = currentEnd + 1 day (shown in popup, not saved)
      const displayNewStart = calcRenewalDisplayStart(currentEnd);
      return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: "#0d1117", border: "1.5px solid rgba(16,185,129,0.4)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>
            <div className="px-6 pt-6 pb-4 text-center"
              style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.05))" }}>
              <div className="text-4xl mb-3">🔄</div>
              <h3 className="text-white font-black text-lg">Confirm Renewal</h3>
              <p className="text-gray-400 text-sm mt-1">
                Are you sure you want to renew <span className="text-white font-semibold">{initial?.name}</span>&apos;s subscription?
              </p>
            </div>
            <div className="px-6 py-4 flex flex-col gap-2">
              {[
                { label: "New Period Start",   value: displayNewStart ? new Date(displayNewStart+"T00:00:00").toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"}) : "—" },
                { label: "New End Date",        value: newEnd ? new Date(newEnd+"T00:00:00").toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"}) : "—" },
                { label: "Duration Extended",  value: period === "yearly" ? "+1 Year" : "+1 Month" },
                { label: "Payment Method",     value: renewPayMethod === "online" ? "Online" : renewPayMethod === "cheque" ? "Cheque" : "Cash" },
                { label: "Confirmation Email", value: `Will be sent to ${initial?.email}` },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-gray-500 text-xs uppercase tracking-widest font-bold">{r.label}</span>
                  <span className="text-white text-xs font-semibold text-right max-w-[55%]">{r.value}</span>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button type="button" onClick={() => setRenewConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                Cancel
              </button>
              <button type="button"
                onClick={() => {
                  // invoke the handleRenew captured in the IIFE scope by re-triggering via a custom event trick
                  // Instead, we store a pending flag and the IIFE picks it up
                  setRenewConfirm(false);
                  setRenewSaving(true);
                  (async () => {
                    try {
                      const token     = await getToken();
                      const headers   = { "Content-Type": "application/json", authorization: `Bearer ${token}` };
                      const renewedAt = new Date().toISOString();
                      const body      = { uid: initial.uid, activeTo: newEnd, paymentMethod: renewPayMethod, lastRenewedAt: renewedAt, lastRenewedBy: "admin" };
                      const res       = await fetch("/api/admin/update-user", { method: "POST", headers, body: JSON.stringify(body) });
                      const data      = await res.json();
                      if (!res.ok) throw new Error(data.error);
                      // Keep activeFrom unchanged, only update activeTo
                      setForm(p => ({ ...p, activeTo: newEnd, paymentMethod: renewPayMethod }));
                      setRenewDone(true);
                      if (initial.email) {
                        try {
                          const emailRes  = await fetch("/api/admin/send-renewal-email", { method: "POST", headers, body: JSON.stringify({ uid: initial.uid, userName: initial.name || initial.email, userEmail: initial.email, plan: form.plan, billingPeriod: form.billingPeriod, paymentMethod: renewPayMethod, activeFrom: currentFrom, activeTo: newEnd, periodStart: displayNewStart, renewedAt }) });
                          const emailData = await emailRes.json();
                          if (!emailRes.ok) onToast?.(`Renewed but email failed: ${emailData.error || emailRes.status}`, "error");
                        } catch (emailErr) {
                          onToast?.(`Renewed but email error: ${emailErr.message}`, "error");
                        }
                      }
                      setRenewSuccess({ newStart: displayNewStart, newEnd, payMethod: renewPayMethod });
                      onRenewSuccess?.();
                    } catch (err) {
                      onToast?.(err.message || "Renewal failed", "error");
                    } finally {
                      setRenewSaving(false);
                    }
                  })();
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff", boxShadow: "0 4px 16px rgba(16,185,129,0.35)" }}>
                Yes, Renew Now
              </button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* ── Processing Overlay ── */}
    {renewSaving && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}>
        <div className="flex flex-col items-center gap-5 px-8 py-10 rounded-2xl"
          style={{ background: "#0d1117", border: "1.5px solid rgba(16,185,129,0.3)", minWidth: 260 }}>
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
              style={{ borderTopColor: "#10B981", borderRightColor: "rgba(16,185,129,0.3)" }} />
            <div className="absolute inset-2 rounded-full flex items-center justify-center text-2xl">🔄</div>
          </div>
          <div className="text-center">
            <p className="text-white font-black text-base">Processing Renewal...</p>
            <p className="text-gray-500 text-sm mt-1">Updating subscription &amp; sending email</p>
          </div>
          <div className="flex flex-col gap-1.5 w-full">
            {["Saving new subscription dates", "Updating payment record", "Sending confirmation email"].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                  style={{ background: "#10B981", animationDelay: `${i * 0.2}s` }} />
                <span className="text-gray-400 text-xs">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* ── Success Popup ── */}
    {renewSuccess && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background: "#0d1117", border: "1.5px solid rgba(52,211,153,0.5)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height: 5, background: "linear-gradient(to right,#10B981,#34d399,#6ee7b7)" }} />
          <div className="px-6 pt-6 pb-3 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
              style={{ background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.4)" }}>
              ✅
            </div>
            <h3 className="text-white font-black text-xl">Renewed Successfully!</h3>
            <p className="text-gray-400 text-sm mt-1.5">
              <span className="text-white font-semibold">{initial?.name}</span>&apos;s subscription has been renewed and a confirmation email has been sent.
            </p>
          </div>
          <div className="px-6 py-3 mx-2 rounded-xl mb-4"
            style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
            {[
              { label: "New Period Starts", value: new Date(renewSuccess.newStart+"T00:00:00").toLocaleDateString("en-PK",{day:"2-digit",month:"long",year:"numeric"}) },
              { label: "New Period Ends",   value: new Date(renewSuccess.newEnd+"T00:00:00").toLocaleDateString("en-PK",{day:"2-digit",month:"long",year:"numeric"}) },
              { label: "Payment Method",   value: renewSuccess.payMethod === "online" ? "🌐 Online" : renewSuccess.payMethod === "cheque" ? "🧾 Cheque" : "💵 Cash" },
              { label: "Email Sent",       value: `✉️ ${initial?.email}` },
            ].map(r => (
              <div key={r.label} className="flex items-start justify-between gap-3 py-1.5"
                style={{ borderBottom: "1px solid rgba(16,185,129,0.1)" }}>
                <span className="text-gray-500 text-[11px] uppercase tracking-widest font-bold flex-shrink-0">{r.label}</span>
                <span className="text-emerald-300 text-xs font-semibold text-right">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="px-6 pb-6">
            <button type="button" onClick={() => setRenewSuccess(null)}
              className="w-full py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff", boxShadow: "0 4px 16px rgba(16,185,129,0.3)" }}>
              Done ✓
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Addon Confirm Popup ─────────────────────────────────────────────── */}
    {addonConfirm && isEdit && (() => {
      const { items: cItems, grandTotal: cTotal } = calcAddonLineItems(addLimits, addonPrices);
      const now       = new Date();
      const expDate   = new Date(now); expDate.setMonth(expDate.getMonth() + 1);
      const purchStr  = now.toLocaleDateString("en-PK",    { day: "2-digit", month: "short", year: "numeric" });
      const expiryStr = expDate.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
      return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)" }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: "#0d1117", border: "1.5px solid rgba(245,158,11,0.45)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
            <div className="px-6 pt-6 pb-4 text-center"
              style={{ background: "linear-gradient(135deg,rgba(245,158,11,0.1),rgba(217,119,6,0.05))" }}>
              <div className="text-4xl mb-3">⚡</div>
              <h3 className="text-white font-black text-lg">Confirm Add-on Purchase</h3>
              <p className="text-gray-400 text-sm mt-1">
                <span className="text-white font-semibold">{initial?.name}</span> ke liye extra quota activate karein?
              </p>
            </div>
            <div className="px-6 py-4 flex flex-col gap-1">
              {cItems.map(item => (
                <div key={item.key} className="flex items-center gap-2 py-1.5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-gray-300 text-xs flex-1">{item.label}</span>
                  <span className="text-gray-500 text-xs mr-1">×{item.qty}</span>
                  <span className="text-amber-300 text-xs font-bold">Rs. {item.total.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 pb-1">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Total</span>
                <span className="text-amber-300 font-black text-base">Rs. {cTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg mt-1"
                style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <span className="text-amber-400 text-xs">⏰</span>
                <p className="text-amber-400 text-[11px] font-medium">Valid: {purchStr} → {expiryStr} (1 month)</p>
              </div>
              <div className="flex items-center gap-2 py-1.5 mt-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-gray-500 text-xs uppercase tracking-widest font-bold">Payment</span>
                <span className="text-white text-xs font-semibold ml-auto">{addonPayMethod === "online" ? "🌐 Online" : addonPayMethod === "cheque" ? "🧾 Cheque" : "💵 Cash"}</span>
              </div>
              {initial?.email && (
                <div className="flex items-center gap-2 py-1.5">
                  <span className="text-gray-500 text-xs uppercase tracking-widest font-bold">Invoice Email</span>
                  <span className="text-blue-400 text-xs font-semibold ml-auto truncate max-w-[55%]">✉️ {initial.email}</span>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button type="button" onClick={() => setAddonConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                Cancel
              </button>
              <button type="button"
                onClick={() => { setAddonConfirm(false); doSaveExtraLimits(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}>
                ✓ Confirm &amp; Activate
              </button>
            </div>
          </div>
        </div>
      );
    })()}

    {/* ── Addon Processing Overlay ────────────────────────────────────────── */}
    {extraSaving && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}>
        <div className="flex flex-col items-center gap-5 px-8 py-10 rounded-2xl"
          style={{ background: "#0d1117", border: "1.5px solid rgba(245,158,11,0.3)", minWidth: 260 }}>
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
              style={{ borderTopColor: "#F59E0B", borderRightColor: "rgba(245,158,11,0.3)" }} />
            <div className="absolute inset-2 rounded-full flex items-center justify-center text-2xl">⚡</div>
          </div>
          <div className="text-center">
            <p className="text-white font-black text-base">Activating Add-on...</p>
            <p className="text-gray-500 text-sm mt-1">Saving limits &amp; sending invoice email</p>
          </div>
          <div className="flex flex-col gap-1.5 w-full">
            {["Saving extra quota", "Setting 1-month expiry", "Sending invoice email"].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                  style={{ background: "#F59E0B", animationDelay: `${i * 0.2}s` }} />
                <span className="text-gray-400 text-xs">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* ── Addon Success Popup ─────────────────────────────────────────────── */}
    {addonSuccess && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background: "#0d1117", border: "1.5px solid rgba(245,158,11,0.5)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height: 5, background: "linear-gradient(to right,#F59E0B,#fbbf24,#FCD34D)" }} />
          <div className="px-6 pt-6 pb-3 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
              style={{ background: "rgba(245,158,11,0.15)", border: "2px solid rgba(245,158,11,0.4)" }}>✅</div>
            <h3 className="text-white font-black text-xl">Add-on Activated!</h3>
            <p className="text-gray-400 text-sm mt-1.5">
              <span className="text-white font-semibold">{initial?.name}</span>&apos;s extra quota is now active and an invoice has been sent.
            </p>
          </div>
          <div className="px-6 py-3 mx-2 rounded-xl mb-4"
            style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
            {addonSuccess.items?.map(item => (
              <div key={item.key} className="flex items-center justify-between py-1.5"
                style={{ borderBottom: "1px solid rgba(245,158,11,0.1)" }}>
                <span className="text-gray-400 text-[11px]">{item.icon} {item.label} ×{item.qty}</span>
                <span className="text-amber-300 text-xs font-semibold">Rs. {item.total.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(245,158,11,0.1)" }}>
              <span className="text-gray-500 text-[11px] uppercase tracking-widest font-bold">Total Paid</span>
              <span className="text-amber-300 font-black">Rs. {addonSuccess.grandTotal?.toLocaleString()}</span>
            </div>
            {addonSuccess.expiresAt && (
              <div className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(245,158,11,0.1)" }}>
                <span className="text-gray-500 text-[11px] uppercase tracking-widest font-bold">Expires On</span>
                <span className="text-amber-300 text-xs font-semibold">⏰ {new Date(addonSuccess.expiresAt).toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" })}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-gray-500 text-[11px] uppercase tracking-widest font-bold">Invoice Sent</span>
              <span className="text-blue-400 text-xs font-semibold">✉️ {initial?.email}</span>
            </div>
          </div>
          <div className="px-6 pb-6">
            <button type="button" onClick={() => setAddonSuccess(null)}
              className="w-full py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000", boxShadow: "0 4px 16px rgba(245,158,11,0.3)" }}>
              Done ✓
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

/* ── User Detail Modal ────────────────────────────────────────────────────── */
function UserDetailModal({ detailUser, detailLoading, onClose, fmtDate, daysLeft }) {
  if (!detailUser && !detailLoading) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl my-6 rounded-2xl overflow-hidden"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>

        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(139,92,246,0.05))" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black"
              style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.25),rgba(245,158,11,0.15))", color: "#60A5FA", border: "1px solid rgba(37,99,235,0.3)" }}>
              {(detailUser?.user?.name || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-white font-black text-lg leading-none">{detailUser?.user?.name || "Loading..."}</h2>
              <p className="text-gray-500 text-xs mt-0.5">{detailUser?.user?.email}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">✕</button>
        </div>

        {detailLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-transparent animate-spin" />
          </div>
        ) : detailUser && (
          <div className="p-6 flex flex-col gap-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">👤 Profile</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Phone",    value: detailUser.user.phone   || "—" },
                  { label: "Address",  value: detailUser.user.address || "—" },
                  { label: "Registered", value: detailUser.user.createdAt ? new Date(detailUser.user.createdAt).toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"}) : "—" },
                  { label: "Email Verified", value: detailUser.authRecord?.emailVerified ? "✅ Yes" : "❌ No" },
                  { label: "Device Limit", value: `${detailUser.user.maxDevices||1} device${(detailUser.user.maxDevices||1)>1?"s":""}` },
                ].map(r => (
                  <div key={r.label} className="rounded-xl px-4 py-3"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                    <p className="text-white text-sm font-medium">{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">📅 Subscription</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label:"Active From", value: fmtDate(detailUser.user.activeFrom) },
                  { label:"Active Until", value: fmtDate(detailUser.user.activeTo) },
                  { label:"Days Left", value: (() => { const d=daysLeft(detailUser.user.activeTo); return d===null?"—":d<0?`Expired ${Math.abs(d)}d ago`:d===0?"Expires today!":`${d} days`; })() },
                  { label:"Billing Period", value: detailUser.user.billingPeriod === "yearly" ? "📆 Yearly" : detailUser.user.billingPeriod === "monthly" ? "📅 Monthly" : detailUser.user.billingPeriod || "—" },
                  { label:"Payment Method", value: detailUser.user.paymentMethod === "online" ? "🌐 Online" : detailUser.user.paymentMethod === "cheque" ? "🧾 Cheque" : detailUser.user.paymentMethod === "cash" ? "💵 Cash" : detailUser.user.paymentMethod || "—" },
                ].map(r => (
                  <div key={r.label} className="rounded-xl px-4 py-3"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                    <p className="text-white text-sm font-medium">{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">⚡ Activity</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label:"Last Login",   value: detailUser.user.lastLogin    ? new Date(detailUser.user.lastLogin).toLocaleString("en-PK")    : detailUser.authRecord?.lastSignInTime || "Never" },
                  { label:"Last Active",  value: detailUser.user.lastActiveAt ? new Date(detailUser.user.lastActiveAt).toLocaleString("en-PK") : "—" },
                  { label:"Login IP",     value: detailUser.user.lastLoginIP  || "—" },
                  { label:"Browser",      value: detailUser.user.lastBrowser  || "—" },
                  { label:"Device",       value: detailUser.user.lastDevice   || "—" },
                ].map(r => (
                  <div key={r.label} className="rounded-xl px-4 py-3"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                    <p className="text-white text-sm font-medium truncate">{r.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">🕐 Login History (last 20)</p>
              {detailUser.activityLogs.length === 0 ? (
                <p className="text-gray-600 text-xs px-1">No login history yet.</p>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div className="grid text-[10px] font-bold uppercase tracking-widest px-4 py-2"
                    style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.05)", gridTemplateColumns:"2fr 1fr 1fr 1fr" }}>
                    <span>Date & Time</span><span>IP</span><span>Browser</span><span>Device</span>
                  </div>
                  {detailUser.activityLogs.map((log, i) => (
                    <div key={log.id} className="grid px-4 py-2.5 text-xs hover:bg-white/[0.02] transition-colors"
                      style={{ gridTemplateColumns:"2fr 1fr 1fr 1fr", borderBottom: i<detailUser.activityLogs.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                      <span className="text-gray-400">{new Date(log.timestamp).toLocaleString("en-PK")}</span>
                      <span className="text-gray-500 font-mono text-[10px]">{log.ip}</span>
                      <span className="text-gray-400">{log.browser}</span>
                      <span className="text-gray-400">{log.device}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sidebar nav items ────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: "users",     icon: "👥", label: "Users",        badge: null },
  { id: "addons",    icon: "⚡", label: "Add-on Req.",  badge: null },
  { id: "packages",  icon: "📦", label: "Packages",     badge: null },
  { id: "inbox",     icon: "📬", label: "Support",      badge: null },
  { id: "analytics", icon: "📊", label: "Analytics",    badge: null },
  { id: "debug",     icon: "🔍", label: "Debug",        badge: null },
];

/* ── Stat Card ────────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, gradient, glow }) {
  return (
    <div className="relative rounded-2xl p-5 overflow-hidden group transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
      style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.08)", boxShadow: `0 0 0 0 ${glow}` }}>
      {/* glow bg */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20"
        style={{ background: gradient }} />
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-lg"
          style={{ background: gradient, boxShadow: `0 4px 16px ${glow}` }}>
          {icon}
        </div>
        <p className="text-white font-black text-3xl leading-none mb-1">{value}</p>
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

/* ── Main AdminPanel ──────────────────────────────────────────────────────── */
export default function AdminPanel() {
  const router = useRouter();
  const [user,          setUser]          = useState(null);
  const [authLoading,   setAuthLoading]   = useState(true);
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [showForm,      setShowForm]      = useState(false);
  const [editUser,      setEditUser]      = useState(null);
  const [confirm,       setConfirm]       = useState(null);
  const [search,        setSearch]        = useState("");
  const [toasts,        setToasts]        = useState([]);
  const [activeTab,     setActiveTab]     = useState("users");
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [debugInfo,     setDebugInfo]     = useState(null);
  const [detailUser,    setDetailUser]    = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedUid,   setSelectedUid]   = useState(null); // user detail screen
  const [pendingAddonCount, setPendingAddonCount] = useState(0); // live badge for add-on requests

  /* ── auth guard ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u || u.uid !== ADMIN_UID) { router.replace("/pages/login"); return; }
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  /* ── live pending add-on requests badge ── */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "addonRequests"), where("status", "==", "pending"));
    const unsub = onSnapshot(q, snap => setPendingAddonCount(snap.size), () => {});
    return () => unsub();
  }, [user]);

  /* ── toast ── */
  const toast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  /* ── token ── */
  const getToken = useCallback(async () => {
    if (user) return user.getIdToken(true);
    if (auth.currentUser) return auth.currentUser.getIdToken(true);
    throw new Error("Not authenticated");
  }, [user]);

  /* ── fetch users ── */
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/list-users", { headers: { authorization: `Bearer ${token}` } });
      const ct    = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error("Server error: " + (await res.text()).slice(0,120));
      const data  = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setUsers(data.users || []);
    } catch (err) {
      toast(err.message || "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  }, [user, toast, getToken]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /* ── save user ── */
  async function handleSaveUser(form) {
    setSaving(true);
    try {
      const token   = await getToken();
      const headers = { "Content-Type": "application/json", authorization: `Bearer ${token}` };
      if (editUser) {
        const body = { uid: editUser.uid, name: form.name, phone: form.phone, address: form.address, activeFrom: form.activeFrom, activeTo: form.activeTo, activeToTime: form.activeToTime, maxDevices: form.maxDevices, plan: form.plan, subscriptionType: form.subscriptionType, billingPeriod: form.billingPeriod, paymentMethod: form.paymentMethod };
        if (form.password) body.newPassword = form.password;
        const res  = await fetch("/api/admin/update-user", { method:"POST", headers, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast(`${form.name} updated successfully`);
      } else {
        const res  = await fetch("/api/admin/create-user", { method:"POST", headers, body: JSON.stringify(form) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast(`${form.name} registered successfully`);
      }
      setShowForm(false); setEditUser(null); fetchUsers();
    } catch (err) { toast(err.message || "Save failed", "error"); }
    finally { setSaving(false); }
  }

  /* ── freeze / unfreeze ── */
  async function handleToggleFreeze(uid, name, currentStatus) {
    const newStatus = currentStatus === "frozen" ? "active" : "frozen";
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type":"application/json", authorization:`Bearer ${token}` },
        body: JSON.stringify({ uid, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`${name} ${newStatus==="frozen"?"frozen":"unfrozen"} successfully`);
      fetchUsers();
    } catch (err) { toast(err.message||"Action failed","error"); }
    finally { setConfirm(null); }
  }

  /* ── toggle email feature ── */
  async function handleToggleEmail(uid, name, currentEnabled) {
    const newVal = !currentEnabled;
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid, emailFeatureEnabled: newVal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Email feature ${newVal ? "enabled" : "disabled"} for ${name}`);
      fetchUsers();
    } catch (err) { toast(err.message || "Action failed", "error"); }
    finally { setConfirm(null); }
  }

  /* ── delete user ── */
  async function handleDeleteUser(uid, name) {
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/delete-user", {
        method:"POST",
        headers:{ "Content-Type":"application/json", authorization:`Bearer ${token}` },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`${name} has been removed`);
      fetchUsers();
    } catch (err) { toast(err.message||"Delete failed","error"); }
    finally { setConfirm(null); }
  }

  /* ── debug ── */
  async function runDebug() {
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/debug", { headers:{ authorization:`Bearer ${token}` } });
      const data  = await res.json();
      setDebugInfo(data);
      setActiveTab("debug");
      toast("Debug info loaded","success");
    } catch (err) { toast("Debug failed: "+err.message,"error"); }
  }

  /* ── user detail ── */
  async function fetchUserDetail(uid) {
    setDetailLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch(`/api/admin/user-detail?uid=${uid}`, { headers:{ authorization:`Bearer ${token}` } });
      const data  = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetailUser(data);
    } catch (err) { toast(err.message||"Failed to load details","error"); }
    finally { setDetailLoading(false); }
  }

  /* ── derived ── */
  const activeCount = users.filter(u => u.status==="active").length;
  const frozenCount = users.filter(u => u.status==="frozen").length;
  const totalCount  = users.filter(u => u.status!=="deleted").length;
  const expiringIn7 = users.filter(u => { const d=daysLeft(u.activeTo); return d!==null&&d>=0&&d<=7&&u.status==="active"; }).length;

  const filteredUsers = users.filter(u => {
    if (u.status==="deleted") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q)||(u.phone||"").includes(q);
  });

  /* ── loading screen ── */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full border-4 border-transparent animate-spin"
            style={{ borderTopColor:"#2563EB", borderRightColor:"#F59E0B" }} />
          <p className="text-gray-600 text-sm font-medium tracking-widest uppercase">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex" style={{ fontFamily:"var(--font-poppins,sans-serif)" }}>
      <Toast toasts={toasts} />

      {/* ── User Detail Full-Screen Overlay ── */}
      {selectedUid && (
        <AdminUserDetail
          uid={selectedUid}
          getToken={getToken}
          onClose={() => setSelectedUid(null)}
          onToast={toast}
        />
      )}

      {/* Modals */}
      {(showForm || editUser) && (
        <UserFormModal initial={editUser} saving={saving}
          onClose={() => { setShowForm(false); setEditUser(null); }}
          onSave={handleSaveUser}
          getToken={getToken}
          onToast={toast}
          onRenewSuccess={fetchUsers} />
      )}
      <UserDetailModal
        detailUser={detailUser} detailLoading={detailLoading}
        onClose={() => setDetailUser(null)} fmtDate={fmtDate} daysLeft={daysLeft} />

      {confirm?.type==="freeze" && (
        <ConfirmDialog
          title={confirm.currentStatus==="frozen"?`Unfreeze ${confirm.name}?`:`Freeze ${confirm.name}?`}
          message={confirm.currentStatus==="frozen"?"This will restore their dashboard access immediately.":"Their dashboard access will be blocked until you unfreeze."}
          confirmLabel={confirm.currentStatus==="frozen"?"Yes, Unfreeze":"Yes, Freeze"}
          confirmColor={confirm.currentStatus==="frozen"?"rgba(52,211,153,0.2)":"rgba(96,165,250,0.2)"}
          onConfirm={() => handleToggleFreeze(confirm.uid,confirm.name,confirm.currentStatus)}
          onCancel={() => setConfirm(null)} />
      )}
      {confirm?.type==="delete" && (
        <ConfirmDialog
          title={`Remove ${confirm.name}?`}
          message="Their account will be disabled. Data stays safe in Firestore."
          confirmLabel="Yes, Remove"
          confirmColor="rgba(239,68,68,0.2)"
          onConfirm={() => handleDeleteUser(confirm.uid,confirm.name)}
          onCancel={() => setConfirm(null)} />
      )}
      {confirm?.type==="emailToggle" && (
        <ConfirmDialog
          title={confirm.currentEnabled ? `Disable Email for ${confirm.name}?` : `Enable Email for ${confirm.name}?`}
          message={confirm.currentEnabled
            ? "Invoice email feature will be disabled. Their Settings page will show a locked notice."
            : "Invoice email feature will be enabled. They can connect their Gmail and send invoice emails."}
          confirmLabel={confirm.currentEnabled ? "Yes, Disable" : "Yes, Enable"}
          confirmColor={confirm.currentEnabled ? "rgba(245,158,11,0.2)" : "rgba(52,211,153,0.2)"}
          onConfirm={() => handleToggleEmail(confirm.uid, confirm.name, confirm.currentEnabled)}
          onCancel={() => setConfirm(null)} />
      )}

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside
        className="flex flex-col h-screen sticky top-0 transition-all duration-300 z-30 flex-shrink-0"
        style={{
          width: sidebarOpen ? 240 : 72,
          background: "rgba(8,13,20,0.98)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
        }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
          <div className="relative w-10 h-10 flex-shrink-0">
            <Image src="/images/Novexa N Logo.png" alt="Novexa" fill className="object-contain" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-white font-black text-sm leading-tight whitespace-nowrap">Super Admin</p>
              <p className="text-gray-600 text-[9px] font-bold tracking-widest uppercase whitespace-nowrap">Novexa ERP</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className="flex items-center gap-3 rounded-xl transition-all duration-200 group relative"
                style={{
                  padding: sidebarOpen ? "10px 12px" : "10px 0",
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                  background: isActive
                    ? "linear-gradient(135deg,rgba(37,99,235,0.2),rgba(245,158,11,0.08))"
                    : "transparent",
                  border: isActive ? "1px solid rgba(37,99,235,0.25)" : "1px solid transparent",
                  color: isActive ? "#fff" : "#6b7280",
                }}>
                {/* active left bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ background:"linear-gradient(to bottom,#2563EB,#F59E0B)" }} />
                )}
                <span className="text-base flex-shrink-0 transition-transform group-hover:scale-110">{item.icon}</span>
                {sidebarOpen && (
                  <span className="text-sm font-semibold whitespace-nowrap flex-1">{item.label}</span>
                )}
                {/* Pending badge for add-ons */}
                {item.id === "addons" && pendingAddonCount > 0 && sidebarOpen && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-black flex-shrink-0"
                    style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.4)", minWidth: 18, textAlign: "center" }}>
                    {pendingAddonCount}
                  </span>
                )}
                {item.id === "addons" && pendingAddonCount > 0 && !sidebarOpen && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full"
                    style={{ background: "#fbbf24" }} />
                )}
                {!sidebarOpen && (
                  <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                    style={{ background:"rgba(13,17,23,0.95)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff" }}>
                    {item.label}{item.id === "addons" && pendingAddonCount > 0 ? ` (${pendingAddonCount})` : ""}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="px-3 pb-4" style={{ borderTop:"1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => setSidebarOpen(o => !o)}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all text-xs font-semibold mt-3">
            <span className="text-base transition-transform duration-300" style={{ transform: sidebarOpen?"rotate(0deg)":"rotate(180deg)" }}>◀</span>
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ══════════════════ MAIN CONTENT ══════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">

        {/* ── Top bar ── */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
          style={{ background:"rgba(8,13,20,0.97)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>

          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-white font-black text-base leading-tight">
                {NAV_ITEMS.find(n=>n.id===activeTab)?.icon} {" "}
                {activeTab==="users"?"User Management":activeTab==="addons"?"Add-on Requests":activeTab==="packages"?"Package Manager":activeTab==="inbox"?"Support Inbox":activeTab==="analytics"?"Analytics Overview":"Debug Console"}
              </h1>
              <p className="text-gray-600 text-[10px] font-semibold tracking-widest uppercase">{todayStr()}</p>
            </div>
            <DigitalClock />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={fetchUsers} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-white/10"
              style={{ border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
              <span className={loading?"animate-spin":""}>↻</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={runDebug}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-amber-500/10"
              style={{ border:"1px solid rgba(245,158,11,0.25)", color:"#fbbf24" }}>
              🔍 <span className="hidden sm:inline">Debug</span>
            </button>
            <button onClick={() => { setEditUser(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] hover:shadow-lg"
              style={{ background:"linear-gradient(135deg,#2563EB,#1d4ed8)", color:"#fff", boxShadow:"0 4px 16px rgba(37,99,235,0.3)" }}>
              ＋ <span className="hidden sm:inline">Register User</span>
            </button>
            <button onClick={() => signOut(auth).then(() => router.push("/pages/login"))}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-red-500/10"
              style={{ border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444" }}>
              🚪 <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 px-6 py-7">

          {/* ──────────── USERS TAB ──────────── */}
          {activeTab==="users" && (
            <div>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard icon="👥" label="Total Users"     value={totalCount}  gradient="linear-gradient(135deg,#2563EB,#1d4ed8)" glow="rgba(37,99,235,0.35)" />
                <StatCard icon="✅" label="Active"          value={activeCount} gradient="linear-gradient(135deg,#10b981,#059669)" glow="rgba(16,185,129,0.35)" />
                <StatCard icon="🔒" label="Frozen"          value={frozenCount} gradient="linear-gradient(135deg,#60a5fa,#3b82f6)" glow="rgba(96,165,250,0.35)" />
                <StatCard icon="⚠️" label="Expiring (7d)"  value={expiringIn7} gradient="linear-gradient(135deg,#F59E0B,#d97706)" glow="rgba(245,158,11,0.35)" />
              </div>

              {/* ── Subscription Expiry Timeline ── */}
              {(() => {
                const timeline = users
                  .filter(u => u.status !== "deleted" && u.activeTo)
                  .map(u => ({ ...u, dl: daysLeft(u.activeTo, u.activeToTime) }))
                  .filter(u => u.dl !== null && u.dl <= 30)
                  .sort((a, b) => a.dl - b.dl);

                if (timeline.length === 0) return null;

                return (
                  <div className="rounded-2xl mb-6 overflow-hidden"
                    style={{ background:"linear-gradient(135deg,rgba(245,158,11,0.05),rgba(255,255,255,0.02))", border:"1px solid rgba(245,158,11,0.18)" }}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3"
                      style={{ borderBottom:"1px solid rgba(245,158,11,0.1)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">⏳</span>
                        <p className="text-white font-bold text-sm">Subscription Expiry Watchlist</p>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background:"rgba(245,158,11,0.15)", color:"#fbbf24", border:"1px solid rgba(245,158,11,0.25)" }}>
                          {timeline.length} user{timeline.length!==1?"s":""}
                        </span>
                      </div>
                      <p className="text-gray-600 text-[10px] uppercase tracking-widest">Next 30 days</p>
                    </div>

                    {/* List */}
                    <div className="divide-y divide-white/[0.04]">
                      {timeline.map(u => {
                        const dl     = u.dl;
                        const isExp  = dl < 0;
                        const isToday = dl === 0;
                        const isCrit = dl >= 0 && dl <= 3;
                        const isWarn = dl > 3  && dl <= 7;
                        const color  = isExp ? "#f87171" : isToday ? "#f87171" : isCrit ? "#fb923c" : isWarn ? "#fbbf24" : "#a3a3a3";
                        const bgCol  = isExp ? "rgba(248,113,113,0.08)" : isCrit ? "rgba(251,146,60,0.06)" : isWarn ? "rgba(251,191,36,0.06)" : "transparent";

                        return (
                          <div key={u.uid}
                            className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-white/[0.02]"
                            style={{ background: bgCol }}>

                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
                              style={{ background:"linear-gradient(135deg,rgba(37,99,235,0.25),rgba(245,158,11,0.15))", color:"#60A5FA", border:"1px solid rgba(37,99,235,0.2)" }}>
                              {(u.name||"?").charAt(0).toUpperCase()}
                            </div>

                            {/* Name + email */}
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-semibold truncate">{u.name}</p>
                              <p className="text-gray-500 text-[11px] truncate">{u.email}</p>
                            </div>

                            {/* Expiry date */}
                            <div className="hidden sm:block text-right flex-shrink-0">
                              <p className="text-gray-600 text-[10px] uppercase tracking-widest">Expires</p>
                              <p className="text-gray-400 text-xs">{fmtDate(u.activeTo)}</p>
                            </div>

                            {/* Countdown pill */}
                            <div className="flex-shrink-0">
                              <span className="px-3 py-1.5 rounded-xl text-xs font-black tabular-nums"
                                style={{
                                  background: isExp ? "rgba(248,113,113,0.15)" : isCrit ? "rgba(251,146,60,0.15)" : isWarn ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.06)",
                                  border: `1px solid ${isExp ? "rgba(248,113,113,0.35)" : isCrit ? "rgba(251,146,60,0.35)" : isWarn ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.1)"}`,
                                  color,
                                }}>
                                {isExp   ? `Expired ${Math.abs(dl)}d ago`
                                 : isToday ? "🔴 Today!"
                                 : isCrit  ? `🔴 ${dl}d left`
                                 : isWarn  ? `🟡 ${dl}d left`
                                 :           `${dl}d left`}
                              </span>
                            </div>

                            {/* Status badge */}
                            <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                              {u.subscriptionType === "trial" && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                  style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
                                  ⏳ Trial
                                </span>
                              )}
                              {(() => { const ss = STATUS_STYLE[u.status]||STATUS_STYLE.active; return (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                  style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}` }}>
                                  {ss.label}
                                </span>
                              ); })()}
                            </div>

                            {/* Quick edit */}
                            <button onClick={() => setEditUser(u)} title="Renew subscription"
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all hover:bg-amber-500/20 hover:scale-110">
                              <span className="text-sm">✏️</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Search */}
              <div className="flex items-center gap-3 mb-5">
                <div className="relative flex-1 max-w-sm">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Search by name, email, phone..."
                    style={{ ...inputStyle, paddingLeft:34, width:"100%" }} />
                </div>
                <span className="text-gray-600 text-xs">{filteredUsers.length} user{filteredUsers.length!==1?"s":""}</span>
              </div>

              {/* Table */}
              <div className="rounded-2xl overflow-hidden"
                style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))", border:"1px solid rgba(255,255,255,0.08)" }}>

                <div className="hidden md:grid gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.06)", gridTemplateColumns:"2fr 2fr 1.2fr 1.8fr 1fr 0.8fr 1fr" }}>
                  <span>User</span><span>Email</span><span>Phone</span><span>Subscription</span><span>Status</span><span className="text-center">📧 Email</span><span>Actions</span>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-transparent animate-spin" />
                  </div>
                ) : filteredUsers.length===0 ? (
                  <div className="text-center py-16">
                    <p className="text-5xl mb-3">👥</p>
                    <p className="text-white font-semibold text-sm">No users found</p>
                    <p className="text-gray-500 text-xs mt-1">{search?"Try a different search":"Register your first user"}</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {filteredUsers.map((u, idx) => {
                      const ss = STATUS_STYLE[u.status] || STATUS_STYLE.active;
                      const dl = daysLeft(u.activeTo);
                      const isExpiringSoon = dl!==null&&dl>=0&&dl<=7&&u.status==="active";
                      return (
                        <div key={u.uid}
                          className="flex flex-col md:grid gap-4 px-5 py-4 transition-all duration-150 hover:bg-white/[0.025] group"
                          style={{ gridTemplateColumns:"2fr 2fr 1.2fr 1.8fr 1fr 0.8fr 1fr", borderBottom: idx<filteredUsers.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>

                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-transform group-hover:scale-105"
                              style={{ background:"linear-gradient(135deg,rgba(37,99,235,0.25),rgba(245,158,11,0.15))", color:"#60A5FA", border:"1px solid rgba(37,99,235,0.25)" }}>
                              {(u.name||"?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-white text-sm font-semibold truncate">{u.name}</p>
                              <p className="text-gray-600 text-[10px] md:hidden truncate">{u.email}</p>
                            </div>
                          </div>

                          <p className="text-gray-400 text-xs hidden md:flex items-center truncate">{u.email}</p>
                          <p className="text-gray-400 text-xs flex items-center">{u.phone||"—"}</p>

                          <div className="flex flex-col justify-center gap-0.5">
                            <p className="text-gray-400 text-[11px]">{fmtDate(u.activeFrom)} → {fmtDate(u.activeTo)}</p>
                            {dl!==null && (
                              <p className="text-[10px] font-semibold"
                                style={{ color: isExpiringSoon?"#fbbf24":dl<0?"#f87171":"#4b5563" }}>
                                {dl<0?`Expired ${Math.abs(dl)}d ago`:dl===0?"Expires today!":isExpiringSoon?`${dl}d left ⚠️`:`${dl}d left`}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {u.subscriptionType === "trial" && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
                                ⏳ Trial
                              </span>
                            )}
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                              style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}` }}>
                              {ss.label}
                            </span>
                          </div>

                          {/* Email feature toggle */}
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => setConfirm({ type: "emailToggle", uid: u.uid, name: u.name, currentEnabled: u.emailFeatureEnabled !== false })}
                              title={u.emailFeatureEnabled !== false ? "Disable Email Feature" : "Enable Email Feature"}
                              className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-300 focus:outline-none"
                              style={{
                                background: u.emailFeatureEnabled !== false
                                  ? "linear-gradient(135deg,#34d399,#059669)"
                                  : "rgba(255,255,255,0.1)",
                                border: u.emailFeatureEnabled !== false
                                  ? "1px solid rgba(52,211,153,0.4)"
                                  : "1px solid rgba(255,255,255,0.15)",
                              }}>
                              <span
                                className="inline-block w-4 h-4 transform bg-white rounded-full shadow-md transition-transform duration-300"
                                style={{ transform: u.emailFeatureEnabled !== false ? "translateX(24px)" : "translateX(4px)" }}
                              />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setSelectedUid(u.uid)} title="View Details"
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-purple-500/20 hover:scale-110">
                              <span className="text-sm">👁️</span>
                            </button>
                            <button onClick={() => setEditUser(u)} title="Edit"
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10 hover:scale-110">
                              <span className="text-sm">✏️</span>
                            </button>
                            <button
                              onClick={() => setConfirm({ type:"freeze", uid:u.uid, name:u.name, currentStatus:u.status })}
                              title={u.status==="frozen"?"Unfreeze":"Freeze"}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-blue-500/20 hover:scale-110">
                              <span className="text-sm">{u.status==="frozen"?"🔓":"🔒"}</span>
                            </button>
                            <button onClick={() => setConfirm({ type:"delete", uid:u.uid, name:u.name })} title="Remove"
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/20 hover:scale-110">
                              <span className="text-sm">🗑️</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────── ADD-ON REQUESTS TAB ──────────── */}
          {activeTab==="addons" && (
            <AdminAddonRequests getToken={getToken} onToast={toast} />
          )}

          {/* ──────────── SUPPORT INBOX TAB ──────────── */}
          {activeTab==="inbox" && (
            <SupportInbox getToken={getToken} onToast={toast} />
          )}

          {/* ──────────── PACKAGES TAB ──────────── */}
          {activeTab==="packages" && (
            <PackageManager getToken={getToken} onToast={toast} />
          )}

          {/* ──────────── ANALYTICS TAB ──────────── */}
          {activeTab==="analytics" && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard icon="👥" label="Total Users"     value={totalCount}  gradient="linear-gradient(135deg,#2563EB,#1d4ed8)" glow="rgba(37,99,235,0.35)" />
                <StatCard icon="✅" label="Active"          value={activeCount} gradient="linear-gradient(135deg,#10b981,#059669)" glow="rgba(16,185,129,0.35)" />
                <StatCard icon="🔒" label="Frozen"          value={frozenCount} gradient="linear-gradient(135deg,#60a5fa,#3b82f6)" glow="rgba(96,165,250,0.35)" />
                <StatCard icon="⚠️" label="Expiring (7d)"  value={expiringIn7} gradient="linear-gradient(135deg,#F59E0B,#d97706)" glow="rgba(245,158,11,0.35)" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Subscription breakdown */}
                <div className="rounded-2xl p-6"
                  style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))", border:"1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-white font-bold text-sm mb-5">📊 Subscription Breakdown</p>
                  {[
                    { label:"Active Users",     value:activeCount,  total:totalCount, color:"#34d399", bg:"rgba(52,211,153,0.15)" },
                    { label:"Frozen Users",     value:frozenCount,  total:totalCount, color:"#60a5fa", bg:"rgba(96,165,250,0.15)" },
                    { label:"Expiring in 7d",   value:expiringIn7,  total:totalCount, color:"#fbbf24", bg:"rgba(251,191,36,0.15)" },
                  ].map(item => (
                    <div key={item.label} className="mb-4">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-gray-400 text-xs font-medium">{item.label}</span>
                        <span className="text-white text-xs font-bold">{item.value} / {item.total}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.05)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width:`${item.total>0?(item.value/item.total)*100:0}%`, background:item.color, boxShadow:`0 0 8px ${item.color}60` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Expiring soon list */}
                <div className="rounded-2xl p-6"
                  style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))", border:"1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-white font-bold text-sm mb-5">⚠️ Expiring Soon</p>
                  {users.filter(u => { const d=daysLeft(u.activeTo); return d!==null&&d>=0&&d<=7&&u.status==="active"; }).length===0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                      <p className="text-3xl mb-2">🎉</p>
                      <p className="text-gray-500 text-sm">No subscriptions expiring soon</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {users.filter(u => { const d=daysLeft(u.activeTo); return d!==null&&d>=0&&d<=7&&u.status==="active"; }).map(u => (
                        <div key={u.uid} className="flex items-center justify-between px-4 py-3 rounded-xl"
                          style={{ background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.15)" }}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{ background:"rgba(245,158,11,0.15)", color:"#fbbf24" }}>
                              {(u.name||"?").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-white text-sm font-medium">{u.name}</span>
                          </div>
                          <span className="text-amber-400 text-xs font-bold">{daysLeft(u.activeTo)}d left</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ──────────── DEBUG TAB ──────────── */}
          {activeTab==="debug" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white font-bold text-base">Debug Console</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Inspect API state and admin auth tokens</p>
                </div>
                <button onClick={runDebug}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={{ background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.25)", color:"#fbbf24" }}>
                  🔍 Run Debug
                </button>
              </div>

              {!debugInfo ? (
                <div className="rounded-2xl p-10 text-center"
                  style={{ background:"rgba(245,158,11,0.03)", border:"1px dashed rgba(245,158,11,0.15)" }}>
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="text-gray-400 text-sm font-medium">Click "Run Debug" to inspect admin state</p>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden"
                  style={{ background:"rgba(8,13,20,0.8)", border:"1px solid rgba(245,158,11,0.2)" }}>
                  <div className="flex items-center justify-between px-5 py-3"
                    style={{ borderBottom:"1px solid rgba(245,158,11,0.12)", background:"rgba(245,158,11,0.05)" }}>
                    <span className="text-amber-400 font-bold text-xs uppercase tracking-widest">🔍 Debug Output</span>
                    <button onClick={() => setDebugInfo(null)} className="text-gray-600 hover:text-gray-400 transition-colors text-sm">✕</button>
                  </div>
                  <div className="p-5">
                    {Object.entries(debugInfo).map(([k,v]) => (
                      <div key={k} className="flex gap-3 py-1.5 font-mono text-xs"
                        style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                        <span className="text-gray-500 w-44 flex-shrink-0">{k}:</span>
                        <span className={String(v).includes("MISSING")||String(v).includes("FAILED")||String(v).includes("Unauthorized")
                          ?"text-red-400":"text-green-400"}>
                          {typeof v==="object"?JSON.stringify(v):String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </main>

        {/* Footer */}
        <footer className="px-6 py-3 text-center" style={{ borderTop:"1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-gray-700 text-[10px] font-mono">🔐 Super Admin-only panel — Novexa ERP v1.0</p>
        </footer>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}
