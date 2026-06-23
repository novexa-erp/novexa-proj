"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection, onSnapshot, query, orderBy, limit,
  doc, addDoc, serverTimestamp, getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import InvoicesView from "./InvoicesView";
import CustomersView from "./CustomersView";
import SettingsView from "./SettingsView";

// ── Sidebar nav items ────────────────────────────────────────────────────────
const navItems = [
  { icon: "📊", label: "Overview",   id: "overview"  },
  { icon: "🧾", label: "Invoices",   id: "invoices"  },
  { icon: "👥", label: "Customers",  id: "customers" },
  { icon: "📦", label: "Inventory",  id: "inventory" },
  { icon: "💳", label: "Payments",   id: "payments"  },
  { icon: "📈", label: "Analytics",  id: "analytics" },
  { icon: "🧑‍💼", label: "HR",        id: "hr"        },
  { icon: "⚙️", label: "Settings",  id: "settings"  },
];

const statusStyle = {
  Paid:    { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
  Unpaid:  { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  Partial: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
};

// Format Rs. amounts
function formatRs(n) {
  if (!n && n !== 0) return "Rs. 0";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}

// Today's date string
function todayStr() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export default function DashboardPage() {
  const router = useRouter();

  // ── Auth state ──────────────────────────────────────────────────────────────
  const [user, setUser]         = useState(null);
  const [userDoc, setUserDoc]   = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Nav / UI ────────────────────────────────────────────────────────────────
  const [activeNav, setActiveNav]   = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Firestore data ──────────────────────────────────────────────────────────
  const [invoices,  setInvoices]  = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── Modals (customer + product only — invoices handled by InvoicesView) ─────
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal,  setShowProductModal]  = useState(false);
  const [formSaving, setFormSaving] = useState(false);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      setUser(u);
      // fetch user profile doc
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) setUserDoc(snap.data());
      } catch { /* ignore */ }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Real-time Firestore listeners ────────────────────────────────────────────
  // Subcollections under users/{uid}/ — no composite index needed
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    let loaded = 0;
    const check = () => { loaded++; if (loaded === 4) setDataLoading(false); };

    const unsubInv = onSnapshot(
      query(collection(db, "users", uid, "invoices"), orderBy("createdAt", "desc"), limit(50)),
      (snap) => { setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() }))); check(); },
      () => check()
    );
    const unsubCust = onSnapshot(
      query(collection(db, "users", uid, "customers"), orderBy("createdAt", "desc")),
      (snap) => { setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); check(); },
      () => check()
    );
    const unsubProd = onSnapshot(
      query(collection(db, "users", uid, "products"), orderBy("createdAt", "desc")),
      (snap) => { setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() }))); check(); },
      () => check()
    );
    const unsubPay = onSnapshot(
      query(collection(db, "users", uid, "payments"), orderBy("createdAt", "desc")),
      (snap) => { setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }))); check(); },
      () => check()
    );

    return () => { unsubInv(); unsubCust(); unsubProd(); unsubPay(); };
  }, [user]);

  // ── Computed stats ───────────────────────────────────────────────────────────
  // Split: customer-linked invoices vs other (direct from Invoices tab)
  const customerInvoices = invoices.filter(i => i.customerId);
  const otherInvoices    = invoices.filter(i => !i.customerId);

  const totalRevenue    = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const pendingAmount   = invoices.filter(i => i.status === "Unpaid" || i.status === "Partial").reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const collectedPct    = totalRevenue + pendingAmount > 0 ? Math.round((totalRevenue / (totalRevenue + pendingAmount)) * 100) : 0;
  const pendingPct      = 100 - collectedPct;
  const activeCustomers = customers.filter(c => c.status !== "inactive").length;
  const lowStockItems   = inventory.filter(i => (Number(i.stock) || 0) <= (Number(i.lowStockThreshold) || 10));

  // balance breakdowns
  const customerBalance = customerInvoices.reduce((s, i) => s + (Number(i.balance) || 0), 0);
  const otherBalance    = otherInvoices.reduce((s, i) => s + (Number(i.balance) || 0), 0);

  const stats = [
    { label: "Total Revenue",       value: formatRs(totalRevenue),   change: `${invoices.filter(i=>i.status==="Paid").length} paid`,          up: true,                icon: "💰", color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" },
    { label: "Invoices Sent",       value: String(invoices.length),  change: `${invoices.filter(i=>i.status==="Unpaid").length} unpaid`,       up: invoices.filter(i=>i.status==="Unpaid").length === 0, icon: "🧾", color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.25)" },
    { label: "Customer Balance",    value: formatRs(customerBalance), change: `${customerInvoices.length} invoices`,                          up: customerBalance === 0, icon: "👥", color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)",
      onClick: () => setActiveNav("customers") },
    { label: "Other Invoice Balance", value: formatRs(otherBalance),  change: `${otherInvoices.length} invoices`,                             up: otherBalance === 0,   icon: "🧾", color: "#2563EB", bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.25)",
      onClick: () => setActiveNav("invoices") },
  ];

  // ── Sign out ─────────────────────────────────────────────────────────────────
  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
  }

  // ── Quick action handlers ─────────────────────────────────────────────────────
  const [custForm, setCustForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [prodForm, setProdForm] = useState({ name: "", stock: "", price: "", lowStockThreshold: "10" });

  async function saveCustomer(e) {
    e.preventDefault();
    if (!user || formSaving) return;
    setFormSaving(true);
    try {
      await addDoc(collection(db, "users", user.uid, "customers"), {
        name:      custForm.name,
        phone:     custForm.phone,
        email:     custForm.email,
        address:   custForm.address,
        status:    "active",
        createdAt: serverTimestamp(),
      });
      setCustForm({ name: "", phone: "", email: "", address: "" });
      setShowCustomerModal(false);
    } catch (err) { alert("Error: " + err.message); }
    setFormSaving(false);
  }

  async function saveProduct(e) {
    e.preventDefault();
    if (!user || formSaving) return;
    setFormSaving(true);
    try {
      await addDoc(collection(db, "users", user.uid, "products"), {
        name:              prodForm.name,
        stock:             Number(prodForm.stock),
        price:             Number(prodForm.price),
        lowStockThreshold: Number(prodForm.lowStockThreshold),
        createdAt:         serverTimestamp(),
      });
      setProdForm({ name: "", stock: "", price: "", lowStockThreshold: "10" });
      setShowProductModal(false);
    } catch (err) { alert("Error: " + err.message); }
    setFormSaving(false);
  }

  // ── Loading screen ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#2563EB,#F59E0B)" }}>
            <svg className="w-6 h-6 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="4" className="opacity-25"/>
              <path fill="white" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/>
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Modal helper ─────────────────────────────────────────────────────────────
  const inputStyle = {
    width: "100%", outline: "none", background: "rgba(255,255,255,0.05)",
    border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 10,
    padding: "10px 14px", color: "#fff", fontSize: 14,
  };
  const labelStyle = { display: "block", color: "#9ca3af", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 };

  const Modal = ({ title, onClose, onSubmit, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-base">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {children}
          <button type="submit" disabled={formSaving}
            className="btn-primary w-full justify-center mt-1"
            style={{ opacity: formSaving ? 0.7 : 1, cursor: formSaving ? "not-allowed" : "pointer" }}>
            {formSaving ? "Saving..." : "Save →"}
          </button>
        </form>
      </div>
    </div>
  );

  const displayName = userDoc?.name || user?.displayName || user?.email?.split("@")[0] || "User";
  const initials    = displayName.charAt(0).toUpperCase();

  const quickActions = [
    { icon: "➕", label: "New Invoice",  color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", action: () => setActiveNav("invoices")   },
    { icon: "👤", label: "Add Customer", color: "#2563EB", bg: "rgba(37,99,235,0.1)",  border: "rgba(37,99,235,0.3)",  action: () => setActiveNav("customers") },
    { icon: "📦", label: "Add Product",  color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", action: () => setShowProductModal(true)  },
    { icon: "📄", label: "Export PDF",   color: "#2563EB", bg: "rgba(37,99,235,0.1)",  border: "rgba(37,99,235,0.3)",  action: () => window.print()             },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] flex" style={{ fontFamily: "var(--font-poppins, sans-serif)" }}>

      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 flex flex-col transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ width: 240, background: "#080d14", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        {/* logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="relative w-9 h-9 flex-shrink-0">
            <Image src="/images/Novexa N Logo.png" alt="Novexa" fill className="object-contain" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-white font-bold text-sm tracking-wide">NOVEXA</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "#F59E0B" }}>ERP</span>
          </div>
        </div>

        {/* nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[10px] font-bold tracking-widest uppercase px-3 mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>Main Menu</p>
          {navItems.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveNav(item.id); setSidebarOpen(false); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-200"
                style={{
                  background: isActive ? "rgba(37,99,235,0.12)" : "transparent",
                  color: isActive ? "#fff" : "#6b7280",
                  borderLeft: isActive ? "2px solid #2563EB" : "2px solid transparent",
                }}>
                <span className="text-base">{item.icon}</span>
                {item.label}
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
              </button>
            );
          })}
        </nav>

        {/* user */}
        <div className="px-4 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl cursor-pointer hover:bg-white/5 group">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#2563EB,#F59E0B)", color: "#fff" }}>{initials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{displayName}</p>
              <p className="text-gray-500 text-[10px] truncate">{user?.email}</p>
            </div>
            <button onClick={handleSignOut} title="Sign out"
              className="text-gray-600 hover:text-red-400 text-xs transition-colors opacity-0 group-hover:opacity-100">⏻</button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* topbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-5 py-4"
          style={{ background: "rgba(8,13,20,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors" onClick={() => setSidebarOpen(true)}>
              <div className="flex flex-col gap-1">
                <span className="block w-5 h-0.5 bg-white" />
                <span className="block w-5 h-0.5 bg-white" />
                <span className="block w-5 h-0.5 bg-white" />
              </div>
            </button>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">
                {navItems.find(n => n.id === activeNav)?.label ?? "Overview"}
              </h1>
              <p className="text-gray-500 text-xs mt-0.5">{todayStr()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-white/8"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-base">🔔</span>
              {lowStockItems.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold cursor-pointer"
              style={{ background: "linear-gradient(135deg,#2563EB,#F59E0B)", color: "#fff" }}>{initials}</div>
          </div>
        </header>

        {/* page body */}
        <main className="flex-1 p-5 md:p-7 overflow-y-auto">

          {/* ── Invoices full page ── */}
          {activeNav === "invoices" ? (
            <InvoicesView uid={user?.uid} invoices={invoices} loading={dataLoading} products={inventory} userDoc={userDoc} />
          ) : activeNav === "customers" ? (
            <CustomersView uid={user?.uid} customers={customers} invoices={invoices} loading={dataLoading} products={inventory} userDoc={userDoc} />
          ) : activeNav === "settings" ? (
            <SettingsView uid={user?.uid} user={user} userDoc={userDoc}
              onSettingsSaved={(updated) => setUserDoc(prev => ({ ...prev, ...updated }))} />
          ) : (
          <>
          {/* quick actions */}
          <div className="flex flex-wrap gap-3 mb-7">
            {quickActions.map((a) => (
              <button key={a.label} onClick={a.action}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105"
                style={{ background: a.bg, border: `1px solid ${a.border}`, color: a.color }}>
                {a.icon} {a.label}
              </button>
            ))}
          </div>

          {/* loading shimmer */}
          {dataLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl p-5 animate-pulse" style={{ background: "rgba(255,255,255,0.04)", height: 110 }} />
              ))}
            </div>
          ) : (
            /* stat cards */
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
              {stats.map((s) => (
                <div key={s.label}
                  className="rounded-2xl p-5 transition-all duration-300"
                  style={{ background: s.bg, border: `1px solid ${s.border}`, cursor: s.onClick ? "pointer" : "default" }}
                  onClick={s.onClick}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 12px 30px ${s.bg}`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xl">{s.icon}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: s.up ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", color: s.up ? "#34d399" : "#f87171" }}>
                      {s.change}
                    </span>
                  </div>
                  <p className="text-white font-black text-xl leading-none mb-1">{s.value}</p>
                  <p className="text-xs font-medium flex items-center gap-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {s.label}
                    {s.onClick && <span style={{ color: "rgba(255,255,255,0.2)" }}>→</span>}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* bottom grid */}
          <div className="grid lg:grid-cols-3 gap-5">

            {/* recent invoices */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <h3 className="text-white font-bold text-sm">Recent Invoices</h3>
                <button onClick={() => setActiveNav("invoices")}
                  className="text-xs font-semibold transition-colors" style={{ color: "#60A5FA" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#F59E0B"}
                  onMouseLeave={e => e.currentTarget.style.color = "#60A5FA"}>
                  View all →
                </button>
              </div>
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                {dataLoading ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="px-5 py-3.5 animate-pulse flex gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/5" />
                      <div className="flex-1 flex flex-col gap-2 py-1">
                        <div className="h-3 bg-white/5 rounded w-32" />
                        <div className="h-2 bg-white/5 rounded w-20" />
                      </div>
                    </div>
                  ))
                ) : invoices.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-gray-500 text-sm">No invoices yet.</p>
                    <button onClick={() => setShowInvoiceModal(true)} className="text-blue-400 text-xs mt-2 hover:text-blue-300">Create your first invoice →</button>
                  </div>
                ) : (
                  invoices.slice(0, 6).map((inv) => {
                    const st = statusStyle[inv.status] || statusStyle["Unpaid"];
                    const dateStr = inv.createdAt?.toDate ? inv.createdAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
                    const num = inv.id.slice(-4).toUpperCase();
                    return (
                      <div key={inv.id} className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/[0.02]">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", color: "#60A5FA" }}>
                            {num}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{inv.customer || "Unknown"}</p>
                            <p className="text-gray-500 text-xs">INV-{num} · {dateStr}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-white text-sm font-semibold">{formatRs(inv.amount)}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                            {inv.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* right sidebar */}
            <div className="flex flex-col gap-4">
              {/* stock alerts */}
              <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-white font-bold text-sm mb-4">Stock Alerts</h3>
                {dataLoading ? (
                  [...Array(3)].map((_, i) => <div key={i} className="h-6 rounded bg-white/5 mb-2 animate-pulse" />)
                ) : lowStockItems.length === 0 ? (
                  <p className="text-gray-500 text-xs">All stock levels are healthy ✓</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {lowStockItems.slice(0, 5).map((item) => {
                      const c = (Number(item.stock) || 0) <= 5 ? "#f87171" : "#fbbf24";
                      return (
                        <div key={item.id} className="flex items-center justify-between">
                          <span className="text-gray-400 text-xs truncate max-w-[140px]">{item.name}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: `${c}18`, color: c, border: `1px solid ${c}40` }}>
                            {item.stock} left
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* payment summary */}
              <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-white font-bold text-sm mb-4">Payment Summary</h3>
                {dataLoading ? (
                  <div className="h-20 animate-pulse bg-white/5 rounded-xl" />
                ) : (
                  <div className="flex flex-col gap-3">
                    {[
                      { label: "Collected", amount: formatRs(totalRevenue),  color: "#34d399", pct: collectedPct },
                      { label: "Pending",   amount: formatRs(pendingAmount), color: "#fbbf24", pct: pendingPct   },
                    ].map((p) => (
                      <div key={p.label}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-gray-400 text-xs">{p.label}</span>
                          <span className="text-white text-xs font-semibold">{p.amount}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${p.pct}%`, background: p.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* customers quick list */}
              <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-white font-bold text-sm mb-4">Recent Customers</h3>
                {dataLoading ? (
                  <div className="h-20 animate-pulse bg-white/5 rounded-xl" />
                ) : customers.length === 0 ? (
                  <p className="text-gray-500 text-xs">No customers yet.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {customers.slice(0, 4).map((c) => (
                      <div key={c.id} className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "rgba(37,99,235,0.15)", color: "#60A5FA" }}>
                          {(c.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-xs font-medium truncate">{c.name}</p>
                          <p className="text-gray-500 text-[10px] truncate">{c.phone || c.email || "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </>
          )}
        </main>
      </div>

      {/* ── Modals (customer + product) ── */}

      {/* Add Customer */}
      {showCustomerModal && (
        <Modal title="Add Customer" onClose={() => setShowCustomerModal(false)} onSubmit={saveCustomer}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input required style={inputStyle} placeholder="e.g. Ahmed Raza"
              value={custForm.name} onChange={e => setCustForm({ ...custForm, name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input type="tel" style={inputStyle} placeholder="+92 300 1234567"
              value={custForm.phone} onChange={e => setCustForm({ ...custForm, phone: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" style={inputStyle} placeholder="customer@example.com"
              value={custForm.email} onChange={e => setCustForm({ ...custForm, email: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Address</label>
            <input style={inputStyle} placeholder="City, Street..."
              value={custForm.address} onChange={e => setCustForm({ ...custForm, address: e.target.value })} />
          </div>
        </Modal>
      )}

      {/* Add Product / Inventory */}
      {showProductModal && (
        <Modal title="Add Product" onClose={() => setShowProductModal(false)} onSubmit={saveProduct}>
          <div>
            <label style={labelStyle}>Product Name</label>
            <input required style={inputStyle} placeholder="e.g. Printer Paper A4"
              value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Stock Quantity</label>
            <input required type="number" min="0" style={inputStyle} placeholder="e.g. 100"
              value={prodForm.stock} onChange={e => setProdForm({ ...prodForm, stock: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Price (Rs.)</label>
            <input type="number" min="0" style={inputStyle} placeholder="e.g. 500"
              value={prodForm.price} onChange={e => setProdForm({ ...prodForm, price: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Low Stock Alert Below</label>
            <input type="number" min="0" style={inputStyle} placeholder="e.g. 10"
              value={prodForm.lowStockThreshold} onChange={e => setProdForm({ ...prodForm, lowStockThreshold: e.target.value })} />
          </div>
        </Modal>
      )}

    </div>
  );
}
