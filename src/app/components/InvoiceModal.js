"use client";
import { useState, useEffect, useRef } from "react";

// ── helpers ───────────────────────────────────────────────────────────────────
export function formatRs(n) {
  if (!n && n !== 0) return "Rs. 0";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}

export const EMPTY_FORM = {
  logoDataUrl: "",
  customerName: "", address: "", phone: "", email: "",
  items: [{ description: "", qty: 1, unitPrice: "", productId: "" }],
  discountType: "percent",
  discountValue: "",
  amountPaid: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  earlyDiscountDays: "", earlyDiscountPercent: "",
  note: "",
};

export function calcTotals(form) {
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
  return { subtotal, discount, afterDiscount, paid, balance };
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
            filtered.map(p => (
              <button key={p.id} type="button"
                onClick={() => onSelect(p)}
                className="w-full flex items-center justify-between px-5 py-3 text-left border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                <div>
                  <p className="text-white text-sm font-medium">{p.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Stock: <span style={{ color: (Number(p.stock) || 0) <= (Number(p.lowStockThreshold) || 10) ? "#fbbf24" : "#34d399" }}>
                      {p.stock ?? "—"}
                    </span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-amber-400 font-bold text-sm">{formatRs(p.price)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Item row with autocomplete ────────────────────────────────────────────────
function ItemRow({ item, idx, products, onChange, onRemove, canRemove, onOpenPicker }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const rowRef = useRef(null);

  // filter products by description typed
  function handleDescChange(val) {
    onChange(idx, "description", val);
    onChange(idx, "productId", ""); // clear link when manually typing
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
    onChange(idx, "unitPrice", String(p.price || ""));
    onChange(idx, "productId", p.id);
    setSuggestions([]);
    setShowSug(false);
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

  return (
    <div ref={rowRef} className="relative">
      <div className="grid gap-2 items-center"
        style={{ gridTemplateColumns: "1fr 64px 110px 80px 36px" }}>

        {/* description + autocomplete */}
        <div className="relative">
          <input placeholder="Item / product name" value={item.description}
            onChange={e => handleDescChange(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSug(true); }}
            autoComplete="off"
            style={{ ...base, paddingRight: 32 }} />
          {/* browse all button */}
          <button type="button" onClick={() => onOpenPicker(idx)}
            title="Browse all products"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-amber-400 transition-colors text-sm">
            📦
          </button>

          {/* autocomplete dropdown */}
          {showSug && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-30"
              style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
              {suggestions.map(p => (
                <button key={p.id} type="button"
                  onMouseDown={() => selectSuggestion(p)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="text-white text-xs font-medium">{p.name}</p>
                    <p className="text-gray-500 text-[10px]">Stock: {p.stock ?? "—"}</p>
                  </div>
                  <p className="text-amber-400 text-xs font-bold ml-2 flex-shrink-0">{formatRs(p.price)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <input type="number" min="1" placeholder="1" value={item.qty}
          onChange={e => onChange(idx, "qty", e.target.value)}
          style={{ ...base, textAlign: "center", padding: "9px 6px" }} />

        <input type="number" min="0" placeholder="Unit price" value={item.unitPrice}
          onChange={e => onChange(idx, "unitPrice", e.target.value)}
          style={{ ...base, textAlign: "right", padding: "9px 10px" }} />

        {/* line total */}
        <p className="text-xs font-semibold text-right flex-shrink-0 pr-1"
          style={{ color: lineTotal > 0 ? "#fff" : "#4b5563" }}>
          {lineTotal > 0 ? formatRs(lineTotal) : "—"}
        </p>

        <button type="button" onClick={() => onRemove(idx)} disabled={!canRemove}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          style={{ color: "#f87171", background: "rgba(248,113,113,0.08)", opacity: canRemove ? 1 : 0.25 }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function InvoiceModal({ onClose, onSave, saving, initial, products = [], settingsLogo = "" }) {
  // if no initial logo provided, use settingsLogo as default
  const defaultForm = settingsLogo
    ? { ...EMPTY_FORM, logoDataUrl: settingsLogo }
    : EMPTY_FORM;

  const [form, setForm]           = useState(initial || defaultForm);
  const [pickerIdx, setPickerIdx] = useState(null);
  const overlayRef                = useRef(null);
  const logoInputRef              = useRef(null);

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
    setForm(p => ({ ...p, items: [...p.items, { description: "", qty: 1, unitPrice: "", productId: "" }] }));
  }
  function removeItem(idx) {
    setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  }

  // select from picker modal
  function handlePickerSelect(p) {
    if (pickerIdx === null) return;
    setItem(pickerIdx, "description", p.name);
    setItem(pickerIdx, "unitPrice", String(p.price || ""));
    setItem(pickerIdx, "productId", p.id);
    setPickerIdx(null);
  }

  const { subtotal, discount, afterDiscount, paid, balance } = calcTotals(form);
  const autoStatus = balance === 0 && afterDiscount > 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...form, subtotal, discount, amount: afterDiscount, amountPaid: paid, balance, status: autoStatus });
  }

  const sect = "text-xs font-bold uppercase tracking-widest mb-3 pb-2 border-b border-white/10";

  return (
    <>
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
                <span>Description <span className="text-gray-700 normal-case font-normal">(type to search)</span></span>
                <span className="text-center">Qty</span>
                <span className="text-right">Unit Price</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              {form.items.map((item, idx) => (
                <ItemRow key={idx} item={item} idx={idx} products={products}
                  onChange={setItem} onRemove={removeItem}
                  canRemove={form.items.length > 1}
                  onOpenPicker={(i) => setPickerIdx(i)} />
              ))}
              <button type="button" onClick={addItem}
                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl w-fit transition-colors mt-1"
                style={{ color: "#60A5FA", background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
                ➕ Add Another Item
              </button>
            </div>
          </div>

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

    {/* product picker modal — rendered outside main modal */}
    {pickerIdx !== null && (
      <ProductPickerModal
        products={products}
        onSelect={handlePickerSelect}
        onClose={() => setPickerIdx(null)}
      />
    )}
    </>
  );
}
