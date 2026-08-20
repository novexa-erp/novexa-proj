"use client";
import { useState, useEffect } from "react";
import {
  collection, getDocs, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import SweetAlert from "./SweetAlert";
import InvoicePDFModal from "./InvoicePDF";
import EmailConfirmationDialog from "./EmailConfirmationDialog";
import { generateInvoicePdfBase64, sendInvoiceEmail } from "@/lib/emailUtils";

// ── shared styles ─────────────────────────────────────────────────────────────
const base = {
  width: "100%", outline: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(255,255,255,0.09)",
  borderRadius: 10, padding: "9px 13px",
  color: "#fff", fontSize: 13,
  transition: "border-color .2s, background .2s",
};

const cardStyle = {
  background: "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 16,
  padding: "20px",
};

// ── Status styles ─────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  Paid:    { color: "#34d399", bg: "rgba(52,211,153,0.1)",   border: "rgba(52,211,153,0.25)"   },
  Unpaid:  { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  Partial: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
  Deleted: { color: "#9ca3af", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.2)" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRs(n) {
  if (!n && n !== 0) return "Rs. 0";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}

function fmtDate(ts, fallback) {
  if (!ts && !fallback) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : new Date(fallback);
    return d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return fallback || "—"; }
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DigitalRegisterView({ uid, userDoc, overviewTotalAmount, overviewCollected, overviewOutstanding }) {
  const [allInvoices, setAllInvoices] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filterType,  setFilterType]  = useState("all");   // all | direct | customer
  const [filterStatus,setFilterStatus]= useState("all");   // all | Paid | Unpaid | Partial | Deleted
  const [pdfInvoice,  setPdfInvoice]  = useState(null);
  const [alert,       setAlert]       = useState({ show: false, type: "", title: "", message: "" });
  const [emailConfirm,setEmailConfirm]= useState({ show: false, invoice: null });

  // ── Fetch all invoices (direct + every customer's invoices) ──────────────────
  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    async function fetchAll() {
      try {
        // 1. Direct invoices
        const directSnap = await getDocs(
          query(collection(db, "users", uid, "invoices"), orderBy("createdAt", "desc"))
        );
        const direct = directSnap.docs.map(d => ({
          id: d.id, ...d.data(),
          _source: "direct",
          _customerId: d.data().customerId || null,
          _customerName: null,
        }));

        // 2. All customers
        const custSnap = await getDocs(
          query(collection(db, "users", uid, "customers"), orderBy("createdAt", "desc"))
        );
        const customers = custSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 3. Each customer's invoices
        const custInvArrays = await Promise.all(
          customers.map(async (cust) => {
            const snap = await getDocs(
              query(collection(db, "users", uid, "customers", cust.id, "invoices"), orderBy("createdAt", "desc"))
            );
            return snap.docs.map(d => ({
              id: d.id, ...d.data(),
              _source: "customer",
              _customerId: cust.id,
              _customerName: cust.name || cust.businessName || "",
            }));
          })
        );
        const custInvs = custInvArrays.flat();

        // 4. Merge — pure direct (no customerId) + all customer invoices
        const merged = [
          ...direct.filter(i => !i.customerId),
          ...custInvs,
        ];

        merged.sort((a, b) => {
          const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.invoiceDate || 0);
          const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.invoiceDate || 0);
          return tb - ta;
        });

        setAllInvoices(merged);
      } catch (err) {
        console.error("[DigitalRegister] fetch error:", err);
      }
      setLoading(false);
    }

    fetchAll();
  }, [uid]);

  // ── Effective status ─────────────────────────────────────────────────────────
  function getEffectiveStatus(inv) {
    if (inv.deleted || inv.adminTrash) return "Deleted";
    const isPrevBal = it => (it.description || "").startsWith("Previous Balance · INV-");
    const actual = inv.actualAmount != null
      ? Number(inv.actualAmount)
      : (inv.items || []).filter(it => !isPrevBal(it))
          .reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0)
        || Number(inv.amount) || 0;
    const paid = Number(inv.amountPaid) || 0;
    const bal  = Math.max(0, actual - paid);
    if (bal === 0 && actual > 0) return "Paid";
    if (paid > 0) return "Partial";
    return "Unpaid";
  }

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = allInvoices.filter(inv => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q ||
      (inv.customerName || inv.customer || "").toLowerCase().includes(q) ||
      (inv._customerName || "").toLowerCase().includes(q) ||
      (inv.invoiceNumber || "").toLowerCase().includes(q) ||
      inv.id.toLowerCase().includes(q);

    const effStatus  = getEffectiveStatus(inv);
    const matchStatus = filterStatus === "all" || effStatus.toLowerCase() === filterStatus.toLowerCase();
    const matchType   = filterType === "all" ||
      (filterType === "direct"   && inv._source === "direct")   ||
      (filterType === "customer" && inv._source === "customer");

    return matchSearch && matchStatus && matchType;
  });

  // ── Stats ────────────────────────────────────────────────────────────────────
  function getStatAmt(inv) {
    const isPrevBal = it => (it.description || "").startsWith("Previous Balance · INV-");
    const itemsTotal = (inv.items || [])
      .filter(it => !isPrevBal(it))
      .reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
    const base = itemsTotal > 0
      ? itemsTotal
      : (inv.actualAmount != null ? Number(inv.actualAmount) : Number(inv.amount) || 0);
    const totalReturns = (inv._pastReturns || []).reduce((s, r) => s + (Number(r.returnAmount) || 0), 0);
    return Math.max(0, base - totalReturns);
  }

  // Stats: sirf non-deleted invoices (deleted:true ya adminTrash:true dono exclude)
  const activeInvoices  = allInvoices.filter(i => !i.deleted && !i.adminTrash);
  const totalInvoices   = activeInvoices.length;
  const totalAmount     = activeInvoices.reduce((s, i) => s + getStatAmt(i), 0);
  const totalCollected  = activeInvoices.reduce((s, i) => s + (Number(i.amountPaid) || 0), 0);
  const totalBalance    = activeInvoices.reduce((s, i) => s + Math.max(0, getStatAmt(i) - (Number(i.amountPaid) || 0)), 0);

  // ── Email handler ────────────────────────────────────────────────────────────
  async function handleSendEmail(inv) {
    const hasContact = !!(inv.email?.trim() || inv.phone?.trim());
    if (!hasContact) {
      setAlert({ show: true, type: "warning", title: "No Contact Info", message: "Is invoice mein email ya phone nahi hai." });
      return;
    }
    setEmailConfirm({ show: true, invoice: inv });
  }

  // ── WhatsApp handler ─────────────────────────────────────────────────────────
  function handleWhatsApp(inv) {
    const phone  = (inv.phone || "").replace(/\D/g, "");
    const invNum = inv.invoiceNumber || `INV-${inv.id.slice(-4).toUpperCase()}`;
    const bal    = Number(inv.balance) || 0;
    const msg    = `Assalam o Alaikum ${inv.customerName || inv.customer || ""},\n\nAapki invoice *${invNum}* ki details:\nTotal: ${formatRs(inv.amount)}\nPaid: ${formatRs(inv.amountPaid)}\nBalance: ${formatRs(bal)}\n\nShukriya!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 300 }}>
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-4 border-t-amber-500 border-r-purple-500 border-b-blue-500 border-l-pink-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">📒</div>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SweetAlert
        show={alert.show} type={alert.type} title={alert.title} message={alert.message}
        onClose={() => setAlert(a => ({ ...a, show: false }))}
      />

      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          📒 Digital Register
        </h1>
        <p style={{ color: "#9ca3af", fontSize: 13 }}>
          Saari invoices ka permanent record — normal aur customer dono. Delete karne ke baad bhi yahan dikhengi.
        </p>
      </div>

      {/* Info bar */}
      <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
        <p style={{ color: "#34d399", fontSize: 12, fontWeight: 600 }}>
          📒 Digital Register — saari invoices (normal + customer) yahan permanent record hain. Delete karne ke baad bhi yahan dikhengi.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total Invoices", val: totalInvoices,                                          icon: "🧾", color: "#F59E0B" },
          { label: "Total Amount",   val: formatRs(overviewTotalAmount   ?? totalAmount),          icon: "💰", color: "#a78bfa" },
          { label: "Collected",      val: formatRs(overviewCollected     ?? totalCollected),       icon: "💵", color: "#34d399" },
          { label: "Outstanding",    val: formatRs(overviewOutstanding   ?? totalBalance),         icon: "⏳", color: "#f87171" },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <p style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{s.label}</p>
            <p style={{ color: s.color, fontWeight: 800, fontSize: 15 }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
          <input
            type="text"
            placeholder="Invoice number ya customer name likhein..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...base, paddingLeft: 36, width: "100%" }}
          />
        </div>

        {/* Status filter */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {[
            { id: "all",     label: "All",     icon: "📋" },
            { id: "Unpaid",  label: "Unpaid",  icon: "❌" },
            { id: "Partial", label: "Partial", icon: "⚡" },
            { id: "Paid",    label: "Paid",    icon: "✅" },
            { id: "Deleted", label: "Deleted", icon: "🗑️" },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterStatus(f.id)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: filterStatus === f.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                border:     filterStatus === f.id ? "1px solid rgba(245,158,11,0.45)" : "1px solid rgba(255,255,255,0.08)",
                color:      filterStatus === f.id ? "#F59E0B" : "#9ca3af",
              }}>
              {f.icon} {f.label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {[
            { id: "all",      label: "All Types" },
            { id: "direct",   label: "Direct"    },
            { id: "customer", label: "Customer"  },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterType(f.id)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: filterType === f.id ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.04)",
                border:     filterType === f.id ? "1px solid rgba(96,165,250,0.35)" : "1px solid rgba(255,255,255,0.08)",
                color:      filterType === f.id ? "#60a5fa" : "#9ca3af",
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 110px 110px 110px 100px 180px", gap: 8, padding: "10px 16px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {["Invoice #", "Customer", "Amount", "Paid", "Balance", "Status", "Actions"].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{search ? "🔍" : "📒"}</div>
            <p style={{ color: "#9ca3af", fontSize: 14 }}>
              {search ? `"${search}" se koi invoice nahi mili.` : "Koi invoice nahi mili."}
            </p>
          </div>
        ) : (
          filtered.map((inv) => {
            const effStatus = getEffectiveStatus(inv);
            const st        = STATUS_STYLE[effStatus] || STATUS_STYLE["Unpaid"];
            const invNum    = inv.invoiceNumber || `INV-${inv.id.slice(-4).toUpperCase()}`;
            const custName  = inv.customerName || inv.customer || inv._customerName || "—";
            const dateStr   = fmtDate(inv.createdAt, inv.invoiceDate);
            const isDeleted = inv.deleted;

            return (
              <div
                key={`${inv._source}-${inv.id}`}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  opacity: isDeleted ? 0.65 : 1,
                  display: "grid",
                  gridTemplateColumns: "140px 1fr 110px 110px 110px 100px 180px",
                  gap: 8, padding: "12px 16px", alignItems: "center",
                }}>

                {/* Invoice number + date + badges */}
                <div>
                  <p style={{ color: "#F59E0B", fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{invNum}</p>
                  <p style={{ color: "#6b7280", fontSize: 10 }}>{dateStr}</p>
                  <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                    {isDeleted && (
                      <span style={{ fontSize: 9, color: "#6b7280", background: "rgba(156,163,175,0.1)", border: "1px solid rgba(156,163,175,0.2)", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                        DELETED
                      </span>
                    )}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                      color:       inv._source === "customer" ? "#a78bfa" : "#60a5fa",
                      background:  inv._source === "customer" ? "rgba(167,139,250,0.08)" : "rgba(96,165,250,0.08)",
                      border: `1px solid ${inv._source === "customer" ? "rgba(167,139,250,0.2)" : "rgba(96,165,250,0.2)"}`,
                    }}>
                      {inv._source === "customer" ? "CUST" : "DIRECT"}
                    </span>
                  </div>
                </div>

                {/* Customer name + phone */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{custName}</p>
                  {inv.phone && <p style={{ color: "#6b7280", fontSize: 10 }}>{inv.phone}</p>}
                </div>

                {/* Amount */}
                <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, textAlign: "right" }}>{formatRs(inv.amount)}</p>

                {/* Paid */}
                <p style={{ color: "#34d399", fontSize: 13, fontWeight: 600, textAlign: "right" }}>{formatRs(inv.amountPaid || 0)}</p>

                {/* Balance */}
                <p style={{ color: Number(inv.balance) > 0 ? "#f87171" : "#34d399", fontSize: 13, fontWeight: 600, textAlign: "right" }}>
                  {formatRs(inv.balance || 0)}
                </p>

                {/* Status badge */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: st.bg, color: st.color, border: `1px solid ${st.border}`, whiteSpace: "nowrap" }}>
                    {effStatus}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button onClick={() => setPdfInvoice(inv)} title="View / Print"
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
                    👁 View
                  </button>
                  {!isDeleted && inv.phone?.trim() && (
                    <button onClick={() => handleWhatsApp(inv)} title="WhatsApp"
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)", color: "#34d399" }}>
                      💬
                    </button>
                  )}
                  {!isDeleted && inv.email?.trim() && (
                    <button onClick={() => handleSendEmail(inv)} title="Email"
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa" }}>
                      📧
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Total count */}
      {filtered.length > 0 && (
        <p style={{ textAlign: "center", fontSize: 11, color: "#6b7280" }}>
          {filtered.length} invoice{filtered.length !== 1 ? "s" : ""} mili — register mein total {allInvoices.length} records hain
        </p>
      )}

      {/* PDF View Modal */}
      {pdfInvoice && (
        <InvoicePDFModal
          inv={pdfInvoice}
          uid={uid}
          userDoc={userDoc}
          onClose={() => setPdfInvoice(null)}
          payments={[]}
        />
      )}

      {/* Email Confirmation */}
      <EmailConfirmationDialog
        show={emailConfirm.show}
        recipientEmail={emailConfirm.invoice?.email}
        recipientPhone={emailConfirm.invoice?.phone}
        invoice={emailConfirm.invoice}
        userDoc={userDoc}
        isUpdate={true}
        documentType="invoice"
        getInvoiceImageFn={emailConfirm.invoice ? async () => {
          const { generateInvoiceImageBase64 } = await import("@/lib/emailUtils");
          return generateInvoiceImageBase64(emailConfirm.invoice, userDoc, []);
        } : undefined}
        onConfirm={async () => {
          if (emailConfirm.invoice) {
            try {
              const pdfBase64 = await generateInvoicePdfBase64(emailConfirm.invoice, userDoc, []);
              const result    = await sendInvoiceEmail(emailConfirm.invoice, userDoc, pdfBase64, uid, true, []);
              if (result.success) {
                setAlert({ show: true, type: "success", title: "Email Bhej Di! 📧", message: `Invoice ${emailConfirm.invoice.email} par bhej di gayi.` });
              } else {
                setAlert({ show: true, type: "warning", title: "Email Failed", message: `Email nahi bhej saki: ${result.error}` });
              }
            } catch {
              setAlert({ show: true, type: "error", title: "Email Failed", message: "Kuch masla hua email bhejte waqt." });
            }
          }
          setEmailConfirm({ show: false, invoice: null });
        }}
        onCancel={(reason) => {
          if (reason === "whatsapp" || reason === "both") {
            setAlert({ show: true, type: "success", title: "WhatsApp! 💬", message: "WhatsApp khul gaya — message bhej dein." });
          }
          setEmailConfirm({ show: false, invoice: null });
        }}
      />
    </div>
  );
}
