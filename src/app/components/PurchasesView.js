"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, onSnapshot, query, orderBy, writeBatch, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import SweetAlert from "./SweetAlert";
import SupplierDetailComponent from "./SupplierDetail";
import { OrderFormModal } from "./SupplierDetail";

// ── helpers ──────────────────────────────────────────────────────────────────
function formatRs(n) {
  if (!n && n !== 0) return "Rs. 0";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}
function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
const AVATAR_COLORS = [
  "linear-gradient(135deg,#2563EB,#60A5FA)",
  "linear-gradient(135deg,#F59E0B,#FCD34D)",
  "linear-gradient(135deg,#8B5CF6,#C4B5FD)",
  "linear-gradient(135deg,#10B981,#34D399)",
  "linear-gradient(135deg,#EF4444,#FCA5A5)",
  "linear-gradient(135deg,#F97316,#FDBA74)",
];
function avatarColor(id) {
  const code = (id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}
const cardStyle = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(12px)",
};
const base = {
  width: "100%", outline: "none", background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: 10,
  padding: "9px 13px", color: "#fff", fontSize: 13,
  transition: "border-color .2s, background .2s",
};
const focusStyle = { background: "rgba(37,99,235,0.07)", borderColor: "rgba(37,99,235,0.5)", boxShadow: "0 0 0 3px rgba(37,99,235,0.08)" };
const lbl = { display: "block", color: "#9ca3af", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 };

function SInput({ type = "text", placeholder, value, onChange, req }) {
  const [f, setF] = useState(false);
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      required={req} autoComplete="off"
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...base, ...(f ? focusStyle : {}) }} />
  );
}
function STextarea({ placeholder, value, onChange, rows = 2 }) {
  const [f, setF] = useState(false);
  return (
    <textarea placeholder={placeholder} value={value} onChange={onChange} rows={rows}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...base, ...(f ? focusStyle : {}), resize: "vertical" }} />
  );
}

// ── Supplier Create/Edit Modal ────────────────────────────────────────────────
const SEMPTY = { name: "", shopName: "", phone: "", email: "", address: "", city: "", notes: "" };

