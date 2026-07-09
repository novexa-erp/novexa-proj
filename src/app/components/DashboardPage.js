"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection, onSnapshot, query, orderBy, limit,
  doc, addDoc, serverTimestamp, getDoc, getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import InvoicesView from "./InvoicesView";
import CustomersView from "./CustomersView";
import SettingsView from "./SettingsView";
import InventoryView from "./InventoryView";
import PaymentsView from "./PaymentsView";
import PurchasesView from "./PurchasesView";
import AnalyticsView from "./AnalyticsView";
import SweetAlert from "./SweetAlert";
import { OrderFormView } from "./SupplierDetail";
import ContactView from "./ContactView";
import TrashView from "./TrashView";

// ── Sidebar nav items ────────────────────────────────────────────────────────
const navItems = [
  { icon: "📊", label: "Overview",    id: "overview"    },
  { icon: "🧾", label: "Invoices",    id: "invoices"    },
  { icon: "👥", label: "Customers",   id: "customers"   },
  { icon: "📦", label: "Inventory",   id: "inventory"   },
  { icon: "💳", label: "Payments",    id: "payments"    },
  { icon: "🛒", label: "Purchases",   id: "purchases"   },
  { icon: "📋", label: "Order Form",  id: "order-form"  },
  { icon: "📈", label: "Analytics",   id: "analytics"   },
  { icon: "⚙️", label: "Settings",   id: "settings"    },
  { icon: "📞", label: "Contact Us",  id: "contact"     },
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

// ── Beautiful Digital Clock ───────────────────────────────────────────────────
function DigitalClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hours   = time.getHours();
  const minutes = String(time.getMinutes()).padStart(2, "0");
  const seconds = String(time.getSeconds()).padStart(2, "0");
  const ampm    = hours >= 12 ? "PM" : "AM";
  const hh      = String(hours % 12 || 12).padStart(2, "0");

  return (
    <div className="flex items-center gap-2">
      {/* Main time display */}
      <div className="flex items-baseline gap-0.5">
        <span className="font-mono font-black tabular-nums leading-none"
          style={{ fontSize: 22, color: "#fff", letterSpacing: "-0.02em", textShadow: "0 0 20px rgba(245,158,11,0.4)" }}>
          {hh}:{minutes}
        </span>
        <span className="font-mono font-bold tabular-nums leading-none"
          style={{ fontSize: 14, color: "rgba(245,158,11,0.8)", marginBottom: 1 }}>
          :{seconds}
        </span>
        <span className="font-bold leading-none ml-1"
          style={{ fontSize: 11, color: "#F59E0B", letterSpacing: "0.05em" }}>
          {ampm}
        </span>
      </div>
    </div>
  );
}

