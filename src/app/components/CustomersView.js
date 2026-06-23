"use client";
import { useState, useEffect } from "react";
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import InvoiceModal, { EMPTY_FORM, calcTotals } from "./InvoiceModal";
import InvoicePDFModal from "./InvoicePDF";

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
    } catch (err) { alert("Error: " + err.message); }
    setSavingInv(false);
  }

  async function handleDeleteInv(id) {
    try {
      await deleteDoc(doc(db, "users", uid, "customers", customer.id, "invoices", id));
      await deleteDoc(doc(db, "users", uid, "invoices", id)).catch(() => {});
    } catch (err) { alert("Error: " + err.message); }
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
    <div className="flex flex-col gap-5">

      {/* top nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold transition-colors"
          style={{ color: "#9ca3af" }}
          onMouseEnter={e => e.currentTarget.style.color = "#fff"}
          onMouseLeave={e => e.currentTarget.style.color = "#9ca3af"}>
          ← Back to Customers
        </button>
        <div className="flex gap-2 flex-wrap">
          {/* ★ Generate Invoice btn */}
          <button onClick={openNewInvoice}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000" }}>
            🧾 Generate Invoice
          </button>
          <button onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#60A5FA" }}>
            ✏️ Edit
          </button>
          <button onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
            🗑 Delete
          </button>
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
    </>
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
      } else {
        await addDoc(collection(db, "users", uid, "customers"), {
          name: form.name, shopName: form.shopName || "",
          phone: form.phone, email: form.email || "",
          address: form.address || "", city: form.city || "",
          notes: form.notes || "", status: "active", createdAt: serverTimestamp(),
        });
      }
      setShowModal(false); setEditTarget(null);
    } catch (err) { alert("Error: " + err.message); }
    setSaving(false);
  }

  async function handleDelete(id) {
    try {
      await deleteDoc(doc(db, "users", uid, "customers", id));
      if (detailCust?.id === id) setDetailCust(null);
    } catch (err) { alert("Error: " + err.message); }
    setDeleteConf(null);
  }

  // stats — sirf customer-linked invoices (customerId wali)
  const custLinkedInvoices = invoices.filter(i => i.customerId);
  const activeCount  = customers.filter(c => c.status !== "inactive").length;
  const totalRevenue = custLinkedInvoices.filter(i => i.status === "Paid").reduce((s, i) => s + (Number(i.amount) || 0), 0);
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
    <div className="flex flex-col gap-5">
      {/* top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-white font-black text-xl">Customers</h2>
          <p className="text-gray-500 text-xs mt-0.5">{customers.length} total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {["All", "active", "inactive"].map(t => (
              <button key={t} onClick={() => setStatusFilter(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                style={{ background: statusFilter === t ? "rgba(37,99,235,0.15)" : "transparent",
                  color: statusFilter === t ? "#60A5FA" : "#6b7280" }}>
                {t === "All" ? `All (${customers.length})` : t === "active" ? `Active (${activeCount})` : `Inactive (${customers.length - activeCount})`}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">🔍</span>
            <input placeholder="Name, shop, phone, city..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl text-xs text-white outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", width: 220 }} />
          </div>
          <button onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", color: "#fff" }}>
            ➕ New Customer
          </button>
        </div>
      </div>

      {/* stats */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Customers", val: customers.length,       icon: "👥", color: "#60A5FA",  bg: "rgba(37,99,235,0.08)",  border: "rgba(37,99,235,0.2)"   },
            { label: "Active",          val: activeCount,            icon: "✅", color: "#34d399",  bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)"  },
            { label: "Total Revenue",   val: formatRs(totalRevenue), icon: "💰", color: "#F59E0B",  bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)"  },
            { label: "Balance Due",     val: formatRs(totalBalance), icon: "⏳",
              color: totalBalance > 0 ? "#f87171" : "#34d399",
              bg: totalBalance > 0 ? "rgba(248,113,113,0.08)" : "rgba(52,211,153,0.08)",
              border: totalBalance > 0 ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 transition-all duration-200"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{s.icon}</span>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</p>
              </div>
              <p className="font-black text-xl" style={{ color: s.color }}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl p-5 animate-pulse" style={{ ...cardS, height: 130 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl py-20 text-center" style={cardS}>
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-400 text-sm font-medium">{search ? "No customers match your search." : "No customers yet."}</p>
          {!search && (
            <button onClick={() => setShowModal(true)} className="mt-3 text-xs font-semibold" style={{ color: "#2563EB" }}>
              Add your first customer →
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => {
            const custInv = invoices.filter(i => i.customerId === c.id);
            const custBal = custInv.reduce((s, i) => s + (Number(i.balance) || 0), 0);
            return (
              <button key={c.id} onClick={() => setDetailCust(c)}
                className="rounded-2xl p-5 text-left transition-all duration-200"
                style={cardS}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)"; e.currentTarget.style.borderColor = "rgba(37,99,235,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                    style={{ background: avatarColor(c.id) }}>
                    {initials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{c.name}</p>
                    {c.shopName && <p className="text-amber-400 text-xs font-medium truncate">{c.shopName}</p>}
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: c.status === "inactive" ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.1)",
                      color: c.status === "inactive" ? "#f87171" : "#34d399",
                      border: `1px solid ${c.status === "inactive" ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)"}` }}>
                    {c.status === "inactive" ? "Inactive" : "Active"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 mb-3">
                  {c.phone && <p className="text-gray-500 text-xs">📞 {c.phone}</p>}
                  {c.city  && <p className="text-gray-500 text-xs">📍 {c.city}</p>}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                  <p className="text-[10px] text-gray-600 font-medium">{custInv.length} invoice{custInv.length !== 1 ? "s" : ""}</p>
                  {custBal > 0 ? (
                    <p className="text-xs font-bold" style={{ color: "#f87171" }}>Bal: {formatRs(custBal)}</p>
                  ) : custInv.length > 0 ? (
                    <p className="text-xs font-bold" style={{ color: "#34d399" }}>Cleared ✓</p>
                  ) : null}
                </div>
              </button>
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
    </div>
  );
}
