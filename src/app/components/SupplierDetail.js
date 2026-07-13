"use client";
import { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, onSnapshot, query, orderBy,
  getDocs, writeBatch, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import SweetAlert from "./SweetAlert";
import EmailConfirmationDialog from "./EmailConfirmationDialog";
import { autoEmailSupplierOrder } from "@/lib/emailUtils";

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
const VARIANT_TYPES = [
  { value: "none",   label: "No Variant",  unit: "",      qtys: [] },
  { value: "kg",     label: "Kg",          unit: "kg",    qtys: [0.25, 0.5, 0.75, 1, 2, 5, 10, 20, 50] },
  { value: "meter",  label: "Meter",       unit: "mtr",   qtys: [0.5, 1, 2, 5, 10, 20, 50, 100] },
  { value: "liter",  label: "Liter",       unit: "ltr",   qtys: [0.25, 0.5, 1, 2, 5, 10, 20] },
  { value: "length", label: "Length (ft)", unit: "ft",    qtys: [1, 2, 3, 5, 10, 20, 50, 100] },
  { value: "piece",  label: "Piece / Pcs", unit: "pcs",   qtys: [1, 5, 10, 25, 50, 100, 200, 500] },
];

function emptyItem() {
  return { description: "", hasVariant: false, variantType: "none", variantQty: "", unitPrice: "", qty: 1 };
}

// Compute effective qty for an item:
// - No variant: just qty (pieces)
// - Variant with qty: variantQty (size per unit) × qty (number of units)
//   e.g. 0.25 kg × 100 units = 25 kg total
function itemEffectiveQty(item) {
  if (!item.hasVariant || item.variantType === "none") return Number(item.qty) || 1;
  const unitSize = Number(item.variantQty) || 0;
  const units    = Number(item.qty) || 1;
  return unitSize * units;
}

// Variant Item Row — used in PurchaseOrderModal
function VariantItemRow({ item, idx, locked, newLocked, isEdit, onChange, onRemove, canRemove }) {
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const variantMeta = VARIANT_TYPES.find(v => v.value === (item.variantType || "none")) || VARIANT_TYPES[0];
  const effectiveQty = itemEffectiveQty(item);
  const lineTotal = effectiveQty * (Number(item.unitPrice) || 0);

  const disabledStyle = { opacity: 0.45, cursor: "not-allowed", background: "rgba(255,255,255,0.02)", borderColor: "rgba(245,158,11,0.15)" };
  const isLocked = locked || newLocked;
  // Description is always locked for new rows in edit mode (pre-filled from original item)
  const isDescLocked = isLocked || (isEdit && item.isNew);

  // In edit mode for new rows: must choose variant before proceeding
  const needsVariant = isEdit && item.isNew && !item.variantType;

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-xl mb-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      {/* Row 1: Description + remove */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            placeholder={isDescLocked ? "" : "e.g. Cotton Fabric"}
            value={item.description}
            onChange={e => onChange("description", e.target.value)}
            required
            readOnly={isDescLocked}
            style={{ ...base, padding: "7px 10px", fontSize: 12, width: "100%", ...(isDescLocked ? disabledStyle : {}) }} />
          {isDescLocked && <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#f59e0b", pointerEvents: "none" }}>🔒</span>}
        </div>
        <button type="button" onClick={onRemove} disabled={!canRemove || locked}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", opacity: (!canRemove || locked) ? 0.15 : 1, cursor: (!canRemove || locked) ? "not-allowed" : "pointer" }}>✕</button>
      </div>

      {/* Row 2: Variant toggle (only in create mode, or show variant info if already set) */}
      {!isLocked && !item.hasVariant && item.variantType === "none" && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">Has variant?</span>
          <button type="button" onClick={() => { onChange("hasVariant", true); setShowVariantPicker(true); }}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all hover:scale-105"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#60A5FA" }}>
            + Add Variant
          </button>
        </div>
      )}

      {/* Variant Type Picker */}
      {(item.hasVariant || (item.variantType && item.variantType !== "none")) && !isLocked && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] text-gray-500 mr-1">Type:</span>
          {VARIANT_TYPES.filter(v => v.value !== "none").map(v => (
            <button key={v.value} type="button"
              onClick={() => { onChange("variantType", v.value); onChange("variantQty", ""); }}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-all"
              style={{
                background: item.variantType === v.value ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${item.variantType === v.value ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.1)"}`,
                color: item.variantType === v.value ? "#f59e0b" : "#9ca3af",
              }}>
              {v.label}
            </button>
          ))}
          <button type="button" onClick={() => { onChange("hasVariant", false); onChange("variantType", "none"); onChange("variantQty", ""); }}
            className="text-[11px] px-2 py-0.5 rounded-full ml-1"
            style={{ color: "#6b7280", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            ✕ Remove
          </button>
        </div>
      )}

      {/* Edit mode: must pick variant for new rows */}
      {isEdit && item.isNew && !isLocked && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] text-gray-500 mr-1">Variant <span style={{color:"#f87171"}}>*</span>:</span>
          {VARIANT_TYPES.map(v => (
            <button key={v.value} type="button"
              onClick={() => { onChange("variantType", v.value); onChange("variantQty", ""); onChange("hasVariant", v.value !== "none"); }}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-all"
              style={{
                background: item.variantType === v.value ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${item.variantType === v.value ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.1)"}`,
                color: item.variantType === v.value ? "#f59e0b" : "#9ca3af",
              }}>
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* Variant Qty Chips — shown when variant type selected */}
      {item.variantType && item.variantType !== "none" && !isLocked && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] text-gray-500 mr-1">{variantMeta.label}:</span>
          {variantMeta.qtys.map(q => (
            <button key={q} type="button"
              onClick={() => onChange("variantQty", String(q))}
              className="text-[11px] font-bold px-2 py-0.5 rounded-full transition-all hover:scale-105"
              style={{
                background: String(item.variantQty) === String(q) ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${String(item.variantQty) === String(q) ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.1)"}`,
                color: String(item.variantQty) === String(q) ? "#34d399" : "#9ca3af",
              }}>
              {q} {variantMeta.unit}
            </button>
          ))}
          <input type="number" inputMode="decimal" min="0" step="any" placeholder="custom"
            value={item.variantQty}
            onChange={e => onChange("variantQty", e.target.value)}
            style={{ ...base, width: 72, padding: "4px 8px", fontSize: 11 }} />
        </div>
      )}

      {/* Row 3: Qty / Units + Price + Total */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* No variant: plain qty */}
        {(!item.variantType || item.variantType === "none") && !isLocked && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">Qty</span>
            <input type="number" inputMode="numeric" min="1" placeholder="1" value={item.qty}
              onChange={e => onChange("qty", e.target.value)}
              style={{ ...base, width: 64, padding: "6px 6px", fontSize: 12, textAlign: "center" }} />
          </div>
        )}

        {/* Variant selected: variantQty (size) × qty (units) */}
        {item.variantType && item.variantType !== "none" && !isLocked && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Size badge */}
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)", color: "#34d399", whiteSpace: "nowrap" }}>
              {item.variantQty || "—"} {variantMeta.unit}
            </span>
            <span className="text-[10px] text-gray-600">×</span>
            {/* Number of units */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">Units</span>
              <input type="number" inputMode="numeric" min="1" placeholder="1" value={item.qty}
                onChange={e => onChange("qty", e.target.value)}
                style={{ ...base, width: 64, padding: "6px 6px", fontSize: 12, textAlign: "center" }} />
            </div>
            {/* Effective total qty */}
            {item.variantQty && Number(item.qty) > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b", whiteSpace: "nowrap" }}>
                = {itemEffectiveQty(item)} {variantMeta.unit} total
              </span>
            )}
          </div>
        )}

        {/* Locked display */}
        {isLocked && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-600">
              {item.variantType && item.variantType !== "none"
                ? `${item.variantQty} ${variantMeta.unit} × ${item.qty} units`
                : `Qty: ${item.qty}`}
            </span>
          </div>
        )}

        {/* Per-unit price */}
        <div className="flex items-center gap-1 flex-1 min-w-[140px]">
          <span className="text-[10px] text-gray-500 whitespace-nowrap">
            {item.variantType && item.variantType !== "none" ? `Per ${variantMeta.unit}` : "Price"}
          </span>
          <input type="number" inputMode="decimal" min="0" placeholder="0" value={item.unitPrice}
            onChange={e => onChange("unitPrice", e.target.value)}
            readOnly={locked}
            style={{ ...base, flex: 1, padding: "6px 8px", fontSize: 12, textAlign: "right", ...(locked ? disabledStyle : {}) }} />
        </div>

        {/* Total */}
        <div className="text-right flex-shrink-0 min-w-[90px]">
          <p className="text-xs font-bold" style={{ color: lineTotal > 0 ? "#fff" : "#4b5563" }}>
            {lineTotal > 0 ? formatRs(lineTotal) : "—"}
          </p>
          {item.variantType && item.variantType !== "none" && lineTotal > 0 && (
            <p className="text-[9px]" style={{ color: "#6b7280" }}>
              {itemEffectiveQty(item)} {variantMeta.unit} × {formatRs(Number(item.unitPrice))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const PO_EMPTY = {
  items: [emptyItem()],
  discountType: "percent",
  discountValue: "",
  amountPaid: "",
  orderDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  note: "",
};

function calcPOTotals(form) {
  const subtotal = (form.items || []).reduce(
    (s, it) => s + itemEffectiveQty(it) * (Number(it.unitPrice) || 0), 0
  );
  const discount = form.discountType === "percent"
    ? subtotal * (Number(form.discountValue) || 0) / 100
    : Number(form.discountValue) || 0;
  const afterDiscount = Math.max(subtotal - discount, 0);
  const paid = Number(form.amountPaid) || 0;
  const balance = Math.max(afterDiscount - paid, 0);
  return { subtotal, discount, afterDiscount, paid, balance };
}

function SInput({ type = "text", placeholder, value, onChange, req, readOnly, inputMode }) {
  const [f, setF] = useState(false);
  const focused = { background: "rgba(37,99,235,0.07)", border: "1.5px solid rgba(37,99,235,0.5)", boxShadow: "0 0 0 3px rgba(37,99,235,0.08)" };
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      required={req} autoComplete="off" readOnly={readOnly} inputMode={inputMode}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...base, ...(f && !readOnly ? focused : {}), ...(readOnly ? { opacity: 0.55, cursor: "not-allowed", background: "rgba(255,255,255,0.02)" } : {}) }} />
  );
}

