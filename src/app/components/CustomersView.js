"use client";
import { useState, useEffect } from "react";
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import InvoiceModal, { EMPTY_FORM, calcTotals } from "./InvoiceModal";
import InvoicePDFModal from "./InvoicePDF";
import SweetAlert from "./SweetAlert";

// ── helpers ───────────────────────────────────────────────────────────────────
function formatRs(n) {
  if (!n && n !== 0) return "Rs. 0";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}
function fmtDate(ts) {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
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
const STATUS_STYLE = {
  Paid:    { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
  Unpaid:  { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  Partial: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
};

// ── shared input ──────────────────────────────────────────────────────────────
const base = {
  width: "100%", outline: "none", background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: 10,
  padding: "9px 13px", color: "#fff", fontSize: 13,
  transition: "border-color .2s, background .2s",
};
const focusStyle = {
  background: "rgba(37,99,235,0.07)", borderColor: "rgba(37,99,235,0.5)",
  boxShadow: "0 0 0 3px rgba(37,99,235,0.08)",
};
const lbl = {
  display: "block", color: "#9ca3af", fontSize: 11, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5,
};
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

const CEMPTY = { name: "", shopName: "", phone: "", email: "", address: "", city: "", notes: "" };

// ── Customer Create/Edit Modal ────────────────────────────────────────────────
function CustomerModal({ initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(initial || CEMPTY);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-lg my-6 rounded-2xl"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-white font-black text-xl">{initial ? "Edit Customer" : "New Customer"}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{initial ? "Update customer details" : "Fill in the details below"}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label style={lbl}>Customer Name <span style={{ color: "#f87171" }}>*</span></label>
              <SInput placeholder="e.g. Ahmed Raza" value={form.name} onChange={set("name")} req />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label style={lbl}>Shop / Brand Name</label>
              <SInput placeholder="e.g. Ali Traders" value={form.shopName} onChange={set("shopName")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}>Phone <span style={{ color: "#f87171" }}>*</span></label>
              <SInput type="tel" placeholder="+92 300 1234567" value={form.phone} onChange={set("phone")} req />
            </div>
            <div>
              <label style={lbl}>Email (optional)</label>
              <SInput type="email" placeholder="customer@email.com" value={form.email} onChange={set("email")} />
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
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 rounded-2xl text-sm font-black"
              style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", color: "#fff",
                opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving..." : initial ? "Update →" : "Create Customer →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
        style={{ background: "#0d1117", border: "1px solid rgba(248,113,113,0.3)" }}>
        <p className="text-3xl">🗑️</p>
        <h3 className="text-white font-bold text-base">Delete Customer?</h3>
        <p className="text-gray-400 text-sm">
          Delete <strong className="text-white">{name}</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Customer Detail ───────────────────────────────────────────────────────────
function CustomerDetail({ customer, uid, products, userDoc, onBack, onEdit, onDelete }) {
  // real-time listener on THIS customer's invoices subcollection
  const [custInvoices, setCustInvoices] = useState([]);
  const [invLoading,   setInvLoading]   = useState(true);
  const [showInvModal, setShowInvModal] = useState(false);
  const [editInv,      setEditInv]      = useState(null); // {id, form}
  const [savingInv,    setSavingInv]    = useState(false);
  const [deleteInvId,  setDeleteInvId]  = useState(null);
  const [pdfInv,       setPdfInv]       = useState(null);
  
  // ★ Customer payments history
  const [customerPayments, setCustomerPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // ★ Sweet Alert State
  const [alert, setAlert] = useState({ show: false, type: "", title: "", message: "" });

  useEffect(() => {
    if (!uid || !customer.id) return;
    const unsub = onSnapshot(
      query(
        collection(db, "users", uid, "customers", customer.id, "invoices"),
        orderBy("createdAt", "desc")
      ),
      snap => { setCustInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setInvLoading(false); },
      () => setInvLoading(false)
    );
    return () => unsub();
  }, [uid, customer.id]);

  // ★ NEW: Load customer's payment history
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      query(
        collection(db, "users", uid, "payments"),
        orderBy("createdAt", "desc")
      ),
      snap => { 
        // Filter payments related to this customer
        const allPayments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const custPayments = allPayments.filter(p => 
          p.customer === customer.name || 
          p.payerName === customer.name ||
          p.customerId === customer.id ||
          custInvoices.some(inv => inv.id === p.invoiceId)
        );
        setCustomerPayments(custPayments); 
        setPaymentsLoading(false); 
      },
      () => setPaymentsLoading(false)
    );
    return () => unsub();
  }, [uid, customer.id, customer.name, custInvoices]);

  // ── computed ──────────────────────────────────────────────────────────────
  const totalBusiness = custInvoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalPaid     = custInvoices.reduce((s, i) => s + (Number(i.amountPaid) || 0), 0);
  const totalBalance  = custInvoices.reduce((s, i) => s + (Number(i.balance) || 0), 0);
  const paidCount     = custInvoices.filter(i => i.status === "Paid").length;

  // ── generate invoice with prev balance carried forward ───────────────────
  function openNewInvoice() {
    const prevBal = totalBalance; // carry-forward
    const prefilled = {
      ...EMPTY_FORM,
      customerName: customer.name,
      phone:        customer.phone || "",
      email:        customer.email || "",
      address:      customer.address || (customer.city ? `${customer.city}${customer.address ? ", " + customer.address : ""}` : ""),
      // if prev balance exists, add it as a line item so customer knows
      items: prevBal > 0
        ? [
            { description: `Previous Balance Carried Forward`, qty: 1, unitPrice: String(prevBal), productId: "" },
            { description: "", qty: 1, unitPrice: "", productId: "" },
          ]
        : [{ description: "", qty: 1, unitPrice: "", productId: "" }],
      note: prevBal > 0
        ? `Includes previous outstanding balance of Rs. ${prevBal.toLocaleString("en-PK")}.`
        : "",
    };
    setEditInv(null);
    setShowInvModal({ prefilled });
  }

  // ── save invoice to customer subcollection + global invoices ─────────────
  async function handleSaveInv(formData) {
    if (!uid || savingInv) return;
    setSavingInv(true);
    try {
      const { subtotal, discount, afterDiscount, paid, balance } = calcTotals(formData);
      const payload = {
        logoDataUrl:          formData.logoDataUrl || "",
        customerId:           customer.id,
        customerName:         customer.name,
        customer:             customer.name,
        address:              formData.address,
        phone:                formData.phone,
        email:                formData.email,
        items:                formData.items,
        discountType:         formData.discountType,
        discountValue:        Number(formData.discountValue) || 0,
        subtotal,
        discount,
        amount:               afterDiscount,
        amountPaid:           paid,
        balance,
        status:               balance === 0 && afterDiscount > 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid",
        invoiceDate:          formData.invoiceDate,
        dueDate:              formData.dueDate || "",
        earlyDiscountDays:    Number(formData.earlyDiscountDays) || 0,
        earlyDiscountPercent: Number(formData.earlyDiscountPercent) || 0,
        note:                 formData.note || "",
      };

      if (editInv) {
        // update in customer subcollection
        await updateDoc(
          doc(db, "users", uid, "customers", customer.id, "invoices", editInv.id),
          { ...payload, updatedAt: serverTimestamp() }
        );
        // also update global
        await updateDoc(
          doc(db, "users", uid, "invoices", editInv.id),
          { ...payload, updatedAt: serverTimestamp() }
        ).catch(() => {}); // ignore if not in global
        
        // ★ Handle payment collection if provided
        if (formData.newPaymentAmount && Number(formData.newPaymentAmount) > 0) {
          const paymentAmount = Number(formData.newPaymentAmount);
          const currentPaid = Number(formData.amountPaid) || 0;
          const newTotalPaid = currentPaid + paymentAmount;
          const newBalance = Math.max(0, payload.amount - newTotalPaid);
          const newStatus = newBalance === 0 ? "Paid" : newTotalPaid > 0 ? "Partial" : "Unpaid";
          
          // Update invoice with new payment (customer subcollection)
          await updateDoc(
            doc(db, "users", uid, "customers", customer.id, "invoices", editInv.id),
            {
              amountPaid: newTotalPaid,
              balance: newBalance,
              status: newStatus,
              lastPaymentAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }
          );
          
          // Update global invoice too
          await updateDoc(
            doc(db, "users", uid, "invoices", editInv.id),
            {
              amountPaid: newTotalPaid,
              balance: newBalance,
              status: newStatus,
              lastPaymentAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }
          ).catch(() => {});
          
          // Create payment record
          await addDoc(collection(db, "users", uid, "payments"), {
            type: "received",
            amount: paymentAmount,
            invoiceId: editInv.id,
            invoiceNumber: `INV-${editInv.id.slice(-4).toUpperCase()}`,
            customerId: customer.id,
            customer: formData.customerName || customer.name,
            payerName: formData.payerName || formData.customerName || customer.name,
            payerContact: formData.payerContact || formData.phone || customer.phone,
            receiverName: formData.receiverName || "",
            receiverContact: formData.receiverContact || "",
            description: `Payment for invoice ${editInv.id.slice(-4).toUpperCase()} from ${customer.name}`,
            method: "cash",
            status: "completed",
            createdAt: serverTimestamp(),
          });
          
          setAlert({
            show: true,
            type: "success",
            title: "Payment Collected! 💰",
            message: `Payment of ${formatRs(paymentAmount)} collected from ${formData.payerName || customer.name}. Invoice updated to ${newStatus}.`,
          });
        } else {
          setAlert({
            show: true,
            type: "success",
            title: "Invoice Updated! ✓",
            message: `Invoice has been updated successfully.`,
          });
        }
      } else {
        // add to customer subcollection first to get the id
        const ref = await addDoc(
          collection(db, "users", uid, "customers", customer.id, "invoices"),
          { ...payload, createdAt: serverTimestamp() }
        );
        // mirror to global invoices with same id
        await updateDoc(
          doc(db, "users", uid, "invoices", ref.id),
          { ...payload, createdAt: serverTimestamp() }
        ).catch(async () => {
          // if doesn't exist, create with setDoc
          const { setDoc } = await import("firebase/firestore");
          await setDoc(
            doc(db, "users", uid, "invoices", ref.id),
            { ...payload, createdAt: serverTimestamp() }
          );
        });
      }
      setShowInvModal(false);
      setEditInv(null);
    } catch (err) { 
      setAlert({
        show: true,
        type: "error",
        title: "Failed to Save Invoice",
        message: err.message || "Something went wrong. Please try again.",
      });
    }
    setSavingInv(false);
  }

  async function handleDeleteInv(id) {
    try {
      await deleteDoc(doc(db, "users", uid, "customers", customer.id, "invoices", id));
      await deleteDoc(doc(db, "users", uid, "invoices", id)).catch(() => {});
      
      setAlert({
        show: true,
        type: "success",
        title: "Invoice Deleted! 🗑️",
        message: "The invoice has been permanently deleted.",
      });
    } catch (err) { 
      setAlert({
        show: true,
        type: "error",
        title: "Failed to Delete Invoice",
        message: err.message || "Something went wrong. Please try again.",
      });
    }
    setDeleteInvId(null);
  }

  function docToForm(inv) {
    return {
      logoDataUrl:          inv.logoDataUrl || "",
      customerName:         inv.customerName || customer.name,
      address:              inv.address || "",
      phone:                inv.phone || customer.phone || "",
      email:                inv.email || customer.email || "",
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

  const cardS = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" };

  return (
    <>
    {/* Sweet Alert */}
    <SweetAlert
      show={alert.show}
      type={alert.type}
      title={alert.title}
      message={alert.message}
      onClose={() => setAlert({ ...alert, show: false })}
    />
    
    <div className="flex flex-col gap-5">

      {/* Professional Top Nav */}
      <div className="relative overflow-hidden rounded-xl p-5" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-pink-500/5 to-purple-500/5" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
          <button onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold transition-colors group"
            style={{ color: "#9ca3af" }}>
            <span className="group-hover:-translate-x-1 transition-transform duration-300">←</span>
            <span className="group-hover:text-white">Back to Customers</span>
          </button>
          <div className="flex gap-2 flex-wrap">
            {/* Generate Invoice */}
            <button onClick={openNewInvoice}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all hover:scale-105 shadow-lg"
              style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000" }}>
              🧾 Generate Invoice
            </button>
            
            {/* View History - NEW BUTTON */}
            <button 
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all hover:scale-105 shadow-lg"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#fff" }}>
              📊 View History
            </button>
            
            {/* Edit */}
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#60A5FA" }}>
              ✏️ Edit
            </button>
            
            {/* Delete */}
            <button onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
              style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
              🗑 Delete
            </button>
          </div>
        </div>
      </div>

      {/* profile card */}
      <div className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5" style={cardS}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white flex-shrink-0"
          style={{ background: avatarColor(customer.id), boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          {initials(customer.name)}
        </div>
        <div className="flex-1">
          <h2 className="text-white font-black text-xl leading-none mb-1">{customer.name}</h2>
          {customer.shopName && <p className="text-amber-400 text-sm font-semibold mb-2">{customer.shopName}</p>}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
            {customer.phone   && <span>📞 {customer.phone}</span>}
            {customer.email   && <span>✉️ {customer.email}</span>}
            {customer.city    && <span>📍 {customer.city}</span>}
            {customer.address && <span>🏠 {customer.address}</span>}
          </div>
          {customer.notes && <p className="text-gray-500 text-xs mt-2 leading-relaxed">{customer.notes}</p>}
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: customer.status === "inactive" ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.1)",
              color: customer.status === "inactive" ? "#f87171" : "#34d399",
              border: `1px solid ${customer.status === "inactive" ? "rgba(248,113,113,0.25)" : "rgba(52,211,153,0.25)"}` }}>
            {customer.status === "inactive" ? "Inactive" : "Active"}
          </span>
          <p className="text-gray-600 text-[10px] mt-1">Since {fmtDate(customer.createdAt)}</p>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Business", val: formatRs(totalBusiness), icon: "💼", color: "#fff"     },
          { label: "Total Paid",     val: formatRs(totalPaid),     icon: "✅", color: "#34d399"  },
          { label: "Balance Due",    val: formatRs(totalBalance),  icon: "⏳",
            color: totalBalance > 0 ? "#f87171" : "#34d399" },
          { label: "Invoices",       val: `${custInvoices.length} · ${paidCount} paid`, icon: "🧾", color: "#60A5FA" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4" style={cardS}>
            <div className="flex items-center gap-2 mb-2">
              <span>{s.icon}</span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{s.label}</p>
            </div>
            <p className="font-black text-base" style={{ color: s.color }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* prev balance banner */}
      {totalBalance > 0 && (
        <div className="rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3"
          style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <div>
            <p className="text-sm font-bold" style={{ color: "#f87171" }}>
              ⚠️ Outstanding Balance: {formatRs(totalBalance)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              This balance will be carried forward to the next invoice automatically.
            </p>
          </div>
          <button onClick={openNewInvoice}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000" }}>
            Generate Invoice →
          </button>
        </div>
      )}

      {/* invoice history */}
      <div className="rounded-2xl overflow-hidden" style={cardS}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-white font-bold text-sm">Invoice History</h3>
          <button onClick={openNewInvoice}
            className="text-xs font-semibold transition-colors" style={{ color: "#F59E0B" }}
            onMouseEnter={e => e.currentTarget.style.color = "#FCD34D"}
            onMouseLeave={e => e.currentTarget.style.color = "#F59E0B"}>
            + New Invoice
          </button>
        </div>

        {invLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse flex gap-3 border-b border-white/[0.04]">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2 py-1">
                <div className="h-3 bg-white/5 rounded w-40" />
                <div className="h-2 bg-white/5 rounded w-24" />
              </div>
            </div>
          ))
        ) : custInvoices.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-3xl mb-2">🧾</p>
            <p className="text-gray-500 text-sm">No invoices yet for this customer.</p>
            <button onClick={openNewInvoice}
              className="mt-3 text-xs font-semibold" style={{ color: "#F59E0B" }}>
              Generate first invoice →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {custInvoices.map(inv => {
              const st = STATUS_STYLE[inv.status] || STATUS_STYLE["Unpaid"];
              const dateStr = inv.createdAt?.toDate
                ? inv.createdAt.toDate().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
                : inv.invoiceDate || "—";
              const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== "Paid";
              const num = (inv.id || "").slice(-4).toUpperCase();
              return (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0"
                      style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", color: "#60A5FA" }}>
                      {num}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">INV-{num}</p>
                        {isOverdue && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>OVERDUE</span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs">{dateStr}{inv.dueDate ? ` · Due ${inv.dueDate}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-white text-sm font-bold">{formatRs(inv.amount)}</p>
                      {Number(inv.balance) > 0 && (
                        <p className="text-xs" style={{ color: "#f87171" }}>Bal: {formatRs(inv.balance)}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {inv.status}
                    </span>
                    {/* action btns */}
                    <div className="flex gap-1">
                      <button onClick={() => setPdfInv(inv)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors"
                        style={{ background: "rgba(52,211,153,0.08)", color: "#34d399" }}>👁</button>
                      <button onClick={() => { setEditInv({ id: inv.id, form: docToForm(inv) }); setShowInvModal(true); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors"
                        style={{ background: "rgba(37,99,235,0.1)", color: "#60A5FA" }}>✏️</button>
                      <button onClick={() => setDeleteInvId(inv.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors"
                        style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}>🗑</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/* Invoice Modal */}
    {showInvModal && (
      <InvoiceModal
        onClose={() => { setShowInvModal(false); setEditInv(null); }}
        onSave={handleSaveInv}
        saving={savingInv}
        initial={editInv?.form || showInvModal?.prefilled || null}
        products={products}
        settingsLogo={userDoc?.logoDataUrl || ""}
      />
    )}

    {/* PDF Modal */}
    {pdfInv && (
      <InvoicePDFModal inv={pdfInv} userDoc={userDoc} onClose={() => setPdfInv(null)} />
    )}

    {/* Delete Invoice Confirm */}
    {deleteInvId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
        <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
          style={{ background: "#0d1117", border: "1px solid rgba(248,113,113,0.3)" }}>
          <p className="text-3xl">🗑️</p>
          <h3 className="text-white font-bold text-base">Delete Invoice?</h3>
          <p className="text-gray-400 text-sm">This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteInvId(null)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
              Cancel
            </button>
            <button onClick={() => handleDeleteInv(deleteInvId)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}>
              Delete
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ★ NEW: Customer Activity History Modal */}
    {showHistoryModal && (
      <CustomerHistoryModal
        customer={customer}
        invoices={custInvoices}
        payments={customerPayments}
        onClose={() => setShowHistoryModal(false)}
      />
    )}
    </>
  );
}

// ★ NEW: Customer History & Activity Report Modal ─────────────────────────────
function CustomerHistoryModal({ customer, invoices, payments, onClose }) {
  const [filter, setFilter] = useState("all"); // all, invoices, payments
  
  // Combine invoices and payments into timeline
  const timeline = [];
  
  // Add invoices to timeline
  invoices.forEach(inv => {
    const date = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt);
    timeline.push({
      type: "invoice",
      date,
      timestamp: date.getTime(),
      data: inv,
    });
  });
  
  // Add payments to timeline
  payments.forEach(pay => {
    const date = pay.createdAt?.toDate ? pay.createdAt.toDate() : new Date(pay.createdAt);
    timeline.push({
      type: "payment",
      date,
      timestamp: date.getTime(),
      data: pay,
    });
  });
  
  // Sort by date (newest first)
  timeline.sort((a, b) => b.timestamp - a.timestamp);
  
  // Filter timeline
  const filtered = filter === "all" 
    ? timeline 
    : timeline.filter(item => item.type === filter.slice(0, -1)); // "invoices" → "invoice"
  
  // Calculate totals
  const totalInvoices = invoices.length;
  const totalPayments = payments.length;
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  const totalPaid = payments.reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);
  const totalBalance = invoices.reduce((sum, inv) => sum + (Number(inv.balance) || 0), 0);
  
  function formatDate(date) {
    return date.toLocaleDateString("en-PK", { 
      day: "2-digit", 
      month: "short", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  
  function handlePrint() {
    window.print();
  }
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fadeIn"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden animate-scaleIn"
        style={{ background: "#0d1117", border: "1px solid rgba(139,92,246,0.3)", boxShadow: "0 20px 60px rgba(139,92,246,0.3)" }}>
        
        {/* Header */}
        <div className="relative overflow-hidden px-6 py-5 border-b border-white/10">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h2 className="text-white font-black text-xl mb-1">
                📊 Activity History & Report
              </h2>
              <p className="text-gray-400 text-xs">
                Complete transaction history for <span className="text-purple-400 font-semibold">{customer.name}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handlePrint}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
                🖨️ Print
              </button>
              <button onClick={onClose}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-all text-2xl font-bold">
                ×
              </button>
            </div>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-4 border-b border-white/10">
          {[
            { label: "Total Invoices", value: totalInvoices, icon: "🧾", color: "#60A5FA" },
            { label: "Total Invoiced", value: formatRs(totalInvoiced), icon: "💼", color: "#F59E0B" },
            { label: "Total Payments", value: totalPayments, icon: "💰", color: "#34d399" },
            { label: "Total Paid", value: formatRs(totalPaid), icon: "✅", color: "#10b981" },
            { label: "Balance Due", value: formatRs(totalBalance), icon: "⏳", color: totalBalance > 0 ? "#f87171" : "#34d399" },
          ].map((stat, i) => (
            <div key={i} className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{stat.icon}</span>
                <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">{stat.label}</p>
              </div>
              <p className="text-sm font-bold" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>
        
        {/* Filter Tabs */}
        <div className="flex gap-2 px-4 py-3 border-b border-white/10">
          {[
            { id: "all", label: "All Activities", icon: "📋", count: timeline.length },
            { id: "invoices", label: "Invoices", icon: "🧾", count: totalInvoices },
            { id: "payments", label: "Payments", icon: "💰", count: totalPayments },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                filter === tab.id ? "scale-105 shadow-lg" : "hover:scale-105"
              }`}
              style={{
                background: filter === tab.id 
                  ? "linear-gradient(135deg, #8B5CF6, #7C3AED)"
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${filter === tab.id ? "#8B5CF6" : "rgba(255,255,255,0.1)"}`,
                color: filter === tab.id ? "#fff" : "#9ca3af",
              }}>
              <span>{tab.icon}</span>
              {tab.label}
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                style={{ background: filter === tab.id ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)" }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        
        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-gray-500 text-sm">No activities found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item, idx) => (
                <div key={idx} 
                  className="group relative rounded-lg p-4 transition-all duration-300 hover:scale-[1.01]"
                  style={{ 
                    background: item.type === "invoice" 
                      ? "rgba(37,99,235,0.05)" 
                      : "rgba(16,185,129,0.05)",
                    border: `1px solid ${item.type === "invoice" ? "rgba(37,99,235,0.2)" : "rgba(16,185,129,0.2)"}` 
                  }}>
                  
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-6 w-2 h-2 rounded-full -translate-x-1/2"
                    style={{ background: item.type === "invoice" ? "#60A5FA" : "#10b981" }} />
                  
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0`}
                        style={{ 
                          background: item.type === "invoice" 
                            ? "rgba(37,99,235,0.15)" 
                            : "rgba(16,185,129,0.15)",
                          border: `1px solid ${item.type === "invoice" ? "rgba(37,99,235,0.3)" : "rgba(16,185,129,0.3)"}`,
                          color: item.type === "invoice" ? "#60A5FA" : "#10b981"
                        }}>
                        {item.type === "invoice" ? "🧾" : "💰"}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {item.type === "invoice" ? (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-white text-sm font-bold">
                                Invoice #{item.data.id.slice(-4).toUpperCase()}
                              </p>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ 
                                  background: item.data.status === "Paid" ? "rgba(52,211,153,0.1)" : 
                                             item.data.status === "Partial" ? "rgba(251,191,36,0.1)" : "rgba(248,113,113,0.1)",
                                  color: item.data.status === "Paid" ? "#34d399" : 
                                         item.data.status === "Partial" ? "#fbbf24" : "#f87171",
                                  border: `1px solid ${item.data.status === "Paid" ? "rgba(52,211,153,0.25)" : 
                                                       item.data.status === "Partial" ? "rgba(251,191,36,0.25)" : "rgba(248,113,113,0.25)"}`
                                }}>
                                {item.data.status}
                              </span>
                            </div>
                            <p className="text-gray-400 text-xs mb-2">
                              📅 {formatDate(item.date)}
                              {item.data.items?.length > 0 && ` · ${item.data.items.length} item(s)`}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs">
                              <span className="text-white font-semibold">
                                Amount: <span className="text-amber-400">{formatRs(item.data.amount)}</span>
                              </span>
                              {item.data.amountPaid > 0 && (
                                <span className="text-white font-semibold">
                                  Paid: <span className="text-green-400">{formatRs(item.data.amountPaid)}</span>
                                </span>
                              )}
                              {item.data.balance > 0 && (
                                <span className="text-white font-semibold">
                                  Balance: <span className="text-red-400">{formatRs(item.data.balance)}</span>
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-white text-sm font-bold">
                                Payment Received
                              </p>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                                {item.data.status || "Completed"}
                              </span>
                            </div>
                            <p className="text-gray-400 text-xs mb-2">
                              📅 {formatDate(item.date)}
                              {item.data.invoiceNumber && ` · ${item.data.invoiceNumber}`}
                            </p>
                            <div className="flex flex-wrap gap-3 text-xs">
                              <span className="text-white font-semibold">
                                Amount: <span className="text-green-400">{formatRs(item.data.amount)}</span>
                              </span>
                              {item.data.payerName && (
                                <span className="text-gray-400">
                                  From: <span className="text-white">{item.data.payerName}</span>
                                </span>
                              )}
                              {item.data.receiverName && (
                                <span className="text-gray-400">
                                  To: <span className="text-white">{item.data.receiverName}</span>
                                </span>
                              )}
                              {item.data.method && (
                                <span className="text-gray-400">
                                  Method: <span className="text-white capitalize">{item.data.method}</span>
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
          <p className="text-gray-500 text-xs">
            Generated on {new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
          <button onClick={onClose}
            className="px-6 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105"
            style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
            Close
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
        
        @media print {
          @page {
            margin: 1cm;
          }
          body * {
            visibility: hidden;
          }
          .print\\:block {
            visibility: visible !important;
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>
    </div>
  );
}

// ── Main CustomersView ────────────────────────────────────────────────────────
export default function CustomersView({ uid, customers, invoices, loading, products, userDoc }) {
  const [showModal,    setShowModal]    = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [deleteConf,   setDeleteConf]   = useState(null);
  const [search,       setSearch]       = useState("");
  const [detailCust,   setDetailCust]   = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  
  // Sweet Alert State
  const [alert, setAlert] = useState({ show: false, type: "", title: "", message: "" });

  // sync detailCust when customers list updates (e.g. after edit)
  useEffect(() => {
    if (detailCust) {
      const updated = customers.find(c => c.id === detailCust.id);
      if (updated) setDetailCust(updated);
    }
  }, [customers]);

  async function handleSave(form) {
    if (!uid || saving) return;
    setSaving(true);
    try {
      if (editTarget) {
        await updateDoc(doc(db, "users", uid, "customers", editTarget.id), {
          name: form.name, shopName: form.shopName || "",
          phone: form.phone, email: form.email || "",
          address: form.address || "", city: form.city || "",
          notes: form.notes || "", updatedAt: serverTimestamp(),
        });
        
        // Show update success alert
        setAlert({
          show: true,
          type: "success",
          title: "Customer Updated! ✓",
          message: `${form.name}'s information has been updated successfully.`,
        });
      } else {
        await addDoc(collection(db, "users", uid, "customers"), {
          name: form.name, shopName: form.shopName || "",
          phone: form.phone, email: form.email || "",
          address: form.address || "", city: form.city || "",
          notes: form.notes || "", status: "active", createdAt: serverTimestamp(),
        });
        
        // Show create success alert
        setAlert({
          show: true,
          type: "success",
          title: "Customer Added! 👥",
          message: `${form.name} has been added to your customer list successfully.`,
        });
      }
      setShowModal(false); setEditTarget(null);
    } catch (err) { 
      setAlert({
        show: true,
        type: "error",
        title: "Failed to Save Customer",
        message: err.message || "Something went wrong. Please try again.",
      });
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, "users", uid, "customers", id));
      if (detailCust?.id === id) setDetailCust(null);
      
      // Show delete success alert
      setAlert({
        show: true,
        type: "success",
        title: "Customer Deleted! 🗑️",
        message: "The customer has been permanently deleted from your records.",
      });
    } catch (err) { 
      setAlert({
        show: true,
        type: "error",
        title: "Failed to Delete Customer",
        message: err.message || "Something went wrong. Please try again.",
      });
    }
    setDeleteConf(null);
  }

  // stats — sirf customer-linked invoices (customerId wali)
  const custLinkedInvoices = invoices.filter(i => i.customerId);
  const activeCount  = customers.filter(c => c.status !== "inactive").length;
  const totalRevenue = custLinkedInvoices.filter(i => i.status === "Paid").reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalPaid    = custLinkedInvoices.reduce((s, i) => s + (Number(i.amountPaid) || 0), 0);
  const totalBalance = custLinkedInvoices.reduce((s, i) => s + (Number(i.balance) || 0), 0);

  const filtered = customers.filter(c => {
    const matchStatus = statusFilter === "All" || c.status === statusFilter || (!c.status && statusFilter === "active");
    const q = search.toLowerCase();
    return matchStatus && (!q ||
      (c.name || "").toLowerCase().includes(q) ||
      (c.shopName || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.city || "").toLowerCase().includes(q));
  });

  const cardS = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" };

  // ── Professional Loader ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-t-amber-500 border-r-purple-500 border-b-blue-500 border-l-pink-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">👥</div>
        </div>
      </div>
    );
  }

  // detail view
  if (detailCust) {
    return (
      <>
        <CustomerDetail
          customer={detailCust} uid={uid}
          products={products || []} userDoc={userDoc}
          onBack={() => setDetailCust(null)}
          onEdit={() => { setEditTarget(detailCust); setShowModal(true); }}
          onDelete={() => setDeleteConf(detailCust.id)}
        />
        {showModal && (
          <CustomerModal
            initial={{ name: editTarget.name, shopName: editTarget.shopName || "",
              phone: editTarget.phone || "", email: editTarget.email || "",
              address: editTarget.address || "", city: editTarget.city || "", notes: editTarget.notes || "" }}
            onClose={() => { setShowModal(false); setEditTarget(null); }}
            onSave={handleSave} saving={saving} />
        )}
        {deleteConf && (
          <DeleteConfirm name={customers.find(c => c.id === deleteConf)?.name}
            onConfirm={() => handleDelete(deleteConf)} onCancel={() => setDeleteConf(null)} />
        )}
      </>
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
              Customer Management
            </h2>
            <p className="text-gray-400 text-xs">Manage your customer base and relationships</p>
          </div>
          
          <button onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="group relative px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 hover:scale-105 overflow-hidden shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-600 transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative z-10 flex items-center gap-2 text-black font-bold">
              <span className="text-base group-hover:rotate-90 transition-transform duration-300">+</span>
              Add Customer
            </span>
          </button>
        </div>
      </div>

      {/* Professional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Total Customers", value: customers.length, icon: "👥", color: "from-orange-500 to-amber-600" },
            { label: "Active Customers", value: activeCount, icon: "✅", color: "from-pink-500 to-purple-600" },
            { label: "Total Revenue", value: formatRs(totalRevenue), icon: "💰", color: "from-amber-500 to-orange-600" },
            { label: "Total Paid", value: formatRs(totalPaid), icon: "💵", color: "from-green-500 to-emerald-600" },
            { label: "Balance Due", value: formatRs(totalBalance), icon: "⏳", color: totalBalance > 0 ? "from-rose-500 to-red-600" : "from-green-500 to-emerald-600" },
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

      {/* Search & Filter */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1 relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-lg opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-300" />
          <input
            type="text"
            placeholder="🔍 Search by name, shop, phone, city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="relative w-full px-4 py-2.5 pl-10 rounded-lg text-sm text-white outline-none transition-all duration-300"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">🔍</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: "All", label: "All", icon: "📋", count: customers.length },
            { id: "active", label: "Active", icon: "✅", count: activeCount },
            { id: "inactive", label: "Inactive", icon: "❌", count: customers.length - activeCount },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
                statusFilter === f.id ? "scale-105 shadow-lg" : "hover:scale-105"
              }`}
              style={{
                background: statusFilter === f.id 
                  ? "linear-gradient(135deg, #F59E0B, #D97706)"
                  : "rgba(255,255,255,0.05)",
                border: `1px solid ${statusFilter === f.id ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                color: statusFilter === f.id ? "#000" : "#9ca3af",
              }}>
              <span className="text-sm font-bold">{f.icon}</span>
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Customers Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl p-16 text-center relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-blue-500/5" />
          <div className="relative z-10">
            <div className="text-4xl mb-4 font-bold">{search ? "🔍" : "👥"}</div>
            <h3 className="text-white font-bold text-xl mb-2">
              {search ? "No matches found" : "No customers yet"}
            </h3>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              {search 
                ? `No customers match "${search}"`
                : "Start by adding your first customer"
              }
            </p>
            {!search && (
              <button onClick={() => setShowModal(true)}
                className="px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
                style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#000" }}>
                + Create First Customer
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c, idx) => {
            const custInv = invoices.filter(i => i.customerId === c.id);
            const custBal = custInv.reduce((s, i) => s + (Number(i.balance) || 0), 0);
            return (
              <div key={c.id}
                onClick={() => setDetailCust(c)}
                className="customer-card group relative rounded-lg overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer"
                style={{ 
                  background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", 
                  border: "1px solid rgba(255,255,255,0.1)", 
                  backdropFilter: "blur(12px)",
                  animationDelay: `${idx * 0.05}s`,
                }}>
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-pink-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Status Badge */}
                <div className="absolute top-3 right-3 z-20">
                  <div className={`px-2 py-1 rounded-md text-[10px] font-semibold backdrop-blur-lg transition-all duration-300 group-hover:scale-110 ${
                    c.status === "inactive" 
                      ? "bg-red-500/20 text-red-300 border border-red-400/40" 
                      : "bg-green-500/20 text-green-300 border border-green-400/40"
                  }`}>
                    {c.status === "inactive" ? "Inactive" : "Active"}
                  </div>
                </div>

                {/* Avatar */}
                <div className="relative p-4 pb-0">
                  <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-xl font-black text-white mb-3 transition-transform duration-300 group-hover:scale-110"
                    style={{ background: avatarColor(c.id), boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
                    {initials(c.name)}
                  </div>
                </div>

                {/* Content */}
                <div className="relative p-4 pt-2 space-y-2.5">
                  
                  {/* Name & Shop */}
                  <div className="text-center">
                    <h3 className="text-white font-bold text-base line-clamp-1 group-hover:text-amber-400 transition-colors">
                      {c.name}
                    </h3>
                    {c.shopName && (
                      <p className="text-amber-400 text-sm font-semibold line-clamp-1 mt-0.5">{c.shopName}</p>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="flex flex-col gap-1 text-center">
                    {c.phone && <p className="text-gray-400 text-xs">📞 {c.phone}</p>}
                    {c.city && <p className="text-gray-400 text-xs">📍 {c.city}</p>}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="text-left">
                      <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Invoices</p>
                      <p className="text-white font-bold text-sm">{custInv.length}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Balance</p>
                      {custBal > 0 ? (
                        <p className="text-rose-400 font-bold text-sm">{formatRs(custBal).replace('Rs. ', '₨')}</p>
                      ) : custInv.length > 0 ? (
                        <p className="text-emerald-400 font-bold text-sm">Cleared ✓</p>
                      ) : (
                        <p className="text-gray-600 font-bold text-sm">—</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <CustomerModal
          initial={editTarget ? { name: editTarget.name, shopName: editTarget.shopName || "",
            phone: editTarget.phone || "", email: editTarget.email || "",
            address: editTarget.address || "", city: editTarget.city || "", notes: editTarget.notes || "" } : null}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSave={handleSave} saving={saving} />
      )}
      {deleteConf && (
        <DeleteConfirm name={customers.find(c => c.id === deleteConf)?.name}
          onConfirm={() => handleDelete(deleteConf)} onCancel={() => setDeleteConf(null)} />
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
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .customer-card {
          animation: fadeInUp 0.4s ease-out both;
        }
      `}</style>
    </div>
  );
}
