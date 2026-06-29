"use client";
import { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, onSnapshot, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import SweetAlert from "./SweetAlert";

// ── helpers ──────────────────────────────────────────────────────────────────
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
function fmtDateTime(ts) {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) +
      "  " + d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true });
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

const cardS = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" };
const base = {
  width: "100%", outline: "none", background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: 10,
  padding: "9px 13px", color: "#fff", fontSize: 13, transition: "border-color .2s",
};
const lbl = {
  display: "block", color: "#9ca3af", fontSize: 11, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5,
};
const STATUS_STYLE = {
  Paid:    { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
  Partial: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
  Pending: { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
};

// ── Purchase Order Modal (items table, like InvoiceModal) ─────────────────────
const PO_EMPTY = {
  items: [{ description: "", qty: 1, unitPrice: "" }],
  discountType: "percent",
  discountValue: "",
  amountPaid: "",
  orderDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  note: "",
};

function calcPOTotals(form) {
  const subtotal = (form.items || []).reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0
  );
  const discount = form.discountType === "percent"
    ? subtotal * (Number(form.discountValue) || 0) / 100
    : Number(form.discountValue) || 0;
  const afterDiscount = Math.max(subtotal - discount, 0);
  const paid = Number(form.amountPaid) || 0;
  const balance = Math.max(afterDiscount - paid, 0);
  return { subtotal, discount, afterDiscount, paid, balance };
}

function SInput({ type = "text", placeholder, value, onChange, req, readOnly }) {
  const [f, setF] = useState(false);
  const focused = { background: "rgba(37,99,235,0.07)", borderColor: "rgba(37,99,235,0.5)", boxShadow: "0 0 0 3px rgba(37,99,235,0.08)" };
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      required={req} autoComplete="off" readOnly={readOnly}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...base, ...(f && !readOnly ? focused : {}), ...(readOnly ? { opacity: 0.6, cursor: "not-allowed", background: "rgba(255,255,255,0.02)" } : {}) }} />
  );
}