// isEdit = true when editing an existing order
// originalItemCount = number of items that existed before editing (those are locked)
function PurchaseOrderModal({ initial, supplier, onClose, onSave, saving, isEdit, originalItemCount }) {
  const [form, setForm] = useState(initial || PO_EMPTY);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  // In edit mode: items at index < lockedCount are fully locked (all fields disabled)
  const lockedCount = isEdit ? (originalItemCount ?? (initial?.items?.length ?? 0)) : 0;
  // The original item descriptions (used to pre-fill new rows on "Add Item" in edit mode)
  const originalItems = isEdit ? (initial?.items || []).slice(0, lockedCount) : [];

  // Totals — only count NEW (unlocked) items when in edit mode so discount/total reflect the new delivery
  const { subtotal, discount, afterDiscount, paid, balance } = calcPOTotals(
    isEdit
      ? { ...form, items: form.items.filter((_, i) => i >= lockedCount) }
      : form
  );

  function setItem(idx, k, v) {
    // In edit mode, locked items are fully read-only
    if (isEdit && idx < lockedCount) return;
    setForm(p => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [k]: v };
      return { ...p, items };
    });
  }

  function addItem() {
    if (isEdit) {
      const newRows = originalItems.map(it => ({
        ...emptyItem(),
        description: it.description || "",
        variantType: it.variantType || "none",
        hasVariant:  it.hasVariant  || false,
        isNew: true,
      }));
      const alreadyHasNew = form.items.some(it => it.isNew);
      if (alreadyHasNew) return;
      setForm(p => ({ ...p, items: [...p.items, ...newRows] }));
    } else {
      setForm(p => ({ ...p, items: [...p.items, emptyItem()] }));
    }
  }

  function removeItem(idx) {
    // Locked items cannot be removed; new items can be removed one by one
    if (isEdit && idx < lockedCount) return;
    const newItems = form.items.filter((it, i) => i >= lockedCount);
    if (newItems.length <= 1) return; // keep at least one new row
    setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  }

  // Whether any new (unlocked) rows have been added in edit mode
  const hasNewItems = isEdit && form.items.some(it => it.isNew);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-3xl mx-auto my-6 rounded-2xl"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", maxWidth: "900px" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-white font-black text-xl">{isEdit ? "Edit Purchase Order" : "New Purchase Order"}</h2>
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
            <div className="flex items-center justify-between mb-1">
              <label style={lbl}>Items <span style={{ color: "#f87171" }}>*</span></label>
              {isEdit && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>
                  🔒 Original items locked
                </span>
              )}
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex flex-col gap-0 p-1">
                {form.items.map((item, idx) => {
                  const locked    = isEdit && idx < lockedCount;
                  const newLocked = isEdit && idx >= lockedCount && item.isNew && !item.isNew; // never lock description on new rows
                  return (
                    <VariantItemRow
                      key={idx}
                      item={item}
                      idx={idx}
                      locked={locked}
                      newLocked={false}
                      isEdit={isEdit}
                      onChange={(k, v) => setItem(idx, k, v)}
                      onRemove={() => removeItem(idx)}
                      canRemove={!locked && (isEdit ? true : form.items.length > 1)}
                    />
                  );
                })}
              </div>
            </div>
            {/* Add Item: in edit mode only show if no new rows added yet */}
            {(!isEdit || !hasNewItems) && (
              <button type="button" onClick={addItem}
                className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", color: "#60A5FA" }}>
                + Add Item
              </button>
            )}
            {isEdit && hasNewItems && (
              <p className="mt-2 text-[10px]" style={{ color: "#f59e0b" }}>
                ✏️ Enter qty &amp; unit price for each item above
              </p>
            )}
          </div>

          {/* Discount — readonly in edit mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}>Discount Type</label>
              <select
                value={form.discountType}
                onChange={isEdit ? undefined : set("discountType")}
                disabled={isEdit}
                style={{ ...base, ...(isEdit ? { opacity: 0.45, cursor: "not-allowed" } : {}) }}>
                <option value="percent" style={{ background: "#0d1117" }}>Percentage (%)</option>
                <option value="fixed"   style={{ background: "#0d1117" }}>Fixed Amount (Rs.)</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Discount Value</label>
              <SInput type="number" inputMode="decimal" min="0" placeholder="0" value={form.discountValue}
                onChange={set("discountValue")} readOnly={isEdit} />
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
              <span className="text-white">{isEdit ? "New Items Total" : "Total Payable"}</span>
              <span className="text-white">{formatRs(afterDiscount)}</span>
            </div>
            {/* Amount Paid: only shown in create mode — in edit mode payment is done separately */}
            {!isEdit && (
              <>
                <div>
                  <label style={{ ...lbl, marginTop: 8 }}>Amount Paid Now (Rs.)</label>
                  <SInput type="number" inputMode="decimal" min="0" placeholder="0" value={form.amountPaid}
                    onChange={set("amountPaid")} />
                </div>
                <div className="flex justify-between text-sm font-bold mt-1">
                  <span className="text-gray-400">Balance Remaining</span>
                  <span style={{ color: balance > 0 ? "#f87171" : "#34d399", fontWeight: 800, fontSize: 16 }}>{formatRs(balance)}</span>
                </div>
              </>
            )}
            {isEdit && (
              <p className="text-[11px] mt-1" style={{ color: "#9ca3af" }}>
                💡 This amount will be added to the order balance. Pay via the 💸 button on the order.
              </p>
            )}
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
              {saving ? "Saving..." : isEdit ? "Update Order →" : "Create Purchase Order →"}
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
            <input type="number" inputMode="decimal" min="1" max={maxPayable} placeholder={`Max: ${maxPayable}`}
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
              <label style={lbl}>Paid By (Your Name) <span style={{ color: "#f87171" }}>*</span></label>
              <input type="text" placeholder="e.g. Ahmed" value={payerName}
                onChange={e => setPayerName(e.target.value)} required style={{ ...base }} />
            </div>
            <div>
              <label style={lbl}>Received By <span style={{ color: "#f87171" }}>*</span></label>
              <input type="text" placeholder={supplier.name} value={receiverName}
                onChange={e => setReceiverName(e.target.value)} required style={{ ...base }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}>Supplier Contact <span style={{ color: "#f87171" }}>*</span></label>
              <input type="tel" inputMode="tel" placeholder={supplier.phone || "+92 300 1234567"} value={receiverContact}
                onChange={e => {
                  let val = e.target.value;
                  if (val === "" || val === "+") { setReceiverContact(""); return; }
                  val = val.replace(/[^+\d]/g, "");
                  if (!val.startsWith("+")) val = "+" + val.replace(/^\+*/, "");
                  if (val.length > 13) val = val.slice(0, 13);
                  setReceiverContact(val);
                }} required style={{ ...base }} />
            </div>
            <div>
              <label style={lbl}>Payment Date <span style={{ color: "#f87171" }}>*</span></label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} required style={{ ...base }} />
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