function SupplierModal({ initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(initial || SEMPTY);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-lg my-6 rounded-2xl"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-white font-black text-xl">{initial ? "Edit Supplier" : "New Supplier"}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{initial ? "Update supplier details" : "Fill in the details below"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label style={lbl}>Supplier Name <span style={{ color: "#f87171" }}>*</span></label>
              <SInput placeholder="e.g. Ali Traders" value={form.name} onChange={set("name")} req />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label style={lbl}>Shop / Company Name</label>
              <SInput placeholder="e.g. ABC Wholesale" value={form.shopName} onChange={set("shopName")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}>Phone <span style={{ color: "#f87171" }}>*</span></label>
              <SInput type="tel" placeholder="+92 300 1234567" value={form.phone} onChange={set("phone")} req />
            </div>
            <div>
              <label style={lbl}>Email (optional)</label>
              <SInput type="email" placeholder="supplier@email.com" value={form.email} onChange={set("email")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}>City</label>
              <SInput placeholder="e.g. Lahore" value={form.city} onChange={set("city")} />
            </div>
            <div>
              <label style={lbl}>Address</label>
              <SInput placeholder="Street, Area..." value={form.address} onChange={set("address")} />
            </div>
          </div>
          <div>
            <label style={lbl}>Notes / Remarks</label>
            <STextarea placeholder="Any extra details..." value={form.notes} onChange={set("notes")} />
          </div>
          <div className="flex gap-3 mt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-2xl text-sm font-black"
              style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", color: "#fff", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving..." : initial ? "Update →" : "Create Supplier →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel, label = "Supplier" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
        style={{ background: "#0d1117", border: "1px solid rgba(248,113,113,0.3)" }}>
        <p className="text-3xl">🗑️</p>
        <h3 className="text-white font-bold text-base">Delete {label}?</h3>
        <p className="text-gray-400 text-sm">Delete <strong className="text-white">{name}</strong>? This cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Supplier Card ─────────────────────────────────────────────────────────────
function SupplierCard({ supplier, onClick, onEdit, onDelete, index }) {
  const balance       = Number(supplier.totalBalance)  || 0;
  const totalPaid     = Number(supplier.totalPaid)     || 0;
  const totalBusiness = Number(supplier.totalBusiness) || 0;
  const paidPct       = totalBusiness > 0 ? (totalPaid / totalBusiness) * 100 : 0;

  return (
    <div className="group relative rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer"
      style={{ ...cardStyle, animation: `fadeInUp 0.4s ease-out ${index * 0.05}s both` }}
      onClick={e => { if (e.defaultPrevented) return; onClick(); }}>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none" />
      <div className="absolute top-3 right-3 z-20">
        <span className={`px-2 py-1 rounded-md text-[10px] font-semibold ${
          balance === 0 ? "bg-green-500/20 text-green-300 border border-green-400/40"
          : totalPaid > 0 ? "bg-yellow-500/20 text-yellow-300 border border-yellow-400/40"
          : "bg-red-500/20 text-red-300 border border-red-400/40"}`}>
          {balance === 0 ? "✅ Clear" : totalPaid > 0 ? "⚡ Partial" : "⏳ Pending"}
        </span>
      </div>
      <div className="p-5 pt-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white flex-shrink-0"
            style={{ background: avatarColor(supplier.id), boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
            {initials(supplier.name)}
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-bold text-base truncate">{supplier.name}</h3>
            {supplier.shopName && <p className="text-amber-400 text-xs font-semibold truncate">{supplier.shopName}</p>}
            <p className="text-gray-500 text-[11px]">{supplier.phone}</p>
          </div>
        </div>
        {supplier.city && <p className="text-gray-500 text-xs">📍 {supplier.city}{supplier.address ? ` · ${supplier.address}` : ""}</p>}
        <div className="pt-2 border-t border-white/5 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">Total Business</span>
            <span className="text-white font-bold text-sm">{formatRs(totalBusiness)}</span>
          </div>
          {Number(supplier.totalReturns) > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-xs">Goods Return</span>
              <span className="text-red-400 font-semibold text-sm">- {formatRs(Number(supplier.totalReturns))}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">Total Paid</span>
            <span className="text-green-400 font-semibold text-sm">{formatRs(totalPaid)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">Balance</span>
            <span className={`font-bold text-sm ${balance > 0 ? "text-red-400" : "text-green-400"}`}>{formatRs(balance)}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-700"
              style={{ width: `${paidPct}%` }} />
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-white/5" onClick={e => e.stopPropagation()}>
          <button onClick={e => { e.stopPropagation(); e.preventDefault(); onEdit(e); }} className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold hover:scale-105 transition-all"
            style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.15),rgba(59,130,246,0.25))", border: "1px solid rgba(59,130,246,0.4)", color: "#60A5FA" }}>✎ Edit</button>
          <button onClick={e => { e.stopPropagation(); e.preventDefault(); onDelete(e); }} className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold hover:scale-105 transition-all"
            style={{ background: "linear-gradient(135deg,rgba(248,113,113,0.1),rgba(239,68,68,0.2))", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>🗑️ Delete</button>
        </div>
      </div>
      <style jsx>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ── Main PurchasesView ────────────────────────────────────────────────────────
export default function PurchasesView({ uid, userDoc }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [suppliers, setSuppliers]         = useState([]);
  const [suppLoading, setSuppLoading]     = useState(true);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editSupplier, setEditSupplier]   = useState(null);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [deleteSupId, setDeleteSupId]     = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [searchQuery, setSearchQuery]     = useState("");
  const [showOrderForm, setShowOrderForm]   = useState(false);
  const [alert, setAlert]                 = useState({ show: false, type: "", title: "", message: "" });

  // URL helpers — same pattern as CustomersView
  function openSupplier(sup) {
    setSelectedSupplier(sup);
    const params = new URLSearchParams(window.location.search);
    params.set("supplierId", sup.id);
    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  }
  function closeSupplier() {
    setSelectedSupplier(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("supplierId");
    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  }

  // Restore selectedSupplier from URL on load / refresh
  useEffect(() => {
    const sid = searchParams.get("supplierId");
    if (!sid) {
      // No supplierId in URL → clear selection (handles sidebar navigation)
      setSelectedSupplier(null);
      return;
    }
    if (sid && suppliers.length > 0) {
      const found = suppliers.find(s => s.id === sid);
      if (found && found.id !== selectedSupplier?.id) {
        setSelectedSupplier(found);
      }
    }
  }, [searchParams, suppliers]);

  // real-time suppliers listener + aggregate stats from orders subcollection
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      query(collection(db, "users", uid, "suppliers"), orderBy("createdAt", "desc")),
      async snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.deleted);
        const withStats = await Promise.all(list.map(async sup => {
          try {
            // Fetch orders, receipts and returns — now nested under each supplier
            const [oSnap, recSnap, retSnap] = await Promise.all([
              getDocs(collection(db, "users", uid, "suppliers", sup.id, "orders")),
              getDocs(collection(db, "users", uid, "suppliers", sup.id, "receipts")),
              getDocs(collection(db, "users", uid, "suppliers", sup.id, "returns")),
            ]);

            const orders   = oSnap.docs.map(d => ({ _id: d.id, ...d.data() })).filter(o => !o.deleted);
            const receipts = recSnap.docs.map(d => ({ _id: d.id, ...d.data() }));
            const returns  = retSnap.docs.map(d => ({ _id: d.id, ...d.data() }));

            // ── DEBUG: log every document and its contributing value ──────
            console.group(`📦 Supplier: ${sup.name} (${sup.id})`);
            console.log("── ORDERS ──");
            orders.forEach(o => {
              const sub  = (o.items||[]).reduce((s,it)=>s+(Number(it.qty)||0)*(Number(it.unitPrice)||0),0);
              const disc = o.discountType==="percent" ? sub*(Number(o.discountValue)||0)/100 : (Number(o.discountValue)||0);
              console.log(`  Order ${o._id}: items subtotal=${sub}, disc=${disc}, origAmt=${Math.max(sub-disc,0)}, totalAmount=${o.totalAmount}, balance=${o.balance}, paidAmount=${o.paidAmount}`);
            });
            console.log("── RECEIPTS (supplierReceipts) ──");
            receipts.forEach(r => console.log(`  Receipt ${r._id}: receiptTotal=${r.receiptTotal}, orderId=${r.orderId}`));
            console.log("── RETURNS (supplierReturns) ──");
            returns.forEach(r => console.log(`  Return ${r._id}: returnTotal=${r.returnTotal}, orderId=${r.orderId}`));
            console.groupEnd();
            // ─────────────────────────────────────────────────────────────

            // Compute original amount from items array (frozen, never mutated)
            const origTotal = orders.reduce((s, o) => {
              if (!o.items?.length) return s;
              const sub  = o.items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
              const disc = o.discountType === "percent"
                ? sub * (Number(o.discountValue) || 0) / 100
                : (Number(o.discountValue) || 0);
              return s + Math.max(sub - disc, 0);
            }, 0);

            const totalReceipts = receipts.reduce((s, r) => s + (Number(r.receiptTotal) || 0), 0);
            const totalReturns  = returns.reduce((s, r)  => s + (Number(r.returnTotal)  || 0), 0);
            const totalPaidOut  = orders.reduce((s, o) => s + (Number(o.paidAmount) || 0), 0);
            const totalBalance  = orders.reduce((s, o) => s + (Number(o.balance)    || 0), 0);

            return {
              ...sup,
              totalBusiness: totalPaidOut + totalBalance,  // net = paid + remaining balance (returns already deducted from balance)
              totalReturns,
              totalPaid:     totalPaidOut,
              totalBalance,
            };
          } catch { return sup; }
        }));
        setSuppliers(withStats);
        setSuppLoading(false);
      },
      () => setSuppLoading(false)
    );
    return () => unsub();
  }, [uid]);

  // ── Supplier CRUD ─────────────────────────────────────────────────────────
  async function handleSaveSupplier(form) {
    setSavingSupplier(true);
    try {
      if (editSupplier) {
        await updateDoc(doc(db, "users", uid, "suppliers", editSupplier.id),
          { ...form, updatedAt: serverTimestamp() });
        setAlert({ show: true, type: "success", title: "Supplier Updated! ✓", message: `${form.name} updated.` });
      } else {
        await addDoc(collection(db, "users", uid, "suppliers"),
          { ...form, createdAt: serverTimestamp() });
        setAlert({ show: true, type: "success", title: "Supplier Added! 🎉", message: `${form.name} added.` });
      }
      setShowSupplierModal(false);
      setEditSupplier(null);
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Error", message: err.message });
    }
    setSavingSupplier(false);
  }

  async function handleDeleteSupplier(id) {
    try {
      const deletedAt = serverTimestamp();

      // Soft delete all orders for this supplier
      const ordersSnap = await getDocs(collection(db, "users", uid, "suppliers", id, "orders"));
      await Promise.all(ordersSnap.docs.map(d => updateDoc(d.ref, { deleted: true, deletedAt })));

      // Soft delete the supplier doc itself
      await updateDoc(doc(db, "users", uid, "suppliers", id), { deleted: true, deletedAt });

      if (selectedSupplier?.id === id) setSelectedSupplier(null);
      setAlert({ show: true, type: "success", title: "Deleted! 🗑️", message: "Supplier moved to trash. You can restore it from Trash." });
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Error", message: err.message });
    }
    setDeleteSupId(null);
  }

  // ── if supplier selected → show detail view ───────────────────────────────
  // (no early return — modals need to be accessible from detail page too)
  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.shopName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.includes(searchQuery)
  );
  const totalBusiness = suppliers.reduce((s, x) => s + (Number(x.totalBusiness) || 0), 0);
  const totalReturns  = suppliers.reduce((s, x) => s + (Number(x.totalReturns)  || 0), 0);
  const totalPaid     = suppliers.reduce((s, x) => s + (Number(x.totalPaid)     || 0), 0);
  const totalBalance  = suppliers.reduce((s, x) => s + (Number(x.totalBalance)  || 0), 0);

  return (
    <>
      <SweetAlert show={alert.show} type={alert.type} title={alert.title} message={alert.message}
        onClose={() => setAlert(a => ({ ...a, show: false }))} />

      {/* ── Supplier Detail View ── */}
      {selectedSupplier && (
        <SupplierDetailComponent
          supplier={suppliers.find(s => s.id === selectedSupplier.id) || selectedSupplier}
          uid={uid}
          userDoc={userDoc}
          onBack={() => closeSupplier()}
          onEdit={() => { setEditSupplier(suppliers.find(s=>s.id===selectedSupplier.id)||selectedSupplier); setShowSupplierModal(true); }}
          onDelete={() => { setDeleteSupId(selectedSupplier.id); }}
        />
      )}

      {/* ── Supplier List View ── */}
      {!selectedSupplier && (
      <div className="flex flex-col gap-5 w-full">

        {/* Header */}
        <div className="relative overflow-hidden rounded-xl p-6" style={cardStyle}>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Purchase Management
              </h2>
              <p className="text-gray-400 text-xs">Manage suppliers and track all purchases</p>
            </div>
            <button onClick={() => { setEditSupplier(null); setShowSupplierModal(true); }}
              className="group relative px-5 py-2.5 rounded-lg font-semibold text-sm hover:scale-105 transition-all overflow-hidden shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600" />
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 flex items-center gap-2 text-white">
                <span className="text-base group-hover:rotate-90 transition-transform duration-300">+</span>
                Add Supplier
              </span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Total Suppliers",  value: suppliers.length,        icon: "👤", color: "from-blue-500 to-indigo-600"   },
            { label: "Total Business",   value: formatRs(totalBusiness),  icon: "💼", color: "from-purple-500 to-pink-600"  },
            { label: "Total Paid Out",   value: formatRs(totalPaid),      icon: "💸", color: "from-green-500 to-emerald-600" },
            { label: "Goods Return",     value: formatRs(totalReturns),   icon: "↩️", color: "from-red-500 to-rose-600"     },
            { label: "Total Payable",    value: formatRs(totalBalance),   icon: "⏳", color: "from-orange-500 to-red-600"   },
          ].map((stat, i) => (
            <div key={i} className="group relative rounded-lg p-4 overflow-hidden hover:scale-[1.02] hover:-translate-y-1 transition-all" style={cardStyle}>
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl font-bold group-hover:scale-110 transition-all">{stat.icon}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r ${stat.color} text-white`}>Live</span>
                </div>
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">{stat.label}</p>
                <p className="text-white font-bold text-2xl">{stat.value}</p>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-50`} />
            </div>
          ))}
        </div>

        {/* ── Order Form Banner ───────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.2)" }}>
          {/* Gradient glow bg */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-purple-600/10" />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 via-orange-500 to-purple-500" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 p-5">
            {/* Left — icon + text */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", boxShadow: "0 4px 20px rgba(245,158,11,0.3)" }}>
                📋
              </div>
              <div>
                <div className="text-white font-bold text-base">Blank Order Form</div>
                <div className="text-gray-400 text-xs mt-0.5">
                  Print &amp; fill by hand · Multi-page · Standard &amp; Variant layouts
                </div>
              </div>
            </div>

            {/* Right — quick page pills + open button */}
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 text-xs">Quick:</span>
                {[5, 10, 25].map(pg => (
                  <button key={pg} onClick={() => setShowOrderForm(true)}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105"
                    style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}>
                    {pg}pg
                  </button>
                ))}
              </div>
              <button onClick={() => setShowOrderForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}>
                📥 Open Form
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <input type="text" placeholder="🔍 Search suppliers..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 rounded-lg text-sm text-white outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
          <span className="absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
        </div>

        {/* Suppliers Grid */}
        {suppLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-t-blue-500 border-r-purple-500 border-b-pink-500 border-l-green-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">👤</div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl p-16 text-center relative overflow-hidden" style={cardStyle}>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5" />
            <div className="relative z-10">
              <div className="text-6xl mb-4">👤</div>
              <h3 className="text-white font-bold text-xl mb-2">
                {searchQuery ? "No suppliers found" : "No suppliers yet"}
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                {searchQuery ? `No match for "${searchQuery}"` : "Add your first supplier to get started"}
              </p>
              {!searchQuery && (
                <button onClick={() => { setEditSupplier(null); setShowSupplierModal(true); }}
                  className="px-6 py-3 rounded-lg text-sm font-semibold hover:scale-105 transition-all shadow-lg"
                  style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: "#fff" }}>
                  + Add First Supplier
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((sup, idx) => (
              <SupplierCard
                key={sup.id}
                supplier={sup}
                index={idx}
                onClick={() => openSupplier(sup)}
                onEdit={e => { e.stopPropagation(); setEditSupplier(sup); setShowSupplierModal(true); }}
                onDelete={e => { e.stopPropagation(); setDeleteSupId(sup.id); }}
              />
            ))}
          </div>
        )}
      </div>
      )} {/* end !selectedSupplier */}

      {/* Supplier Modal — always mounted so works from both list & detail */}
      {showSupplierModal && (
        <SupplierModal
          initial={editSupplier ? {
            name: editSupplier.name || "", shopName: editSupplier.shopName || "",
            phone: editSupplier.phone || "", email: editSupplier.email || "",
            address: editSupplier.address || "", city: editSupplier.city || "",
            notes: editSupplier.notes || "",
          } : null}
          onClose={() => { setShowSupplierModal(false); setEditSupplier(null); }}
          onSave={handleSaveSupplier}
          saving={savingSupplier}
        />
      )}

      {/* Delete Confirm */}
      {deleteSupId && (
        <DeleteConfirm
          name={suppliers.find(s => s.id === deleteSupId)?.name || "this supplier"}
          label="Supplier"
          onConfirm={() => { handleDeleteSupplier(deleteSupId); closeSupplier(); }}
          onCancel={() => setDeleteSupId(null)}
        />
      )}

      {/* Order Form Modal */}
      {showOrderForm && (
        <OrderFormModal
          userDoc={userDoc}
          onClose={() => setShowOrderForm(false)}
        />
      )}

      <style jsx global>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x { background-size: 200% 200%; animation: gradient-x 5s ease infinite; }
      `}</style>
    </>
  );
}
