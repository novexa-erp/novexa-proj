"use client";
import { useState } from "react";
import {
  collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import InvoiceModal, { formatRs } from "./InvoiceModal";
import InvoicePDFModal from "./InvoicePDF";

const STATUS_STYLE = {
  Paid:    { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
  Unpaid:  { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  Partial: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
};

const TABS = ["All", "Unpaid", "Partial", "Paid"];

// convert Firestore doc → modal initial form
function docToForm(inv) {
  return {
    logoDataUrl:          inv.logoDataUrl || "",
    customerName:         inv.customerName || inv.customer || "",
    address:              inv.address || "",
    phone:                inv.phone || "",
    email:                inv.email || "",
    items:                inv.items?.length ? inv.items : [{ description: "", qty: 1, unitPrice: "", productId: "" }],
    discountType:         inv.discountType || "percent",
    discountValue:        inv.discountValue != null ? String(inv.discountValue) : "",
    amountPaid:           inv.amountPaid != null ? String(inv.amountPaid) : "",
    invoiceDate:          inv.invoiceDate || new Date().toISOString().slice(0, 10),
    dueDate:              inv.dueDate || "",
    earlyDiscountDays:    inv.earlyDiscountDays ? String(inv.earlyDiscountDays) : "",
    earlyDiscountPercent: inv.earlyDiscountPercent ? String(inv.earlyDiscountPercent) : "",
    note:                 inv.note || "",
  };
}

export default function InvoicesView({ uid, invoices, loading, products = [], userDoc }) {  const [activeTab,   setActiveTab]   = useState("All");
  const [showModal,   setShowModal]   = useState(false);
  const [editTarget,  setEditTarget]  = useState(null); // {id, form}
  const [saving,      setSaving]      = useState(false);
  const [deleteConf,  setDeleteConf]  = useState(null); // invoice id
  const [search,      setSearch]      = useState("");
  const [pdfInvoice,  setPdfInvoice]  = useState(null); // invoice to preview PDF

  // only show invoices NOT linked to a customer (customerId = undefined/null/empty)
  const directInvoices = invoices.filter(i => !i.customerId);

  // filter
  const filtered = directInvoices.filter(inv => {
    const matchTab    = activeTab === "All" || inv.status === activeTab;
    const matchSearch = !search ||
      (inv.customerName || inv.customer || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.id || "").toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  // ── Save (create or update) ────────────────────────────────────────────────
  async function handleSave(formData) {
    if (!uid || saving) return;
    setSaving(true);
    try {
      const payload = {
        logoDataUrl:          formData.logoDataUrl || "",
        customerName:         formData.customerName,
        customer:             formData.customerName, // backward compat
        address:              formData.address,
        phone:                formData.phone,
        email:                formData.email,
        items:                formData.items,
        discountType:         formData.discountType,
        discountValue:        Number(formData.discountValue) || 0,
        subtotal:             formData.subtotal,
        discount:             formData.discount,
        amount:               formData.amount,       // after discount
        amountPaid:           formData.amountPaid,
        balance:              formData.balance,
        status:               formData.status,
        invoiceDate:          formData.invoiceDate,
        dueDate:              formData.dueDate,
        earlyDiscountDays:    Number(formData.earlyDiscountDays) || 0,
        earlyDiscountPercent: Number(formData.earlyDiscountPercent) || 0,
        note:                 formData.note,
      };

      if (editTarget) {
        await updateDoc(doc(db, "users", uid, "invoices", editTarget.id), {
          ...payload, updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "users", uid, "invoices"), {
          ...payload, createdAt: serverTimestamp(),
        });
      }
      setShowModal(false);
      setEditTarget(null);
    } catch (err) { alert("Error: " + err.message); }
    setSaving(false);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, "users", uid, "invoices", id));
    } catch (err) { alert("Error: " + err.message); }
    setDeleteConf(null);
  }

  const card = "rounded-2xl p-5";
  const cardStyle = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" };

  return (
    <div className="flex flex-col gap-5">

      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {TABS.map(t => {
            const count = t === "All" ? directInvoices.length : directInvoices.filter(i => i.status === t).length;
            const active = activeTab === t;
            return (
              <button key={t} onClick={() => setActiveTab(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                style={{
                  background: active ? (t === "Paid" ? "rgba(52,211,153,0.15)" : t === "Unpaid" ? "rgba(248,113,113,0.15)" : t === "Partial" ? "rgba(251,191,36,0.15)" : "rgba(37,99,235,0.15)") : "transparent",
                  color: active ? (t === "Paid" ? "#34d399" : t === "Unpaid" ? "#f87171" : t === "Partial" ? "#fbbf24" : "#60A5FA") : "#6b7280",
                }}>
                {t}
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.07)" }}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          {/* search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">🔍</span>
            <input placeholder="Search customer / ID..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl text-xs text-white outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", width: 200 }} />
          </div>
          {/* new invoice btn */}
          <button onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000" }}>
            ➕ New Invoice
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Invoices",  val: directInvoices.length,                                                                    color: "#60A5FA" },
            { label: "Total Amount",    val: formatRs(directInvoices.reduce((s,i)=>s+(Number(i.amount)||0),0)),                        color: "#fff"    },
            { label: "Total Collected", val: formatRs(directInvoices.reduce((s,i)=>s+(Number(i.amountPaid)||0),0)),                    color: "#34d399" },
            { label: "Total Balance",   val: formatRs(directInvoices.reduce((s,i)=>s+(Number(i.balance)||0),0)),                       color: "#f87171" },
          ].map(s => (
            <div key={s.label} className={card} style={cardStyle}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{s.label}</p>
              <p className="font-black text-base" style={{ color: s.color }}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Invoice list ── */}
      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        {/* list header */}
        <div className="hidden md:grid px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600 border-b border-white/[0.05]"
          style={{ gridTemplateColumns: "1fr 120px 110px 110px 90px 120px" }}>
          <span>Customer</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Paid</span>
          <span className="text-right">Balance</span>
          <span className="text-center">Status</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-4 border-b border-white/[0.04] animate-pulse flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2 py-1">
                <div className="h-3 bg-white/5 rounded w-40" />
                <div className="h-2 bg-white/5 rounded w-24" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">🧾</p>
            <p className="text-gray-400 text-sm font-medium">
              {search ? "No invoices match your search." : `No ${activeTab === "All" ? "" : activeTab.toLowerCase() + " "}invoices yet.`}
            </p>
            {!search && (
              <button onClick={() => { setEditTarget(null); setShowModal(true); }}
                className="mt-3 text-xs font-semibold transition-colors" style={{ color: "#F59E0B" }}>
                Create your first invoice →
              </button>
            )}
          </div>
        ) : (
          filtered.map((inv) => {
            const st      = STATUS_STYLE[inv.status] || STATUS_STYLE["Unpaid"];
            const dateStr = inv.createdAt?.toDate
              ? inv.createdAt.toDate().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
              : inv.invoiceDate || "—";
            const num     = inv.id.slice(-4).toUpperCase();
            const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== "Paid";

            return (
              <div key={inv.id}
                className="grid items-center px-5 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                style={{ gridTemplateColumns: "1fr" }}>

                {/* mobile layout */}
                <div className="flex items-center justify-between md:hidden">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0"
                      style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", color: "#60A5FA" }}>
                      {num}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{inv.customerName || inv.customer || "Unknown"}</p>
                      <p className="text-gray-500 text-[10px]">INV-{num} · {dateStr}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-white text-sm font-bold">{formatRs(inv.amount)}</p>
                      {Number(inv.balance) > 0 && <p className="text-[10px]" style={{ color: "#f87171" }}>Bal: {formatRs(inv.balance)}</p>}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {inv.status}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => setPdfInvoice(inv)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors"
                        style={{ background: "rgba(52,211,153,0.08)", color: "#34d399" }}>👁</button>
                      <button onClick={() => { setEditTarget({ id: inv.id, form: docToForm(inv) }); setShowModal(true); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors"
                        style={{ background: "rgba(37,99,235,0.1)", color: "#60A5FA" }}>✏️</button>
                      <button onClick={() => setDeleteConf(inv.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors"
                        style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>🗑</button>
                    </div>
                  </div>
                </div>

                {/* desktop layout */}
                <div className="hidden md:grid items-center gap-4"
                  style={{ gridTemplateColumns: "1fr 120px 110px 110px 90px 120px" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0"
                      style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", color: "#60A5FA" }}>
                      {num}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{inv.customerName || inv.customer || "Unknown"}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-500 text-[10px]">INV-{num} · {dateStr}</p>
                        {isOverdue && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>OVERDUE</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-white text-sm font-bold text-right">{formatRs(inv.amount)}</p>
                  <p className="text-right text-sm font-semibold" style={{ color: "#34d399" }}>{formatRs(inv.amountPaid || 0)}</p>
                  <p className="text-right text-sm font-semibold" style={{ color: Number(inv.balance) > 0 ? "#f87171" : "#34d399" }}>
                    {formatRs(inv.balance || 0)}
                  </p>
                  <div className="flex justify-center">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {inv.status}
                    </span>
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setPdfInvoice(inv)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-105"
                      style={{ background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                      👁 View
                    </button>
                    <button onClick={() => { setEditTarget({ id: inv.id, form: docToForm(inv) }); setShowModal(true); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-105"
                      style={{ background: "rgba(37,99,235,0.1)", color: "#60A5FA", border: "1px solid rgba(37,99,235,0.2)" }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => setDeleteConf(inv.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-105"
                      style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                      🗑 Del
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Invoice Modal ── */}
      {showModal && (
        <InvoiceModal
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSave={handleSave}
          saving={saving}
          initial={editTarget?.form || null}
          products={products}
          settingsLogo={userDoc?.logoDataUrl || ""}
        />
      )}

      {/* ── PDF Preview Modal ── */}
      {pdfInvoice && (
        <InvoicePDFModal
          inv={pdfInvoice}
          userDoc={userDoc}
          onClose={() => setPdfInvoice(null)}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteConf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
            style={{ background: "#0d1117", border: "1px solid rgba(248,113,113,0.3)" }}>
            <p className="text-3xl">🗑️</p>
            <h3 className="text-white font-bold text-base">Delete Invoice?</h3>
            <p className="text-gray-400 text-sm">This action cannot be undone. The invoice will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConf(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConf)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
