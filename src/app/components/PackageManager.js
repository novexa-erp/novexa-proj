"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── All dashboard tabs that can be toggled per plan ───────────────────────────
const ALL_TABS = [
  { id: "overview",    label: "Overview",    icon: "📊" },
  { id: "invoices",    label: "Invoices",    icon: "🧾" },
  { id: "customers",   label: "Customers",   icon: "👥" },
  { id: "inventory",   label: "Inventory",   icon: "📦" },
  { id: "payments",    label: "Payments",    icon: "💳" },
  { id: "purchases",   label: "Purchases",   icon: "🛒" },
  { id: "order-form",  label: "Order Form",  icon: "📋" },
  { id: "analytics",   label: "Analytics",   icon: "📈" },
  { id: "hr",          label: "HR",          icon: "👔" },
  { id: "branches",    label: "Branches",    icon: "🏢" },
  { id: "settings",    label: "Settings",    icon: "⚙️" },
  { id: "contact",     label: "Contact Us",  icon: "📞" },
  { id: "my-tickets",  label: "My Tickets",  icon: "🎫" },
];

// ── Default plans (used when Firestore has no data yet) ───────────────────────
const DEFAULT_PLANS = [
  {
    id: "starter",
    name: "Starter",
    icon: "💎",
    color: "#10B981",
    monthlyPrice: 2499,       // Main price (shown big — becomes crossed if afterMonthlyPrice set)
    yearlyPrice: 24990,
    afterMonthlyPrice: null,  // Discount price — if set, main becomes crossed, this shown big
    afterYearlyPrice: null,
    discountLabel: "",        // e.g. "Early Bird" — blank = no badge
    maxDevices: 1,
    limits: {
      invoicesPerMonth: 100,
      invoicesPerCustomerPerMonth: 100,
      customersPerMonth: 100,
      suppliersPerMonth: 20,
      ordersPerSupplierPerMonth: 100,
    },
    allowedTabs: ["overview","invoices","customers","inventory","payments","purchases","settings","contact","my-tickets"],
  },
  {
    id: "business",
    name: "Business",
    icon: "🚀",
    color: "#2563EB",
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    afterMonthlyPrice: null,
    afterYearlyPrice: null,
    discountLabel: "",
    maxDevices: 5,
    limits: {
      invoicesPerMonth: 1000,
      invoicesPerCustomerPerMonth: 1000,
      customersPerMonth: 500,
      suppliersPerMonth: 100,
      ordersPerSupplierPerMonth: 500,
    },
    allowedTabs: ["overview","invoices","customers","inventory","payments","purchases","order-form","analytics","settings","contact","my-tickets"],
  },
  {
    id: "professional",
    name: "Professional",
    icon: "👑",
    color: "#F59E0B",
    monthlyPrice: 8999,
    yearlyPrice: 89990,
    afterMonthlyPrice: null,
    afterYearlyPrice: null,
    discountLabel: "",
    maxDevices: 15,
    limits: {
      invoicesPerMonth: 5000,
      invoicesPerCustomerPerMonth: 5000,
      customersPerMonth: 2000,
      suppliersPerMonth: 500,
      ordersPerSupplierPerMonth: 2000,
    },
    allowedTabs: ["overview","invoices","customers","inventory","payments","purchases","order-form","analytics","hr","branches","settings","contact","my-tickets"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: "🏢",
    color: "#A855F7",
    monthlyPrice: null,
    yearlyPrice: null,
    afterMonthlyPrice: null,
    afterYearlyPrice: null,
    discountLabel: "",
    maxDevices: 50,
    limits: {
      invoicesPerMonth: null,
      invoicesPerCustomerPerMonth: null,
      customersPerMonth: null,
      suppliersPerMonth: null,
      ordersPerSupplierPerMonth: null,
    },
    allowedTabs: ["overview","invoices","customers","inventory","payments","purchases","order-form","analytics","hr","branches","settings","contact","my-tickets"],
  },
];

const LIMIT_FIELDS = [
  { key: "invoicesPerMonth",             label: "Invoices / Month",                   icon: "🧾" },
  { key: "invoicesPerCustomerPerMonth",  label: "Invoices per Customer / Month",      icon: "👥" },
  { key: "customersPerMonth",            label: "Customers / Month",                  icon: "👤" },
  { key: "suppliersPerMonth",            label: "Suppliers / Month",                  icon: "🏭" },
  { key: "ordersPerSupplierPerMonth",    label: "Orders per Supplier / Month",        icon: "🛒" },
];

// ── Add-on fields with tiered pricing ────────────────────────────────────────
// Each category: per-unit price + packages (qty → price)
// Price rules:
//   < smallest package qty → per-unit rate × qty
//   >= a package qty       → that package's flat price
const ADDON_CATEGORIES = [
  {
    limitKey: "invoicesPerMonth",
    label: "Extra Invoices / Month",
    icon: "🧾",
    perUnitKey: "invoicesPerMonth_per",
    perUnitLabel: "Per Invoice",
    defaultPerUnit: 10,
    packages: [
      { key: "invoicesPerMonth_50",   qty: 50,   defaultPrice: 500  },
      { key: "invoicesPerMonth_100",  qty: 100,  defaultPrice: 900  },
      { key: "invoicesPerMonth_250",  qty: 250,  defaultPrice: 2000 },
      { key: "invoicesPerMonth_500",  qty: 500,  defaultPrice: 3500 },
      { key: "invoicesPerMonth_1000", qty: 1000, defaultPrice: 6000 },
    ],
  },
  {
    limitKey: "invoicesPerCustomerPerMonth",
    label: "Extra Invoices per Customer / Month",
    icon: "👥",
    perUnitKey: "invoicesPerCustomerPerMonth_per",
    perUnitLabel: "Per Invoice",
    defaultPerUnit: 10,
    packages: [
      { key: "invoicesPerCustomerPerMonth_50",   qty: 50,   defaultPrice: 500  },
      { key: "invoicesPerCustomerPerMonth_100",  qty: 100,  defaultPrice: 900  },
      { key: "invoicesPerCustomerPerMonth_250",  qty: 250,  defaultPrice: 2000 },
      { key: "invoicesPerCustomerPerMonth_500",  qty: 500,  defaultPrice: 3500 },
      { key: "invoicesPerCustomerPerMonth_1000", qty: 1000, defaultPrice: 6000 },
    ],
  },
  {
    limitKey: "customersPerMonth",
    label: "Extra Customers",
    icon: "👤",
    perUnitKey: "customersPerMonth_per",
    perUnitLabel: "Per Customer",
    defaultPerUnit: 30,
    packages: [
      { key: "customersPerMonth_50",   qty: 50,   defaultPrice: 1200 },
      { key: "customersPerMonth_100",  qty: 100,  defaultPrice: 2200 },
      { key: "customersPerMonth_250",  qty: 250,  defaultPrice: 5000 },
      { key: "customersPerMonth_500",  qty: 500,  defaultPrice: 9000 },
      { key: "customersPerMonth_1000", qty: 1000, defaultPrice: 16000 },
    ],
  },
  {
    limitKey: "suppliersPerMonth",
    label: "Extra Suppliers",
    icon: "🏭",
    perUnitKey: "suppliersPerMonth_per",
    perUnitLabel: "Per Supplier",
    defaultPerUnit: 30,
    packages: [
      { key: "suppliersPerMonth_20",   qty: 20,   defaultPrice: 500  },
      { key: "suppliersPerMonth_50",   qty: 50,   defaultPrice: 1200 },
      { key: "suppliersPerMonth_100",  qty: 100,  defaultPrice: 2200 },
      { key: "suppliersPerMonth_250",  qty: 250,  defaultPrice: 5000 },
      { key: "suppliersPerMonth_500",  qty: 500,  defaultPrice: 9000 },
      { key: "suppliersPerMonth_1000", qty: 1000, defaultPrice: 16000 },
    ],
  },
  {
    limitKey: "ordersPerSupplierPerMonth",
    label: "Extra Orders per Supplier / Month",
    icon: "🛒",
    perUnitKey: "ordersPerSupplierPerMonth_per",
    perUnitLabel: "Per Order",
    defaultPerUnit: 10,
    packages: [
      { key: "ordersPerSupplierPerMonth_50",   qty: 50,   defaultPrice: 500  },
      { key: "ordersPerSupplierPerMonth_100",  qty: 100,  defaultPrice: 900  },
      { key: "ordersPerSupplierPerMonth_250",  qty: 250,  defaultPrice: 2000 },
      { key: "ordersPerSupplierPerMonth_500",  qty: 500,  defaultPrice: 3500 },
      { key: "ordersPerSupplierPerMonth_1000", qty: 1000, defaultPrice: 6000 },
    ],
  },
];

// ── Extra User Seat pricing (simple per-user flat rate, no tiers) ─────────────
const DEFAULT_USER_SEAT_PRICE = 1000; // Rs. per extra user / month

// Flat list of all price keys for Firestore storage
const DEFAULT_ADDON_PRICES = (() => {
  const out = {};
  ADDON_CATEGORIES.forEach(cat => {
    out[cat.perUnitKey] = cat.defaultPerUnit;
    cat.packages.forEach(pkg => { out[pkg.key] = pkg.defaultPrice; });
  });
  out["extraUser_monthly"] = DEFAULT_USER_SEAT_PRICE;
  return out;
})();

const inputSt = {
  outline: "none", background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: 10,
  padding: "8px 12px", color: "#fff", fontSize: 13, width: "100%",
};

export default function PackageManager({ getToken, onToast }) {
  const [plans,       setPlans]       = useState(null); // null = loading
  const [addonPrices, setAddonPrices] = useState(null); // null = loading
  const [saving,      setSaving]      = useState(false);
  const [activeId,    setActiveId]    = useState("starter");

  // ── Load from Firestore ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, "adminConfig", "plans"));
      if (snap.exists()) {
        const data = snap.data();
        setPlans(data.list || DEFAULT_PLANS);
        setAddonPrices(data.addonPrices || DEFAULT_ADDON_PRICES);
      } else {
        setPlans(DEFAULT_PLANS);
        setAddonPrices(DEFAULT_ADDON_PRICES);
      }
    } catch {
      setPlans(DEFAULT_PLANS);
      setAddonPrices(DEFAULT_ADDON_PRICES);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Save to Firestore ─────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(db, "adminConfig", "plans"), {
        list: plans,
        addonPrices: addonPrices || DEFAULT_ADDON_PRICES,
        updatedAt: new Date().toISOString(),
      });
      onToast("Plans saved successfully! ✓", "success");
    } catch (err) {
      onToast("Save failed: " + err.message, "error");
    }
    setSaving(false);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function updatePlan(id, field, value) {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }
  function updateLimit(id, key, value) {
    setPlans(prev => prev.map(p =>
      p.id === id ? { ...p, limits: { ...p.limits, [key]: value === "" || value === "∞" ? null : Number(value) } } : p
    ));
  }
  function toggleTab(planId, tabId) {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p;
      const has = p.allowedTabs.includes(tabId);
      return { ...p, allowedTabs: has ? p.allowedTabs.filter(t => t !== tabId) : [...p.allowedTabs, tabId] };
    }));
  }

  if (!plans || !addonPrices) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-t-amber-500 border-transparent animate-spin" />
      </div>
    );
  }

  const activePlan = plans.find(p => p.id === activeId) || plans[0];

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-black text-xl">📦 Package Manager</h2>
          <p className="text-gray-500 text-xs mt-0.5">Plans ke limits, tabs, aur prices yahan set karein</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
          style={{
            background: saving ? "rgba(37,99,235,0.4)" : "linear-gradient(135deg,#2563EB,#1d4ed8)",
            color: "#fff", opacity: saving ? 0.7 : 1,
          }}>
          {saving ? "Saving..." : "💾 Save All Changes"}
        </button>
      </div>

      {/* Plan selector tabs */}
      <div className="flex gap-2 flex-wrap">
        {plans.map(p => (
          <button key={p.id} onClick={() => setActiveId(p.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: activeId === p.id ? `rgba(${p.id === "starter" ? "16,185,129" : p.id === "business" ? "37,99,235" : p.id === "professional" ? "245,158,11" : "168,85,247"},0.18)` : "rgba(255,255,255,0.04)",
              border: `1.5px solid ${activeId === p.id ? p.color : "rgba(255,255,255,0.08)"}`,
              color: activeId === p.id ? p.color : "#6b7280",
              boxShadow: activeId === p.id ? `0 0 16px ${p.color}30` : "none",
            }}>
            <span>{p.icon}</span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Active plan editor */}
      {activePlan && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Left: Basic Info + Pricing */}
          <div className="flex flex-col gap-4">

            {/* Plan Name & Icon */}
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: activePlan.color }}>
                {activePlan.icon} Plan Info
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ display: "block", color: "#9ca3af", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Plan Name</label>
                  <input value={activePlan.name} onChange={e => updatePlan(activePlan.id, "name", e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={{ display: "block", color: "#9ca3af", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Icon / Emoji</label>
                  <input value={activePlan.icon} onChange={e => updatePlan(activePlan.id, "icon", e.target.value)} style={inputSt} maxLength={4} />
                </div>
                <div>
                  <label style={{ display: "block", color: "#9ca3af", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Color (hex)</label>
                  <div className="flex gap-2">
                    <input type="color" value={activePlan.color} onChange={e => updatePlan(activePlan.id, "color", e.target.value)}
                      style={{ width: 40, height: 38, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", padding: 2 }} />
                    <input value={activePlan.color} onChange={e => updatePlan(activePlan.id, "color", e.target.value)} style={{ ...inputSt, flex: 1 }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", color: "#9ca3af", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Max Devices</label>
                  <input type="number" min="1" value={activePlan.maxDevices ?? ""} onChange={e => updatePlan(activePlan.id, "maxDevices", e.target.value === "" ? null : Number(e.target.value))} style={inputSt} placeholder="e.g. 5" />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="rounded-2xl p-5" style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-4">💰 Pricing (PKR)</p>

              {/* Discount label */}
              <div className="mb-4">
                <label style={{ display: "block", color: "#9ca3af", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                  Discount Label
                  <span style={{ color: "#4b5563", fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>(e.g. "Early Bird" — blank = no badge)</span>
                </label>
                <input
                  value={activePlan.discountLabel ?? ""}
                  onChange={e => updatePlan(activePlan.id, "discountLabel", e.target.value)}
                  style={inputSt} placeholder='e.g. Early Bird, Sale, Launch Offer'
                />
              </div>

              {/* Monthly: Before → After */}
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">📅 Monthly</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label style={{ display: "block", color: "#fbbf24", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                    Main Price (shown big)
                  </label>
                  <input type="number" min="0"
                    value={activePlan.monthlyPrice ?? ""}
                    onChange={e => updatePlan(activePlan.id, "monthlyPrice", e.target.value === "" ? null : Number(e.target.value))}
                    style={inputSt}
                    placeholder="e.g. 2499 (blank = Custom)"
                  />
                </div>
                <div>
                  <label style={{ display: "block", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                    Discount Price (main crossed, this shown big)
                  </label>
                  <input type="number" min="0"
                    value={activePlan.afterMonthlyPrice ?? ""}
                    onChange={e => updatePlan(activePlan.id, "afterMonthlyPrice", e.target.value === "" ? null : Number(e.target.value))}
                    style={{ ...inputSt, color: "#34d399" }}
                    placeholder="blank = no discount"
                  />
                </div>
              </div>

              {/* Yearly: Before → After */}
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">📅 Yearly</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ display: "block", color: "#fbbf24", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                    Main Price (shown big)
                  </label>
                  <input type="number" min="0"
                    value={activePlan.yearlyPrice ?? ""}
                    onChange={e => updatePlan(activePlan.id, "yearlyPrice", e.target.value === "" ? null : Number(e.target.value))}
                    style={inputSt}
                    placeholder="e.g. 24990 (blank = Custom)"
                  />
                </div>
                <div>
                  <label style={{ display: "block", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                    Discount Price (main crossed, this shown big)
                  </label>
                  <input type="number" min="0"
                    value={activePlan.afterYearlyPrice ?? ""}
                    onChange={e => updatePlan(activePlan.id, "afterYearlyPrice", e.target.value === "" ? null : Number(e.target.value))}
                    style={{ ...inputSt, color: "#34d399" }}
                    placeholder="blank = no discount"
                  />
                </div>
              </div>
              <p className="text-gray-600 text-[10px] mt-3">
                Discount Price blank → sirf Main Price dikhegi, koi strikethrough nahi.
                Main Price blank → "Custom" dikhega.
              </p>
            </div>

            {/* Monthly Limits */}
            <div className="rounded-2xl p-5" style={{ background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.15)" }}>
              <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">📊 Monthly Limits</p>
              <div className="flex flex-col gap-3">
                {LIMIT_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center gap-3">
                    <span className="text-base w-6 flex-shrink-0">{f.icon}</span>
                    <span className="text-gray-400 text-xs flex-1">{f.label}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="0"
                        value={activePlan.limits[f.key] ?? ""}
                        onChange={e => updateLimit(activePlan.id, f.key, e.target.value)}
                        style={{ ...inputSt, width: 90, textAlign: "center" }}
                        placeholder="∞"
                      />
                      <button type="button"
                        onClick={() => updateLimit(activePlan.id, f.key, null)}
                        title="Set Unlimited"
                        className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all hover:scale-105"
                        style={{
                          background: activePlan.limits[f.key] === null ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${activePlan.limits[f.key] === null ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: activePlan.limits[f.key] === null ? "#34d399" : "#6b7280",
                        }}>
                        ∞
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-gray-600 text-[10px] mt-3">Field blank ya ∞ = unlimited. Monthly auto-reset hota hai.</p>
            </div>
          </div>

          {/* Right: Tab Permissions */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: activePlan.color }}>
              🔐 Dashboard Tabs
            </p>
            <p className="text-gray-600 text-[10px] mb-4">Toggle karo which tabs is plan mein accessible honge</p>

            <div className="flex flex-col gap-2">
              {ALL_TABS.map(tab => {
                const allowed = activePlan.allowedTabs.includes(tab.id);
                const isCore  = tab.id === "overview" || tab.id === "settings" || tab.id === "contact" || tab.id === "my-tickets";
                return (
                  <button key={tab.id} type="button"
                    onClick={() => !isCore && toggleTab(activePlan.id, tab.id)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200"
                    style={{
                      background: allowed ? `rgba(${activePlan.id === "starter" ? "16,185,129" : activePlan.id === "business" ? "37,99,235" : activePlan.id === "professional" ? "245,158,11" : "168,85,247"},0.10)` : "rgba(255,255,255,0.02)",
                      border: `1px solid ${allowed ? activePlan.color + "50" : "rgba(255,255,255,0.06)"}`,
                      cursor: isCore ? "not-allowed" : "pointer",
                      opacity: isCore ? 0.7 : 1,
                    }}>
                    <span className="text-base w-6">{tab.icon}</span>
                    <span className="text-sm font-medium flex-1" style={{ color: allowed ? "#fff" : "#4b5563" }}>{tab.label}</span>
                    {isCore ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: "rgba(255,255,255,0.06)", color: "#4b5563" }}>Always On</span>
                    ) : (
                      <div className="w-10 h-5 rounded-full relative transition-all duration-300 flex-shrink-0"
                        style={{ background: allowed ? activePlan.color : "rgba(255,255,255,0.1)" }}>
                        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300"
                          style={{ left: allowed ? "calc(100% - 18px)" : "2px" }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            <div className="mt-4 px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-gray-500 text-xs">
                <span className="font-bold" style={{ color: activePlan.color }}>
                  {activePlan.allowedTabs.length}
                </span>
                {" "}tabs allowed ·{" "}
                <span className="font-bold text-gray-600">
                  {ALL_TABS.length - activePlan.allowedTabs.length}
                </span>
                {" "}locked
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Add-on Prices ───────────────────────────────────────────────── */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(245,158,11,0.04)", border: "1.5px solid rgba(245,158,11,0.25)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⚡</span>
          <p className="text-amber-400 text-sm font-black uppercase tracking-widest">Add-on Prices (PKR)</p>
        </div>
        <p className="text-gray-600 text-[10px] mb-5">
          Har add-on 1 mahine ke liye valid. Smallest package se kam qty → per-unit rate × qty.
        </p>
        <div className="flex flex-col gap-6">
          {ADDON_CATEGORIES.map(cat => (
            <div key={cat.limitKey}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{cat.icon}</span>
                <p className="text-gray-300 text-xs font-bold">{cat.label}</p>
              </div>
              {/* Per-unit price */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <div className="flex-1">
                  <p className="text-gray-400 text-xs font-semibold">{cat.perUnitLabel} (custom qty &lt; {cat.packages[0].qty})</p>
                  <p className="text-gray-600 text-[10px]">Jab qty {cat.packages[0].qty} se kam ho — per unit charge</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-gray-500 text-xs">Rs.</span>
                  <input type="number" min="0"
                    value={addonPrices[cat.perUnitKey] ?? cat.defaultPerUnit}
                    onChange={e => setAddonPrices(prev => ({ ...prev, [cat.perUnitKey]: e.target.value === "" ? 0 : Number(e.target.value) }))}
                    style={{ ...inputSt, width: 80, textAlign: "center", color: "#60a5fa", fontWeight: 700 }}
                  />
                </div>
              </div>
              {/* Package tiers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cat.packages.map(pkg => (
                  <div key={pkg.key} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(245,158,11,0.1)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 text-xs font-semibold">+{pkg.qty.toLocaleString()} {cat.label.includes("Invoice") ? "Invoices" : cat.label.includes("Customer") ? "Customers" : cat.label.includes("Supplier") && !cat.label.includes("Order") ? "Suppliers" : "Orders"}</p>
                      <p className="text-gray-600 text-[10px]">Package · 1 month validity</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-gray-500 text-xs">Rs.</span>
                      <input type="number" min="0"
                        value={addonPrices[pkg.key] ?? pkg.defaultPrice}
                        onChange={e => setAddonPrices(prev => ({ ...prev, [pkg.key]: e.target.value === "" ? 0 : Number(e.target.value) }))}
                        style={{ ...inputSt, width: 80, textAlign: "center", color: "#fbbf24", fontWeight: 700 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Extra User Seats ─────────────────────────────────────────── */}
        <div className="mt-6 pt-6" style={{ borderTop: "1px solid rgba(245,158,11,0.15)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">👤</span>
            <p className="text-gray-300 text-xs font-bold">Extra User Seats / Month</p>
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black"
              style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.35)" }}>
              Per User
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-4 rounded-xl"
            style={{ background: "rgba(99,102,241,0.07)", border: "1.5px solid rgba(99,102,241,0.25)" }}>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold">Price per Extra User / Month</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Flat rate — user jitne extra users chahein select karein, itna × per-user price lagega. 1 month validity.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-gray-400 text-sm font-semibold">Rs.</span>
              <input
                type="number" min="0"
                value={addonPrices["extraUser_monthly"] ?? DEFAULT_USER_SEAT_PRICE}
                onChange={e => setAddonPrices(prev => ({
                  ...prev,
                  extraUser_monthly: e.target.value === "" ? 0 : Number(e.target.value),
                }))}
                style={{ ...inputSt, width: 90, textAlign: "center", color: "#a5b4fc", fontWeight: 800, fontSize: 15 }}
              />
              <span className="text-gray-600 text-xs">/user</span>
            </div>
          </div>
          <p className="text-gray-700 text-[10px] mt-2">
            Example: Rs. {(addonPrices["extraUser_monthly"] ?? DEFAULT_USER_SEAT_PRICE).toLocaleString()} × 3 users = Rs. {((addonPrices["extraUser_monthly"] ?? DEFAULT_USER_SEAT_PRICE) * 3).toLocaleString()}/month
          </p>
        </div>
      </div>

      {/* Save reminder */}
      <div className="flex items-center justify-between px-5 py-3 rounded-xl"
        style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <p className="text-amber-400 text-xs font-medium">
          ⚠️ Changes save karne ke baad sare users ke dashboards par instantly apply honge.
        </p>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000" }}>
          {saving ? "Saving..." : "Save →"}
        </button>
      </div>
    </div>
  );
}
