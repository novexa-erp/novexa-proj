"use client";
import { useState, useEffect, useRef } from "react";
import SweetAlert from "./SweetAlert";

// ── helpers ───────────────────────────────────────────────────────────────────
export function formatRs(n) {
  if (!n && n !== 0) return "Rs. 0";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}

export const EMPTY_FORM = {
  logoDataUrl: "",
  customerName: "", address: "", phone: "", email: "",
  items: [{ description: "", qty: 1, unitPrice: "", productId: "", variantId: "", variantLabel: "", variantUnit: "", stock: "" }],
  discountType: "percent",
  discountValue: "",
  amountPaid: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  earlyDiscountDays: "", earlyDiscountPercent: "",
  note: "",
};

export function calcTotals(form) {
  const isPrevBal = it => (it.description || "").startsWith("Previous Balance · INV-");
  const subtotal = form.items.reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0
  );
  const discount =
    form.discountType === "percent"
      ? subtotal * (Number(form.discountValue) || 0) / 100
      : Number(form.discountValue) || 0;
  const afterDiscount = Math.max(subtotal - discount, 0);
  const paid = Number(form.amountPaid) || 0;
  const balance = Math.max(afterDiscount - paid, 0);

  // actualBalance = balance excluding previous balance carry-forward items
  // This is used for payment collection — user only pays for their own products
  const actualSubtotal = form.items
    .filter(it => !isPrevBal(it))
    .reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
  const actualDiscount = form.discountType === "percent"
    ? actualSubtotal * (Number(form.discountValue) || 0) / 100
    : Math.min(Number(form.discountValue) || 0, actualSubtotal);
  const actualAfterDiscount = Math.max(actualSubtotal - actualDiscount, 0);
  const actualBalance = Math.max(actualAfterDiscount - paid, 0);

  return { subtotal, discount, afterDiscount, paid, balance, actualBalance, actualAfterDiscount };
}

// ── shared input styles ───────────────────────────────────────────────────────
const base = {
  width: "100%", outline: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(255,255,255,0.09)",
  borderRadius: 10, padding: "9px 13px",
  color: "#fff", fontSize: 13,
  transition: "border-color .2s, background .2s",
};
const focused = {
  background: "rgba(37,99,235,0.07)",
  borderColor: "rgba(37,99,235,0.5)",
  boxShadow: "0 0 0 3px rgba(37,99,235,0.08)",
};
const lbl = {
  display: "block", color: "#9ca3af", fontSize: 11,
  fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.07em", marginBottom: 5,
};

function FInput({ label, req, children, cls }) {
  return (
    <div className={cls}>
      {label && (
        <label style={lbl}>
          {label}{req && <span style={{ color: "#f87171" }}> *</span>}
        </label>
      )}
      {children}
    </div>
  );
}

function StyledInput({ type = "text", placeholder, value, onChange, req, min, step, sx, autoComplete }) {
  const [isFocused, setF] = useState(false);
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      required={req} min={min} step={step} autoComplete={autoComplete || "off"}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...base, ...(isFocused ? focused : {}), ...sx }} />
  );
}

function StyledSelect({ value, onChange, children }) {
  const [isFocused, setF] = useState(false);
  return (
    <select value={value} onChange={onChange}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...base, ...(isFocused ? focused : {}), cursor: "pointer" }}>
      {children}
    </select>
  );
}

function StyledTextarea({ placeholder, value, onChange, rows = 2 }) {
  const [isFocused, setF] = useState(false);
  return (
    <textarea placeholder={placeholder} value={value} onChange={onChange} rows={rows}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...base, ...(isFocused ? focused : {}), resize: "vertical" }} />
  );
}