// ── Return Goods Modal ────────────────────────────────────────────────────────
function ReturnGoodsModal({ order, supplier, receipts = [], onClose, onSave, saving }) {
  const VTYPES = { kg:"kg", meter:"mtr", liter:"ltr", length:"ft", piece:"pcs" };

  // Build all purchased item groups: original order items + receipt items
  // Group by description (item name) — each group holds all variants ever purchased
  function buildPurchasedGroups() {
    const groups = {}; // key = description

    // Original order items
    (order.items || []).forEach(it => {
      if (!it.description?.trim()) return;
      const key = it.description.trim();
      if (!groups[key]) groups[key] = { description: key, variantType: it.variantType || "none", unitPrice: it.unitPrice || "", entries: [] };
      groups[key].entries.push({ variantQty: it.variantQty || "", qty: it.qty || 1, unitPrice: it.unitPrice || "" });
      // Use latest unitPrice as default
      groups[key].unitPrice = it.unitPrice || groups[key].unitPrice;
      groups[key].variantType = it.variantType || groups[key].variantType || "none";
    });

    // Receipt items (additional purchases)
    receipts.forEach(r => {
      (r.items || []).forEach(it => {
        if (!it.description?.trim()) return;
        const key = it.description.trim();
        if (!groups[key]) groups[key] = { description: key, variantType: it.variantType || "none", unitPrice: it.unitPrice || "", entries: [] };
        groups[key].entries.push({ variantQty: it.variantQty || "", qty: it.qty || 1, unitPrice: it.unitPrice || "" });
        groups[key].unitPrice = it.unitPrice || groups[key].unitPrice;
        groups[key].variantType = it.variantType || groups[key].variantType || "none";
      });
    });

    return Object.values(groups);
  }

  const purchasedGroups = buildPurchasedGroups();

  // For each group, init a return item with variant picker
  const initItems = purchasedGroups.map(g => ({
    description: g.description,
    variantType: g.variantType,
    variantQty:  "",          // user picks variant size
    qty:         "",          // user enters number of units
    unitPrice:   g.unitPrice, // pre-filled, editable
    isVariant:   g.variantType && g.variantType !== "none",
  }));

  // Fallback: if no items from order, show one blank row
  const [items, setItems] = useState(
    initItems.length > 0
      ? initItems
      : [{ description: "", variantType: "none", variantQty: "", qty: "", unitPrice: "", isVariant: false }]
  );
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const VARIANT_META = { kg:{unit:"kg", qtys:[0.25,0.5,0.75,1,2,5,10,20,50]}, meter:{unit:"mtr", qtys:[0.5,1,2,5,10,20,50]}, liter:{unit:"ltr", qtys:[0.25,0.5,1,2,5,10,20]}, length:{unit:"ft", qtys:[1,2,3,5,10,20,50]}, piece:{unit:"pcs", qtys:[1,5,10,25,50,100,200]} };

  function effQty(it) {
    if (!it.isVariant || !it.variantQty) return Number(it.qty) || 0;
    return (Number(it.variantQty) || 0) * (Number(it.qty) || 0);
  }

  const returnTotal = items.reduce((s, it) => s + effQty(it) * (Number(it.unitPrice) || 0), 0);
  const balanceAfter = Math.max(0, (Number(order.balance) || 0) - returnTotal);

  function setItem(idx, k, v) {
    setItems(p => { const arr = [...p]; arr[idx] = { ...arr[idx], [k]: v }; return arr; });
  }

  function addBlankItem() {
    setItems(p => [...p, { description: "", variantType: "none", variantQty: "", qty: "", unitPrice: "", isVariant: false }]);
  }

  function removeItem(idx) {
    if (items.length <= 1) return;
    setItems(p => p.filter((_, i) => i !== idx));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-xl my-6 rounded-2xl"
        style={{ background: "#0d1117", border: "1px solid rgba(239,68,68,0.3)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-white font-black text-xl">📦 Return Goods</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              Order: <span className="text-amber-400 font-semibold">PO-{(order.id || "").slice(-4).toUpperCase()}</span>
              &nbsp;· Balance: <span className="text-red-400 font-semibold">{formatRs(Number(order.balance) || 0)}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10">✕</button>
        </div>

        <form onSubmit={e => {
          e.preventDefault();
          const validItems = items
            .filter(it => it.description?.trim() && effQty(it) > 0 && Number(it.unitPrice) > 0)
            .map(it => ({
              description: it.description,
              variantType: it.variantType || "none",
              variantQty:  it.variantQty || "",
              qty:         it.isVariant ? it.qty : it.qty,
              unitPrice:   it.unitPrice,
              effectiveQty: effQty(it),
            }));
          if (validItems.length === 0) return;
          onSave({ items: validItems, returnTotal, returnDate, note });
        }} className="flex flex-col gap-4 p-6">

          {/* Return Date */}
          <div>
            <label style={lbl}>Return Date <span style={{ color: "#f87171" }}>*</span></label>
            <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} required style={{ ...base }} />
          </div>

          {/* Return Items */}
          <div>
            <label style={lbl}>Return Items <span style={{ color: "#f87171" }}>*</span></label>
            <div className="flex flex-col gap-2">
              {items.map((item, idx) => {
                const meta = VARIANT_META[item.variantType] || null;
                const eff  = effQty(item);
                const tot  = eff * (Number(item.unitPrice) || 0);
                return (
                  <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-xl"
                    style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}>
                    {/* Row 1: Item name (locked if from order) + remove */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          placeholder="Item name"
                          value={item.description}
                          onChange={e => setItem(idx, "description", e.target.value)}
                          required
                          readOnly={!!purchasedGroups.find(g => g.description === item.description)}
                          style={{ ...base, fontSize: 13, padding: "7px 10px",
                            ...(purchasedGroups.find(g => g.description === item.description)
                              ? { opacity: 0.7, cursor: "not-allowed", background: "rgba(255,255,255,0.02)" }
                              : {})
                          }} />
                        {purchasedGroups.find(g => g.description === item.description) && (
                          <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:10, color:"#f59e0b" }}>🔒</span>
                        )}
                      </div>
                      <button type="button" onClick={() => removeItem(idx)} disabled={items.length <= 1}
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", opacity: items.length <= 1 ? 0.2 : 1 }}>✕</button>
                    </div>

                    {/* Row 2: Variant chips (if variant item) */}
                    {item.isVariant && meta && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] text-gray-500 mr-1">{meta.unit} per unit:</span>
                        {meta.qtys.map(q => (
                          <button key={q} type="button"
                            onClick={() => setItem(idx, "variantQty", String(q))}
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full transition-all hover:scale-105"
                            style={{
                              background: String(item.variantQty) === String(q) ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)",
                              border: `1px solid ${String(item.variantQty) === String(q) ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                              color: String(item.variantQty) === String(q) ? "#f87171" : "#9ca3af",
                            }}>
                            {q} {meta.unit}
                          </button>
                        ))}
                        <input type="number" inputMode="decimal" min="0" step="any" placeholder="custom"
                          value={item.variantQty}
                          onChange={e => setItem(idx, "variantQty", e.target.value)}
                          style={{ ...base, width: 72, padding: "4px 8px", fontSize: 11 }} />
                      </div>
                    )}

                    {/* Row 3: Qty + Price + Total */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.isVariant ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-500">Units to return</span>
                          <input type="number" inputMode="numeric" min="1" placeholder="0" value={item.qty}
                            onChange={e => setItem(idx, "qty", e.target.value)}
                            style={{ ...base, width: 70, padding: "6px 6px", fontSize: 12, textAlign: "center" }} />
                          {item.variantQty && Number(item.qty) > 0 && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171", whiteSpace:"nowrap" }}>
                              = {eff} {meta?.unit || ""}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500">Qty</span>
                          <input type="number" inputMode="numeric" min="1" placeholder="0" value={item.qty}
                            onChange={e => setItem(idx, "qty", e.target.value)}
                            style={{ ...base, width: 70, padding: "6px 6px", fontSize: 12, textAlign: "center" }} />
                        </div>
                      )}

                      <div className="flex items-center gap-1 flex-1 min-w-[130px]">
                        <span className="text-[10px] text-gray-500 whitespace-nowrap">
                          {item.isVariant && meta ? `Per ${meta.unit}` : "Unit Price"}
                        </span>
                        <input type="number" inputMode="decimal" min="0" placeholder="0" value={item.unitPrice}
                          onChange={e => setItem(idx, "unitPrice", e.target.value)}
                          style={{ ...base, flex: 1, padding: "6px 8px", fontSize: 12, textAlign: "right" }} />
                      </div>

                      <div className="text-right flex-shrink-0 min-w-[90px]">
                        <p className="text-sm font-bold" style={{ color: tot > 0 ? "#f87171" : "#4b5563" }}>
                          {tot > 0 ? `- ${formatRs(tot)}` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addBlankItem}
              className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-105"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
              + Add Item
            </button>
          </div>

          {/* Summary */}
          <div className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-gray-400">Total Return Amount</span>
              <span style={{ color: returnTotal > 0 ? "#f87171" : "#6b7280", fontSize: 16, fontWeight: 800 }}>
                - {formatRs(returnTotal)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 border-t border-white/10 pt-2 mt-1">
              <span>Balance after return</span>
              <span style={{ color: balanceAfter > 0 ? "#f87171" : "#34d399", fontWeight: 700 }}>
                {formatRs(balanceAfter)}
              </span>
            </div>
          </div>

          {/* Note */}
          <div>
            <label style={lbl}>Notes / Reason</label>
            <textarea rows={2} placeholder="Reason for return..." value={note} onChange={e => setNote(e.target.value)}
              style={{ ...base, resize: "vertical" }} />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || returnTotal <= 0}
              className="flex-1 py-3 rounded-2xl text-sm font-black"
              style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff",
                opacity: (saving || returnTotal <= 0) ? 0.5 : 1, cursor: (saving || returnTotal <= 0) ? "not-allowed" : "pointer" }}>
              {saving ? "Processing..." : "📦 Confirm Return →"}
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

// ── Purchase Order PDF Template ───────────────────────────────────────────────
export function PurchaseOrderPDFTemplate({ order, supplier, userDoc = {}, receipts, returns, payments }) {
  const num = `PO-${(order.id || "").slice(-4).toUpperCase()}`;
  const generatedOn = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" });

  // Helper
  function fmtD(ts) {
    if (!ts) return "—";
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return "—"; }
  }

  // Variant meta
  const VTYPES = { kg:"kg", meter:"mtr", liter:"ltr", length:"ft", piece:"pcs" };

  function itemLabel(it) {
    if (!it.hasVariant || !it.variantType || it.variantType === "none") {
      return `${it.description}  ×${it.qty || 1}`;
    }
    const unit = VTYPES[it.variantType] || it.variantType;
    const effQty = (Number(it.variantQty) || 0) * (Number(it.qty) || 1);
    return `${it.description}  (${it.variantQty}${unit} × ${it.qty} = ${effQty}${unit})`;
  }

  function itemQtyDisplay(it) {
    if (!it.hasVariant || !it.variantType || it.variantType === "none") return `${it.qty || 1} pcs`;
    const unit = VTYPES[it.variantType] || it.variantType;
    return `${(Number(it.variantQty) || 0) * (Number(it.qty) || 1)} ${unit}`;
  }

  function itemTotal(it) {
    if (!it.hasVariant || !it.variantType || it.variantType === "none")
      return (Number(it.qty) || 1) * (Number(it.unitPrice) || 0);
    return (Number(it.variantQty) || 0) * (Number(it.qty) || 1) * (Number(it.unitPrice) || 0);
  }

  // Build full timeline: original items + receipts + returns + payments
  const origTotal = (order.items || []).reduce((s, it) => s + itemTotal(it), 0);
  const disc = order.discountType === "percent"
    ? origTotal * (Number(order.discountValue) || 0) / 100
    : (Number(order.discountValue) || 0);
  const orderAmt = Math.max(origTotal - disc, 0);

  const totalReceipts = (receipts || []).reduce((s, r) => s + (Number(r.receiptTotal) || 0), 0);
  const totalReturns  = (returns  || []).reduce((s, r) => s + (Number(r.returnTotal)  || 0), 0);
  const totalPaid     = Number(order.paidAmount) || 0;
  const grossTotal    = orderAmt + totalReceipts;
  const balance       = Number(order.balance) || 0;

  const statusKey = balance <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Pending";
  const sColor = { Paid: "#16a34a", Partial: "#d97706", Pending: "#dc2626" }[statusKey];
  const sBg    = { Paid: "#dcfce7", Partial: "#fef3c7", Pending: "#fee2e2" }[statusKey];

  return (
    <div style={{ width: 794, minHeight: 1123, background: "#fff", color: "#111",
      fontSize: 13,
      padding: "44px 52px", boxSizing: "border-box", position: "relative" }}>

      {/* Top accent */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6,
        background: "linear-gradient(to right,#f59e0b,#d97706,#92400e)" }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {userDoc?.logoDataUrl && (
            <img src={userDoc.logoDataUrl} alt="Logo"
              style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8 }} />
          )}
          <div>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#111" }}>
              {userDoc?.business || userDoc?.name || "Your Business"}
            </div>
            {userDoc?.address && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{userDoc.address}</div>}
            {userDoc?.phone   && <div style={{ fontSize: 11, color: "#6b7280" }}>{userDoc.phone}</div>}
            {userDoc?.email   && <div style={{ fontSize: 11, color: "#6b7280" }}>{userDoc.email}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#d97706", letterSpacing: "-1px" }}>
            PURCHASE ORDER
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111", marginTop: 4 }}>{num}</div>
          <div style={{ marginTop: 8, display: "inline-block", padding: "3px 14px", borderRadius: 20,
            fontSize: 11, fontWeight: 700, background: sBg, color: sColor, border: `1px solid ${sColor}33` }}>
            {statusKey.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "#e5e7eb", marginBottom: 22 }} />

      {/* Supplier + Order Info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Supplier */}
        <div style={{ padding: "14px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
            color: "#92400e", marginBottom: 8 }}>SUPPLIER</div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{supplier.name}</div>
          {supplier.shopName && <div style={{ fontSize: 12, color: "#d97706", fontWeight: 600, marginTop: 2 }}>{supplier.shopName}</div>}
          {supplier.phone && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>📞 {supplier.phone}</div>}
          {supplier.email && <div style={{ fontSize: 11, color: "#4b5563" }}>✉️ {supplier.email}</div>}
          {supplier.city  && <div style={{ fontSize: 11, color: "#4b5563" }}>📍 {supplier.city}{supplier.address ? `, ${supplier.address}` : ""}</div>}
        </div>
        {/* Order details */}
        <div style={{ padding: "14px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
            color: "#6b7280", marginBottom: 8 }}>ORDER DETAILS</div>
          {[
            ["Order Date",    fmtD(order.orderDate || order.createdAt)],
            ["Created At",    (() => { try { const d = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || 0); return d.toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"}) + "  " + d.toLocaleTimeString("en-PK",{hour:"2-digit",minute:"2-digit",hour12:true}); } catch { return "—"; }})()],
            ["Due Date",      order.dueDate ? fmtD(order.dueDate) : "—"],
            ["Reference",     num],
            ["Generated",     generatedOn],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
              <span style={{ color: "#6b7280" }}>{k}</span>
              <span style={{ fontWeight: 600, color: "#111" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
        <thead>
          <tr style={{ background: "#d97706", color: "#fff" }}>
            {["Date & Time", "Type", "Item / Description", "Qty",
              // Smart unit price header: if all original items share same variant type → use it, else generic
              (() => {
                const origItems = order.items || [];
                const variantTypes = [...new Set(origItems.map(it => it.variantType || "none").filter(v => v !== "none"))];
                const VMAP = { kg:"Per kg", meter:"Per mtr", liter:"Per ltr", length:"Per ft", piece:"Per pcs" };
                if (variantTypes.length === 1) return VMAP[variantTypes[0]] || "Per Unit";
                const allNoVariant = origItems.every(it => !it.hasVariant || !it.variantType || it.variantType === "none");
                return allNoVariant ? "Per Unit" : "Unit Price";
              })(),
              "Total"].map((h, i) => (
              <th key={h} style={{
                padding: "9px 10px", fontSize: 9, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.05em",
                textAlign: i >= 3 ? "right" : "left",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* ── Original Order Items ── */}
          {(order.items || []).map((it, i) => {
            const tot = itemTotal(it);
            const ts  = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt || 0);
            const dtStr = ts.toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" })
              + "  " + ts.toLocaleTimeString("en-PK", { hour:"2-digit", minute:"2-digit", hour12:true });
            return (
              <tr key={`orig-${i}`} style={{ background: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                <td style={{ padding: "8px 10px", fontSize: 10, color: "#4b5563", whiteSpace: "nowrap" }}>{dtStr}</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ display: "inline-block", padding: "1px 7px", borderRadius: 10,
                    fontSize: 8, fontWeight: 700, background: "#fffbeb", color: "#b45309",
                    border: "1px solid #fde68a" }}>Order</span>
                </td>
                <td style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600 }}>
                  {it.description}
                  {it.hasVariant && it.variantType && it.variantType !== "none" && (
                    <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 1 }}>
                      {it.variantQty} {VTYPES[it.variantType] || it.variantType} × {it.qty} units
                    </div>
                  )}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11 }}>{itemQtyDisplay(it)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11 }}>
                  {it.hasVariant && it.variantType && it.variantType !== "none"
                    ? `Rs. ${Number(it.unitPrice || 0).toLocaleString("en-PK")} / ${VTYPES[it.variantType] || it.variantType}`
                    : `Rs. ${Number(it.unitPrice || 0).toLocaleString("en-PK")}`
                  }
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>
                  Rs. {tot.toLocaleString("en-PK")}
                </td>
              </tr>
            );
          })}

          {/* ── Additional Purchases (receipts) ── */}
          {(receipts || []).map((r, ri) =>
            (r.items || []).map((it, ii) => {
              const effQty = (!it.hasVariant || !it.variantType || it.variantType === "none")
                ? (Number(it.qty) || 1)
                : (Number(it.variantQty) || 0) * (Number(it.qty) || 1);
              const unit = it.hasVariant && it.variantType && it.variantType !== "none"
                ? (VTYPES[it.variantType] || it.variantType) : "pcs";
              const tot = effQty * (Number(it.unitPrice) || 0);
              const ts = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
              const dtStr = ts.toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" })
                + "  " + ts.toLocaleTimeString("en-PK", { hour:"2-digit", minute:"2-digit", hour12:true });
              return (
                <tr key={`rec-${ri}-${ii}`} style={{ background: "#f0fdf4" }}>
                  <td style={{ padding: "8px 10px", fontSize: 10, color: "#4b5563", whiteSpace: "nowrap" }}>{dtStr}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ display: "inline-block", padding: "1px 7px", borderRadius: 10,
                      fontSize: 8, fontWeight: 700, background: "#dcfce7", color: "#15803d",
                      border: "1px solid #86efac" }}>Purchased</span>
                  </td>
                  <td style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600 }}>
                    {it.description}
                    {it.hasVariant && it.variantType && it.variantType !== "none" && (
                      <span style={{ fontSize: 9, color: "#9ca3af", marginLeft: 4 }}>
                        ({it.variantQty}{unit} × {it.qty})
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11 }}>{effQty} {unit}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11 }}>
                    {it.hasVariant && it.variantType && it.variantType !== "none"
                      ? `Rs. ${Number(it.unitPrice || 0).toLocaleString("en-PK")} / ${unit}`
                      : `Rs. ${Number(it.unitPrice || 0).toLocaleString("en-PK")}`
                    }
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#15803d" }}>
                    + Rs. {tot.toLocaleString("en-PK")}
                  </td>
                </tr>
              );
            })
          )}

          {/* ── Goods Returned ── */}
          {(returns || []).map((r, ri) =>
            (r.items || []).map((it, ii) => {
              const isVariant = it.variantType && it.variantType !== "none";
              const unit      = isVariant ? (VTYPES[it.variantType] || it.variantType) : "pcs";
              const eQty      = Number(it.effectiveQty) || (isVariant
                ? (Number(it.variantQty) || 0) * (Number(it.qty) || 0)
                : Number(it.qty) || 0);
              const lineTotal = eQty * (Number(it.unitPrice) || 0);
              const qtyDisplay = isVariant && it.variantQty
                ? `${it.variantQty}${unit}×${it.qty}=${eQty}${unit}`
                : `${eQty} ${unit}`;
              const ts = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
              const dtStr = ts.toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" })
                + "  " + ts.toLocaleTimeString("en-PK", { hour:"2-digit", minute:"2-digit", hour12:true });
              return (
                <tr key={`ret-${ri}-${ii}`} style={{ background: "#fef2f2" }}>
                  <td style={{ padding: "8px 10px", fontSize: 10, color: "#4b5563", whiteSpace: "nowrap" }}>{dtStr}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ display: "inline-block", padding: "1px 7px", borderRadius: 10,
                      fontSize: 8, fontWeight: 700, background: "#fee2e2", color: "#dc2626",
                      border: "1px solid #fca5a5" }}>Return</span>
                  </td>
                  <td style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600 }}>{it.description}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 10 }}>{qtyDisplay}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11 }}>
                    {isVariant ? `Rs. ${Number(it.unitPrice||0).toLocaleString("en-PK")}/${unit}` : `Rs. ${Number(it.unitPrice||0).toLocaleString("en-PK")}`}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#dc2626" }}>
                    - Rs. {lineTotal.toLocaleString("en-PK")}
                  </td>
                </tr>
              );
            })
          )}

          {/* ── Payments ── */}
          {(payments || []).map((p, pi) => {
            const ts = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
            const dtStr = ts.toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" })
              + "  " + ts.toLocaleTimeString("en-PK", { hour:"2-digit", minute:"2-digit", hour12:true });
            const methodLabel = { cash:"💵 Cash", bank:"🏦 Bank", cheque:"📄 Cheque", easypaisa:"📱 EasyPaisa", jazzcash:"📱 JazzCash" }[p.method] || p.method || "Cash";
            const detail = [p.payerName && `By: ${p.payerName}`, p.receiverName && `To: ${p.receiverName}`, p.payerContact && p.payerContact].filter(Boolean).join("  ·  ");
            return (
              <tr key={`pay-${pi}`} style={{ background: "#eff6ff" }}>
                <td style={{ padding: "8px 10px", fontSize: 10, color: "#4b5563", whiteSpace: "nowrap" }}>{dtStr}</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ display: "inline-block", padding: "1px 7px", borderRadius: 10,
                    fontSize: 8, fontWeight: 700, background: "#dbeafe", color: "#1d4ed8",
                    border: "1px solid #bfdbfe" }}>Payment</span>
                </td>
                <td style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600 }}>
                  {methodLabel}
                  {detail && <div style={{ fontSize: 9, color: "#6b7280", marginTop: 1 }}>{detail}</div>}
                  {p.note && <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 1 }}>{p.note}</div>}
                </td>
                <td colSpan={2} style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, color: "#6b7280" }}>
                  {p.payDate || ""}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#1d4ed8" }}>
                  - Rs. {(Number(p.amount) || 0).toLocaleString("en-PK")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals Summary */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <div style={{ minWidth: 300, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 18px" }}>
          {[
            ["Order Amount",         `Rs. ${orderAmt.toLocaleString("en-PK")}`,          "#111"],
            ...(totalReceipts > 0 ? [["+ Additional Purchases", `Rs. ${totalReceipts.toLocaleString("en-PK")}`, "#15803d"]] : []),
            ...(totalReturns  > 0 ? [["− Goods Return",         `Rs. ${totalReturns.toLocaleString("en-PK")}`,  "#dc2626"]] : []),
          ].map(([k, v, c]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11 }}>
              <span style={{ color: "#6b7280" }}>{k}</span>
              <span style={{ fontWeight: 700, color: c }}>{v}</span>
            </div>
          ))}
          <div style={{ height: 1, background: "#e5e7eb", margin: "7px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 900, marginBottom: 8 }}>
            <span style={{ color: "#92400e" }}>GROSS TOTAL</span>
            <span style={{ color: "#d97706" }}>Rs. {grossTotal.toLocaleString("en-PK")}</span>
          </div>
          {totalPaid > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
              <span style={{ color: "#6b7280" }}>− Amount Paid</span>
              <span style={{ fontWeight: 700, color: "#16a34a" }}>Rs. {totalPaid.toLocaleString("en-PK")}</span>
            </div>
          )}
          <div style={{ height: 1, background: "#e5e7eb", margin: "7px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 900 }}>
            <span style={{ color: balance > 0 ? "#dc2626" : "#16a34a" }}>
              {balance > 0 ? "BALANCE DUE" : "CLEARED ✓"}
            </span>
            <span style={{ color: balance > 0 ? "#dc2626" : "#16a34a" }}>
              Rs. {balance.toLocaleString("en-PK")}
            </span>
          </div>
        </div>
      </div>

      {/* Note */}
      {order.note && (
        <div style={{ padding: "10px 14px", background: "#f9fafb", border: "1px solid #e5e7eb",
          borderRadius: 8, marginBottom: 20, fontSize: 11, color: "#4b5563" }}>
          <span style={{ fontWeight: 700 }}>Note: </span>{order.note}
        </div>
      )}

      {/* Footer */}
      <div style={{ position: "absolute", bottom: 32, left: 52, right: 52 }}>
        <div style={{ height: 1, background: "linear-gradient(to right,#f59e0b,#d97706,#92400e)", marginBottom: 12 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#9ca3af" }}>
          <div>
            <div style={{ color: "#d97706", fontWeight: 800, fontSize: 12 }}>Novexa ERP</div>
            <div style={{ marginTop: 1 }}>Smart Business Management</div>
          </div>
          <div style={{ textAlign: "center" }}>Purchase Order · {num}</div>
          <div style={{ textAlign: "right" }}>
            <div>Generated: {generatedOn}</div>
            <div style={{ marginTop: 1 }}>Powered by Novexa ERP</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Purchase Order View Modal ─────────────────────────────────────────────────
function PurchaseOrderViewModal({ order, supplier, userDoc = {}, receipts, returns, payments, onClose }) {
  const printRef     = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [scale,   setScale]   = useState(1);

  useEffect(() => {
    function updateScale() {
      if (!containerRef.current) return;
      setScale(Math.min(1, containerRef.current.clientWidth / 794));
    }
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  async function downloadPDF() {
    if (!printRef.current || loading) return;
    setLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF       = (await import("jspdf")).default;
      const canvas = await html2canvas(printRef.current, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, width: 794,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
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
      const num = `PO-${(order.id || "").slice(-4).toUpperCase()}`;
      pdf.save(`${num}-${supplier.name.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) { alert("PDF failed: " + err.message); }
    setLoading(false);
  }

  function printOrder() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank", "width=900,height=700");
    w.document.write(`<!DOCTYPE html><html><head><title>Purchase Order</title>
      <style>body{margin:0;padding:0;background:#fff;}</style>
      </head><body>${content}</body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  }

  function shareWhatsApp() {
    const num       = `PO-${(order.id || "").slice(-4).toUpperCase()}`;
    const balance   = Number(order.balance) || 0;
    const totalPaid = Number(order.paidAmount) || 0;
    const receiptsTotal = (receipts || []).reduce((s, r) => s + (Number(r.receiptTotal) || 0), 0);
    const returnsTotal  = (returns  || []).reduce((s, r) => s + (Number(r.returnTotal)  || 0), 0);
    const origItems = (order.items || []).reduce((s, it) => {
      const effQty = (!it.hasVariant || it.variantType === "none")
        ? (Number(it.qty) || 1)
        : (Number(it.variantQty) || 0) * (Number(it.qty) || 1);
      return s + effQty * (Number(it.unitPrice) || 0);
    }, 0);
    const grossTotal = origItems + receiptsTotal;
    const text = encodeURIComponent(
      `*Purchase Order ${num}*\nSupplier: ${supplier.name}\n\n` +
      `📦 Items:\n${(order.items || []).map(it => `  • ${it.description}`).join("\n")}\n\n` +
      `💰 Gross Total: *Rs. ${grossTotal.toLocaleString("en-PK")}*\n` +
      (totalPaid > 0 ? `✅ Paid: *Rs. ${totalPaid.toLocaleString("en-PK")}*\n` : "") +
      (returnsTotal > 0 ? `↩ Returns: *Rs. ${returnsTotal.toLocaleString("en-PK")}*\n` : "") +
      `⏳ Balance: *Rs. ${balance.toLocaleString("en-PK")}*\n\n` +
      `— ${userDoc?.business || userDoc?.name || "Novexa ERP"}`
    );
    window.open(`https://wa.me/${(supplier.phone || "").replace(/[^0-9]/g, "")}?text=${text}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-2 sm:p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-[820px] mx-auto my-2 sm:my-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
          <h3 className="text-white font-bold text-sm sm:text-base truncate max-w-[60%]">
            📄 PO-{(order.id || "").slice(-4).toUpperCase()} · {supplier.name}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={shareWhatsApp}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:scale-105 transition-all"
              style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25D366" }}>
              💬 WA
            </button>
            <button onClick={printOrder}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:scale-105 transition-all"
              style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
              🖨️
            </button>
            <button onClick={downloadPDF} disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold hover:scale-105 transition-all"
              style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000", opacity: loading ? 0.7 : 1 }}>
              {loading ? "⏳..." : "⬇️ PDF"}
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 text-lg flex-shrink-0">✕</button>
          </div>
        </div>

        {/* PDF Preview — scales on mobile */}
        <div ref={containerRef} style={{ width: "100%", overflow: "hidden", borderRadius: 12, border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
          <div style={{
            width: 794,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            marginBottom: scale < 1 ? `${(scale - 1) * 100}%` : 0,
          }}>
            <div ref={printRef}>
              <PurchaseOrderPDFTemplate
                order={order}
                supplier={supplier}
                userDoc={userDoc}
                receipts={receipts}
                returns={returns}
                payments={payments}
              />
            </div>
          </div>
        </div>
        <p className="text-center text-gray-600 text-xs mt-3">Scroll to preview · Download PDF or share via WhatsApp</p>
      </div>
    </div>
  );
}

// ── Blank Order Form — multi-page, printable ────────────────────────────────
function BlankOrderFormTemplate({ userDoc = {}, formType, totalPages, bw = false }) {
  const hasVariant  = formType === "variant";
  const generatedOn = new Date().toLocaleDateString("en-PK", { day:"2-digit", month:"long", year:"numeric" });
  const cols = hasVariant
    ? ["Item / Description", "Variant Type", "Size / Unit", "Units", "Total Qty", "Unit Price", "Total Amount"]
    : ["Item / Description", "Qty", "Unit Price", "Total Amount"];

  // Color palette — switches between color and B&W
  const accent     = bw ? "#000"    : "#b45309";
  const accentBg   = bw ? "#eee"    : "#fff8e1";
  const accentText = bw ? "#000"    : "#7c2d12";
  const headBg     = bw ? "#222"    : "#b45309";
  const borderMid  = bw ? "#444"    : "#999";
  const borderDark = bw ? "#000"    : "#555";
  const textMid    = bw ? "#222"    : "#333";
  const textSub    = bw ? "#444"    : "#444";
  const sectionBg  = bw ? "#f0f0f0" : "#f9f9f9";
  const sectionBdr = bw ? "#666"    : "#bbb";
  const greenBdr   = bw ? "#444"    : "#4d7a5a";
  const greenBg    = bw ? "#f0f0f0" : "#f0fdf4";
  const greenText  = bw ? "#000"    : "#14532d";

  const rowsP1   = 15;
  const rowsMid  = 20;
  const rowsLast = 11;

  // Header component (rendered on every page)
  function PageHeader({ pageNum }) {
    return (
      <div>
        <div style={{ height: 5, marginBottom: 10 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            {userDoc?.logoDataUrl && (
              <img src={userDoc.logoDataUrl} alt="Logo"
                style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8, border: `1px solid ${borderDark}` }} />
            )}
            <div>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#000", lineHeight: 1.1 }}>
                {userDoc?.business || userDoc?.name || "Your Business"}
              </div>
              {userDoc?.phone   && <div style={{ fontSize: 9, color: textMid, marginTop: 1 }}>📞 {userDoc.phone}</div>}
              {userDoc?.email   && <div style={{ fontSize: 9, color: textMid }}>✉️ {userDoc.email}</div>}
              {userDoc?.website && <div style={{ fontSize: 9, color: textMid }}>🌐 {userDoc.website}</div>}
              {userDoc?.address && <div style={{ fontSize: 9, color: textMid }}>📍 {userDoc.address}</div>}
            </div>
          </div>
          <div style={{ textAlign: "right", paddingRight: "10px" }}>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-1.5px", color: accent, lineHeight: 1.1 }}>ORDER FORM</div>
            <div style={{ fontSize: 9, color: textSub, marginTop: 2 }}>
              {hasVariant ? "Variant / Measurement Order" : "Standard Order Form"}
            </div>
            <div style={{ marginTop: 4, display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center" }}>
              <span style={{ padding: "2px 10px", borderRadius: 20, background: accentBg,
                border: `1px solid ${accent}`, fontSize: 8, color: accentText, fontWeight: 700 }}>
                {hasVariant ? "📦 WITH VARIANTS" : "📋 STANDARD"}
              </span>
              <span style={{ fontSize: 9, color: textMid }}>Page {pageNum} / {totalPages}</span>
            </div>
          </div>
        </div>
        <div style={{ height: 2, background: accent, marginBottom: 10 }} />
      </div>
    );
  }

  // Footer component — sits at bottom of flex column, no overlap
  function PageFooter({ pageNum }) {
    return (
      <div style={{ marginTop: "auto", paddingTop: 6 }}>
        <div style={{ height: 1.5, background: accent, marginBottom: 5 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: accent }}>Novexa ERP</div>
            <div style={{ fontSize: 8, color: textSub }}>Smart Business Management — novexa.app</div>
          </div>
          <div style={{ textAlign: "center", fontSize: 8, color: textSub }}>
            <div>This form was generated by Novexa ERP</div>
            <div>Print · Fill · Sign · File</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 8, color: textSub }}>
            <div>Generated: {generatedOn}</div>
            <div>Page {pageNum} of {totalPages} · © Novexa</div>
          </div>
        </div>
      </div>
    );
  }

  // Table header row
  function TableHead() {
    return (
      <tr style={{ background: headBg, color: "#fff" }}>
        <th style={{ padding: "5px 5px", fontSize: 9, fontWeight: 800, textTransform: "uppercase",
          letterSpacing: "0.04em", textAlign: "center", width: 22 }}>#</th>
        {cols.map((h, i) => (
          <th key={h} style={{ padding: "5px 7px", fontSize: 9, fontWeight: 800, textTransform: "uppercase",
            letterSpacing: "0.04em", textAlign: i === 0 ? "left" : "right" }}>{h}</th>
        ))}
      </tr>
    );
  }

  // Blank item rows
  function ItemRows({ from, count, shade }) {
    return Array.from({ length: count }).map((_, i) => (
      <tr key={i} style={{ background: "#fff", borderBottom: `1px solid ${borderMid}` }}>
        <td style={{ padding: "6px 5px", textAlign: "center", fontSize: 10, color: "#000", fontWeight: 700 }}>{from + i + 1}</td>
        {cols.map((_, ci) => (
          <td key={ci} style={{ padding: "6px 5px", borderLeft: `1px solid ${borderMid}` }} />
        ))}
      </tr>
    ));
  }

  // Page subtotal row (on every page)
  function PageSubtotal() {
    return (
      <tr style={{ background: "#f5f5f5", borderTop: `2px solid ${borderDark}` }}>
        <td colSpan={cols.length} style={{ padding: "5px 7px", textAlign: "right",
          fontSize: 9, fontWeight: 800, color: "#111", textTransform: "uppercase",
          letterSpacing: "0.05em", borderLeft: `1px solid ${borderMid}` }}>
          Page Subtotal
        </td>
        <td style={{ padding: "5px 7px", borderLeft: `2px solid ${accent}`, width: 110 }} />
      </tr>
    );
  }

  // Build pages array
  const pages = [];
  for (let p = 0; p < totalPages; p++) {
    pages.push(p + 1);
  }

  const pageStyle = {
    width: 794, height: 1123, minHeight: 1123, background: "#fff", color: "#000",
    fontSize: 13, padding: "10px 25px 10px 20px", boxSizing: "border-box",
    display: "flex", flexDirection: "column", overflow: "hidden",
  };

  // Gradient border wrapper — screen only, stripped on print
  const pageBorderStyle = {
    background: "linear-gradient(135deg, #f59e0b, #6366f1, #8b5cf6, #f59e0b)",
    padding: "3px",
    borderRadius: 6,
    // marginBottom: 6,
  };

  return (
    <div>
      {pages.map(pageNum => {
        const isFirst = pageNum === 1;
        const isLast  = pageNum === totalPages;
        const isMid   = !isFirst && !isLast;
        const rowCount = isFirst ? rowsP1 : isLast ? rowsLast : rowsMid;
        const rowStart = isFirst ? 0
          : rowsP1 + (pageNum - 2) * rowsMid;

        return (
          <div key={pageNum} style={pageBorderStyle}>
            <div style={{
              ...pageStyle,
              pageBreakAfter: isLast ? "avoid" : "always",
              breakAfter: isLast ? "avoid" : "page",
            }}>
            <PageHeader pageNum={pageNum} />

            {/* ── First page only: meta + supplier section ── */}
            {isFirst && (
              <>
                {/* Order meta */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  {[["ORDER DATE","DD / MM / YYYY"],["ORDER REF #",""],["DELIVERY DATE","DD / MM / YYYY"]].map(([lbl, ph]) => (
                    <div key={lbl}>
                      <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#111",
                        letterSpacing: "0.06em", marginBottom: 2 }}>{lbl}</div>
                      <div style={{ borderBottom: `1.5px solid ${borderDark}`, height: 24, display: "flex",
                        alignItems: "flex-end", paddingBottom: 2, fontSize: 10, color: "#888" }}>{ph}</div>
                    </div>
                  ))}
                </div>
                {/* Supplier + Notes */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12,
                  padding: "10px 14px", background: sectionBg, border: `1px solid ${sectionBdr}`, borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: accent,
                      letterSpacing: "0.07em", marginBottom: 6 }}>SUPPLIER / PARTY DETAILS</div>
                    {["Name","Shop / Company","Phone","Email","Address"].map(lbl => (
                      <div key={lbl} style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 10, color: "#111", fontWeight: 600, minWidth: 80, flexShrink: 0 }}>{lbl}:</span>
                        <div style={{ flex: 1, borderBottom: `1.5px solid ${borderDark}`, height: 18 }} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#222",
                      letterSpacing: "0.07em", marginBottom: 6 }}>NOTES / SPECIAL INSTRUCTIONS</div>
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} style={{ borderBottom: `1px solid ${borderMid}`, height: 18, marginBottom: 3 }} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── Items table (all pages) ── */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0, flex: isLast ? undefined : 1 }}>
              <thead><TableHead /></thead>
              <tbody>
                <ItemRows from={rowStart} count={rowCount} />
                <PageSubtotal />
              </tbody>
            </table>

            {/* ── Last page only: grand total + payment + signatures ── */}
            {isLast && (
              <>
                {/* Grand total rows */}
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
                  <tbody>
                    {[["SUBTOTAL",""],["DISCOUNT",""],["GRAND TOTAL","grand"]].map(([lbl, type]) => (
                      <tr key={lbl} style={{ background: type === "grand" ? accentBg : "#fff",
                        borderBottom: `1px solid ${borderMid}` }}>
                        <td colSpan={cols.length} style={{ padding: "6px 8px", textAlign: "right",
                          fontSize: type === "grand" ? 12 : 10, fontWeight: type === "grand" ? 900 : 700,
                          color: type === "grand" ? accent : "#111",
                          borderLeft: `1px solid ${type === "grand" ? accent : borderMid}` }}>
                          {lbl}
                        </td>
                        <td style={{ padding: "6px 8px", width: 110,
                          borderLeft: `2px solid ${type === "grand" ? accent : borderDark}`,
                          borderBottom: type === "grand" ? `2px solid ${accent}` : undefined }} />
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Payment + Terms */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div style={{ padding: "8px 12px", background: greenBg, border: `1px solid ${greenBdr}`, borderRadius: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: greenText,
                      letterSpacing: "0.07em", marginBottom: 6 }}>PAYMENT DETAILS</div>
                    {["Payment Method","Amount Paid","Remaining Balance","Payment Date"].map(lbl => (
                      <div key={lbl} style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 10, color: "#111", fontWeight: 600, minWidth: 110, flexShrink: 0 }}>{lbl}:</span>
                        <div style={{ flex: 1, borderBottom: `1.5px solid ${greenBdr}`, height: 18 }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "8px 12px", background: "#fff", border: `1px solid ${sectionBdr}`, borderRadius: 8 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#222",
                      letterSpacing: "0.07em", marginBottom: 6 }}>TERMS & CONDITIONS</div>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ borderBottom: `1px solid ${borderMid}`, height: 19, marginBottom: 3 }} />
                    ))}
                  </div>
                </div>

                {/* Signatures */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 8 }}>
                  {["Ordered By","Authorized By","Received By"].map(lbl => (
                    <div key={lbl} style={{ textAlign: "center" }}>
                      <div style={{ borderBottom: `2px solid #111`, height: 34, marginBottom: 5 }} />
                      <div style={{ fontSize: 10, color: "#111", fontWeight: 700 }}>{lbl}</div>
                      <div style={{ fontSize: 9, color: "#555", marginTop: 1 }}>Signature / Name / Date</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <PageFooter pageNum={pageNum} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Order Form View (full dashboard page — no modal) ─────────────────────────
export function OrderFormView({ userDoc = {} }) {
  const printRef     = useRef(null);
  const containerRef = useRef(null);
  const [formType, setFormType] = useState("plain");
  const [pages,    setPages]    = useState(5);
  const [loading,  setLoading]  = useState(false);
  const [scale,    setScale]    = useState(1);
  const [bw,       setBw]       = useState(false);

  const PAGE_OPTIONS = [5, 10, 25, 50];

  // Scale preview to fit container
  useEffect(() => {
    function updateScale() {
      if (!containerRef.current) return;
      const available = containerRef.current.clientWidth - 4; // minus border
      setScale(Math.min(1, available / 794));
    }
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  async function downloadPDF() {
    if (!printRef.current || loading) return;
    setLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF       = (await import("jspdf")).default;
      // printRef → BlankOrderFormTemplate outer div → its children are per-page wrapper divs
      const templateRoot = printRef.current.firstElementChild;
      const pageWrappers = templateRoot ? templateRoot.children : printRef.current.children;
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < pageWrappers.length; i++) {
        // each pageWrapper is the gradient border div; firstElementChild is the actual white page
        const pageEl = pageWrappers[i].firstElementChild || pageWrappers[i];
        const canvas = await html2canvas(pageEl, {
          scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, width: 794,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const imgH = (canvas.height / canvas.width) * pdfW;
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pdfW, Math.min(imgH, pdfH));
      }
      pdf.save(`Order-Form-${pages}pg-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) { alert("PDF failed: " + err.message); }
    setLoading(false);
  }

  function printForm() {
    if (!printRef.current) return;

    // Navigate: printRef → BlankOrderFormTemplate outer div → per-page gradient wrappers
    const templateRoot = printRef.current.firstElementChild;
    const pageWrappers = templateRoot
      ? Array.from(templateRoot.children)
      : Array.from(printRef.current.children);

    // Extract only the actual white page div (firstElementChild of each gradient wrapper)
    const pagesHTML = pageWrappers.map((wrapper, i) => {
      const page = wrapper.firstElementChild || wrapper;
      const isLast = i === pageWrappers.length - 1;
      // Clone and override styles for clean print
      const clone = page.cloneNode(true);
      clone.style.cssText = [
        "width:794px",
        "height:1123px",
        "min-height:1123px",
        "max-height:1123px",
        "padding:0 25px 70px 10px",
        "margin:0",
        "overflow:hidden",
        "background:#fff",
        "color:#111",
        "font-size:13px",
        "box-sizing:border-box",
        "display:flex",
        "flex-direction:column",
        "position:relative",
        isLast ? "page-break-after:avoid;break-after:avoid" : "page-break-after:always;break-after:page",
      ].join(";");
      return clone.outerHTML;
    }).join("\n");

    const w = window.open("", "_blank", "width=900,height=900");
    w.document.write(`<!DOCTYPE html>
<html><head><title>Order Form</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  @page { size: A4 portrait; margin: 0; }
  @media print {
    html, body { width: 794px; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
    .print-page { page-break-after: always; break-after: page; }
    .print-page:last-child { page-break-after: avoid; break-after: avoid; }
  }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
</style>
</head><body>${pagesHTML}</body></html>`);

    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 600);
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-xl p-6"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(245,158,11,0.2)" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/8 via-orange-500/5 to-purple-600/8" />
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 via-orange-500 to-purple-500" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-1" style={{
              background: "linear-gradient(135deg,#f59e0b,#d97706,#a78bfa)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
            }}>📋 Order Form</h2>
            <p className="text-gray-400 text-xs">Generate blank order forms to print, fill by hand, sign &amp; file</p>
          </div>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Form type */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {[["plain","📋 Standard"],["variant","📦 Variants"]].map(([v, lbl]) => (
                <button key={v} onClick={() => setFormType(v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: formType === v ? "linear-gradient(135deg,#f59e0b,#d97706)" : "transparent",
                    color: formType === v ? "#000" : "#9ca3af"
                  }}>{lbl}</button>
              ))}
            </div>
            {/* Pages */}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-xs">Pages:</span>
              <div className="flex gap-1">
                {PAGE_OPTIONS.map(p => (
                  <button key={p} onClick={() => setPages(p)}
                    className="w-8 h-7 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: pages === p ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.05)",
                      color: pages === p ? "#fff" : "#9ca3af",
                      border: `1px solid ${pages === p ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`
                    }}>{p}</button>
                ))}
                <input type="number" inputMode="numeric" min="1" max="100" value={pages}
                  onChange={e => setPages(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  className="w-14 h-7 rounded-lg text-xs text-center text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} />
              </div>
            </div>
            {/* Action buttons */}
            <button onClick={printForm}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold hover:scale-105 transition-all"
              style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
              🖨️ Print
            </button>
            <button onClick={downloadPDF} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold hover:scale-105 transition-all"
              style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000", opacity: loading ? 0.7 : 1 }}>
              {loading ? "⏳ Generating..." : "⬇️ Download PDF"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Info chips + Print Mode toggle ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Info chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { icon: "📄", text: `${pages} pages` },
            { icon: "✏️", text: "Fill by hand" },
            { icon: "🖊️", text: "Sign & file" },
            { icon: formType === "variant" ? "📦" : "📋", text: formType === "variant" ? "With Variants" : "Standard" },
          ].map((chip, i) => (
            <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#d97706" }}>
              {chip.icon} {chip.text}
            </span>
          ))}
        </div>

        {/* Print mode selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold" style={{ color: "#9ca3af" }}>Print Mode:</span>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <button onClick={() => setBw(false)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: !bw ? "linear-gradient(135deg,#f59e0b,#d97706)" : "transparent",
                color: !bw ? "#000" : "#9ca3af",
                boxShadow: !bw ? "0 2px 8px rgba(245,158,11,0.3)" : "none"
              }}>
              🎨 Color Print
            </button>
            <button onClick={() => setBw(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: bw ? "linear-gradient(135deg,#444,#111)" : "transparent",
                color: bw ? "#fff" : "#9ca3af",
                boxShadow: bw ? "0 2px 8px rgba(0,0,0,0.4)" : "none"
              }}>
              🖤 B&W Print
            </button>
          </div>
          <span className="text-xs" style={{ color: bw ? "#9ca3af" : "rgba(245,158,11,0.7)" }}>
            {bw ? "Black & White — saves ink" : "Color — orange highlights"}
          </span>
        </div>
      </div>

      {/* ── Form Preview ── */}
      {/* measureRef: full width div to measure available space */}
      <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
        {/* gradient border wrapper — exactly as wide as the scaled form */}
        <div style={{
          background: "linear-gradient(135deg,#f59e0b,#6366f1,#8b5cf6)",
          padding: "2px",
          borderRadius: 14,
          width: scale < 1 ? `${794 * scale + 4}px` : "794px",
          overflow: "hidden",
        }}>
          <div style={{ background: "#0d1117", borderRadius: 12, overflow: "hidden" }}>
            <div style={{
              width: 794,
              transformOrigin: "top left",
              transform: `scale(${scale})`,
              marginBottom: scale < 1 ? `${1123 * pages * (scale - 1)}px` : 0,
            }}>
              <div ref={printRef}>
                <BlankOrderFormTemplate userDoc={userDoc} formType={formType} totalPages={pages} bw={bw} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-gray-600 text-xs pb-4">
        {pages} page form · Print &amp; fill by hand · Sign &amp; file
      </p>
    </div>
  );
}

// ── Order Form Modal ──────────────────────────────────────────────────────────
export function OrderFormModal({ order, userDoc = {}, onClose }) {
  const printRef      = useRef(null);
  const containerRef  = useRef(null);
  const innerRef      = useRef(null);
  const [formType, setFormType] = useState("plain");
  const [pages,    setPages]    = useState(5);
  const [loading,  setLoading]  = useState(false);
  const [scale,    setScale]    = useState(1);

  const PAGE_OPTIONS = [5, 10, 25, 50];

  // Scale the 794px-wide page to fit the container width
  useEffect(() => {
    function updateScale() {
      if (!containerRef.current) return;
      const available = containerRef.current.clientWidth;
      const s = Math.min(1, available / 794);
      setScale(s);
    }
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  async function downloadPDF() {
    if (!printRef.current || loading) return;
    setLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF       = (await import("jspdf")).default;
      // Render each page separately to handle multi-page correctly
      // Each child is the gradient border wrapper; inner div (firstElementChild) is the actual page
      const pageWrappers = printRef.current.children;
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      for (let i = 0; i < pageWrappers.length; i++) {
        const pageEl = pageWrappers[i].firstElementChild || pageWrappers[i];
        const canvas = await html2canvas(pageEl, {
          scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, width: 794,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const imgH = (canvas.height / canvas.width) * pdfW;
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pdfW, Math.min(imgH, pdfH));
      }
      pdf.save(`Order-Form-${pages}pg-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) { alert("PDF failed: " + err.message); }
    setLoading(false);
  }

  function printForm() {
    if (!printRef.current) return;

    const w = window.open("", "_blank", "width=900,height=900");
    w.document.write(`<!DOCTYPE html>
<html><head><title>Order Form</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  
  @page { 
    size: A4 portrait; 
    margin: 0; 
  }
  
  .print-page {
    position: relative;
    width: 794px;
    height: 1123px;
    min-height: 1123px;
    max-height: 1123px;
    overflow: hidden;
    background: #fff;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
    padding: 0 52px 70px 52px;
    margin: 0;
    display: block;
  }
  
  .print-page:last-child {
    page-break-after: avoid;
    break-after: avoid;
  }
  
  /* Table rules */
  table {
    width: 100%;
    border-collapse: collapse;
    page-break-inside: auto;
  }
  
  thead {
    display: table-header-group;
  }
  
  tbody tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
</style>
</head><body></body></html>`);

    const doc = w.document;
    doc.close();
    
    // Extract and add pages with proper class
    const pageWrappers = Array.from(printRef.current.children);
    pageWrappers.forEach((wrapper, idx) => {
      const page = wrapper.firstElementChild;
      if (page) {
        const clonedPage = page.cloneNode(true);
        clonedPage.className = 'print-page';
        // Preserve inline flex styles but remove pageBreak inline styles
        // (they'll be handled by CSS class)
        doc.body.appendChild(clonedPage);
      }
    });
    
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 800);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-2 sm:p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}>
      <div className="w-full my-2 sm:my-4" style={{ maxWidth: 820 }}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-white font-bold text-base">📋 Order Form</h3>
            {/* Form type */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              {[["plain","📋 Standard"],["variant","📦 Variants"]].map(([v, lbl]) => (
                <button key={v} onClick={() => setFormType(v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: formType === v ? "linear-gradient(135deg,#f59e0b,#d97706)" : "transparent",
                    color: formType === v ? "#000" : "#9ca3af" }}>{lbl}</button>
              ))}
            </div>
            {/* Pages selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-xs">Pages:</span>
              <div className="flex gap-1">
                {PAGE_OPTIONS.map(p => (
                  <button key={p} onClick={() => setPages(p)}
                    className="w-8 h-7 rounded-lg text-xs font-bold transition-all"
                    style={{ background: pages === p ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.06)",
                      color: pages === p ? "#fff" : "#9ca3af",
                      border: `1px solid ${pages === p ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}` }}>
                    {p}
                  </button>
                ))}
                {/* Custom input */}
                <input type="number" inputMode="numeric" min="1" max="100" value={pages}
                  onChange={e => setPages(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  className="w-14 h-7 rounded-lg text-xs text-center text-white outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={printForm}
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

        {/* Form Preview */}
        <div style={{
          background: "linear-gradient(135deg,#f59e0b,#6366f1,#8b5cf6)",
          padding: "2px", borderRadius: 14, overflow: "hidden"
        }}>
          <div style={{ background: "#111", borderRadius: 12, overflow: "hidden" }}>
            <div ref={containerRef} style={{ width: "100%", overflow: "hidden" }}>
              <div style={{
                width: 794,
                transformOrigin: "top left",
                transform: `scale(${scale})`,
                marginBottom: scale < 1 ? `${1123 * pages * (scale - 1)}px` : 0,
              }}>
                <div ref={printRef}>
                  <BlankOrderFormTemplate userDoc={userDoc} formType={formType} totalPages={pages} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-gray-600 text-xs mt-3">
          {pages} page form · Print &amp; fill by hand · Sign &amp; file
        </p>
      </div>
    </div>
  );
}

// ── Supplier History PDF Template ─────────────────────────────────────────────
// NOTE: This function is defined later in the file at line 1801

// ── Supplier History PDF Template ─────────────────────────────────────────────
function SupplierHistoryTemplate({ supplier, orders, payments, receipts, returns, userDoc = {} }) {
  const timeline = [];
  orders.forEach(o => {
    const date = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
    timeline.push({ type: "order", date, data: o });
  });
  payments.forEach(p => {
    const date = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
    timeline.push({ type: "payment", date, data: p });
  });
  (receipts || []).forEach(r => {
    const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
    timeline.push({ type: "receipt", date, data: r });
  });
  (returns || []).forEach(r => {
    const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
    timeline.push({ type: "return", date, data: r });
  });
  timeline.sort((a, b) => b.date - a.date);

  // totalOrdered = original order amounts + additional purchases (receipts)
  // Returns are NOT subtracted — they affect balance, not total purchased amount
  const totalOrdered  = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0)
                      + (receipts || []).reduce((s, r) => s + (Number(r.receiptTotal) || 0), 0);
  const totalPaid     = orders.reduce((s, o) => s + (Number(o.paidAmount) || 0), 0);
  const totalBalance  = orders.reduce((s, o) => s + (Number(o.balance) || 0), 0);
  const generatedOn   = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div style={{ width: 794, minHeight: 1123, background: "#fff", color: "#111",
      fontSize: 13, padding: "48px 52px",
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
      {/* Timeline Table — same ledger flow as CustomerHistoryPDF */}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "24px" }} />
          <col style={{ width: "110px" }} />
          <col style={{ width: "72px" }} />
          <col style={{ width: "auto" }} />
          <col style={{ width: "80px" }} />
          <col style={{ width: "70px" }} />
          <col style={{ width: "78px" }} />
          <col style={{ width: "68px" }} />
          <col style={{ width: "78px" }} />
          <col style={{ width: "62px" }} />
        </colgroup>
        <thead>
          <tr style={{ background: "#d97706", color: "#fff" }}>
            {["#", "Date & Time", "Type", "Reference / Items", "Amount", "Paid", "Purchased", "Return", "Balance", "Status"].map((h, i) => (
              <th key={h} style={{
                padding: "9px 7px",
                textAlign: i === 0 ? "center" : i >= 4 ? "right" : "left",
                fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
                textTransform: "uppercase", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeline.map((item, idx) => {
            const isOrder   = item.type === "order";
            const isReceipt = item.type === "receipt";
            const isReturn  = item.type === "return";
            const isPayment = item.type === "payment";
            const d         = item.data;

            const ref = isOrder
              ? `PO-${(d.id || "").slice(-4).toUpperCase()}`
              : `PO-${(d.orderId || "").slice(-4).toUpperCase()}`;

            const itemsStr = isOrder && d.items?.length > 0
              ? d.items.map(it => `${it.description} ×${it.qty}`).join(", ")
              : isReceipt && d.items?.length > 0
                ? d.items.map(it => `${it.description} ×${it.qty}`).join(", ")
                : isReturn && d.items?.length > 0
                  ? d.items.map(it => `${it.description} ×${it.qty}`).join(", ")
                  : isPayment && d.method ? `via ${d.method}` : "";

            // AMOUNT — for order rows: always compute from the frozen items array (ignores any
            // mutated totalAmount/initialAmount fields from old data).
            const orderOriginalAmount = (() => {
              if (!isOrder) return null;
              if (!d.items?.length) return Number(d.initialAmount ?? d.totalAmount) || 0;
              const sub  = d.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
              const disc = d.discountType === "percent"
                ? sub * (Number(d.discountValue) || 0) / 100
                : (Number(d.discountValue) || 0);
              return Math.max(sub - disc, 0);
            })();

            const amountVal = isOrder   ? orderOriginalAmount
                            : isReceipt ? (Number(d.balanceBefore) || 0)
                            : isReturn  ? (Number(d.balanceBefore) || 0)
                            : (d.balanceBefore != null ? Number(d.balanceBefore) : null);

            // PAID column
            const paidVal = isOrder   ? (d.initialPaidAmount != null ? Number(d.initialPaidAmount) : 0)
                          : isPayment ? (Number(d.amount) || 0)
                          : null;

            // PURCHASED column (receipt only)
            const purchasedVal = isReceipt ? (Number(d.receiptTotal) || 0) : null;

            // RETURN column (return only, shown in Purchased cell with minus)
            const returnVal = isReturn ? (Number(d.returnTotal) || 0) : null;

            // BALANCE = closing balance after this event
            // For order rows: use the frozen original amount minus initial payment
            const initPaid = d.initialPaidAmount != null ? Number(d.initialPaidAmount) : 0;
            const balVal = isOrder   ? Math.max(0, (orderOriginalAmount ?? 0) - initPaid)
                         : isReceipt ? (Number(d.balanceAfter) || 0)
                         : isReturn  ? (Number(d.balanceAfter) || 0)
                         : isPayment ? (Number(d.balanceAfter) || 0)
                         : null;

            // STATUS
            const orderStatus = isOrder
              ? (balVal <= 0 ? "Paid" : initPaid > 0 ? "Partial" : "Pending")
              : null;
            const rowStatus = isOrder   ? orderStatus
                            : isReceipt ? "Purchased"
                            : isReturn  ? "Return"
                            : "Payment";

            const sBg    = { Paid: "#dcfce7", Partial: "#fef3c7", Pending: "#fee2e2", Payment: "#eff6ff", Purchased: "#f0fdf4", Return: "#fef2f2" }[rowStatus] || "#f3f4f6";
            const sColor = { Paid: "#16a34a", Partial: "#d97706", Pending: "#dc2626", Payment: "#1d4ed8", Purchased: "#15803d", Return: "#dc2626" }[rowStatus] || "#374151";

            const typeLabel = isOrder ? "🛒 Order" : isReceipt ? "Purchased" : isReturn ? "↩ Return" : "Payment";
            const typeBg    = isOrder ? "#fffbeb" : isReceipt ? "#f0fdf4" : isReturn ? "#fef2f2" : "#eff6ff";
            const typeColor = isOrder ? "#b45309" : isReceipt ? "#15803d" : isReturn ? "#dc2626" : "#1d4ed8";
            const typeBdr   = isOrder ? "#fde68a" : isReceipt ? "#86efac" : isReturn ? "#fca5a5" : "#bfdbfe";

            return (
              <tr key={idx} style={{ background: idx % 2 === 0 ? "#f9fafb" : "#fff" }}>
                <td style={{ padding: "8px 7px", textAlign: "center", color: "#9ca3af", fontSize: 11, verticalAlign: "middle" }}>{idx + 1}</td>
                <td style={{ padding: "8px 7px", fontSize: 10, color: "#374151", whiteSpace: "nowrap", verticalAlign: "middle" }}>{fmtDateTime(item.date)}</td>
                <td style={{ padding: "8px 7px", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 12, fontSize: 9, fontWeight: 700,
                    background: typeBg, color: typeColor, border: `1px solid ${typeBdr}`, whiteSpace: "nowrap" }}>{typeLabel}</span>
                </td>
                <td style={{ padding: "8px 7px", fontSize: 10, fontWeight: 600, color: "#111", verticalAlign: "middle", overflow: "hidden" }}>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ref}</div>
                  {itemsStr && <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 400, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{itemsStr}</div>}
                </td>
                {/* AMOUNT — opening balance before this event */}
                <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#111", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                  {amountVal != null ? formatRs(amountVal) : <span style={{ color: "#9ca3af" }}>—</span>}
                </td>
                {/* PAID */}
                <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "middle" }}>
                  {paidVal != null && paidVal > 0
                    ? <span style={{ color: "#16a34a" }}>{formatRs(paidVal)}</span>
                    : <span style={{ color: "#9ca3af" }}>—</span>}
                </td>
                {/* PURCHASED — green, only for receipt rows */}
                <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", verticalAlign: "middle" }}>
                  {purchasedVal != null && purchasedVal > 0
                    ? <span style={{ color: "#15803d" }}>{formatRs(purchasedVal)}</span>
                    : <span style={{ color: "#9ca3af" }}>—</span>}
                </td>
                {/* RETURN — red, only for return rows */}
                <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", verticalAlign: "middle" }}>
                  {returnVal != null && returnVal > 0
                    ? <span style={{ color: "#dc2626" }}>- {formatRs(returnVal)}</span>
                    : <span style={{ color: "#9ca3af" }}>—</span>}
                </td>
                {/* BALANCE — closing balance after this event */}
                <td style={{ padding: "8px 7px", textAlign: "right", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", verticalAlign: "middle" }}>
                  {balVal != null
                    ? (balVal > 0
                        ? <span style={{ color: "#dc2626" }}>{formatRs(balVal)}</span>
                        : <span style={{ color: "#16a34a" }}>Cleared ✓</span>)
                    : <span style={{ color: "#9ca3af" }}>—</span>}
                </td>
                {/* STATUS */}
                <td style={{ padding: "8px 7px", textAlign: "right", verticalAlign: "middle" }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 12,
                    fontSize: 9, fontWeight: 700, background: sBg, color: sColor, whiteSpace: "nowrap" }}>
                    {rowStatus}
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
function SupplierHistoryModal({ supplier, orders, payments, receipts, returns, userDoc = {}, onClose }) {
  const printRef     = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [scale,   setScale]   = useState(1);

  useEffect(() => {
    function updateScale() {
      if (!containerRef.current) return;
      setScale(Math.min(1, containerRef.current.clientWidth / 794));
    }
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

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
    // Returns NOT subtracted — total ordered = how much was purchased, not affected by returns
    const totalOrdered = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0)
                       + (receipts || []).reduce((s, r) => s + (Number(r.receiptTotal) || 0), 0);
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
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-2 sm:p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-[820px] mx-auto my-2 sm:my-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
          <h3 className="text-white font-bold text-sm sm:text-base truncate max-w-[60%]">
            📊 {supplier.name} — Report
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={shareWhatsApp}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:scale-105 transition-all"
              style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25D366" }}>
              💬 WA
            </button>
            <button onClick={printReport}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:scale-105 transition-all"
              style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
              🖨️
            </button>
            <button onClick={downloadPDF} disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold hover:scale-105 transition-all"
              style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000", opacity: loading ? 0.7 : 1 }}>
              {loading ? "⏳..." : "⬇️ PDF"}
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 text-lg flex-shrink-0">✕</button>
          </div>
        </div>
        {/* Preview — scales on mobile */}
        <div ref={containerRef} style={{ width: "100%", overflow: "hidden", borderRadius: 12, border: "1px solid rgba(245,158,11,0.3)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
          <div style={{
            width: 794,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            marginBottom: scale < 1 ? `${(scale - 1) * 100}%` : 0,
          }}>
            <div ref={printRef}>
              <SupplierHistoryTemplate supplier={supplier} orders={orders} payments={payments} receipts={receipts || []} returns={returns || []} userDoc={userDoc} />
            </div>
          </div>
        </div>
        <p className="text-center text-gray-600 text-xs mt-3">Scroll to see full report · Click &quot;Download PDF&quot; to save</p>
      </div>
    </div>
  );
}

// ── Main SupplierDetail Export ────────────────────────────────────────────────
export default function SupplierDetail({ supplier, uid, userDoc = {}, onBack, onEdit, onDelete }) {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editOrder, setEditOrder]     = useState(null);  // {id, form} for edit
  const [savingOrder, setSavingOrder] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState(null);
  const [payOrder, setPayOrder]       = useState(null);  // order to pay
  const [savingPay, setSavingPay]     = useState(false);
  const [returnOrder, setReturnOrder] = useState(null); // order to return goods
  const [savingReturn, setSavingReturn] = useState(false);
  const [showHistory, setShowHistory] = useState(false);   // true = full supplier history
  const [historyOrder, setHistoryOrder] = useState(null);  // specific order history
  const [viewOrder, setViewOrder]       = useState(null);  // order to view as PDF
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [supplierReceipts, setSupplierReceipts] = useState([]);
  const [supplierReturns, setSupplierReturns]   = useState([]);
  const [alert, setAlert]             = useState({ show: false, type: "", title: "", message: "" });
  
  // Email Confirmation Dialog State
  const [emailConfirm, setEmailConfirm] = useState({ show: false, order: null, isUpdate: false });

  // real-time orders listener
  useEffect(() => {
    if (!uid || !supplier.id) return;
    const unsub = onSnapshot(
      query(collection(db, "users", uid, "suppliers", supplier.id, "orders"), orderBy("createdAt", "desc")),
      snap => { setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => !o.deleted)); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [uid, supplier.id]);

  // real-time supplier payments
  useEffect(() => {
    if (!uid || !supplier.id) return;
    const unsub = onSnapshot(
      query(collection(db, "users", uid, "suppliers", supplier.id, "payments")),
      snap => { setSupplierPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
      () => {}
    );
    return () => unsub();
  }, [uid, supplier.id]);

  // real-time supplier receipts (new items added via order edit)
  useEffect(() => {
    if (!uid || !supplier.id) return;
    const unsub = onSnapshot(
      query(collection(db, "users", uid, "suppliers", supplier.id, "receipts")),
      snap => { setSupplierReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
      () => {}
    );
    return () => unsub();
  }, [uid, supplier.id]);

  // real-time supplier returns
  useEffect(() => {
    if (!uid || !supplier.id) return;
    const unsub = onSnapshot(
      query(collection(db, "users", uid, "suppliers", supplier.id, "returns")),
      snap => { setSupplierReturns(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
      () => {}
    );
    return () => unsub();
  }, [uid, supplier.id]);

  // Compute the true original order amount from its items array + discount.
  // This is always correct — items array is frozen at creation, never mutated.
  // We never trust totalAmount or initialAmount fields which may be stale from old data.
  function orderOriginalAmt(o) {
    if (!o.items?.length) return 0;
    const sub  = o.items.reduce((s, it) => s + itemEffectiveQty(it) * (Number(it.unitPrice) || 0), 0);
    const disc = o.discountType === "percent"
      ? sub * (Number(o.discountValue) || 0) / 100
      : (Number(o.discountValue) || 0);
    return Math.max(sub - disc, 0);
  }

  // stats — net purchased = paid + balance (returns already deducted from balance field)
  const totalPaid     = orders.reduce((s, o) => s + (Number(o.paidAmount) || 0), 0);
  const totalBalance  = orders.reduce((s, o) => s + (Number(o.balance) || 0), 0);
  const totalOrdered  = totalPaid + totalBalance; // net after returns
  const totalReturns  = supplierReturns.reduce((s, r) => s + (Number(r.returnTotal) || 0), 0);
  const paidCount     = orders.filter(o => Number(o.balance) <= 0).length;

  // ── Save Purchase Order ────────────────────────────────────────────────────
  async function handleSaveOrder(formData) {
    if (savingOrder) return;
    setSavingOrder(true);
    try {
      // Separate items: truly original order items | past receipt rows (locked, skip on save) | new rows to save
      const originalItems = (formData.items || []).filter(it => !it.isNew && !it.isReceipt);
      const newItems      = (formData.items || []).filter(it => it.isNew && it.description?.trim());

      if (editOrder) {
        // ── EDIT MODE ─────────────────────────────────────────────────────
        // Order totals stay UNCHANGED — we only update dates/note on the order doc
        // New items go into a separate supplierReceipts record
        const cleanOriginalItems = originalItems.map(({ isNew, isReceipt, ...rest }) => rest);

        await updateDoc(doc(db, "users", uid, "suppliers", supplier.id, "orders", editOrder.id), {
          items:     cleanOriginalItems,   // original items only, unchanged
          orderDate: formData.orderDate,
          dueDate:   formData.dueDate || "",
          note:      formData.note || "",
          updatedAt: serverTimestamp(),
        });

        // Save new items as a receipt record (shows as "Received" row in history)
        if (newItems.length > 0) {
          const receiptTotal = newItems.reduce(
            (s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0
          );
          const currentOrder  = orders.find(o => o.id === editOrder.id);
          // Use the stored balance field — it's always kept accurate by payment/return/receipt updates
          const balanceBefore = Number(currentOrder?.balance) || 0;
          const balanceAfter  = balanceBefore + receiptTotal;

          await addDoc(collection(db, "users", uid, "suppliers", supplier.id, "receipts"), {
            supplierId:    supplier.id,
            supplierName:  supplier.name,
            orderId:       editOrder.id,
            orderRef:      `PO-${editOrder.id.slice(-4).toUpperCase()}`,
            items:         newItems.map(({ isNew, isReceipt, ...rest }) => rest),
            receiptTotal,
            balanceBefore,
            balanceAfter,
            createdAt:     serverTimestamp(),
          });

          // Update order balance/status ONLY — totalAmount stays frozen (original order amount never changes)
          const newStatus = balanceAfter <= 0 ? "Paid" : (Number(currentOrder?.paidAmount) || 0) > 0 ? "Partial" : "Pending";
          await updateDoc(doc(db, "users", uid, "suppliers", supplier.id, "orders", editOrder.id), {
            balance:   balanceAfter,
            status:    newStatus,
            updatedAt: serverTimestamp(),
          });
        }

        // Only show alert if no email will be sent
        if (!supplier.email?.trim()) {
          setAlert({ show: true, type: "success", title: "Order Updated! ✓", message: newItems.length > 0 ? `Order updated & ${newItems.length} new receipt(s) recorded.` : "Purchase order updated." });
        }

        // ── Auto-email updated order to supplier ──────────────────────────
        if (supplier.email?.trim()) {
          const currentOrder = orders.find(o => o.id === editOrder.id);
          const updatedOrder = {
            ...currentOrder,
            id:        editOrder.id,
            orderDate: formData.orderDate,
            dueDate:   formData.dueDate || "",
            note:      formData.note || "",
          };
          setEmailConfirm({ show: true, order: updatedOrder, isUpdate: true });
        }

      } else {
        // ── CREATE MODE ───────────────────────────────────────────────────
        const cleanItems = originalItems.map(({ isNew, isReceipt, ...rest }) => rest);
        const { subtotal, discount, afterDiscount, paid, balance } = calcPOTotals(formData);

        const payload = {
          supplierId:        supplier.id,
          supplierName:      supplier.name,
          items:             cleanItems,
          discountType:      formData.discountType,
          discountValue:     Number(formData.discountValue) || 0,
          subtotal,
          totalAmount:       afterDiscount,
          initialAmount:     afterDiscount,   // ← frozen forever, never updated
          paidAmount:        paid,
          balance,
          status:            balance <= 0 ? "Paid" : paid > 0 ? "Partial" : "Pending",
          orderDate:         formData.orderDate,
          dueDate:           formData.dueDate || "",
          note:              formData.note || "",
          initialPaidAmount: paid,
        };

        const ref = await addDoc(
          collection(db, "users", uid, "suppliers", supplier.id, "orders"),
          { ...payload, createdAt: serverTimestamp() }
        );

        // If initial payment was made, record it
        if (paid > 0) {
          await addDoc(collection(db, "users", uid, "suppliers", supplier.id, "payments"), {
            supplierId:    supplier.id,
            supplierName:  supplier.name,
            orderId:       ref.id,
            orderRef:      `PO-${ref.id.slice(-4).toUpperCase()}`,
            amount:        paid,
            balanceBefore: afterDiscount,
            balanceAfter:  balance,
            method:        "cash",
            description:   `Initial payment for PO-${ref.id.slice(-4).toUpperCase()}`,
            createdAt:     serverTimestamp(),
          });
        }
        
        // Only show alert if no email will be sent
        if (!supplier.email?.trim()) {
          setAlert({ show: true, type: "success", title: "Order Created! 🛒", message: "New purchase order recorded." });
        }

        // ── Auto-email new order to supplier ──────────────────────────────
        if (supplier.email?.trim()) {
          setEmailConfirm({ show: true, order: { ...payload, id: ref.id }, isUpdate: false });
        }
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
      const newBalance = Math.max(0, (Number(payOrder.balance) || 0) - amount);
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
      await addDoc(collection(db, "users", uid, "suppliers", supplier.id, "payments"), {
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

      // Only show alert if no email will be sent
      if (!supplier.email?.trim()) {
        setAlert({
          show: true, type: "success",
          title: "Payment Recorded! 💸",
          message: `${formatRs(amount)} paid to ${supplier.name}. Balance: ${formatRs(newBalance)}.`,
        });
      }

      // ── Auto-email payment receipt to supplier ────────────────────────────
      if (supplier.email?.trim()) {
        const updatedOrder = {
          ...payOrder,
          paidAmount: newPaid,
          balance:    newBalance,
          status:     newStatus,
        };
        // Include the new payment directly — don't wait for Firestore listener to update supplierPayments state
        const newPaymentRecord = {
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
          createdAt:       new Date(),
        };
        setEmailConfirm({
          show: true,
          order: updatedOrder,
          isUpdate: true,
          extraPayment: newPaymentRecord,
        });
      }

      setPayOrder(null);
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Error", message: err.message });
    }
    setSavingPay(false);
  }

  // ── Delete Order ──────────────────────────────────────────────────────────
  async function handleDeleteOrder(id) {
    try {
      // Soft delete the order
      await updateDoc(
        doc(db, "users", uid, "suppliers", supplier.id, "orders", id),
        { deleted: true, deletedAt: serverTimestamp() }
      );
      setAlert({ show: true, type: "success", title: "Deleted! 🗑️", message: "Order moved to trash. Restore it from Trash." });
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Error", message: err.message });
    }
    setDeleteOrderId(null);
  }

  // ── Return Goods ──────────────────────────────────────────────────────────
  async function handleReturnGoods({ items, returnTotal, returnDate, note }) {
    if (!returnOrder || savingReturn) return;
    setSavingReturn(true);
    try {
      // balanceBefore = the stored balance field (kept accurate by payment/receipt/return updates)
      const balanceBefore = Number(returnOrder.balance) || 0;
      const newBalance    = Math.max(0, balanceBefore - returnTotal);
      const newStatus     = newBalance <= 0 ? "Paid" : (Number(returnOrder.paidAmount) || 0) > 0 ? "Partial" : "Pending";

      // Save return record
      await addDoc(collection(db, "users", uid, "suppliers", supplier.id, "returns"), {
        supplierId:   supplier.id,
        supplierName: supplier.name,
        orderId:      returnOrder.id,
        orderRef:     `PO-${returnOrder.id.slice(-4).toUpperCase()}`,
        items,
        returnTotal,
        balanceBefore,
        balanceAfter:  newBalance,
        returnDate,
        note: note || "",
        createdAt: serverTimestamp(),
      });

      // Update order balance/status ONLY — totalAmount stays frozen (original order amount never changes)
      await updateDoc(doc(db, "users", uid, "suppliers", supplier.id, "orders", returnOrder.id), {
        balance:   newBalance,
        status:    newStatus,
        updatedAt: serverTimestamp(),
      });

      // Only show alert if no email will be sent
      if (!supplier.email?.trim()) {
        setAlert({
          show: true, type: "success",
          title: "Return Recorded! 📦",
          message: `${formatRs(returnTotal)} deducted. New balance: ${formatRs(newBalance)}.`,
        });
      }

      // ── Auto-email return confirmation to supplier ────────────────────────
      if (supplier.email?.trim()) {
        const updatedOrder = {
          ...returnOrder,
          balance: newBalance,
          status:  newStatus,
        };
        setEmailConfirm({ show: true, order: updatedOrder, isUpdate: true });
      }

      setReturnOrder(null);
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Error", message: err.message });
    }
    setSavingReturn(false);
  }

  function orderToForm(o) {
    // Collect all receipt rows for this order (previous "Add Item" purchases), sorted oldest first
    const receiptRows = supplierReceipts
      .filter(r => r.orderId === o.id)
      .slice()
      .sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return da - db2;
      })
      .flatMap(r => (r.items || []).map(it => ({
        ...it,
        isNew: false,       // treat as locked — already purchased
        isReceipt: true,    // flag so modal knows it's a receipt row
      })));

    const originalItems = o.items?.length ? o.items : [{ description: "", qty: 1, unitPrice: "" }];

    return {
      items:             [...originalItems, ...receiptRows],
      discountType:      o.discountType  || "percent",
      discountValue:     o.discountValue != null ? String(o.discountValue) : "",
      amountPaid:        o.paidAmount    != null ? String(o.paidAmount) : "",
      orderDate:         o.orderDate     || new Date().toISOString().slice(0, 10),
      dueDate:           o.dueDate       || "",
      note:              o.note          || "",
      // lock ALL existing rows (original + receipts), only newly added rows are editable
      _originalItemCount: originalItems.length + receiptRows.length,
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
            { label: "Goods Return",   val: totalReturns > 0 ? `- ${formatRs(totalReturns)}` : "Rs. 0", icon: "↩️", color: totalReturns > 0 ? "#f87171" : "#9ca3af" },
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

                // Gross purchasing = original + receipts (returns shown separately below, NOT deducted from total)
                const receiptsTotal = supplierReceipts
                  .filter(r => r.orderId === o.id)
                  .reduce((s, r) => s + (Number(r.receiptTotal) || 0), 0);
                const returnsTotal  = supplierReturns
                  .filter(r => r.orderId === o.id)
                  .reduce((s, r) => s + (Number(r.returnTotal) || 0), 0);
                const total = orderOriginalAmt(o) + receiptsTotal; // gross, returns shown separately

                const statusKey = bal <= 0 ? "Paid" : paid > 0 ? "Partial" : "Pending";
                const st = STATUS_STYLE[statusKey];
                const num = (o.id || "").slice(-4).toUpperCase();
                const isOverdue = o.dueDate && new Date(o.dueDate) < new Date() && statusKey !== "Paid";
                return (
                  <div key={o.id} className="flex flex-col px-4 py-3 gap-2 hover:bg-white/[0.02] transition-colors border-b border-white/[0.04] last:border-0">
                    {/* Row 1: avatar + PO number + date + status */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0"
                        style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#F59E0B" }}>
                        {num}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white text-sm font-medium whitespace-nowrap">PO-{num}</p>
                          {isOverdue && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>OVERDUE</span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs whitespace-nowrap">{fmtDate(o.createdAt)}{o.dueDate ? ` · Due ${o.dueDate}` : ""}</p>
                        {o.items?.length > 0 && (
                          <p className="text-gray-600 text-[10px] mt-0.5 truncate">
                            📦 {o.items.map(it => it.description).join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                        {statusKey}
                      </span>
                    </div>

                    {/* Row 2: amounts + action buttons */}
                    <div className="flex items-center justify-between gap-2 pl-12">
                      <div>
                        <p className="text-white text-sm font-bold">{formatRs(total)}</p>
                        <div className="flex flex-wrap gap-x-3">
                          {paid > 0 && (
                            <p className="text-[10px] font-semibold" style={{ color: "#34d399" }}>Paid: {formatRs(paid)}</p>
                          )}
                          {returnsTotal > 0 && (
                            <p className="text-[10px] font-semibold" style={{ color: "#f87171" }}>Return: -{formatRs(returnsTotal)}</p>
                          )}
                          {bal > 0 && (
                            <p className="text-[10px] font-bold" style={{ color: "#f87171" }}>Bal: {formatRs(bal)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        <button onClick={() => setViewOrder(o)} title="View Order"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors"
                          style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>👁</button>
                        {bal > 0 && (
                          <button onClick={() => setPayOrder(o)} title="Pay Supplier"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors"
                            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#34d399" }}>💸</button>
                        )}
                        <button onClick={() => setReturnOrder(o)} title="Return Goods"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors"
                          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>↩</button>
                        <button onClick={() => setHistoryOrder(o)} title="View History"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors"
                          style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}>📊</button>
                        <button onClick={() => { setEditOrder({ id: o.id, form: orderToForm(o) }); setShowOrderModal(true); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors"
                          style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", color: "#60A5FA" }}>✏️</button>
                        <button onClick={() => setDeleteOrderId(o.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors"
                          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>🗑</button>
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
          isEdit={!!editOrder}
          originalItemCount={editOrder ? (editOrder.form._originalItemCount ?? 0) : 0}
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

      {/* Purchase Order View Modal — 👁 button */}
      {viewOrder && (
        <PurchaseOrderViewModal
          order={viewOrder}
          supplier={supplier}
          userDoc={userDoc}
          receipts={supplierReceipts.filter(r => r.orderId === viewOrder.id)}
          returns={supplierReturns.filter(r => r.orderId === viewOrder.id)}
          payments={supplierPayments.filter(p => p.orderId === viewOrder.id)}
          onClose={() => setViewOrder(null)}
        />
      )}

      {/* Full Supplier History Modal — "View History" button in top nav */}
      {showHistory && (
        <SupplierHistoryModal
          supplier={supplier}
          orders={orders}
          payments={supplierPayments}
          receipts={supplierReceipts}
          returns={supplierReturns}
          userDoc={userDoc}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Per-Order History Modal — 📊 button on each order row */}
      {historyOrder && (
        <SupplierHistoryModal
          supplier={supplier}
          orders={[historyOrder]}
          payments={supplierPayments.filter(p => p.orderId === historyOrder.id)}
          receipts={supplierReceipts.filter(r => r.orderId === historyOrder.id)}
          returns={supplierReturns.filter(r => r.orderId === historyOrder.id)}
          userDoc={userDoc}
          onClose={() => setHistoryOrder(null)}
        />
      )}

      {/* Return Goods Modal */}
      {returnOrder && (
        <ReturnGoodsModal
          order={returnOrder}
          supplier={supplier}
          receipts={supplierReceipts.filter(r => r.orderId === returnOrder.id)}
          onClose={() => setReturnOrder(null)}
          onSave={handleReturnGoods}
          saving={savingReturn}
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

      {/* ── Email Confirmation Dialog ── */}
      <EmailConfirmationDialog
        show={emailConfirm.show}
        recipientEmail={supplier?.email}
        documentType="order"
        onConfirm={async () => {
          // User clicked "Yes" - send email with proper PO PDF
          if (emailConfirm.order) {
            // filter receipts/returns/payments for this order
            const orderId = emailConfirm.order.id;
            const orderReceipts = supplierReceipts.filter(r => r.orderId === orderId);
            const orderReturns  = supplierReturns.filter(r => r.orderId === orderId);
            // Merge state payments with any extraPayment (new payment not yet in state)
            const statePayments = supplierPayments.filter(p => p.orderId === orderId);
            const orderPayments = emailConfirm.extraPayment
              ? [...statePayments.filter(p => p.id !== emailConfirm.extraPayment.id), emailConfirm.extraPayment]
              : statePayments;
            await autoEmailSupplierOrder({
              order:    emailConfirm.order,
              supplier,
              userDoc,
              uid,
              setAlert,
              isUpdate: emailConfirm.isUpdate,
              receipts: orderReceipts,
              returns:  orderReturns,
              payments: orderPayments,
              onConfirm: async (sendEmailFn) => { await sendEmailFn(); },
            });
          }
          setEmailConfirm({ show: false, order: null, isUpdate: false });
        }}
        onCancel={() => {
          // User clicked "No" - show success without email
          const docType = emailConfirm.isUpdate ? "Updated" : "Created";
          setAlert({
            show: true,
            type: "success",
            title: `Order ${docType}! 🛒`,
            message: `Purchase order has been ${docType.toLowerCase()} successfully. Email was not sent.`,
          });
          setEmailConfirm({ show: false, order: null, isUpdate: false });
        }}
      />
    </>
  );
}
