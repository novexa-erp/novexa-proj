"use client";
import { useState } from "react";
import {
  collection, addDoc, doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import InvoiceModal, { formatRs } from "./InvoiceModal";
import InvoicePDFModal from "./InvoicePDF";
import SweetAlert from "./SweetAlert";

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
  
  // Sweet Alert State
  const [alert, setAlert] = useState({ show: false, type: "", title: "", message: "" });

  // only show invoices NOT linked to a customer AND not soft-deleted
  const directInvoices = invoices.filter(i => !i.customerId && !i.deleted);

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
        // If new payment is being added, exclude amountPaid/balance/status from first update
        // They will be correctly set in the payment block below
        const hasNewPayment = formData.newPaymentAmount && Number(formData.newPaymentAmount) > 0;
        const detailsPayload = hasNewPayment
          ? (({ amountPaid, balance, status, ...rest }) => rest)(payload)
          : payload;

        // Update invoice details
        await updateDoc(doc(db, "users", uid, "invoices", editTarget.id), {
          ...detailsPayload, updatedAt: serverTimestamp(),
        });
        
        // Handle payment collection if provided
        if (formData.newPaymentAmount && Number(formData.newPaymentAmount) > 0) {
          const paymentAmount = Number(formData.newPaymentAmount);
          // previousBalance = balance before this payment
          const previousBalance = Math.max(0, payload.amount - (Number(formData.amountPaid) || 0));
          const newTotalPaid = (Number(formData.amountPaid) || 0) + paymentAmount;
          const newBalance = Math.max(0, payload.amount - newTotalPaid);
          const newStatus = newBalance === 0 ? "Paid" : newTotalPaid > 0 ? "Partial" : "Unpaid";
          
          // Update ONLY payment fields on invoice — do NOT change items/amounts
          await updateDoc(doc(db, "users", uid, "invoices", editTarget.id), {
            amountPaid: newTotalPaid,
            balance: newBalance,
            status: newStatus,
            lastPaymentAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          
          // Create payment record:
          // amount  = previousBalance (Amount col — pehle ka balance)
          // paid    = jo abhi diya (Paid col)
          // balance = jo bacha (Balance col)
          // status  = Partial / Paid
          await addDoc(collection(db, "users", uid, "payments"), {
            type: "received",
            amount: previousBalance,            // pehla balance
            paid: paymentAmount,                // jo diya
            balance: newBalance,                // jo bacha
            invoiceId: editTarget.id,
            invoiceNumber: `INV-${editTarget.id.slice(-4).toUpperCase()}`,
            customer: formData.customerName,
            payerName: formData.payerName || formData.customerName,
            payerContact: formData.payerContact || formData.phone,
            receiverName: formData.receiverName || "",
            receiverContact: formData.receiverContact || "",
            description: `Payment for invoice ${editTarget.id.slice(-4).toUpperCase()}`,
            method: formData.paymentMethod || "cash",
            status: newStatus,                  // Partial / Paid
            createdAt: serverTimestamp(),
          });
          
          setAlert({
            show: true,
            type: "success",
            title: "Payment Collected! 💰",
            message: `Payment of ${formatRs(paymentAmount)} collected from ${formData.payerName || formData.customerName}. Invoice updated to ${newStatus}.`,
          });
        } else {
          // Show update success alert (no payment)
          setAlert({
            show: true,
            type: "success",
            title: "Invoice Updated! ✓",
            message: `Invoice for ${formData.customerName} has been updated successfully.`,
          });
        }
      } else {
        // Create new invoice — store original values so history always shows creation-time state
        await addDoc(collection(db, "users", uid, "invoices"), {
          ...payload,
          originalAmountPaid: payload.amountPaid,
          originalBalance:    payload.balance,
          originalStatus:     payload.status,
          createdAt: serverTimestamp(),
        });
        
        // Update stock for each item in the invoice
        for (const item of formData.items) {
          if (item.productId && item.qty) {
            const productRef = doc(db, "users", uid, "products", item.productId);
            const product = products.find(p => p.id === item.productId);
            
            if (product) {
              const qtyToDeduct = Number(item.qty) || 0;
              
              // Check if product has variants
              if (item.variantId && product.variants?.length > 0) {
                // Update variant stock
                const updatedVariants = product.variants.map(v => {
                  // Match by ID or by index (for backwards compatibility)
                  const varId = v.id || `var_${product.variants.indexOf(v)}`;
                  if (varId === item.variantId) {
                    const currentStock = Number(v.stock) || 0;
                    const newStock = Math.max(0, currentStock - qtyToDeduct);
                    return { ...v, stock: newStock };
                  }
                  return v;
                });
                
                await updateDoc(productRef, {
                  variants: updatedVariants,
                  updatedAt: serverTimestamp(),
                });
              } else {
                // Update simple product stock
                const currentStock = Number(product.stock) || 0;
                const newStock = Math.max(0, currentStock - qtyToDeduct);
                
                await updateDoc(productRef, {
                  stock: newStock,
                  updatedAt: serverTimestamp(),
                });
              }
            }
          }
        }
        
        // Show create success alert
        setAlert({
          show: true,
          type: "success",
          title: "Invoice Created! 🧾",
          message: `New invoice for ${formData.customerName} has been created successfully. Stock updated.`,
        });
      }
      setShowModal(false);
      setEditTarget(null);
    } catch (err) { 
      setAlert({
        show: true,
        type: "error",
        title: "Failed to Save Invoice",
        message: err.message || "Something went wrong. Please try again.",
      });
    }
    setSaving(false);
  }

  // ── Delete (soft) ─────────────────────────────────────────────────────────
  async function handleDelete(id) {
    try {
      await updateDoc(doc(db, "users", uid, "invoices", id), {
        deleted:   true,
        deletedAt: serverTimestamp(),
      });
      setAlert({
        show: true,
        type: "success",
        title: "Invoice Deleted! 🗑️",
        message: "The invoice has been removed from your records.",
      });
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        title: "Failed to Delete Invoice",
        message: err.message || "Something went wrong. Please try again.",
      });
    }
    setDeleteConf(null);
  }

  const card = "rounded-2xl p-5";
  const cardStyle = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" };

  // ── Professional Loader ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-t-amber-500 border-r-purple-500 border-b-blue-500 border-l-pink-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">🧾</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Sweet Alert */}
      <SweetAlert
        show={alert.show}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert({ ...alert, show: false })}
      />

      {/* Professional Header */}
      <div className="relative overflow-hidden rounded-xl p-6" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-pink-500/5 to-purple-500/5 animate-gradient-x" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1 bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              Invoice Management
            </h2>
            <p className="text-gray-400 text-xs">Create and manage customer invoices</p>
          </div>
          
          <button onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="group relative px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-105 overflow-hidden shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-600 transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative z-10 flex items-center gap-2 text-black font-bold">
              <span className="text-base group-hover:rotate-90 transition-transform duration-300">+</span>
              Create Invoice
            </span>
          </button>
        </div>
      </div>

      {/* Professional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Invoices", value: directInvoices.length, icon: "🧾", color: "from-orange-500 to-amber-600" },
          { label: "Total Amount", value: formatRs(directInvoices.reduce((s,i)=>s+(Number(i.amount)||0),0)), icon: "💰", color: "from-pink-500 to-purple-600" },
          { label: "Total Collected", value: formatRs(directInvoices.reduce((s,i)=>s+(Number(i.amountPaid)||0),0)), icon: "💵", color: "from-green-500 to-emerald-600" },
          { label: "Total Balance", value: formatRs(directInvoices.reduce((s,i)=>s+(Number(i.balance)||0),0)), icon: "⏳", color: "from-rose-500 to-red-600" },
        ].map((stat, i) => (
          <div key={i} 
            className="group relative rounded-lg p-4 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div className="text-2xl font-bold group-hover:scale-110 transition-all duration-300">
                  {stat.icon}
                </div>
                <div className={`px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gradient-to-r ${stat.color} text-white`}>
                  Live
                </div>
              </div>
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wide mb-1">{stat.label}</p>
              <p className="text-white font-bold text-2xl">{typeof stat.value === 'number' ? stat.value : stat.value}</p>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-50`} />
          </div>
        ))}
      </div>

      {/* Search & Filter Tabs */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1 relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-300" />
          <input
            type="text"
            placeholder="🔍 Search by customer name or invoice ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="relative w-full px-4 py-2.5 pl-10 rounded-lg text-sm text-white outline-none transition-all duration-300"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">🔍</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map(t => {
            const count = t === "All" ? directInvoices.length : directInvoices.filter(i => i.status === t).length;
            const icons = { All: "📋", Unpaid: "❌", Partial: "⚡", Paid: "✅" };
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
                  activeTab === t ? "scale-105 shadow-lg" : "hover:scale-105"
                }`}
                style={{
                  background: activeTab === t 
                    ? "linear-gradient(135deg, #F59E0B, #D97706)"
                    : "rgba(255,255,255,0.05)",
                  border: `1px solid ${activeTab === t ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                  color: activeTab === t ? "#000" : "#9ca3af",
                }}>
                <span className="text-sm font-bold">{icons[t]}</span>
                {t} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Invoice list ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>

        {/* list header — same grid as rows */}
        <div className="hidden md:grid px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600 border-b border-white/[0.05]"
          style={{ gridTemplateColumns: "minmax(0,1fr) 110px 110px 110px 90px 160px" }}>
          <span>Customer</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Paid</span>
          <span className="text-right">Balance</span>
          <span className="text-center">Status</span>
          <span className="text-right">Actions</span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-blue-500/5" />
            <div className="relative z-10">
              <div className="text-4xl mb-4 font-bold">{search ? "🔍" : "🧾"}</div>
              <h3 className="text-white font-bold text-xl mb-2">
                {search ? "No matches found" : `No ${activeTab === "All" ? "" : activeTab.toLowerCase() + " "}invoices yet`}
              </h3>
              <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                {search
                  ? `No invoices match "${search}"`
                  : "Create your first invoice to get started"}
              </p>
              {!search && (
                <button onClick={() => { setEditTarget(null); setShowModal(true); }}
                  className="px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
                  style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#000" }}>
                  + Create First Invoice
                </button>
              )}
            </div>
          </div>
        ) : (
          filtered.map((inv) => {
            const st       = STATUS_STYLE[inv.status] || STATUS_STYLE["Unpaid"];
            const dateStr  = inv.createdAt?.toDate
              ? inv.createdAt.toDate().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
              : inv.invoiceDate || "—";
            const num      = inv.id.slice(-4).toUpperCase();
            const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== "Paid";

            return (
              <div key={inv.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">

                {/* ── Mobile ── */}
                <div className="flex items-center justify-between px-5 py-3.5 md:hidden">
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
                      <button onClick={() => setPdfInvoice(inv)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: "rgba(52,211,153,0.08)", color: "#34d399" }}>👁</button>
                      <button onClick={() => { setEditTarget({ id: inv.id, form: docToForm(inv) }); setShowModal(true); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: "rgba(37,99,235,0.1)", color: "#60A5FA" }}>✏️</button>
                      <button onClick={() => setDeleteConf(inv.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>🗑</button>
                    </div>
                  </div>
                </div>

                {/* ── Desktop — same grid template as header ── */}
                <div className="hidden md:grid items-center px-5 py-3.5"
                  style={{ gridTemplateColumns: "minmax(0,1fr) 110px 110px 110px 90px 160px" }}>

                  {/* Customer */}
                  <div className="flex items-center gap-3 min-w-0 pr-4">
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

                  {/* Amount */}
                  <p className="text-white text-sm font-bold text-right">{formatRs(inv.amount)}</p>

                  {/* Paid */}
                  <p className="text-right text-sm font-semibold" style={{ color: "#34d399" }}>{formatRs(inv.amountPaid || 0)}</p>

                  {/* Balance */}
                  <p className="text-right text-sm font-semibold"
                    style={{ color: Number(inv.balance) > 0 ? "#f87171" : "#34d399" }}>
                    {formatRs(inv.balance || 0)}
                  </p>

                  {/* Status */}
                  <div className="flex justify-center">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {inv.status}
                    </span>
                  </div>

                  {/* Actions */}
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
            <p className="text-gray-400 text-sm">This invoice will be removed from your view. You can ask admin to restore it if needed.</p>
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

      <style jsx global>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 5s ease infinite;
        }
      `}</style>
    </div>
  );
}