// ── Product picker modal ──────────────────────────────────────────────────────
function ProductPickerModal({ products, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const filtered = products.filter(p =>
    (p.name || "").toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl flex flex-col"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", maxHeight: "70vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h3 className="text-white font-bold text-base">Select Product</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button>
        </div>
        <div className="px-4 py-3 border-b border-white/[0.05]">
          <input placeholder="Search products..." value={search}
            onChange={e => setSearch(e.target.value)} autoFocus
            style={{ ...base, padding: "8px 12px" }} />
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No products found.</p>
          ) : (
            filtered.map(p => {
              const hasVariants = p.variantType !== "none" && p.variants?.length > 0;
              const totalStock = hasVariants 
                ? p.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
                : (p.stock || 0);
              
              return (
                <button key={p.id} type="button"
                  onClick={() => onSelect(p)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {p.name}
                      {hasVariants && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">{p.variants.length} variants</span>}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      Total Stock: <span style={{ color: totalStock <= (Number(p.lowStockThreshold) || 10) ? "#fbbf24" : "#34d399" }}>
                        {totalStock}
                      </span>
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-amber-400 font-bold text-sm">
                      {hasVariants ? "Select →" : formatRs(p.price)}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Variant type config for inline use in invoice ────────────────────────────
const VARIANT_TYPES_INV = [
  { id: "none",   label: "No Variant",  icon: "📦", unit: "",   presets: [] },
  { id: "weight", label: "Weight (kg)", icon: "⚖️", unit: "kg", presets: ["0.25","0.5","0.75","1","2","5","10"] },
  { id: "volume", label: "Volume (L)",  icon: "🧴", unit: "L",  presets: ["0.25","0.5","0.75","1","2","5","10"] },
  { id: "length", label: "Length (m)",  icon: "📏", unit: "m",  presets: ["1","2","3","5","10"] },
  { id: "size",   label: "Size",        icon: "👕", unit: "",   presets: ["XS","S","M","L","XL","XXL"] },
  { id: "custom", label: "Custom",      icon: "⚙️", unit: "",   presets: [] },
];

// ── Item row with autocomplete + variant support ─────────────────────────────
function ItemRow({ item, idx, products, onChange, onRemove, canRemove, onOpenPicker, onStockError }) {
  // Custom variant state for non-inventory items
  const [showVariantSetup, setShowVariantSetup] = useState(false);
  const [customVarType,    setCustomVarType]    = useState("none");
  const [customVarLabel,   setCustomVarLabel]   = useState("");
  const [customVarPrice,   setCustomVarPrice]   = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const rowRef = useRef(null);

  // Find selected product
  const selectedProduct = item.productId ? products.find(p => p.id === item.productId) : null;
  const hasVariants = selectedProduct && selectedProduct.variantType !== "none" && selectedProduct.variants?.length > 0;

  // filter products by description typed
  function handleDescChange(val) {
    onChange(idx, "description", val);
    onChange(idx, "productId", ""); // clear link when manually typing
    onChange(idx, "variantId", "");
    onChange(idx, "stock", "");
    
    if (val.trim().length > 0) {
      const matches = products.filter(p =>
        (p.name || "").toLowerCase().startsWith(val.toLowerCase()) ||
        (p.name || "").toLowerCase().includes(val.toLowerCase())
      ).slice(0, 6);
      setSuggestions(matches);
      setShowSug(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSug(false);
    }
  }

  function selectSuggestion(p) {
    onChange(idx, "description", p.name);
    onChange(idx, "productId", p.id);
    
    // Check if product has variants
    if (p.variantType !== "none" && p.variants?.length > 0) {
      // Has variants - don't fill price/stock/label yet, wait for variant selection
      onChange(idx, "unitPrice",    "");
      onChange(idx, "variantId",    "");
      onChange(idx, "variantLabel", "");
      onChange(idx, "variantUnit",  "");
      onChange(idx, "stock",        "");
    } else {
      // No variants - fill price and stock directly
      onChange(idx, "unitPrice",    String(p.price || ""));
      onChange(idx, "stock",        String(p.stock || 0));
      onChange(idx, "variantId",    "");
      onChange(idx, "variantLabel", "");
      onChange(idx, "variantUnit",  "");
    }
    
    setSuggestions([]);
    setShowSug(false);
  }

  // Handle variant selection
  function handleVariantChange(variantId) {
    onChange(idx, "variantId", variantId);
    
    if (variantId && selectedProduct) {
      // Find variant by ID or by index (for backwards compatibility)
      let variant = selectedProduct.variants.find(v => v.id === variantId);
      
      // If not found by ID, try to find by index (var_0, var_1, etc.)
      if (!variant && variantId.startsWith('var_')) {
        const vIdx = parseInt(variantId.split('_')[1]);
        variant = selectedProduct.variants[vIdx];
      }
      
      if (variant) {
        onChange(idx, "unitPrice",    String(variant.price || ""));
        onChange(idx, "stock",        String(variant.stock || 0));
        // Save variant label (e.g. "0.5 L") and unit (e.g. "L") for invoice PDF
        onChange(idx, "variantLabel", variant.label || "");
        // Derive unit from product variantType
        const varTypeUnit = {
          weight: "kg", volume: "L", length: "m",
        };
        const unit = varTypeUnit[selectedProduct.variantType] || "";
        onChange(idx, "variantUnit",  unit);
      }
    } else {
      onChange(idx, "unitPrice",    "");
      onChange(idx, "stock",        "");
      onChange(idx, "variantLabel", "");
      onChange(idx, "variantUnit",  "");
    }
  }

  // Handle quantity change with stock validation
  function handleQtyChange(value) {
    const qty = Number(value) || 0;
    const availableStock = Number(item.stock) || 0;
    
    // Check if quantity exceeds stock
    if (qty > availableStock && availableStock > 0) {
      // Show error alert
      onStockError(item.description || "Product", availableStock);
      // Set to max available stock
      onChange(idx, "qty", String(availableStock));
    } else {
      onChange(idx, "qty", value);
    }
  }

  // close on outside click
  useEffect(() => {
    function handler(e) {
      if (rowRef.current && !rowRef.current.contains(e.target)) setShowSug(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const lineTotal = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
  const stock = Number(item.stock) || 0;
  const qty = Number(item.qty) || 0;
  const stockStatus = qty > stock ? "low" : "ok";
  // Lock prev balance carry-forward rows completely
  const isRowLocked = !!item.locked;

  return (
    <div ref={rowRef} className="relative flex flex-col gap-2">
      {/* Main Row */}
      <div className="grid gap-2 items-center"
        style={{ gridTemplateColumns: hasVariants ? "1fr 64px 110px 80px 36px" : "1fr 64px 110px 80px 36px" }}>

        {/* description + autocomplete */}
        <div className="relative">
          <input placeholder="Item / product name" value={item.description}
            onChange={e => isRowLocked ? undefined : handleDescChange(e.target.value)}
            onFocus={() => { if (!isRowLocked && suggestions.length > 0) setShowSug(true); }}
            readOnly={isRowLocked}
            autoComplete="off"
            style={{
              ...base, paddingRight: isRowLocked ? 12 : 32,
              opacity: isRowLocked ? 0.65 : 1,
              cursor: isRowLocked ? "default" : "text",
              background: isRowLocked ? "rgba(255,255,255,0.02)" : base.background,
              color: isRowLocked ? "#9ca3af" : "#fff",
            }} />
          {/* browse all button — hidden for locked rows */}
          {!isRowLocked && (
            <button type="button" onClick={() => onOpenPicker(idx)}
              title="Browse all products"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-amber-400 transition-colors text-sm">
              📦
            </button>
          )}

          {/* autocomplete dropdown */}
          {!isRowLocked && showSug && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-30"
              style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
              {suggestions.map(p => {
                const hasVars = p.variantType !== "none" && p.variants?.length > 0;
                const totalStock = hasVars 
                  ? p.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
                  : (p.stock || 0);
                
                return (
                  <button key={p.id} type="button"
                    onMouseDown={() => selectSuggestion(p)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0">
                    <div>
                      <p className="text-white text-xs font-medium">
                        {p.name} {hasVars && <span className="text-gray-500 text-[10px]">({p.variants.length} variants)</span>}
                      </p>
                      <p className="text-gray-500 text-[10px]">Stock: {totalStock}</p>
                    </div>
                    <p className="text-amber-400 text-xs font-bold ml-2 flex-shrink-0">
                      {hasVars ? "Select variant →" : formatRs(p.price)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <input type="number" min="1" placeholder="1" value={item.qty}
          onChange={e => isRowLocked ? undefined : handleQtyChange(e.target.value)}
          readOnly={isRowLocked}
          max={item.stock || undefined}
          style={{ 
            ...base, 
            textAlign: "center", 
            padding: "9px 6px",
            borderColor: (qty > stock && stock > 0) ? "#f87171" : base.border,
            opacity: isRowLocked ? 0.65 : 1,
            cursor: isRowLocked ? "default" : "text",
            background: isRowLocked ? "rgba(255,255,255,0.02)" : base.background,
            color: isRowLocked ? "#9ca3af" : "#fff",
          }} />

        <input type="number" min="0" placeholder="Unit price" value={item.unitPrice}
          onChange={e => isRowLocked ? undefined : onChange(idx, "unitPrice", e.target.value)}
          readOnly={isRowLocked}
          disabled={!isRowLocked && (hasVariants && item.variantId)}
          style={{ 
            ...base, 
            textAlign: "right", 
            padding: "9px 10px",
            opacity: isRowLocked ? 0.65 : (hasVariants && item.variantId) ? 0.6 : 1,
            cursor: isRowLocked ? "default" : (hasVariants && item.variantId) ? "not-allowed" : "text",
            background: isRowLocked ? "rgba(255,255,255,0.02)" : (hasVariants && item.variantId) ? "rgba(255,255,255,0.02)" : base.background,
            color: isRowLocked ? "#9ca3af" : "#fff",
          }} />

        {/* line total */}
        <p className="text-xs font-semibold text-right flex-shrink-0 pr-1"
          style={{ color: lineTotal > 0 ? (isRowLocked ? "#6b7280" : "#fff") : "#4b5563" }}>
          {lineTotal > 0 ? formatRs(lineTotal) : "—"}
        </p>

        <button type="button" onClick={() => onRemove(idx)} disabled={!canRemove || isRowLocked}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", opacity: (canRemove && !isRowLocked) ? 1 : 0.15 }}>
          ✕
        </button>
      </div>

      {/* Variant Selection Row (if product has variants) */}
      {hasVariants && (
        <div className="flex items-center gap-2 pl-2 pb-1 border-l-2 border-amber-500/20">
          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide min-w-[60px]">Variant:</span>
          <select
            value={item.variantId || ""}
            onChange={e => handleVariantChange(e.target.value)}
            style={{ 
              ...base, 
              fontSize: 12, 
              padding: "6px 10px",
              maxWidth: "200px",
              background: "rgba(245,158,11,0.05)",
              borderColor: item.variantId ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.09)",
            }}
          >
            <option value="" style={{ background: "#0d1117" }}>Select variant...</option>
            {selectedProduct.variants.map((v, vIdx) => {
              const varId = v.id || `var_${vIdx}`;
              return (
                <option key={varId} value={varId} style={{ background: "#0d1117" }}>
                  {v.label} - {formatRs(v.price)} (Stock: {v.stock || 0})
                </option>
              );
            })}
          </select>
          {item.variantId && (
            <span className="text-[10px] px-2 py-1 rounded-md font-semibold"
              style={{
                background: stockStatus === "ok" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                color: stockStatus === "ok" ? "#34d399" : "#f87171",
              }}>
              {stockStatus === "low" ? `⚠ Only ${stock} available` : `✓ ${stock} in stock`}
            </span>
          )}
        </div>
      )}

      {/* Stock indicator for non-variant products */}
      {!hasVariants && item.productId && stock >= 0 && (
        <div className="flex items-center gap-2 pl-2 text-[10px]">
          <span
            className="px-2 py-0.5 rounded-md font-semibold"
            style={{
              background: stockStatus === "ok" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
              color: stockStatus === "ok" ? "#34d399" : "#f87171",
            }}>
            {stockStatus === "low" ? `⚠ Only ${stock} available` : `✓ ${stock} in stock`}
          </span>
        </div>
      )}

      {/* ── Custom Variant Setup (for non-inventory items only, non-locked) ── */}
      {!item.productId && item.description && !hasVariants && !isRowLocked && (
        <div className="pl-2">
          {!showVariantSetup ? (
            <button type="button"
              onClick={() => setShowVariantSetup(true)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
              style={{ color: "#a78bfa", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
              ⚙️ Add Variant (optional)
            </button>
          ) : (
            <div className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.2)" }}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a78bfa" }}>
                  ⚙️ Variant Setup
                </span>
                <button type="button" onClick={() => {
                  setShowVariantSetup(false);
                  setCustomVarType("none");
                  setCustomVarLabel("");
                  setCustomVarPrice("");
                  onChange(idx, "variantLabel", "");
                  onChange(idx, "variantUnit", "");
                }} className="text-gray-500 hover:text-white text-xs">✕</button>
              </div>

              {/* Variant type pills */}
              <div className="flex flex-wrap gap-1.5">
                {VARIANT_TYPES_INV.map(vt => (
                  <button key={vt.id} type="button"
                    onClick={() => { setCustomVarType(vt.id); setCustomVarLabel(""); }}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-all"
                    style={{
                      background: customVarType === vt.id ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${customVarType === vt.id ? "rgba(139,92,246,0.6)" : "rgba(255,255,255,0.08)"}`,
                      color: customVarType === vt.id ? "#c4b5fd" : "#9ca3af",
                    }}>
                    {vt.icon} {vt.label}
                  </button>
                ))}
              </div>

              {customVarType !== "none" && (() => {
                const vt = VARIANT_TYPES_INV.find(v => v.id === customVarType);
                return (
                  <div className="flex flex-col gap-2">
                    {/* Presets */}
                    {vt.presets.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {vt.presets.map(p => (
                          <button key={p} type="button"
                            onClick={() => {
                              const lbl = vt.unit ? `${p} ${vt.unit}` : p;
                              setCustomVarLabel(lbl);
                              onChange(idx, "variantLabel", lbl);
                              onChange(idx, "variantUnit", vt.unit);
                            }}
                            className="text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all"
                            style={{
                              background: customVarLabel === (vt.unit ? `${p} ${vt.unit}` : p)
                                ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.04)",
                              border: `1px solid ${customVarLabel === (vt.unit ? `${p} ${vt.unit}` : p)
                                ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`,
                              color: "#f59e0b",
                            }}>
                            {p}{vt.unit ? ` ${vt.unit}` : ""}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Manual label input */}
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder={vt.unit ? `e.g. 1 ${vt.unit}` : "e.g. Medium"}
                        value={customVarLabel}
                        onChange={e => {
                          setCustomVarLabel(e.target.value);
                          onChange(idx, "variantLabel", e.target.value);
                          onChange(idx, "variantUnit", vt.unit);
                        }}
                        style={{ ...base, fontSize: 12, padding: "6px 10px", flex: 1 }}
                      />
                      <input
                        type="number" min="0" placeholder="Price per unit"
                        value={customVarPrice}
                        onChange={e => {
                          setCustomVarPrice(e.target.value);
                          onChange(idx, "unitPrice", e.target.value);
                        }}
                        style={{ ...base, fontSize: 12, padding: "6px 10px", width: 120, textAlign: "right" }}
                      />
                    </div>

                    {customVarLabel && customVarPrice && (
                      <div className="text-[10px] px-2 py-1 rounded-lg"
                        style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>
                        ✓ <strong>{item.description}</strong> · {customVarLabel} · Rs. {customVarPrice}/unit
                        · Qty: {item.qty || 1} · Total: {formatRs((Number(item.qty) || 1) * (Number(customVarPrice) || 0))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Show saved custom variant label */}
      {!item.productId && item.variantLabel && (
        <div className="pl-2">
          <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
            style={{ background: "rgba(139,92,246,0.1)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.2)" }}>
            ⚙️ {item.variantLabel} · Rs. {item.unitPrice}/unit
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function InvoiceModal({ onClose, onSave, saving, initial, defaultValues, products = [], settingsLogo = "" }) {
  // if no initial logo provided, use settingsLogo as default
  const defaultForm = settingsLogo
    ? { ...EMPTY_FORM, logoDataUrl: settingsLogo }
    : EMPTY_FORM;

  // new invoice: use defaultValues (prefilled) if provided, else defaultForm
  // edit invoice: use initial (existing invoice data)
  const startForm = initial || (defaultValues ? { ...defaultForm, ...defaultValues } : defaultForm);

  const [form, setForm]           = useState(startForm);
  const [pickerIdx, setPickerIdx] = useState(null);
  const overlayRef                = useRef(null);
  const logoInputRef              = useRef(null);
  
  // ── Additional items for edit mode (new purchase on existing invoice) ──────
  const [additionalItems, setAdditionalItems] = useState(
    [{ description: "", qty: 1, unitPrice: "", productId: "", variantId: "", stock: "" }]
  );
  const [addPickerIdx, setAddPickerIdx] = useState(null); // picker for additional items
  const [showAddPurchase, setShowAddPurchase] = useState(false); // toggle add more purchase row

  // ── Goods Return state ───────────────────────────────────────────────────────
  const [showReturn, setShowReturn] = useState(false);
  const [returnItem, setReturnItem] = useState({ description: "", qty: "", rate: "" });
  
  // Sweet Alert State for stock validation
  const [alert, setAlert] = useState({ show: false, type: "", title: "", message: "" });

  useEffect(() => {
    if (initial) {
      // when editing: keep existing logo; if none, fall back to settingsLogo
      setForm({ ...initial, logoDataUrl: initial.logoDataUrl || settingsLogo || "" });
    }
  }, [initial, settingsLogo]);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  // ── logo upload ──────────────────────────────────────────────────────────────
  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert("Logo too large — max 500 KB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setForm(p => ({ ...p, logoDataUrl: ev.target.result }));
    reader.readAsDataURL(file);
  }

  // ── item helpers ─────────────────────────────────────────────────────────────
  function setItem(idx, k, v) {
    setForm(p => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [k]: v };
      return { ...p, items };
    });
  }
  function addItem() {
    setForm(p => ({ ...p, items: [...p.items, { description: "", qty: 1, unitPrice: "", productId: "", variantId: "", variantLabel: "", variantUnit: "", stock: "" }] }));
  }
  function removeItem(idx) {
    setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  }

  // ── additional items helpers (edit mode — new purchase on existing invoice) ─
  function setAddItem(idx, k, v) {
    setAdditionalItems(prev => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [k]: v };
      return arr;
    });
  }
  function addMoreItem() {
    setAdditionalItems(prev => [...prev, { description: "", qty: 1, unitPrice: "", productId: "", variantId: "", stock: "" }]);
  }
  function removeAddItem(idx) {
    setAdditionalItems(prev => prev.filter((_, i) => i !== idx));
  }
  function handleAddPickerSelect(p) {
    if (addPickerIdx === null) return;
    setAddItem(addPickerIdx, "description", p.name);
    setAddItem(addPickerIdx, "productId", p.id);
    if (p.variantType !== "none" && p.variants?.length > 0) {
      setAddItem(addPickerIdx, "unitPrice", "");
      setAddItem(addPickerIdx, "variantId", "");
      setAddItem(addPickerIdx, "stock", "");
    } else {
      setAddItem(addPickerIdx, "unitPrice", String(p.price || ""));
      setAddItem(addPickerIdx, "stock", String(p.stock || 0));
      setAddItem(addPickerIdx, "variantId", "");
    }
    setAddPickerIdx(null);
  }

  // Check if any additional items have been filled
  const hasAdditionalItems = additionalItems.some(
    it => it.description.trim() && (Number(it.qty) > 0) && (Number(it.unitPrice) >= 0)
  );
  // Total amount of additional items
  const additionalTotal = additionalItems.reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0
  );

  // ── goods return helpers (edit mode) ────────────────────────────────────────
  const returnTotal = (Number(returnItem.qty) || 0) * (Number(returnItem.rate) || 0);
  const hasReturn   = returnItem.description && Number(returnItem.qty) > 0 && Number(returnItem.rate) > 0;

  // Stock validation error handler
  function handleStockError(productName, availableStock) {
    setAlert({
      show: true,
      type: "warning",
      title: "Insufficient Stock! ⚠️",
      message: `You have only ${availableStock} units of "${productName}" in stock. Would you like to add more stock? Go to Inventory to increase stock levels.`,
    });
  }

  // select from picker modal (existing items)
  function handlePickerSelect(p) {
    if (pickerIdx === null) return;
    setItem(pickerIdx, "description", p.name);
    setItem(pickerIdx, "productId", p.id);
    if (p.variantType !== "none" && p.variants?.length > 0) {
      setItem(pickerIdx, "unitPrice",    "");
      setItem(pickerIdx, "variantId",    "");
      setItem(pickerIdx, "variantLabel", "");
      setItem(pickerIdx, "variantUnit",  "");
      setItem(pickerIdx, "stock",        "");
    } else {
      setItem(pickerIdx, "unitPrice",    String(p.price || ""));
      setItem(pickerIdx, "stock",        String(p.stock || 0));
      setItem(pickerIdx, "variantId",    "");
      setItem(pickerIdx, "variantLabel", "");
      setItem(pickerIdx, "variantUnit",  "");
    }
    setPickerIdx(null);
  }

  const { subtotal, discount, afterDiscount, paid, balance, actualBalance, actualAfterDiscount } = calcTotals(form);
  const autoStatus = balance === 0 && afterDiscount > 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";

  // For payment collection: only enable if there are actual product items (not just prev balance)
  const isPrevBal = it => (it.description || "").startsWith("Previous Balance · INV-");
  const hasRealItems = (form.items || []).some(it => !isPrevBal(it) && it.description?.trim() && Number(it.qty) > 0 && Number(it.unitPrice) >= 0);

  function handleSubmit(e) {
    e.preventDefault();
    // Pass additionalItems along so handleSaveInv can process them
    onSave({
      ...form,
      subtotal, discount,
      amount: afterDiscount,
      amountPaid: paid,
      balance,
      status: autoStatus,
      additionalItems: (initial && showAddPurchase) ? additionalItems : [],
      returnItem: (initial && showReturn && hasReturn) ? returnItem : null,
    });
  }

  const sect = "text-xs font-bold uppercase tracking-widest mb-3 pb-2 border-b border-white/10";

  return (
    <>
    {/* Sweet Alert for Stock Validation */}
    <SweetAlert
      show={alert.show}
      type={alert.type}
      title={alert.title}
      message={alert.message}
      onClose={() => setAlert({ ...alert, show: false })}
    />
    
    <div ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>

      <div className="relative w-full max-w-2xl my-6 rounded-2xl flex flex-col"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-white font-black text-xl">{initial ? "Edit Invoice" : "New Invoice"}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{initial ? "Update invoice details" : "Fill in the details below"}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">

          {/* ── Logo upload ── */}
          <div>
            <p className={sect} style={{ color: "#9ca3af" }}>Business Logo (optional)</p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ background: "rgba(255,255,255,0.04)", border: "1.5px dashed rgba(255,255,255,0.15)" }}>
                {form.logoDataUrl ? (
                  <img src={form.logoDataUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-2xl">🏢</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                  style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#60A5FA" }}>
                  {form.logoDataUrl ? "Change Logo" : "Upload Logo"}
                </button>
                {form.logoDataUrl && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, logoDataUrl: "" }))}
                    className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                    style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
                    Remove
                  </button>
                )}
                <p className="text-gray-600 text-[10px]">PNG, JPG · max 500 KB</p>
                {!form.logoDataUrl && settingsLogo && (
                  <p className="text-[10px]" style={{ color: "#fbbf24" }}>
                    ⚠ No logo set — add one in Settings
                  </p>
                )}
                {form.logoDataUrl && form.logoDataUrl === settingsLogo && (
                  <p className="text-[10px]" style={{ color: "#34d399" }}>
                    ✓ Using logo from Settings
                  </p>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                onChange={handleLogoChange} />
            </div>
          </div>

          {/* ── Customer Info ── */}
          <div>
            <p className={sect} style={{ color: "#F59E0B" }}>Customer Information</p>
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Customer Name" req cls="col-span-2">
                <StyledInput placeholder="e.g. Ali Traders" value={form.customerName}
                  onChange={set("customerName")} req />
              </FInput>
              <FInput label="Phone Number">
                <StyledInput type="tel" placeholder="+92 300 1234567" value={form.phone} onChange={set("phone")} />
              </FInput>
              <FInput label="Email (optional)">
                <StyledInput type="email" placeholder="customer@example.com" value={form.email} onChange={set("email")} />
              </FInput>
              <FInput label="Address" cls="col-span-2">
                <StyledInput placeholder="Street, City..." value={form.address} onChange={set("address")} />
              </FInput>
            </div>
          </div>

          {/* ── Items ── */}
          <div>
            <p className={sect} style={{ color: "#2563EB" }}>Items / Services</p>
            <div className="flex flex-col gap-2">
              {/* column headers */}
              <div className="grid gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 px-1"
                style={{ gridTemplateColumns: "1fr 64px 110px 80px 36px" }}>
                <span>Description {!initial && <span className="text-gray-700 normal-case font-normal">(type to search)</span>}</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Unit Price</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              {/* Edit mode: all existing items fully locked (read-only display rows) */}
              {initial ? (
                form.items.map((item, idx) => {
                  const lineTotal = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
                  return (
                    <div key={idx} className="grid gap-2 items-center"
                      style={{ gridTemplateColumns: "1fr 64px 110px 80px 36px" }}>
                      <div className="px-3 py-2 rounded-xl text-sm text-gray-400 truncate"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.06)" }}>
                        {item.description || "—"}
                      </div>
                      <div className="px-2 py-2 rounded-xl text-sm text-gray-400 text-center"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.06)" }}>
                        {item.qty}
                      </div>
                      <div className="px-2 py-2 rounded-xl text-sm text-gray-400 text-right"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.06)" }}>
                        {item.unitPrice}
                      </div>
                      <p className="text-xs font-semibold text-right pr-1" style={{ color: lineTotal > 0 ? "#9ca3af" : "#4b5563" }}>
                        {lineTotal > 0 ? formatRs(lineTotal) : "—"}
                      </p>
                      {/* locked — no remove button */}
                      <div className="w-9 h-9" />
                    </div>
                  );
                })
              ) : (
                <>
                  {form.items.map((item, idx) => (
                    <ItemRow key={idx} item={item} idx={idx} products={products}
                      onChange={setItem} onRemove={removeItem}
                      canRemove={form.items.length > 1}
                      onOpenPicker={(i) => setPickerIdx(i)}
                      onStockError={handleStockError}
                      locked={false} />
                  ))}
                  <button type="button" onClick={addItem}
                    className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl w-fit transition-colors mt-1"
                    style={{ color: "#60A5FA", background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
                    ➕ Add Another Item
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Add More Purchase (Edit mode only) ── */}
          {initial && (() => {
            // Find first real product (non prev-balance) from invoice items
            const firstRealItem = form.items.find(
              it => it.description && !it.description.startsWith("Previous Balance · INV-")
            );
            const productName = firstRealItem?.description || "";
            const defaultRate = firstRealItem?.unitPrice || "";

            return (
              <div>
                {!showAddPurchase ? (
                  <button type="button"
                    onClick={() => {
                      setAdditionalItems([{
                        description: productName,
                        qty: 1,
                        unitPrice: defaultRate,
                        productId: firstRealItem?.productId || "",
                        variantId: firstRealItem?.variantId || "",
                        stock: firstRealItem?.stock || "",
                      }]);
                      setShowAddPurchase(true);
                    }}
                    className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all hover:scale-105"
                    style={{ color: "#f59e0b", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                    ➕ Add More Purchase
                  </button>
                ) : (
                  <div className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.04)" }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b"
                      style={{ borderColor: "rgba(245,158,11,0.15)" }}>
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#f59e0b" }}>
                        ➕ Add More Purchase
                      </p>
                      <button type="button" onClick={() => setShowAddPurchase(false)}
                        className="text-gray-500 hover:text-white text-sm transition-colors">✕</button>
                    </div>

                    <div className="p-4 flex flex-col gap-3">
                      {/* Column headers */}
                      <div className="grid gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 px-1"
                        style={{ gridTemplateColumns: "1fr 90px 110px 90px" }}>
                        <span>Product</span>
                        <span className="text-center">Qty</span>
                        <span className="text-right">Rate</span>
                        <span className="text-right">Total</span>
                      </div>

                      {/* Single purchase row */}
                      <div className="grid gap-2 items-center"
                        style={{ gridTemplateColumns: "1fr 90px 110px 90px" }}>
                        {/* Product name — read only */}
                        <div className="px-3 py-2 rounded-xl text-sm truncate"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.08)", color: "#9ca3af" }}>
                          {additionalItems[0]?.description || "—"}
                        </div>
                        {/* Qty — editable */}
                        <input
                          type="number" min="1" placeholder="Qty"
                          value={additionalItems[0]?.qty || ""}
                          onChange={e => setAddItem(0, "qty", e.target.value)}
                          style={{ ...{ width:"100%", outline:"none", background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(255,255,255,0.09)", borderRadius:10, padding:"9px 8px", color:"#fff", fontSize:13, textAlign:"center" } }}
                        />
                        {/* Rate — editable */}
                        <input
                          type="number" min="0" placeholder="Rate"
                          value={additionalItems[0]?.unitPrice || ""}
                          onChange={e => setAddItem(0, "unitPrice", e.target.value)}
                          style={{ ...{ width:"100%", outline:"none", background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(255,255,255,0.09)", borderRadius:10, padding:"9px 10px", color:"#fff", fontSize:13, textAlign:"right" } }}
                        />
                        {/* Line total */}
                        <p className="text-xs font-bold text-right pr-1"
                          style={{ color: (Number(additionalItems[0]?.qty)||0)*(Number(additionalItems[0]?.unitPrice)||0) > 0 ? "#f59e0b" : "#4b5563" }}>
                          {(Number(additionalItems[0]?.qty)||0)*(Number(additionalItems[0]?.unitPrice)||0) > 0
                            ? formatRs((Number(additionalItems[0]?.qty)||0)*(Number(additionalItems[0]?.unitPrice)||0))
                            : "—"}
                        </p>
                      </div>

                      {/* Preview */}
                      {hasAdditionalItems && (
                        <div className="mt-1 px-3 py-2 rounded-lg text-xs"
                          style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>
                          ✓ Save hone par <strong>{formatRs(additionalTotal)}</strong> invoice mein add hoga — balance barh jaayega
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Goods Return (Edit mode only) ── */}
          {initial && (() => {
            const firstRealItem = form.items.find(
              it => it.description && !it.description.startsWith("Previous Balance · INV-")
            );
            const productName = firstRealItem?.description || "";

            return (
              <div>
                {!showReturn ? (
                  <button type="button"
                    onClick={() => {
                      setReturnItem({ description: productName, qty: "", rate: firstRealItem?.unitPrice || "" });
                      setShowReturn(true);
                    }}
                    className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all hover:scale-105"
                    style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
                    ↩️ Goods Return
                  </button>
                ) : (
                  <div className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.04)" }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b"
                      style={{ borderColor: "rgba(248,113,113,0.15)" }}>
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#f87171" }}>
                        ↩️ Goods Return
                      </p>
                      <button type="button" onClick={() => setShowReturn(false)}
                        className="text-gray-500 hover:text-white text-sm transition-colors">✕</button>
                    </div>

                    <div className="p-4 flex flex-col gap-3">
                      {/* Column headers */}
                      <div className="grid gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 px-1"
                        style={{ gridTemplateColumns: "1fr 90px 110px 90px" }}>
                        <span>Product</span>
                        <span className="text-center">Qty Returned</span>
                        <span className="text-right">Rate</span>
                        <span className="text-right">Return Amount</span>
                      </div>

                      <div className="grid gap-2 items-center"
                        style={{ gridTemplateColumns: "1fr 90px 110px 90px" }}>
                        {/* Product — read only */}
                        <div className="px-3 py-2 rounded-xl text-sm truncate"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.08)", color: "#9ca3af" }}>
                          {returnItem.description || "—"}
                        </div>
                        {/* Qty */}
                        <input type="number" min="1" placeholder="Qty"
                          value={returnItem.qty}
                          onChange={e => setReturnItem(p => ({ ...p, qty: e.target.value }))}
                          style={{ width:"100%", outline:"none", background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(248,113,113,0.3)", borderRadius:10, padding:"9px 8px", color:"#fff", fontSize:13, textAlign:"center" }}
                        />
                        {/* Rate */}
                        <input type="number" min="0" placeholder="Rate"
                          value={returnItem.rate}
                          onChange={e => setReturnItem(p => ({ ...p, rate: e.target.value }))}
                          style={{ width:"100%", outline:"none", background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(248,113,113,0.3)", borderRadius:10, padding:"9px 10px", color:"#fff", fontSize:13, textAlign:"right" }}
                        />
                        {/* Return total */}
                        <p className="text-xs font-bold text-right pr-1"
                          style={{ color: returnTotal > 0 ? "#f87171" : "#4b5563" }}>
                          {returnTotal > 0 ? `- ${formatRs(returnTotal)}` : "—"}
                        </p>
                      </div>

                      {hasReturn && (
                        <div className="mt-1 px-3 py-2 rounded-lg text-xs"
                          style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
                          ↩️ Save hone par <strong>{formatRs(returnTotal)}</strong> balance se minus ho jaayega
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Discount ── */}
          <div>
            <p className={sect} style={{ color: "#F59E0B" }}>Discount</p>
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Discount Type">
                <StyledSelect value={form.discountType} onChange={set("discountType")}>
                  <option value="percent" style={{ background: "#0d1117" }}>Percentage (%)</option>
                  <option value="rupees"  style={{ background: "#0d1117" }}>Fixed Amount (Rs.)</option>
                </StyledSelect>
              </FInput>
              <FInput label={form.discountType === "percent" ? "Discount %" : "Discount (Rs.)"}>
                <StyledInput type="number" min="0" step="0.01"
                  placeholder={form.discountType === "percent" ? "e.g. 10" : "e.g. 500"}
                  value={form.discountValue} onChange={set("discountValue")} />
              </FInput>
            </div>
          </div>

          {/* ── Payment ── */}
          <div>
            <p className={sect} style={{ color: "#34d399" }}>Payment Details</p>
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Amount Already Paid (Rs.)">
                <StyledInput type="number" min="0" placeholder="0"
                  value={form.amountPaid} onChange={set("amountPaid")} />
              </FInput>
              <div className="rounded-xl p-3 flex flex-col justify-center"
                style={{ background: balance > 0 ? "rgba(248,113,113,0.06)" : "rgba(52,211,153,0.06)",
                  border: `1px solid ${balance > 0 ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)"}` }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                  style={{ color: balance > 0 ? "#f87171" : "#34d399" }}>
                  {balance > 0 ? "Balance Due" : "Fully Paid ✓"}
                </p>
                <p className="text-white font-black text-base">{formatRs(balance)}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">
                  Status: <span className="font-semibold" style={{
                    color: autoStatus === "Paid" ? "#34d399" : autoStatus === "Partial" ? "#fbbf24" : "#f87171"
                  }}>{autoStatus}</span>
                </p>
              </div>
            </div>
          </div>

          {/* ── Dates ── */}
          <div>
            <p className={sect} style={{ color: "#2563EB" }}>Dates & Terms</p>
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Invoice Date" req>
                <StyledInput type="date" value={form.invoiceDate} onChange={set("invoiceDate")} req />
              </FInput>
              <FInput label="Due Date (Payment Deadline)">
                <StyledInput type="date" value={form.dueDate} onChange={set("dueDate")} />
              </FInput>
            </div>
          </div>

          {/* ── Payment Collection (Only for Edit with Balance on actual items) ── */}
          {initial && hasRealItems && actualBalance > 0 && (
            <div>
              <p className={sect} style={{ color: "#10b981" }}>
                💰 Collect Payment
                <span className="ml-2 text-gray-600 normal-case tracking-normal font-normal">(optional - add new payment)</span>
              </p>
              <div className="p-4 rounded-xl" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Payer Info */}
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-green-400 mb-2 uppercase tracking-wide">👤 Payment From (Payer)</p>
                  </div>
                  <FInput label="Payer Name">
                    <StyledInput placeholder="e.g. Ali Ahmed" value={form.payerName || ""}
                      onChange={(e) => setForm(p => ({ ...p, payerName: e.target.value }))} />
                  </FInput>
                  <FInput label="Payer Contact">
                    <StyledInput type="tel" placeholder="+92 300 1234567" value={form.payerContact || ""}
                      onChange={(e) => setForm(p => ({ ...p, payerContact: e.target.value }))} />
                  </FInput>
                  
                  {/* Receiver Info */}
                  <div className="col-span-2 mt-2">
                    <p className="text-xs font-bold text-blue-400 mb-2 uppercase tracking-wide">💵 Payment To (Receiver)</p>
                  </div>
                  <FInput label="Receiver Name">
                    <StyledInput placeholder="e.g. Muhammad Salman" value={form.receiverName || ""}
                      onChange={(e) => setForm(p => ({ ...p, receiverName: e.target.value }))} />
                  </FInput>
                  <FInput label="Receiver Contact">
                    <StyledInput type="tel" placeholder="+92 300 7654321" value={form.receiverContact || ""}
                      onChange={(e) => setForm(p => ({ ...p, receiverContact: e.target.value }))} />
                  </FInput>
                  
                  {/* Payment Amount */}
                  <div className="col-span-2 mt-2">
                    <FInput label={`💸 Payment Amount (Max: ${formatRs(actualBalance)})`}>
                      <StyledInput type="number" min="0" max={actualBalance} step="0.01"
                        placeholder="0" value={form.newPaymentAmount || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          if (val <= actualBalance) {
                            setForm(p => ({ ...p, newPaymentAmount: e.target.value }));
                          }
                        }} />
                    </FInput>
                  </div>
                </div>
                
                {form.newPaymentAmount && Number(form.newPaymentAmount) > 0 && (
                  <div className="mt-3 p-3 rounded-lg" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)" }}>
                    <p className="text-xs text-green-300 mb-1 font-semibold">✓ Payment Preview:</p>
                    <p className="text-xs text-gray-400">
                      {form.payerName || "Payer"} will pay <span className="text-white font-bold">{formatRs(form.newPaymentAmount)}</span> to {form.receiverName || "Receiver"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      New Balance: <span className="text-amber-400 font-bold">{formatRs(Math.max(0, actualBalance - Number(form.newPaymentAmount)))}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Early Payment Condition ── */}
          <div>
            <p className={sect} style={{ color: "#fbbf24" }}>
              Early Payment Condition
              <span className="ml-2 text-gray-600 normal-case tracking-normal font-normal">(optional)</span>
            </p>
            <p className="text-gray-600 text-xs mb-3">Pay within X days → get Y% extra discount</p>
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Pay within (days)">
                <StyledInput type="number" min="1" placeholder="e.g. 7"
                  value={form.earlyDiscountDays} onChange={set("earlyDiscountDays")} />
              </FInput>
              <FInput label="Bonus Discount (%)">
                <StyledInput type="number" min="0" max="100" placeholder="e.g. 5"
                  value={form.earlyDiscountPercent} onChange={set("earlyDiscountPercent")} />
              </FInput>
            </div>
            {form.earlyDiscountDays && form.earlyDiscountPercent && (
              <div className="mt-2 px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}>
                💡 Pay within {form.earlyDiscountDays} days → get extra {form.earlyDiscountPercent}% off
              </div>
            )}
          </div>

          {/* ── Note ── */}
          <FInput label="Note / Remarks (optional)">
            <StyledTextarea placeholder="Any additional remarks or terms..." value={form.note} onChange={set("note")} rows={2} />
          </FInput>

          {/* ── Summary bar ── */}
          <div className="rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            {[
              { label: "Subtotal", val: formatRs(subtotal),           color: "#fff"     },
              { label: "Discount", val: `- ${formatRs(discount)}`,    color: "#fbbf24"  },
              { label: "Paid",     val: formatRs(paid),               color: "#34d399"  },
              { label: "Balance",  val: formatRs(balance), color: balance > 0 ? "#f87171" : "#34d399" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">{s.label}</p>
                <p className="font-black text-sm" style={{ color: s.color }}>{s.val}</p>
              </div>
            ))}
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 rounded-2xl text-sm font-black transition-all"
              style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)",
                color: "#000", opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving..." : initial ? "Update Invoice →" : "Save Invoice →"}
            </button>
          </div>

        </form>
      </div>
    </div>

    {/* product picker modal — for existing items */}
    {pickerIdx !== null && (
      <ProductPickerModal
        products={products}
        onSelect={handlePickerSelect}
        onClose={() => setPickerIdx(null)}
      />
    )}
    {/* product picker modal — for additional items */}
    {addPickerIdx !== null && (
      <ProductPickerModal
        products={products}
        onSelect={handleAddPickerSelect}
        onClose={() => setAddPickerIdx(null)}
      />
    )}
    </>
  );
}
