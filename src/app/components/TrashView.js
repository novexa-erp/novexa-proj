"use client";

import { useState, useEffect } from "react";
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, deleteDoc, serverTimestamp, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import SweetAlert from "./SweetAlert";

function formatRs(n) {
  if (!n && n !== 0) return "Rs. 0";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}
function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

/* ── 15-day countdown ──────────────────────────────────────────────────────
   Returns { expired: boolean, daysLeft: number, hoursLeft: number, display: string }
   Input: adminTrashedAt timestamp (Firestore Timestamp or ISO string)
────────────────────────────────────────────────────────────────────────── */
function calc15DayCountdown(adminTrashedAt) {
  if (!adminTrashedAt) return { expired: false, daysLeft: 15, hoursLeft: 0, display: "—" };
  
  const trashedDate = adminTrashedAt.toDate ? adminTrashedAt.toDate() : new Date(adminTrashedAt);
  const expiryDate  = new Date(trashedDate.getTime() + (15 * 24 * 60 * 60 * 1000)); // +15 days
  const now         = new Date();
  const msLeft      = expiryDate - now;
  
  if (msLeft <= 0) {
    return { expired: true, daysLeft: 0, hoursLeft: 0, display: "⚠️ Expired — will be deleted" };
  }
  
  const daysLeft  = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  const hoursLeft = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  
  if (daysLeft === 0) {
    return { expired: false, daysLeft: 0, hoursLeft, display: `⏰ ${hoursLeft}h left` };
  } else if (daysLeft === 1) {
    return { expired: false, daysLeft: 1, hoursLeft, display: `⏰ 1 day ${hoursLeft}h left` };
  } else {
    return { expired: false, daysLeft, hoursLeft, display: `⏰ ${daysLeft} days ${hoursLeft}h left` };
  }
}