function PurchaseOrderModal({ initial, supplier, onClose, onSave, saving }) {
  const [form, setForm] = useState(initial || PO_EMPTY);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const { subtotal, discount, afterDiscount, paid, balance } = calcPOTotals(form);

  function setItem(idx, k, v) {
    setForm(p => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [k]: v };
      return { ...p, items };
    });
  }
  function addItem() {
    setForm(p => ({ ...p, items: [...p.items, { description: "", qty: 1, unitPrice: "" }] }));
  }
  function removeItem(idx) {
    if (form.items.length <= 1) return;
    setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-2xl my-6 rounded-2xl"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-white font-black text-xl">{initial ? "Edit Purchase Order" : "New Purchase Order"}</h2>
            <p className="text-gray-500 text-xs mt-0.5">Supplier: <span className="text-amber-400 font-semibold">{supplier.name}</span></p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="flex flex-col gap-4 p-6">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}>Order Date <span style={{ color: "#f87171" }}>*</span></label>
              <SInput type="date" value={form.orderDate} onChange={set("orderDate")} req />
            </div>
            <div>
              <label style={lbl}>Due Date</label>
              <SInput type="date" value={form.dueDate} onChange={set("dueDate")} />
            </div>
          </div>

          {/* Items Table */}
          <div>
            <label style={lbl}>Items <span style={{ color: "#f87171" }}>*</span></label>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {/* Header */}
              <div className="grid gap-2 px-3 py-2" style={{ gridTemplateColumns: "1fr 70px 110px 80px 32px", background: "rgba(255,255,255,0.03)" }}>
                {["Item / Description", "Qty", "Unit Price", "Total", ""].map((h, i) => (
                  <span key={i} className="text-[10px] font-bold uppercase tracking-widest text-gray-500" style={{ textAlign: i >= 3 ? "right" : "left" }}>{h}</span>
                ))}
              </div>
              <div className="flex flex-col gap-1 p-2">
                {form.items.map((item, idx) => {
                  const lineTotal = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
                  return (
                    <div key={idx} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 70px 110px 80px 32px" }}>
                      <input placeholder="e.g. Cotton Fabric" value={item.description}
                        onChange={e => setItem(idx, "description", e.target.value)} required
                        style={{ ...base, padding: "7px 10px", fontSize: 12 }} />
                      <input type="number" min="1" placeholder="1" value={item.qty}
                        onChange={e => setItem(idx, "qty", e.target.value)}
                        style={{ ...base, padding: "7px 6px", fontSize: 12, textAlign: "center" }} />
                      <input type="number" min="0" placeholder="0" value={item.unitPrice}
                        onChange={e => setItem(idx, "unitPrice", e.target.value)}
                        style={{ ...base, padding: "7px 8px", fontSize: 12, textAlign: "right" }} />
                      <p className="text-xs font-semibold text-right pr-1" style={{ color: lineTotal > 0 ? "#fff" : "#4b5563" }}>
                        {lineTotal > 0 ? formatRs(lineTotal) : "—"}
                      </p>
                      <button type="button" onClick={() => removeItem(idx)} disabled={form.items.length <= 1}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", opacity: form.items.length <= 1 ? 0.15 : 1 }}>
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <button type="button" onClick={addItem}
              className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-105"
              style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", color: "#60A5FA" }}>
              + Add Item
            </button>
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}>Discount Type</label>
              <select value={form.discountType} onChange={set("discountType")} style={{ ...base }}>
                <option value="percent" style={{ background: "#0d1117" }}>Percentage (%)</option>
                <option value="fixed"   style={{ background: "#0d1117" }}>Fixed Amount (Rs.)</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Discount Value</label>
              <SInput type="number" min="0" placeholder="0" value={form.discountValue} onChange={set("discountValue")} />
            </div>
          </div>

          {/* Totals Summary */}
          <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Subtotal</span><span className="text-white font-semibold">{formatRs(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-gray-400">
                <span>Discount</span><span className="text-red-400 font-semibold">- {formatRs(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-2 mt-1">
              <span className="text-white">Total Payable</span><span className="text-white">{formatRs(afterDiscount)}</span>
            </div>
            <div>
              <label style={{ ...lbl, marginTop: 8 }}>Amount Paid Now (Rs.)</label>
              <SInput type="number" min="0" placeholder="0" value={form.amountPaid} onChange={set("amountPaid")} />
            </div>
            <div className="flex justify-between text-sm font-bold mt-1">
              <span className="text-gray-400">Balance Remaining</span>
              <span style={{ color: balance > 0 ? "#f87171" : "#34d399", fontWeight: 800, fontSize: 16 }}>{formatRs(balance)}</span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label style={lbl}>Notes / Remarks</label>
            <textarea rows={2} placeholder="Any notes..." value={form.note} onChange={set("note")}
              style={{ ...base, resize: "vertical" }} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 rounded-2xl text-sm font-black"
              style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000",
                opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving..." : initial ? "Update Order →" : "Create Purchase Order →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Pay Supplier Modal ────────────────────────────────────────────────────────
function PaySupplierModal({ order, supplier, onClose, onSave, saving }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [payerName, setPayerName]     = useState("");
  const [receiverName, setReceiverName] = useState(supplier.name || "");
  const [receiverContact, setReceiverContact] = useState(supplier.phone || "");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote]   = useState("");
  const maxPayable = Number(order.balance) || 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-md my-6 rounded-2xl"
        style={{ background: "#0d1117", border: "1px solid rgba(16,185,129,0.3)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-white font-black text-xl">💸 Pay Supplier</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              Order: <span className="text-amber-400 font-semibold">PO-{(order.id || "").slice(-4).toUpperCase()}</span>
              &nbsp;· Balance: <span className="text-red-400 font-semibold">{formatRs(maxPayable)}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10">✕</button>
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          const amt = Number(amount);
          if (!amt || amt <= 0) return;
          if (amt > maxPayable) { alert(`Max payable: ${formatRs(maxPayable)}`); return; }
          onSave({ amount: amt, method, payerName, receiverName, receiverContact, payDate, note });
        }} className="flex flex-col gap-4 p-6">
          <div>
            <label style={lbl}>Amount to Pay (Rs.) <span style={{ color: "#f87171" }}>*</span></label>
            <input type="number" min="1" max={maxPayable} placeholder={`Max: ${maxPayable}`}
              value={amount} onChange={e => setAmount(e.target.value)} required
              style={{ ...base }} />
          </div>
          <div>
            <label style={lbl}>Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} style={{ ...base }}>
              <option value="cash"   style={{ background: "#0d1117" }}>💵 Cash</option>
              <option value="bank"   style={{ background: "#0d1117" }}>🏦 Bank Transfer</option>
              <option value="cheque" style={{ background: "#0d1117" }}>📄 Cheque</option>
              <option value="easypaisa" style={{ background: "#0d1117" }}>📱 EasyPaisa</option>
              <option value="jazzcash"  style={{ background: "#0d1117" }}>📱 JazzCash</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}>Paid By (Your Name)</label>
              <input type="text" placeholder="e.g. Ahmed" value={payerName}
                onChange={e => setPayerName(e.target.value)} style={{ ...base }} />
            </div>
            <div>
              <label style={lbl}>Received By</label>
              <input type="text" placeholder={supplier.name} value={receiverName}
                onChange={e => setReceiverName(e.target.value)} style={{ ...base }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}>Supplier Contact</label>
              <input type="tel" placeholder={supplier.phone} value={receiverContact}
                onChange={e => setReceiverContact(e.target.value)} style={{ ...base }} />
            </div>
            <div>
              <label style={lbl}>Payment Date</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={{ ...base }} />
            </div>
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <textarea rows={2} placeholder="Any remarks..." value={note}
              onChange={e => setNote(e.target.value)} style={{ ...base, resize: "vertical" }} />
          </div>
          <div className="rounded-xl p-3 flex justify-between items-center"
            style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <span className="text-gray-400 text-sm">After Payment Balance</span>
            <span className="font-black text-lg" style={{ color: (maxPayable - (Number(amount) || 0)) > 0 ? "#f87171" : "#34d399" }}>
              {formatRs(Math.max(0, maxPayable - (Number(amount) || 0)))}
            </span>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 rounded-2xl text-sm font-black"
              style={{ background: "linear-gradient(135deg,#10B981,#059669)", color: "#fff",
                opacity: saving ? 0.7 : 1 }}>
              {saving ? "Processing..." : "💸 Pay Now →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────────────
function DeleteConfirmSD({ name, label, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
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

// ── Supplier History PDF Template ─────────────────────────────────────────────
function SupplierHistoryTemplate({ supplier, orders, payments, userDoc }) {
  const timeline = [];
  orders.forEach(o => {
    const date = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
    timeline.push({ type: "order", date, data: o });
  });
  payments.forEach(p => {
    const date = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
    timeline.push({ type: "payment", date, data: p });
  });
  timeline.sort((a, b) => b.date - a.date);

  const totalOrdered  = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const totalPaid     = orders.reduce((s, o) => s + (Number(o.paidAmount) || 0), 0);
  const totalBalance  = orders.reduce((s, o) => s + (Number(o.balance) || 0), 0);
  const generatedOn   = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div style={{ width: 794, minHeight: 1123, background: "#fff", color: "#111",
      fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 13, padding: "48px 52px",
      boxSizing: "border-box", position: "relative" }}>
      {/* Accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5,
        background: "linear-gradient(to right,#1d4ed8,#8b5cf6,#f59e0b)" }} />
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {userDoc?.logoDataUrl && <img src={userDoc.logoDataUrl} alt="Logo"
            style={{ width: 58, height: 58, objectFit: "contain", borderRadius: 8 }} />}
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: "#111" }}>{userDoc?.business || userDoc?.name || "Your Business"}</div>
            {userDoc?.address && <div style={{ fontSize: 11, color: "#6b7280" }}>{userDoc.address}</div>}
            {userDoc?.phone   && <div style={{ fontSize: 11, color: "#6b7280" }}>{userDoc.phone}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#d97706", letterSpacing: "-1px" }}>SUPPLIER REPORT</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Generated: {generatedOn}</div>
          <div style={{ marginTop: 8, display: "inline-block", padding: "4px 14px", borderRadius: 20,
            fontSize: 11, fontWeight: 700, background: "#fef3c7", color: "#d97706" }}>PURCHASE STATEMENT</div>
        </div>
      </div>
      <div style={{ height: 1, background: "#e5e7eb", marginBottom: 24 }} />
      {/* Supplier info */}
      <div style={{ display: "flex", gap: 16, marginBottom: 28, padding: "16px 20px",
        background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10 }}>
        <div style={{ width: 50, height: 50, borderRadius: 12, flexShrink: 0,
          background: "linear-gradient(135deg,#f59e0b,#d97706)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 900, color: "#fff" }}>
          {(supplier.name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{supplier.name}</div>
          {supplier.shopName && <div style={{ fontSize: 12, color: "#d97706", fontWeight: 600 }}>{supplier.shopName}</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", marginTop: 5, fontSize: 11, color: "#4b5563" }}>
            {supplier.phone   && <span>📞 {supplier.phone}</span>}
            {supplier.email   && <span>✉️ {supplier.email}</span>}
            {supplier.city    && <span>📍 {supplier.city}</span>}
          </div>
        </div>
      </div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 28 }}>
        {[
          { label: "Total Ordered", value: formatRs(totalOrdered), icon: "🛒", bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
          { label: "Total Paid",    value: formatRs(totalPaid),    icon: "✅", bg: "#f0fdf4", border: "#86efac", color: "#15803d" },
          { label: "Balance Due",   value: formatRs(totalBalance), icon: "⏳",
            bg: totalBalance > 0 ? "#fef2f2" : "#f0fdf4",
            border: totalBalance > 0 ? "#fca5a5" : "#86efac",
            color: totalBalance > 0 ? "#dc2626" : "#15803d" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "12px 14px", borderRadius: 10, background: s.bg, border: `1px solid ${s.border}` }}>
            <div style={{ fontSize: 14, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      {/* Timeline Table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#d97706", color: "#fff" }}>
            {["#", "Date & Time", "Type", "Reference / Items", "Total", "Paid", "Balance", "Status"].map((h, i) => (
              <th key={h} style={{ padding: "9px 7px", textAlign: i >= 4 ? "right" : i === 0 ? "center" : "left",
                fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeline.map((item, idx) => {
            const isOrder   = item.type === "order";
            const d         = item.data;
            const ref       = isOrder ? `PO-${(d.id || "").slice(-4).toUpperCase()}` : `PO-${(d.orderId || "").slice(-4).toUpperCase()}`;
            const total     = isOrder ? Number(d.totalAmount) || 0 : null;
            const paid      = isOrder ? Number(d.paidAmount) || 0 : Number(d.amount) || 0;
            const balance   = isOrder ? Number(d.balance) || 0 : Number(d.balanceAfter) || 0;
            const status    = isOrder ? (Number(d.balance) <= 0 ? "Paid" : Number(d.paidAmount) > 0 ? "Partial" : "Pending") : "Payment";
            const sBg    = { Paid: "#dcfce7", Partial: "#fef3c7", Pending: "#fee2e2", Payment: "#eff6ff" }[status];
            const sColor = { Paid: "#16a34a", Partial: "#d97706", Pending: "#dc2626", Payment: "#1d4ed8" }[status];
            const typeLabel = isOrder ? "🛒 Order" : "💸 Payment";
            const typeBg    = isOrder ? "#fffbeb" : "#f0fdf4";
            const typeColor = isOrder ? "#b45309" : "#15803d";
            const typeBdr   = isOrder ? "#fde68a" : "#86efac";
            const itemsStr  = isOrder && d.items?.length > 0
              ? d.items.map(it => `${it.description} ×${it.qty}`).join(", ")
              : (!isOrder && d.method ? `via ${d.method}` : "");
            return (
              <tr key={idx} style={{ background: idx % 2 === 0 ? "#f9fafb" : "#fff" }}>
                <td style={{ padding: "8px 8px", textAlign: "center", color: "#9ca3af", fontSize: 11 }}>{idx + 1}</td>
                <td style={{ padding: "8px 8px", fontSize: 10, color: "#374151", whiteSpace: "nowrap" }}>{fmtDateTime(item.date)}</td>
                <td style={{ padding: "8px 8px" }}>
                  <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 12, fontSize: 9, fontWeight: 700,
                    background: typeBg, color: typeColor, border: `1px solid ${typeBdr}` }}>{typeLabel}</span>
                </td>
                <td style={{ padding: "8px 8px", fontSize: 10, fontWeight: 600, color: "#111" }}>
                  {ref}
                  {itemsStr && <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 400, marginTop: 1 }}>{itemsStr}</div>}
                </td>
                <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#111", whiteSpace: "nowrap" }}>
                  {total != null ? formatRs(total) : "—"}
                </td>
                <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#16a34a", whiteSpace: "nowrap" }}>
                  {paid > 0 ? formatRs(paid) : "—"}
                </td>
                <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 11, fontWeight: 700,
                  color: balance > 0 ? "#dc2626" : "#16a34a", whiteSpace: "nowrap" }}>
                  {balance > 0 ? formatRs(balance) : <span style={{ color: "#16a34a" }}>Cleared ✓</span>}
                </td>
                <td style={{ padding: "8px 7px", textAlign: "right" }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 12,
                    fontSize: 10, fontWeight: 700, background: sBg, color: sColor }}>
                    {status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Footer */}
      <div style={{ position: "absolute", bottom: 36, left: 52, right: 52 }}>
        <div style={{ height: 1, background: "linear-gradient(to right,#1d4ed8,#8b5cf6,#f59e0b)", marginBottom: 14 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
          <div><div style={{ color: "#d97706", fontWeight: 800, fontSize: 13 }}>Novexa ERP</div>
            <div style={{ color: "#9ca3af", fontSize: 10, marginTop: 1 }}>Smart Business Management</div></div>
          <div style={{ color: "#9ca3af", fontSize: 10 }}>Supplier Report · {supplier.name}</div>
          <div style={{ textAlign: "right", color: "#9ca3af", fontSize: 10 }}>
            <div>Generated on {generatedOn}</div><div style={{ marginTop: 1 }}>Powered by Novexa ERP</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Supplier History Modal ────────────────────────────────────────────────────
function SupplierHistoryModal({ supplier, orders, payments, userDoc, onClose }) {
  const printRef = useRef(null);
  const [loading, setLoading] = useState(false);

  async function downloadPDF() {
    if (!printRef.current || loading) return;
    setLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF       = (await import("jspdf")).default;
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, width: 794 });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf     = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height / canvas.width) * pdfW;
      const pageH = pdf.internal.pageSize.getHeight();
      if (pdfH <= pageH) {
        pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
      } else {
        let yPos = 0, remaining = pdfH;
        while (remaining > 0) {
          pdf.addImage(imgData, "JPEG", 0, -yPos, pdfW, pdfH);
          remaining -= pageH; yPos += pageH;
          if (remaining > 0) pdf.addPage();
        }
      }
      pdf.save(`Supplier-${(supplier.name || "").replace(/\s+/g, "-")}-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) { alert("PDF failed: " + err.message); }
    setLoading(false);
  }

  function printReport() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank", "width=900,height=700");
    w.document.write(`<!DOCTYPE html><html><head><title>Supplier Report</title>
      <style>body{margin:0;padding:0;background:#fff;}</style>
      </head><body>${content}</body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  }

  const totalBalance = orders.reduce((s, o) => s + (Number(o.balance) || 0), 0);

  function shareWhatsApp() {
    const totalOrdered = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
    const totalPaid    = orders.reduce((s, o) => s + (Number(o.paidAmount) || 0), 0);
    const text = encodeURIComponent(
      `Hi ${supplier.name},\n\nAccount Summary:\n\n` +
      `🛒 Total Ordered: *${formatRs(totalOrdered)}*\n` +
      `✅ Total Paid: *${formatRs(totalPaid)}*\n` +
      `⏳ Balance Payable: *${formatRs(totalBalance)}*\n\n` +
      `— ${userDoc?.business || userDoc?.name || "Your Business"}`
    );
    window.open(`https://wa.me/${(supplier.phone || "").replace(/[^0-9]/g, "")}?text=${text}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-[860px] my-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
          <h3 className="text-white font-bold text-base">📊 Supplier Report — {supplier.name}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={shareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold hover:scale-105 transition-all"
              style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25D366" }}>
              💬 WhatsApp
            </button>
            <button onClick={printReport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold hover:scale-105 transition-all"
              style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
              🖨️ Print
            </button>
            <button onClick={downloadPDF} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold hover:scale-105 transition-all"
              style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000", opacity: loading ? 0.7 : 1 }}>
              {loading ? "⏳ Generating..." : "⬇️ Download PDF"}
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 text-lg">✕</button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl shadow-2xl" style={{ border: "1px solid rgba(245,158,11,0.3)" }}>
          <div ref={printRef}>
            <SupplierHistoryTemplate supplier={supplier} orders={orders} payments={payments} userDoc={userDoc} />
          </div>
        </div>
        <p className="text-center text-gray-600 text-xs mt-3">Scroll to see full report · Click &quot;Download PDF&quot; to save</p>
      </div>
    </div>
  );
}

// ── Main SupplierDetail Export ────────────────────────────────────────────────
export default function SupplierDetail({ supplier, uid, userDoc, onBack, onEdit, onDelete }) {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editOrder, setEditOrder]     = useState(null);  // {id, form} for edit
  const [savingOrder, setSavingOrder] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState(null);
  const [payOrder, setPayOrder]       = useState(null);  // order to pay
  const [savingPay, setSavingPay]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [alert, setAlert]             = useState({ show: false, type: "", title: "", message: "" });

  // real-time orders listener
  useEffect(() => {
    if (!uid || !supplier.id) return;
    const unsub = onSnapshot(
      query(collection(db, "users", uid, "suppliers", supplier.id, "orders"), orderBy("createdAt", "desc")),
      snap => { setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [uid, supplier.id]);

  // real-time supplier payments
  useEffect(() => {
    if (!uid || !supplier.id) return;
    const unsub = onSnapshot(
      query(collection(db, "users", uid, "supplierPayments"), orderBy("createdAt", "desc")),
      snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setSupplierPayments(all.filter(p => p.supplierId === supplier.id));
      },
      () => {}
    );
    return () => unsub();
  }, [uid, supplier.id]);

  // stats
  const totalOrdered  = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const totalPaid     = orders.reduce((s, o) => s + (Number(o.paidAmount) || 0), 0);
  const totalBalance  = orders.reduce((s, o) => s + (Number(o.balance) || 0), 0);
  const paidCount     = orders.filter(o => Number(o.balance) <= 0).length;

  // ── Save Purchase Order ────────────────────────────────────────────────────
  async function handleSaveOrder(formData) {
    if (savingOrder) return;
    setSavingOrder(true);
    try {
      const { subtotal, discount, afterDiscount, paid, balance } = calcPOTotals(formData);
      const payload = {
        supplierId:    supplier.id,
        supplierName:  supplier.name,
        items:         formData.items,
        discountType:  formData.discountType,
        discountValue: Number(formData.discountValue) || 0,
        subtotal,
        totalAmount:   afterDiscount,
        paidAmount:    paid,
        balance,
        status:        balance <= 0 ? "Paid" : paid > 0 ? "Partial" : "Pending",
        orderDate:     formData.orderDate,
        dueDate:       formData.dueDate || "",
        note:          formData.note || "",
      };

      if (editOrder) {
        await updateDoc(doc(db, "users", uid, "suppliers", supplier.id, "orders", editOrder.id),
          { ...payload, updatedAt: serverTimestamp() });
        setAlert({ show: true, type: "success", title: "Order Updated! ✓", message: "Purchase order updated." });
      } else {
        const ref = await addDoc(
          collection(db, "users", uid, "suppliers", supplier.id, "orders"),
          { ...payload, createdAt: serverTimestamp() }
        );
        // If initial payment was made, record it
        if (paid > 0) {
          await addDoc(collection(db, "users", uid, "supplierPayments"), {
            supplierId:      supplier.id,
            supplierName:    supplier.name,
            orderId:         ref.id,
            orderRef:        `PO-${ref.id.slice(-4).toUpperCase()}`,
            amount:          paid,
            balanceAfter:    balance,
            method:          "cash",
            description:     `Initial payment for PO-${ref.id.slice(-4).toUpperCase()}`,
            createdAt:       serverTimestamp(),
          });
        }
        setAlert({ show: true, type: "success", title: "Order Created! 🛒", message: "New purchase order recorded." });
      }
      setShowOrderModal(false);
      setEditOrder(null);
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Error", message: err.message });
    }
    setSavingOrder(false);
  }

  // ── Pay Supplier ──────────────────────────────────────────────────────────
  async function handlePaySupplier({ amount, method, payerName, receiverName, receiverContact, payDate, note }) {
    if (!payOrder || savingPay) return;
    setSavingPay(true);
    try {
      const newPaid    = (Number(payOrder.paidAmount) || 0) + amount;
      const newBalance = Math.max(0, (Number(payOrder.totalAmount) || 0) - newPaid);
      const newStatus  = newBalance <= 0 ? "Paid" : "Partial";

      // Update order
      await updateDoc(doc(db, "users", uid, "suppliers", supplier.id, "orders", payOrder.id), {
        paidAmount:     newPaid,
        balance:        newBalance,
        status:         newStatus,
        lastPaymentAt:  serverTimestamp(),
        updatedAt:      serverTimestamp(),
      });

      // Record payment
      await addDoc(collection(db, "users", uid, "supplierPayments"), {
        supplierId:      supplier.id,
        supplierName:    supplier.name,
        orderId:         payOrder.id,
        orderRef:        `PO-${payOrder.id.slice(-4).toUpperCase()}`,
        amount,
        balanceBefore:   Number(payOrder.balance) || 0,
        balanceAfter:    newBalance,
        method,
        payerName:       payerName || "",
        receiverName:    receiverName || supplier.name,
        receiverContact: receiverContact || supplier.phone || "",
        payDate,
        note:            note || "",
        status:          newStatus,
        description:     `Payment of ${formatRs(amount)} for PO-${payOrder.id.slice(-4).toUpperCase()}`,
        createdAt:       serverTimestamp(),
      });

      setAlert({
        show: true, type: "success",
        title: "Payment Recorded! 💸",
        message: `${formatRs(amount)} paid to ${supplier.name}. Balance: ${formatRs(newBalance)}.`,
      });
      setPayOrder(null);
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Error", message: err.message });
    }
    setSavingPay(false);
  }

  // ── Delete Order ──────────────────────────────────────────────────────────
  async function handleDeleteOrder(id) {
    try {
      await deleteDoc(doc(db, "users", uid, "suppliers", supplier.id, "orders", id));
      setAlert({ show: true, type: "success", title: "Deleted! 🗑️", message: "Order removed." });
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Error", message: err.message });
    }
    setDeleteOrderId(null);
  }

  function orderToForm(o) {
    return {
      items:         o.items?.length ? o.items : [{ description: "", qty: 1, unitPrice: "" }],
      discountType:  o.discountType  || "percent",
      discountValue: o.discountValue != null ? String(o.discountValue) : "",
      amountPaid:    o.paidAmount    != null ? String(o.paidAmount) : "",
      orderDate:     o.orderDate     || new Date().toISOString().slice(0, 10),
      dueDate:       o.dueDate       || "",
      note:          o.note          || "",
    };
  }

  return (
    <>
      <SweetAlert show={alert.show} type={alert.type} title={alert.title} message={alert.message}
        onClose={() => setAlert(a => ({ ...a, show: false }))} />

      <div className="flex flex-col gap-5">

        {/* Top Nav */}
        <div className="relative overflow-hidden rounded-xl p-5"
          style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-red-500/5" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold group" style={{ color: "#9ca3af" }}>
              <span className="group-hover:-translate-x-1 transition-transform">←</span>
              <span className="group-hover:text-white">Back to Purchases</span>
            </button>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setEditOrder(null); setShowOrderModal(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black hover:scale-105 transition-all shadow-lg"
                style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000" }}>
                🛒 New Purchase Order
              </button>
              <button onClick={() => setShowHistory(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black hover:scale-105 transition-all shadow-lg"
                style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#fff" }}>
                📊 View History
              </button>
              <button onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold hover:scale-105 transition-all"
                style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#60A5FA" }}>
                ✏️ Edit
              </button>
              <button onClick={onDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold hover:scale-105 transition-all"
                style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
                🗑 Delete
              </button>
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5" style={cardS}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white flex-shrink-0"
            style={{ background: avatarColor(supplier.id), boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
            {initials(supplier.name)}
          </div>
          <div className="flex-1">
            <h2 className="text-white font-black text-xl leading-none mb-1">{supplier.name}</h2>
            {supplier.shopName && <p className="text-amber-400 text-sm font-semibold mb-2">{supplier.shopName}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
              {supplier.phone   && <span>📞 {supplier.phone}</span>}
              {supplier.email   && <span>✉️ {supplier.email}</span>}
              {supplier.city    && <span>📍 {supplier.city}</span>}
              {supplier.address && <span>🏠 {supplier.address}</span>}
            </div>
            {supplier.notes && <p className="text-gray-500 text-xs mt-2">{supplier.notes}</p>}
          </div>
          <div className="flex-shrink-0 text-right">
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
              Active Supplier
            </span>
            <p className="text-gray-600 text-[10px] mt-1">Since {fmtDate(supplier.createdAt)}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Ordered",  val: formatRs(totalOrdered), icon: "🛒", color: "#fff"     },
            { label: "Total Paid Out", val: formatRs(totalPaid),    icon: "💸", color: "#34d399"  },
            { label: "Balance Payable",val: formatRs(totalBalance), icon: "⏳", color: totalBalance > 0 ? "#f87171" : "#34d399" },
            { label: "Orders",         val: `${orders.length} · ${paidCount} cleared`, icon: "📦", color: "#60A5FA" },
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

        {/* Balance Banner */}
        {totalBalance > 0 && (
          <div className="rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3"
            style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
            <div>
              <p className="text-sm font-bold" style={{ color: "#f87171" }}>⚠️ Payable to Supplier: {formatRs(totalBalance)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Amount still to be paid to {supplier.name}.</p>
            </div>
            <button onClick={() => { setEditOrder(null); setShowOrderModal(true); }}
              className="px-4 py-2 rounded-xl text-xs font-bold hover:scale-105 transition-all flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000" }}>
              New Order →
            </button>
          </div>
        )}

        {/* Purchase Orders Table */}
        <div className="rounded-2xl overflow-hidden" style={cardS}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-white font-bold text-sm">Purchase Orders</h3>
            <button onClick={() => { setEditOrder(null); setShowOrderModal(true); }}
              className="text-xs font-semibold transition-colors" style={{ color: "#F59E0B" }}>
              + New Order
            </button>
          </div>

          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="px-5 py-4 animate-pulse flex gap-3 border-b border-white/[0.04]">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex-shrink-0" />
                <div className="flex-1 flex flex-col gap-2 py-1">
                  <div className="h-3 bg-white/5 rounded w-40" /><div className="h-2 bg-white/5 rounded w-24" />
                </div>
              </div>
            ))
          ) : orders.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2">🛒</p>
              <p className="text-gray-500 text-sm">No purchase orders yet.</p>
              <button onClick={() => { setEditOrder(null); setShowOrderModal(true); }}
                className="mt-3 text-xs font-semibold" style={{ color: "#F59E0B" }}>
                Create first order →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {orders.map(o => {
                const bal   = Number(o.balance) || 0;
                const paid  = Number(o.paidAmount) || 0;
                const total = Number(o.totalAmount) || 0;
                const statusKey = bal <= 0 ? "Paid" : paid > 0 ? "Partial" : "Pending";
                const st = STATUS_STYLE[statusKey];
                const num = (o.id || "").slice(-4).toUpperCase();
                const isOverdue = o.dueDate && new Date(o.dueDate) < new Date() && statusKey !== "Paid";
                return (
                  <div key={o.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0"
                        style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#F59E0B" }}>
                        {num}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-medium">PO-{num}</p>
                          {isOverdue && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>OVERDUE</span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs">{fmtDate(o.createdAt)}{o.dueDate ? ` · Due ${o.dueDate}` : ""}</p>
                        {o.items?.length > 0 && (
                          <p className="text-gray-600 text-[10px] mt-0.5 truncate max-w-[220px]">
                            📦 {o.items.map(it => it.description).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-white text-sm font-bold">{formatRs(total)}</p>
                        {bal > 0 && <p className="text-xs" style={{ color: "#f87171" }}>Bal: {formatRs(bal)}</p>}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                        {statusKey}
                      </span>
                      <div className="flex gap-1">
                        {bal > 0 && (
                          <button onClick={() => setPayOrder(o)} title="Pay Supplier"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors"
                            style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}>💸</button>
                        )}
                        <button onClick={() => setShowHistory(true)} title="View History"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors"
                          style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}>📊</button>
                        <button onClick={() => { setEditOrder({ id: o.id, form: orderToForm(o) }); setShowOrderModal(true); }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors"
                          style={{ background: "rgba(37,99,235,0.1)", color: "#60A5FA" }}>✏️</button>
                        <button onClick={() => setDeleteOrderId(o.id)}
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

      {/* Purchase Order Modal */}
      {showOrderModal && (
        <PurchaseOrderModal
          initial={editOrder ? editOrder.form : null}
          supplier={supplier}
          onClose={() => { setShowOrderModal(false); setEditOrder(null); }}
          onSave={handleSaveOrder}
          saving={savingOrder}
        />
      )}

      {/* Pay Supplier Modal */}
      {payOrder && (
        <PaySupplierModal
          order={payOrder}
          supplier={supplier}
          onClose={() => setPayOrder(null)}
          onSave={handlePaySupplier}
          saving={savingPay}
        />
      )}

      {/* History Modal */}
      {showHistory && (
        <SupplierHistoryModal
          supplier={supplier}
          orders={orders}
          payments={supplierPayments}
          userDoc={userDoc}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Delete Order Confirm */}
      {deleteOrderId && (
        <DeleteConfirmSD
          name={`PO-${(deleteOrderId || "").slice(-4).toUpperCase()}`}
          label="Order"
          onConfirm={() => handleDeleteOrder(deleteOrderId)}
          onCancel={() => setDeleteOrderId(null)}
        />
      )}
    </>
  );
}