// Separate component for search params to wrap in Suspense
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Auth state ──────────────────────────────────────────────────────────────
  const [user, setUser]         = useState(null);
  const [userDoc, setUserDoc]   = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Nav / UI ────────────────────────────────────────────────────────────────
  // Initialize from URL query param or default to "overview"
  const [activeNav, setActiveNav]   = useState(searchParams.get("view") || "overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false); // Loading state for tab switching

  // ── Firestore data ──────────────────────────────────────────────────────────
  const [invoices,  setInvoices]  = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [payments,  setPayments]  = useState([]);
  const [totalPurchasing, setTotalPurchasing] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  // ── Modals (customer + product only — invoices handled by InvoicesView) ─────
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductModal,  setShowProductModal]  = useState(false);
  const [formSaving, setFormSaving] = useState(false);

  // ── Sweet Alert State ─────────────────────────────────────────────────────
  const [alert, setAlert] = useState({ show: false, type: "", title: "", message: "" });
  
  // ── Logout Confirmation ─────────────────────────────────────────────────────
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ── Subscription expiry warning ─────────────────────────────────────────────
  const [showExpiryPopup,  setShowExpiryPopup]  = useState(false);
  const [expiryDaysLeft,   setExpiryDaysLeft]   = useState(null);

  // ── Auth guard + subscription + session check ────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/pages/login"); return; }

      // Step 1: Check subscription status
      try {
        const token = await u.getIdToken();
        const res = await fetch("/api/admin/check-subscription", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.allowed) {
          await signOut(auth);
          const reason = data.status === "frozen"
            ? (data.reason === "subscription_expired" ? "expired" : "frozen")
            : data.status === "not_started" ? "not_started" : "access_denied";
          router.push(`/pages/login?blocked=${reason}`);
          return;
        }
      } catch { /* network error — allow in */ }

      // Step 2: Register session — only if no active sessionId already stored
      // (prevents creating duplicate sessions on every page refresh)
      const existingSessionId = sessionStorage.getItem("novexa_session_id");
      if (!existingSessionId || existingSessionId === "admin") {
        try {
          const token = await u.getIdToken();
          const res = await fetch("/api/admin/session-login", {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.sessionId && data.sessionId !== "admin") {
            sessionStorage.setItem("novexa_session_id", data.sessionId);
          }
        } catch { /* ignore — session tracking optional */ }
      }

      setUser(u);

      // userDoc is loaded via real-time listener below — just set auth loading done
      setAuthLoading(false);

      // ── Expiry check will run once userDoc listener fires ──────────────────
    });
    return () => unsub();
  }, [router]);

  // ── Real-time userDoc listener ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserDoc(data);
        // ── Check expiry and show popup once per session ──────────────────
        if (data.activeTo) {
          const diff = Math.ceil(
            (new Date(data.activeTo + "T23:59:59") - new Date()) / 86400000
          );
          if (diff >= 0 && diff <= 3) {
            setExpiryDaysLeft(diff);
            const popupKey = `novexa_expiry_shown_${user.uid}`;
            if (!sessionStorage.getItem(popupKey)) {
              setShowExpiryPopup(true);
              sessionStorage.setItem(popupKey, "1");
            }
          }
        }
      }
    });
    return () => unsubUser();
  }, [user]);

  // ── Heartbeat — verify session every 8s ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    async function heartbeat() {
      const sessionId = sessionStorage.getItem("novexa_session_id");
      if (!sessionId || sessionId === "admin") return;

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/session-heartbeat", {
          method: "POST",
          headers: {
            authorization:  `Bearer ${token}`,
            "x-session-id": sessionId,
          },
        });
        const data = await res.json();
        if (!data.valid) {
          sessionStorage.removeItem("novexa_session_id");
          await signOut(auth);
          const reason = data.reason === "account_frozen"       ? "frozen"
                       : data.reason === "subscription_expired" ? "expired"
                       : data.reason === "account_not_found"    ? "access_denied"
                       : "session_evicted";
          router.push(`/pages/login?blocked=${reason}`);
        }
      } catch { /* network blip — don't kick out */ }
    }

    // Run immediately on mount, then every 8 seconds
    heartbeat();
    const interval = setInterval(heartbeat, 8000);
    return () => clearInterval(interval);
  }, [user, router]);

  // ── Sync activeNav with URL ──────────────────────────────────────────────────
  useEffect(() => {
    const view = searchParams.get("view");
    if (view && navItems.some(item => item.id === view)) {
      setActiveNav(view);
    }
  }, [searchParams]);

  // ── Update URL when navigation changes ──────────────────────────────────────
  function handleNavChange(navId) {
    setViewLoading(true); // Show loader when switching tabs
    setActiveNav(navId);
    setSidebarOpen(false);
    // Update URL without page reload
    const params = new URLSearchParams(window.location.search);
    params.set("view", navId);
    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    // Hide loader after a brief moment to show transition
    setTimeout(() => setViewLoading(false), 300);
  }

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
      (snap) => { setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.deleted)); check(); },
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

  // ── Fetch total purchasing from supplier orders ────────────────────────────
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    let cancelled = false;
    const unsubSuppliers = onSnapshot(
      query(collection(db, "users", uid, "suppliers"), orderBy("createdAt", "desc")),
      async (snap) => {
        if (cancelled) return;
        try {
          const suppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          let grandTotal = 0;
          await Promise.all(suppliers.map(async (sup) => {
            const oSnap = await getDocs(collection(db, "users", uid, "suppliers", sup.id, "orders"));
            oSnap.docs.forEach(d => {
              const o = d.data();
              if (o.items?.length) {
                const sub = o.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
                const disc = o.discountType === "percent"
                  ? sub * (Number(o.discountValue) || 0) / 100
                  : (Number(o.discountValue) || 0);
                grandTotal += Math.max(sub - disc, 0);
              }
            });
          }));
          if (!cancelled) setTotalPurchasing(grandTotal);
        } catch { /* ignore */ }
      },
      () => {}
    );
    return () => { cancelled = true; unsubSuppliers(); };
  }, [user]);

  // ── Computed stats ───────────────────────────────────────────────────────────
  // Split: customer-linked invoices vs other (direct from Invoices tab)
  const customerInvoices = invoices.filter(i => i.customerId);
  const otherInvoices    = invoices.filter(i => !i.customerId);

  // Total Revenue = all amounts collected (Paid invoices full amount + Partial paid amounts)
  const totalRevenue    = invoices.filter(i => i.status === "Paid").reduce((s, i) => s + (Number(i.amount) || 0), 0)
    + invoices.filter(i => i.status === "Partial").reduce((s, i) => s + ((Number(i.amount) || 0) - (Number(i.balance) || 0)), 0);

  // Pending = sum of all balances (unpaid full amount + partial remaining balance)
  const customerPending = customerInvoices.reduce((s, i) => s + (Number(i.balance) || 0), 0);
  const otherPending    = otherInvoices.reduce((s, i) => s + (Number(i.balance) || 0), 0);
  const pendingAmount   = customerPending + otherPending;

  const collectedPct    = totalRevenue + pendingAmount > 0 ? Math.round((totalRevenue / (totalRevenue + pendingAmount)) * 100) : 0;
  const pendingPct      = 100 - collectedPct;
  const activeCustomers = customers.filter(c => c.status !== "inactive").length;
  const lowStockItems   = inventory.filter(i => (Number(i.stock) || 0) <= (Number(i.lowStockThreshold) || 10));

  // balance breakdowns
  const customerBalance = customerInvoices.reduce((s, i) => s + (Number(i.balance) || 0), 0);
  const otherBalance    = otherInvoices.reduce((s, i) => s + (Number(i.balance) || 0), 0);

  const stats = [
    { label: "Total Revenue",        value: formatRs(totalRevenue),    change: `${invoices.filter(i=>i.status==="Paid").length} paid`,          icon: "💰", color: "from-amber-500 to-orange-600" },
    { label: "Total Purchasing",      value: formatRs(totalPurchasing), change: "All orders",                                                    icon: "🛒", color: "from-green-500 to-emerald-600", onClick: () => handleNavChange("purchases") },
    { label: "Customer Balance",      value: formatRs(customerBalance), change: `${customerInvoices.length} invoices`,                          icon: "👥", color: "from-orange-500 to-amber-600",  onClick: () => handleNavChange("customers") },
    { label: "Other Invoice Balance", value: formatRs(otherBalance),    change: `${otherInvoices.length} invoices`,                             icon: "🧾", color: "from-blue-500 to-cyan-600",    onClick: () => handleNavChange("invoices") },
  ];

  // ── Sign out ─────────────────────────────────────────────────────────────────
  async function handleSignOut() {
    const sessionId = sessionStorage.getItem("novexa_session_id");
    if (sessionId && auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        await fetch("/api/admin/session-logout", {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "x-session-id": sessionId },
        });
      } catch { /* ignore */ }
      sessionStorage.removeItem("novexa_session_id");
    }
    await signOut(auth);
    router.push("/pages/login");
  }
  
  function confirmLogout() {
    setShowLogoutConfirm(true);
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
      
      // Show success alert
      setAlert({
        show: true,
        type: "success",
        title: "Customer Added! 👥",
        message: `${custForm.name} has been added to your customer list successfully.`,
      });
    } catch (err) { 
      setAlert({
        show: true,
        type: "error",
        title: "Failed to Add Customer",
        message: err.message || "Something went wrong. Please try again.",
      });
    }
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
      
      // Show success alert
      setAlert({
        show: true,
        type: "success",
        title: "Product Added! 📦",
        message: `${prodForm.name} has been added to your inventory successfully.`,
      });
    } catch (err) { 
      setAlert({
        show: true,
        type: "error",
        title: "Failed to Add Product",
        message: err.message || "Something went wrong. Please try again.",
      });
    }
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
    { icon: "➕", label: "New Invoice",  color: "from-amber-500 to-orange-600", action: () => handleNavChange("invoices")   },
    { icon: "👤", label: "Add Customer", color: "from-pink-500 to-purple-600", action: () => handleNavChange("customers") },
    { icon: "📦", label: "Add Product",  color: "from-orange-500 to-amber-600", action: () => setShowProductModal(true)  },
    { icon: "📄", label: "Export PDF",   color: "from-blue-500 to-cyan-600",  action: () => window.print()             },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] flex" style={{ fontFamily: "var(--font-poppins, sans-serif)" }}>
      {/* Sweet Alert */}
      <SweetAlert
        show={alert.show}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert({ ...alert, show: false })}
      />

      {/* ── Subscription Expiry Popup ── */}
      {showExpiryPopup && expiryDaysLeft !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm rounded-3xl overflow-hidden"
            style={{ background: "#0d1117", border: "1px solid rgba(239,68,68,0.35)", boxShadow: "0 0 60px rgba(239,68,68,0.15)" }}>
            {/* Red top bar */}
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#ef4444,#f97316)" }} />
            <div className="p-7 flex flex-col items-center gap-4 text-center">
              {/* Animated icon */}
              <div className="relative w-20 h-20 flex items-center justify-center rounded-full"
                style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.3)" }}>
                <span className="text-4xl animate-bounce">⏰</span>
              </div>
              <div>
                <h2 className="text-white font-black text-xl mb-1">
                  Subscription Expiring Soon!
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {expiryDaysLeft === 0
                    ? "Your Novexa subscription expires today! Please renew immediately to avoid losing access."
                    : `Your Novexa subscription will expire in `}
                  {expiryDaysLeft > 0 && (
                    <span className="text-red-400 font-black text-base">
                      {expiryDaysLeft} {expiryDaysLeft === 1 ? "day" : "days"}
                    </span>
                  )}
                  {expiryDaysLeft > 0 && ". Please contact Novexa to renew your plan and avoid interruption."}
                </p>
              </div>
              {/* Urgency badge */}
              <div className="px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest"
                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
                {expiryDaysLeft === 0 ? "🚨 Expires Today" : expiryDaysLeft === 1 ? "⚠️ Last Day Tomorrow" : `⚠️ ${expiryDaysLeft} Days Remaining`}
              </div>
              <div className="flex gap-3 w-full mt-1">
                <button onClick={() => setShowExpiryPopup(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280" }}>
                  Remind Later
                </button>
                <a href="https://wa.me/923001234567?text=Hello%20Novexa%2C%20I%20need%20to%20renew%20my%20subscription."
                  target="_blank" rel="noopener noreferrer"
                  onClick={() => setShowExpiryPopup(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-black text-center transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff" }}>
                  Contact Support →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <button key={item.id} onClick={() => handleNavChange(item.id)}
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
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl mb-2">
            {/* User Logo/Avatar */}
            {userDoc?.logoDataUrl ? (
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                <img src={userDoc.logoDataUrl} alt="Logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#2563EB,#F59E0B)", color: "#fff" }}>{initials}</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{displayName}</p>
              <p className="text-gray-500 text-[10px] truncate">{user?.email}</p>
            </div>
          </div>
          {/* Trash Button */}
          <button
            onClick={() => handleNavChange("trash")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-200 hover:bg-red-500/10 mb-2 group"
            style={{
              color: activeNav === "trash" ? "#f87171" : "#6b7280",
              background: activeNav === "trash" ? "rgba(248,113,113,0.08)" : "transparent",
              border: activeNav === "trash" ? "1px solid rgba(248,113,113,0.2)" : "1px solid transparent",
            }}>
            <span className="text-base">🗑️</span>
            <span>Trash</span>
            {activeNav === "trash" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-400" />}
          </button>
          {/* Logout Button */}
          <button 
            onClick={confirmLogout} 
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-200 hover:bg-red-500/10 group"
            style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="text-base">🚪</span>
            <span>Logout</span>
            <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </button>
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
            {/* Digital Clock */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl mr-1"
              style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <DigitalClock />
            </div>
            <button className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-white/8"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-base">🔔</span>
              {lowStockItems.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>
            {/* User Logo/Avatar */}
            {userDoc?.logoDataUrl ? (
              <div className="w-9 h-9 rounded-xl overflow-hidden cursor-pointer" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                <img src={userDoc.logoDataUrl} alt="Logo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold cursor-pointer"
                style={{ background: "linear-gradient(135deg,#2563EB,#F59E0B)", color: "#fff" }}>{initials}</div>
            )}
          </div>
        </header>

        {/* ── Subscription Expiry Banner ── */}
        {expiryDaysLeft !== null && expiryDaysLeft <= 3 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3"
            style={{
              background: expiryDaysLeft === 0
                ? "linear-gradient(90deg,rgba(239,68,68,0.18),rgba(249,115,22,0.12))"
                : "linear-gradient(90deg,rgba(239,68,68,0.12),rgba(249,115,22,0.07))",
              borderBottom: `1px solid ${expiryDaysLeft === 0 ? "rgba(239,68,68,0.5)" : "rgba(239,68,68,0.3)"}`,
              borderLeft: `3px solid ${expiryDaysLeft === 0 ? "#ef4444" : "#f97316"}`,
            }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-base flex-shrink-0">
                {expiryDaysLeft === 0 ? "🚨" : "⏰"}
              </span>
              <p className="text-sm font-semibold truncate" style={{ color: expiryDaysLeft === 0 ? "#fca5a5" : "#fdba74" }}>
                {expiryDaysLeft === 0
                  ? "Your subscription expires today! Renew now to avoid losing access."
                  : `Your subscription expires in ${expiryDaysLeft} ${expiryDaysLeft === 1 ? "day" : "days"}. Renew before it's too late.`}
              </p>
            </div>
            <a href="https://wa.me/923001234567?text=Hello%20Novexa%2C%20I%20need%20to%20renew%20my%20subscription."
              target="_blank" rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff" }}>
              Contact Support →
            </a>
          </div>
        )}

        {/* page body */}
        <main className="flex-1 p-5 md:p-7 overflow-y-auto">

          {/* ── Invoices full page ── */}
          {activeNav === "invoices" ? (
            <InvoicesView uid={user?.uid} invoices={invoices} loading={dataLoading || viewLoading} products={inventory} userDoc={userDoc} payments={payments} />
          ) : activeNav === "customers" ? (
            <CustomersView uid={user?.uid} customers={customers} invoices={invoices} loading={dataLoading || viewLoading} products={inventory} userDoc={userDoc} />
          ) : activeNav === "inventory" ? (
            <InventoryView uid={user?.uid} />
          ) : activeNav === "payments" ? (
            <PaymentsView uid={user?.uid} onNavigate={handleNavChange} />
          ) : activeNav === "purchases" ? (
            <PurchasesView uid={user?.uid} userDoc={userDoc} />
          ) : activeNav === "order-form" ? (
            <OrderFormView userDoc={userDoc} />
          ) : activeNav === "analytics" ? (
            <AnalyticsView uid={user?.uid} />
          ) : activeNav === "settings" ? (
            <SettingsView uid={user?.uid} user={user} userDoc={userDoc} loading={viewLoading}
              onSettingsSaved={(updated) => setUserDoc(prev => ({ ...prev, ...updated }))} />
          ) : activeNav === "contact" ? (
            <ContactView userDoc={userDoc} user={user} />
          ) : activeNav === "trash" ? (
            <TrashView uid={user?.uid} />
          ) : (
          <>
          {/* Overview Section with Professional Loader */}
          {dataLoading || viewLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-t-amber-500 border-r-purple-500 border-b-blue-500 border-l-pink-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">📊</div>
              </div>
            </div>
          ) : (
          <>
          {/* quick actions */}
          <div className="flex flex-wrap gap-3 mb-7">
            {quickActions.map((a) => (
              <button key={a.label} onClick={a.action}
                className="group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105 overflow-hidden shadow-lg">
                <div className={`absolute inset-0 bg-gradient-to-r ${a.color} opacity-90`} />
                <div className={`absolute inset-0 bg-gradient-to-r ${a.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300 brightness-110`} />
                <span className="relative z-10 text-white">{a.icon}</span>
                <span className="relative z-10 text-white">{a.label}</span>
              </button>
            ))}
          </div>

          {/* stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
              {stats.map((s) => (
                <div key={s.label}
                  className="group relative rounded-lg p-5 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                  style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)", cursor: s.onClick ? "pointer" : "default" }}
                  onClick={s.onClick}>
                  
                  {/* Gradient Overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-2xl font-bold group-hover:scale-110 transition-all duration-300">
                        {s.icon}
                      </div>
                      <div className={`px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r ${s.color} text-white`}>
                        {s.change}
                      </div>
                    </div>
                    <p className="text-white font-bold text-2xl leading-none mb-1">{s.value}</p>
                    <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1">
                      {s.label}
                      {s.onClick && <span className="text-amber-400">→</span>}
                    </p>
                  </div>
                  
                  {/* Bottom gradient bar */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${s.color} opacity-50`} />
                </div>
              ))}
            </div>

          {/* bottom grid */}
          <div className="grid lg:grid-cols-3 gap-5">

            {/* recent invoices */}
            <div className="lg:col-span-2 rounded-xl overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-pink-500/5 to-purple-500/5" />
                <div className="relative z-10 flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <h3 className="text-white font-bold text-sm">Recent Invoices</h3>
                  <button onClick={() => handleNavChange("invoices")}
                    className="text-xs font-semibold transition-colors" style={{ color: "#F59E0B" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#FCD34D"}
                    onMouseLeave={e => e.currentTarget.style.color = "#F59E0B"}>
                    View all →
                  </button>
                </div>
              </div>
              <div className="p-3 flex flex-col gap-1.5">
                {otherInvoices.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-gray-500 text-sm">No invoices yet.</p>
                    <button onClick={() => handleNavChange("invoices")} className="text-blue-400 text-xs mt-2 hover:text-blue-300">Create your first invoice →</button>
                  </div>
                ) : (
                  otherInvoices.slice(0, 6).map((inv) => {
                    const st = statusStyle[inv.status] || statusStyle["Unpaid"];
                    const dateStr = inv.createdAt?.toDate ? inv.createdAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
                    const num = inv.id.slice(-4).toUpperCase();
                    return (
                      <div key={inv.id}
                        className="flex items-center justify-between px-4 py-3 rounded-xl transition-all hover:bg-white/[0.04]"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.2)", color: "#60A5FA" }}>
                            {num}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-semibold truncate">{inv.customer || "Unknown"}</p>
                            <p className="text-gray-500 text-[11px]">INV-{num} · {dateStr}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          <span className="text-white text-sm font-bold">{formatRs(inv.amount)}</span>
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
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
              <div className="rounded-xl p-5" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base">⚠️</span>
                  <h3 className="text-white font-bold text-sm">Stock Alerts</h3>
                </div>
                {lowStockItems.length === 0 ? (
                  <p className="text-gray-500 text-xs">All stock levels are healthy ✓</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {lowStockItems.slice(0, 5).map((item) => {
                      const c = (Number(item.stock) || 0) <= 5 ? "#f87171" : "#fbbf24";
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-2">
                          <span className="text-gray-300 text-xs font-medium truncate flex-1">{item.name}</span>
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg flex-shrink-0 whitespace-nowrap"
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
              <div className="rounded-xl p-5" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base">💳</span>
                  <h3 className="text-white font-bold text-sm">Payment Summary</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {/* Collected */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-gray-400 text-xs">Collected</span>
                      <span className="text-white text-xs font-semibold">{formatRs(totalRevenue)}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${collectedPct}%`, background: "#34d399" }} />
                    </div>
                  </div>
                  {/* Pending */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-gray-400 text-xs">Pending</span>
                      <span className="text-white text-xs font-semibold">{formatRs(pendingAmount)}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pendingPct}%`, background: "#fbbf24" }} />
                    </div>
                  </div>
                  {/* Pending breakdown */}
                  {pendingAmount > 0 && (
                    <div className="mt-1 rounded-lg p-2.5 flex flex-col gap-1.5"
                      style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.1)" }}>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-[11px]">↳ Customer pending</span>
                        <span className="text-amber-400 text-[11px] font-semibold">{formatRs(customerPending)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-[11px]">↳ Other invoice pending</span>
                        <span className="text-amber-400 text-[11px] font-semibold">{formatRs(otherPending)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* customers quick list */}
              <div className="rounded-xl p-5" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">👥</span>
                    <h3 className="text-white font-bold text-sm">Recent Customers</h3>
                  </div>
                  <button onClick={() => handleNavChange("customers")}
                    className="text-[11px] font-semibold" style={{ color: "#F59E0B" }}>
                    View all →
                  </button>
                </div>
                {customers.length === 0 ? (
                  <p className="text-gray-500 text-xs">No customers yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {customers.slice(0, 4).map((c) => {
                      const custBal = customerInvoices
                        .filter(i => i.customerId === c.id)
                        .reduce((s, i) => s + (Number(i.balance) || 0), 0);
                      return (
                        <div key={c.id}
                          className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:bg-white/[0.03]"
                          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.2),rgba(245,158,11,0.2))", color: "#60A5FA", border: "1px solid rgba(37,99,235,0.2)" }}>
                            {(c.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-semibold truncate">{c.name}</p>
                            <p className="text-gray-500 text-[10px] truncate">{c.phone || c.email || "—"}</p>
                          </div>
                          {custBal > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                              style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
                              {formatRs(custBal)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          </>
          )}
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
            <input  type="email" style={inputStyle} placeholder="customer@example.com"
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

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center animate-scaleIn"
            style={{ background: "#0d1117", border: "1px solid rgba(239,68,68,0.3)" }}>
            <p className="text-4xl">🚪</p>
            <h3 className="text-white font-bold text-xl">Logout Confirmation</h3>
            <p className="text-gray-400 text-sm">
              Are you sure you want to logout? You'll need to sign in again to access your dashboard.
            </p>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                Cancel
              </button>
              <button onClick={() => { setShowLogoutConfirm(false); handleSignOut(); }}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105"
                style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444" }}>
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Main export with Suspense boundary
export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-t-amber-500 border-r-purple-500 border-b-blue-500 border-l-pink-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">📊</div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