const STATUS_STYLE = {
  Paid:    { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
  Unpaid:  { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  Partial: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
};

const TABS = [
  { id: "invoices",  label: "Invoices",  icon: "🧾" },
  { id: "customers", label: "Customers", icon: "👥" },
  { id: "products",  label: "Products",  icon: "📦" },
  { id: "payments",  label: "Payments",  icon: "💳" },
  { id: "suppliers", label: "Suppliers", icon: "🏭" },
  { id: "orders",    label: "Orders",    icon: "📋" },
];

export default function TrashView({ uid }) {
  const [activeTab, setActiveTab] = useState("invoices");
  const [items,     setItems]     = useState({ invoices: [], customers: [], products: [], payments: [], suppliers: [], orders: [] });
  const [loading,   setLoading]   = useState(true);
  const [restoreId, setRestoreId] = useState(null);
  const [permId,    setPermId]    = useState(null);
  const [working,   setWorking]   = useState(false);
  const [toast,     setToast]     = useState(null);
  const [alert,     setAlert]     = useState({ show: false, type: "success", title: "", message: "" });
  // Ticker to refresh countdown displays every minute
  const [tick,      setTick]      = useState(0);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Show SweetAlert popup, then toast after it's closed
  function showSuccessPopup(title, message) {
    setAlert({ show: true, type: "success", title, message });
  }

  // ── Tick every 60 seconds so countdown timers refresh ─────────────────────
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-purge expired adminTrash items (15-day window elapsed) ──────────
  useEffect(() => {
    if (!uid) return;
    const allItems = Object.values(items).flat();
    const expired  = allItems.filter(item => {
      if (!item.adminTrash) return false;
      const cd = calc15DayCountdown(item.adminTrashedAt);
      return cd.expired;
    });
    if (expired.length === 0) return;

    // Fire-and-forget: get current user's token and permanently delete expired items
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken(true);
        if (!token) return; // only works if user is logged in (client-side safety check)

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
      } catch {
        // Silently ignore — will retry on next render/load
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, uid]);

  // ── Load all deleted items ─────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const unsubs = [];
    const simpleCols = ["invoices", "customers", "products", "payments", "suppliers"];

    // Simple top-level collections
    simpleCols.forEach(col => {
      const q = query(
        collection(db, "users", uid, col),
        where("deleted", "==", true)
      );
      const unsub = onSnapshot(q, snap => {
        // Hide items that have been "permanently deleted" (moved to admin archive)
        const docs = snap.docs
          .map(d => ({ id: d.id, _col: col, ...d.data() }))
          .filter(d => !d.adminTrash);
        setItems(prev => ({ ...prev, [col]: docs }));
        setLoading(false);
      }, () => setLoading(false));
      unsubs.push(unsub);
    });

    // Orders — nested under each supplier, need collectionGroup or per-supplier scan
    // Use collectionGroup for simplicity
    const ordersUnsub = onSnapshot(
      query(
        collection(db, "users", uid, "suppliers"),
        where("deleted", "==", false)   // only active suppliers
      ),
      async (suppSnap) => {
        // For each active supplier, listen to their deleted orders
        const allOrders = [];
        await Promise.all(suppSnap.docs.map(async suppDoc => {
          const oSnap = await getDocs(
            query(
              collection(db, "users", uid, "suppliers", suppDoc.id, "orders"),
              where("deleted", "==", true)
            )
          );
          oSnap.docs.forEach(d => allOrders.push({
            id: d.id,
            _col: "orders",
            _supplierId: suppDoc.id,
            _supplierName: suppDoc.data().name || "Unknown Supplier",
            ...d.data(),
          }));
        }));
        // Hide adminTrash items from user's view
        setItems(prev => ({ ...prev, orders: allOrders.filter(o => !o.adminTrash) }));
        setLoading(false);
      },
      () => setLoading(false)
    );
    unsubs.push(ordersUnsub);

    return () => unsubs.forEach(u => u());
  }, [uid]);

  const current = items[activeTab] || [];
  const total   = Object.values(items).reduce((s, arr) => s + arr.length, 0);

  // ── Restore ────────────────────────────────────────────────────────────────
  async function handleRestore(item) {
    setWorking(true);
    try {
      const updates = { deleted: false, deletedAt: null, restoredAt: serverTimestamp() };

      if (item._col === "orders") {
        await updateDoc(doc(db, "users", uid, "suppliers", item._supplierId, "orders", item.id), updates);
      } else {
        await updateDoc(doc(db, "users", uid, item._col, item.id), updates);
      }

      // Customer restore — also restore their invoices + payments
      if (item._col === "customers") {
        const subSnap = await getDocs(collection(db, "users", uid, "customers", item.id, "invoices"));
        await Promise.all(subSnap.docs.map(d => updateDoc(d.ref, updates)));
        const invSnap = await getDocs(query(collection(db, "users", uid, "invoices"), where("customerId", "==", item.id)));
        await Promise.all(invSnap.docs.map(d => updateDoc(d.ref, updates)));
        const paySnap = await getDocs(query(collection(db, "users", uid, "payments"), where("customerId", "==", item.id)));
        await Promise.all(paySnap.docs.map(d => updateDoc(d.ref, updates)));
      }

      // Supplier restore — also restore their orders
      if (item._col === "suppliers") {
        const oSnap = await getDocs(collection(db, "users", uid, "suppliers", item.id, "orders"));
        await Promise.all(oSnap.docs.map(d => updateDoc(d.ref, updates)));
      }

      // Invoice restore — also restore in customer subcollection
      if (item._col === "invoices" && item.customerId) {
        await updateDoc(doc(db, "users", uid, "customers", item.customerId, "invoices", item.id), updates).catch(() => {});
      }

      // Show success popup FIRST, then close confirm dialog
      showSuccessPopup("Restored Successfully! ✓", "Item has been restored to its original section.");
      setWorking(false);
      setRestoreId(null);
      return;
    } catch (err) {
      showToast(err.message || "Restore failed", "error");
    }
    setWorking(false);
    setRestoreId(null);
  }

  // ── Permanent Delete — moves to admin trash instead of actual deletion ──────
  async function handlePermDelete(item) {
    setWorking(true);
    try {
      // Mark as adminTrash instead of deleting — super admin can still see and restore
      const adminTrashUpdate = { adminTrash: true, adminTrashedAt: serverTimestamp() };

      if (item._col === "orders") {
        await updateDoc(doc(db, "users", uid, "suppliers", item._supplierId, "orders", item.id), adminTrashUpdate);
      } else {
        await updateDoc(doc(db, "users", uid, item._col, item.id), adminTrashUpdate);
      }

      if (item._col === "customers") {
        const subSnap = await getDocs(collection(db, "users", uid, "customers", item.id, "invoices"));
        await Promise.all(subSnap.docs.map(d => updateDoc(d.ref, adminTrashUpdate)));
        const invSnap = await getDocs(query(collection(db, "users", uid, "invoices"), where("customerId", "==", item.id)));
        await Promise.all(invSnap.docs.map(d => updateDoc(d.ref, adminTrashUpdate)));
        const paySnap = await getDocs(query(collection(db, "users", uid, "payments"), where("customerId", "==", item.id)));
        await Promise.all(paySnap.docs.map(d => updateDoc(d.ref, adminTrashUpdate)));
      }

      if (item._col === "suppliers") {
        const oSnap = await getDocs(collection(db, "users", uid, "suppliers", item.id, "orders"));
        await Promise.all(oSnap.docs.map(d => updateDoc(d.ref, adminTrashUpdate)));
      }

      if (item._col === "invoices" && item.customerId) {
        await updateDoc(doc(db, "users", uid, "customers", item.customerId, "invoices", item.id), adminTrashUpdate).catch(() => {});
      }

      showToast("Moved to admin archive. Contact support to restore.", "error");
    } catch (err) {
      showToast(err.message || "Delete failed", "error");
    }
    setWorking(false);
    setPermId(null);
  }

  // ── Item label helper ──────────────────────────────────────────────────────
  function getLabel(item) {
    if (item._col === "invoices")  return item.customerName || item.customer || "Unknown";
    if (item._col === "customers") return item.name || "Unknown Customer";
    if (item._col === "products")  return item.name || "Unknown Product";
    if (item._col === "payments")  return item.payerName || item.customer || "Payment";
    if (item._col === "suppliers") return item.name || "Unknown Supplier";
    if (item._col === "orders")    return `PO-${item.id.slice(-4).toUpperCase()} · ${item._supplierName}`;
    return "Item";
  }
  function getSublabel(item) {
    if (item._col === "invoices")  return `INV-${item.id.slice(-4).toUpperCase()} · ${formatRs(item.amount)} · ${item.status || ""}`;
    if (item._col === "customers") return `${item.phone || ""} · ${item.email || ""}`.replace(/^·\s|·\s$/, "").trim() || "—";
    if (item._col === "products")  return `Stock: ${item.stock ?? "—"} · Price: ${formatRs(item.price)}`;
    if (item._col === "payments")  return `${formatRs(item.paid || item.amount)} · ${item.method || "cash"}`;
    if (item._col === "suppliers") return `${item.phone || ""} · Balance: ${formatRs(item.totalBalance)}`;
    if (item._col === "orders")    return `Total: ${formatRs(item.totalAmount)} · Paid: ${formatRs(item.paidAmount)} · Balance: ${formatRs(item.balance)}`;
    return "";
  }
  function getIcon(item) {
    if (item._col === "invoices")  return "🧾";
    if (item._col === "customers") return "👥";
    if (item._col === "products")  return "📦";
    if (item._col === "payments")  return "💳";
    if (item._col === "suppliers") return "🏭";
    if (item._col === "orders")    return "📋";
    return "🗑";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-12 h-12 rounded-full border-4 border-t-red-500 border-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-10">

      {/* ── SweetAlert Popup ── */}
      <SweetAlert
        show={alert.show}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => {
          setAlert(a => ({ ...a, show: false }));
          if (alert.type === "success") showToast(alert.title, "success");
        }}
      />

      {/* ── Bottom-right Toast (shows after popup closes) ── */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[9998] px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{
            background: toast.type === "success" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
            border: `1px solid ${toast.type === "success" ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)"}`,
            color:  toast.type === "success" ? "#34d399" : "#f87171",
            backdropFilter: "blur(12px)",
            animation: "slideUp 0.3s ease",
          }}>
          {toast.type === "success" ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl p-5" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.18)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-white font-black text-xl">🗑️ Trash</h2>
            <p className="text-gray-500 text-xs mt-0.5">Deleted items — restore or permanently remove. Items sent to permanent delete are auto-deleted after 15 days.</p>
          </div>
          <span className="px-3 py-1.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
            {total} item{total !== 1 ? "s" : ""} in trash
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: activeTab === t.id ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${activeTab === t.id ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: activeTab === t.id ? "#f87171" : "#6b7280",
            }}>
            {t.icon} {t.label}
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(255,255,255,0.08)", color: "#9ca3af" }}>
              {items[t.id]?.length || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Items list */}
      {current.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-5xl">🎉</span>
          <p className="text-white font-bold">No deleted {activeTab} here</p>
          <p className="text-gray-500 text-sm">This section is clean.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {current.map((item, idx) => {
            // Only show countdown for items that are in adminTrash (user "perm-deleted")
            const isAdminTrash = !!item.adminTrash;
            const countdown = isAdminTrash ? calc15DayCountdown(item.adminTrashedAt) : null;
            // eslint-disable-next-line no-unused-expressions
            tick; // subscribe to ticker so this re-evaluates every minute

            return (
              <div key={item.id}
                className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors gap-4">

                {/* Icon + Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                    style={{
                      background: isAdminTrash ? "rgba(167,139,250,0.12)" : "rgba(248,113,113,0.1)",
                      border: `1px solid ${isAdminTrash ? "rgba(167,139,250,0.3)" : "rgba(248,113,113,0.2)"}`,
                    }}>
                    {getIcon(item)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white text-sm font-semibold truncate">{getLabel(item)}</p>
                      {isAdminTrash && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}>
                          Contact support to recover
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-[11px] truncate">{getSublabel(item)}</p>
                  </div>
                </div>

                {/* Date + 15-day countdown */}
                <div className="hidden sm:flex flex-col items-end flex-shrink-0 text-right gap-0.5">
                  {isAdminTrash ? (
                    <>
                      <p className="text-gray-600 text-[10px] uppercase tracking-wide">Auto-delete in</p>
                      <p className={`text-xs font-bold ${countdown?.expired ? "text-red-400" : countdown?.daysLeft <= 3 ? "text-amber-400" : "text-purple-400"}`}>
                        {countdown?.display || "—"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-600 text-[10px] uppercase tracking-wide">Deleted</p>
                      <p className="text-gray-400 text-xs">{fmtDate(item.deletedAt)}</p>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 flex-shrink-0">
                  {!isAdminTrash && (
                    <>
                      <button onClick={() => setRestoreId(item.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                        style={{ background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                        ↩ Restore
                      </button>
                      <button onClick={() => setPermId(item.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                        style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                        🗑 Delete
                      </button>
                    </>
                  )}
                  {isAdminTrash && (
                    <span className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                      style={{ background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
                      🔒 Admin only
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Restore Confirm */}
      {restoreId && (() => { const item = current.find(i => i.id === restoreId); return item ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
            style={{ background: "#0d1117", border: "1px solid rgba(52,211,153,0.25)" }}>

            {/* Icon — spinner while working */}
            {working ? (
              <div className="flex justify-center">
                <div className="w-10 h-10 rounded-full border-4 border-t-green-400 border-transparent animate-spin" />
              </div>
            ) : (
              <span className="text-4xl">↩️</span>
            )}

            <h3 className="text-white font-bold text-lg">
              {working ? "Restoring..." : `Restore ${TABS.find(t=>t.id===item._col)?.label.slice(0,-1)}?`}
            </h3>

            {!working && (
              <p className="text-gray-400 text-sm">
                <span className="text-white font-semibold">{getLabel(item)}</span> will be restored and visible again.
                {item._col === "customers" && " Their invoices and payments will also be restored."}
                {item._col === "suppliers" && " Their orders will also be restored."}
              </p>
            )}

            {working && (
              <p className="text-gray-500 text-xs">Please wait...</p>
            )}

            {!working && (
              <div className="flex gap-3">
                <button onClick={() => setRestoreId(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                  Cancel
                </button>
                <button onClick={() => handleRestore(item)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.35)", color: "#34d399" }}>
                  Yes, Restore
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null; })()}

      {/* Permanent Delete Confirm */}
      {permId && (() => { const item = current.find(i => i.id === permId); return item ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
            style={{ background: "#0d1117", border: "1px solid rgba(248,113,113,0.3)" }}>
            <span className="text-4xl">⚠️</span>
            <h3 className="text-white font-bold text-lg">Delete Permanently?</h3>
            <p className="text-gray-400 text-sm">
              Once deleted, this data <span className="text-white font-bold">cannot be recovered</span> on your own.
              Only in a genuine emergency, you may contact support — but restoration is{" "}
              <span className="text-red-400 font-bold">not guaranteed</span>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPermId(null)} disabled={working}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                Cancel
              </button>
              <button onClick={() => handlePermDelete(item)} disabled={working}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}>
                {working ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null; })()}

      <style>{`
        @keyframes popupIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
