"use client";
import { useState, useRef, useEffect } from "react";
import {
  collection, addDoc, doc, updateDoc, serverTimestamp, runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getLimits, checkMonthlyLimit, loadPlansFromFirestore, getEffectiveLimit } from "@/lib/planLimits";
import InvoiceModal, { formatRs } from "./InvoiceModal";
import InvoicePDFModal, { InvoiceTemplateForEmail } from "./InvoicePDF";
import SweetAlert from "./SweetAlert";
import EmailConfirmationDialog from "./EmailConfirmationDialog";
import { generateInvoicePdfBase64, sendInvoiceEmail } from "@/lib/emailUtils";

// ── Generate PDF base64 from invoice data (for email attachment) ──────────────

const STATUS_STYLE = {
  Paid:    { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)"  },
  Unpaid:  { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
  Partial: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)"  },
};

// ── Variant multiplier helper ─────────────────────────────────────────────────
// For inventory product variants (productId set), price is already fixed — multiplier = 1.
// For custom/manual variants (no productId), the label may encode a quantity (e.g. "0.5 kg").
function getVarMult(item) {
  if (!item.variantLabel || item.productId) return 1;
  const n = parseFloat(item.variantLabel);
  return (!isNaN(n) && n > 0) ? n : 1;
}

// ── Global invoice serial counter ─────────────────────────────────────────────
// Format: INV-01140726  (serial 2-digit + DD + MM + YY)
async function getNextInvoiceNumber() {
  const counterRef = doc(db, "globalCounters", "invoiceSerial");
  let serial;
  await runTransaction(db, async (txn) => {
    const snap = await txn.get(counterRef);
    serial = snap.exists() ? (snap.data().count || 0) + 1 : 1;
    txn.set(counterRef, { count: serial });
  });
  const now = new Date();
  const dd  = String(now.getDate()).padStart(2, "0");
  const mm  = String(now.getMonth() + 1).padStart(2, "0");
  const yy  = String(now.getFullYear()).slice(-2);
  return `INV-${String(serial).padStart(2, "0")}${dd}${mm}${yy}`;
}

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

export default function InvoicesView({ uid, invoices, loading, products = [], userDoc, payments = [], highlightId = null }) {
  const [activeTab,    setActiveTab]    = useState("All");
  const [showModal,    setShowModal]    = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [deleteConf,   setDeleteConf]   = useState(null);
  const [search,       setSearch]       = useState("");
  const [pdfInvoice,   setPdfInvoice]   = useState(null);
  const [flashId,      setFlashId]      = useState(null);
  const [monthlyCount,  setMonthlyCount]  = useState(null); // invoices created this month
  const [planLimitVal,  setPlanLimitVal]  = useState(null); // dynamic invoice limit from Firestore
  const rowRefs = useRef({});

  // Sweet Alert State
  const [alert, setAlert] = useState({ show: false, type: "", title: "", message: "" });
  
  // Email Confirmation Dialog State
  const [emailConfirm, setEmailConfirm] = useState({ show: false, invoice: null, isUpdate: false });

  // ── Quick Pay Modal State ────────────────────────────────────────────────────
  const [payTarget,   setPayTarget]   = useState(null); // invoice obj for quick pay
  const [savingPay,   setSavingPay]   = useState(false);
  const [payForm,     setPayForm]     = useState({ amount: "", method: "cash", payerName: "", payerContact: "", receiverName: "", receiverContact: "" });

  // ── Quick Return Modal State ─────────────────────────────────────────────────
  const [returnTarget, setReturnTarget] = useState(null); // invoice obj for quick return
  const [savingReturn, setSavingReturn] = useState(false);
  const [returnForm,   setReturnForm]   = useState({ description: "", qty: "", rate: "", productId: "", variantId: "", variantLabel: "", variantUnit: "", maxQty: 0 });

  // ── Actions dropdown state ───────────────────────────────────────────────────
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Load monthly invoice count ─────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const plan = userDoc?.plan || "starter";
    // Load dynamic limit from Firestore
    loadPlansFromFirestore().then(fsPlans => {
      const limits = getLimits(plan, fsPlans);
      const base   = limits.invoicesPerMonth ?? null;
      const effective = getEffectiveLimit(base, "invoicesPerMonth", userDoc?.extraLimits, userDoc?.extraLimitsExpiresAt);
      setPlanLimitVal(effective);
    });
    import("@/lib/planLimits").then(({ countThisMonth }) => {
      import("firebase/firestore").then(({ collection }) => {
        import("@/lib/firebase").then(({ db: fdb }) => {
          countThisMonth(collection(fdb, "users", uid, "invoices"), userDoc?.activeFrom)
            .then(n => setMonthlyCount(n));
        });
      });
    });
  }, [uid, invoices, userDoc?.plan, userDoc?.extraLimits, userDoc?.extraLimitsExpiresAt]);

  // ── Scroll to & flash highlighted invoice ──────────────────────────────────
  useEffect(() => {
    if (!highlightId) return;
    // Switch to "All" tab and clear search so the row is definitely visible
    setActiveTab("All");
    setSearch("");

    // Try multiple times — rows may not be in DOM immediately after tab switch
    let attempts = 0;
    const tryScroll = () => {
      attempts++;
      const el = rowRefs.current[highlightId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setFlashId(null); // reset first so animation re-triggers
        setTimeout(() => setFlashId(highlightId), 50);
        setTimeout(() => setFlashId(null), 2500);
      } else if (attempts < 10) {
        setTimeout(tryScroll, 200); // retry every 200ms up to 10 times
      }
    };
    const timer = setTimeout(tryScroll, 100);
    return () => clearTimeout(timer);
  }, [highlightId, invoices]); // re-run when invoices data arrives
  
  // ★ Add to Inventory Dialog State
  const [nonInventoryDialog, setNonInventoryDialog] = useState({ show: false, items: [], costPrices: [], formData: null });

  // only show invoices NOT linked to a customer AND not soft-deleted
  // Exception: if highlightId is set and it belongs to a customer invoice, show it too
  const directInvoices = invoices.filter(i => {
    if (i.deleted) return false;
    if (i.customerId && i.id !== highlightId) return false; // hide customer invoices unless it's the highlighted one
    return true;
  });

  // filter — use effectiveStatus (recalculated from actualAmount) not stored status
  const filtered = directInvoices.filter(inv => {
    const isPrevBalItem = it => (it.description || "").startsWith("Previous Balance · INV-");
    const invActualAmt = inv.actualAmount != null
      ? Number(inv.actualAmount)
      : (inv.items || []).filter(it => !isPrevBalItem(it))
          .reduce((s, it) => s + (Number(it.qty) || 0) * getVarMult(it) * (Number(it.unitPrice) || 0), 0)
        || Number(inv.amount) || 0;
    const invAmtPaid = Number(inv.amountPaid) || 0;
    const invActualBalance = Math.max(0, invActualAmt - invAmtPaid);
    const effStatus = invActualBalance === 0 && invActualAmt > 0 ? "Paid" : invAmtPaid > 0 ? "Partial" : "Unpaid";

    const matchTab    = activeTab === "All" || effStatus === activeTab;
    const matchSearch = !search ||
      (inv.customerName || inv.customer || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.id || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.invoiceNumber || "").toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  // ── Quick Pay handler ──────────────────────────────────────────────────────
  async function handleQuickPay() {
    if (!payTarget || savingPay) return;
    const paymentAmount = Number(payForm.amount) || 0;
    if (paymentAmount <= 0) return;

    const inv = payTarget;
    const isPrevBalItem = it => (it.description || "").startsWith("Previous Balance · INV-");
    const invActualAmt  = inv.actualAmount != null
      ? Number(inv.actualAmount)
      : (inv.items || []).filter(it => !isPrevBalItem(it))
          .reduce((s, it) => s + (Number(it.qty) || 0) * getVarMult(it) * (Number(it.unitPrice) || 0), 0)
        || Number(inv.amount) || 0;
    const currentPaid     = Number(inv.amountPaid) || 0;
    const previousBalance = Math.max(0, invActualAmt - currentPaid);
    const newTotalPaid    = currentPaid + paymentAmount;
    const newBalance      = Math.max(0, invActualAmt - newTotalPaid);
    const newStatus       = newBalance === 0 ? "Paid" : newTotalPaid > 0 ? "Partial" : "Unpaid";

    setSavingPay(true);
    try {
      await updateDoc(doc(db, "users", uid, "invoices", inv.id), {
        amountPaid:      newTotalPaid,
        balance:         newBalance,
        status:          newStatus,
        lastPaymentAt:   serverTimestamp(),
        updatedAt:       serverTimestamp(),
      });

      await addDoc(collection(db, "users", uid, "payments"), {
        type:            "received",
        amount:          previousBalance,
        paid:            paymentAmount,
        balance:         newBalance,
        invoiceId:       inv.id,
        invoiceNumber:   inv.invoiceNumber || `INV-${inv.id.slice(-4).toUpperCase()}`,
        customer:        inv.customerName || inv.customer || "",
        payerName:       payForm.payerName || inv.customerName || "",
        payerContact:    payForm.payerContact || inv.phone || "",
        receiverName:    payForm.receiverName || "",
        receiverContact: payForm.receiverContact || "",
        description:     `Payment for invoice ${inv.invoiceNumber || inv.id.slice(-4).toUpperCase()}`,
        method:          payForm.method || "cash",
        status:          newStatus,
        createdAt:       serverTimestamp(),
      });

      setAlert({
        show: true, type: "success",
        title: "Payment Collected! 💰",
        message: `${formatRs(paymentAmount)} collect ho gaya. Invoice status: ${newStatus}.`,
      });
      setPayTarget(null);
      setPayForm({ amount: "", method: "cash", payerName: "", payerContact: "", receiverName: "", receiverContact: "" });
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Payment Failed", message: err.message || "Kuch masla hua." });
    }
    setSavingPay(false);
  }

  // ── Quick Return handler ────────────────────────────────────────────────────
  async function handleQuickReturn() {
    if (!returnTarget || savingReturn) return;
    const { description, qty, rate, productId, variantId, variantLabel, variantUnit } = returnForm;
    if (!description || !Number(qty) || !Number(rate)) return;

    const inv    = returnTarget;
    const retVarMult     = variantLabel ? (parseFloat(variantLabel) > 0 ? parseFloat(variantLabel) : 1) : 1;
    const returnAmount   = (Number(qty) || 0) * retVarMult * (Number(rate) || 0);

    setSavingReturn(true);
    try {
      // Restore stock
      if (productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
          const productRef = doc(db, "users", uid, "products", productId);
          const qtyToRestore = Number(qty) || 0;
          if (variantId && product.variants?.length > 0) {
            const updatedVariants = product.variants.map((v, vIdx) => {
              const varId = v.id || `var_${vIdx}`;
              if (varId === variantId) return { ...v, stock: (Number(v.stock) || 0) + qtyToRestore };
              return v;
            });
            await updateDoc(productRef, { variants: updatedVariants, updatedAt: serverTimestamp() });
          } else {
            await updateDoc(productRef, { stock: (Number(product.stock) || 0) + qtyToRestore, updatedAt: serverTimestamp() });
          }
        }
      }

      // Record return in invoice's _pastReturns
      const pastReturns = Array.isArray(inv._pastReturns) ? [...inv._pastReturns] : [];
      pastReturns.push({ description, qty: Number(qty), rate: Number(rate), returnAmount, variantLabel, variantUnit, returnedAt: new Date().toISOString() });

      // Recalculate invoice amounts
      const isPrevBalItem = it => (it.description || "").startsWith("Previous Balance · INV-");
      const totalPastRet  = pastReturns.reduce((s, r) => s + (Number(r.returnAmount) || 0), 0);
      const invActualAmt  = inv.actualAmount != null
        ? Number(inv.actualAmount)
        : (inv.items || []).filter(it => !isPrevBalItem(it))
            .reduce((s, it) => s + (Number(it.qty) || 0) * getVarMult(it) * (Number(it.unitPrice) || 0), 0)
          || Number(inv.amount) || 0;
      const baseAfterRet  = Math.max(0, invActualAmt - totalPastRet);
      const currentPaid   = Number(inv.amountPaid) || 0;
      const newBalance    = Math.max(0, baseAfterRet - currentPaid);
      const newStatus     = newBalance === 0 && baseAfterRet > 0 ? "Paid" : currentPaid > 0 ? "Partial" : "Unpaid";

      await updateDoc(doc(db, "users", uid, "invoices", inv.id), {
        _pastReturns: pastReturns,
        balance:      newBalance,
        status:       newStatus,
        updatedAt:    serverTimestamp(),
      });

      // Payment record for return
      await addDoc(collection(db, "users", uid, "payments"), {
        type:          "return",
        amount:        returnAmount,
        invoiceId:     inv.id,
        invoiceNumber: inv.invoiceNumber || `INV-${inv.id.slice(-4).toUpperCase()}`,
        customer:      inv.customerName || inv.customer || "",
        description:   `Return: ${description}${variantLabel ? ` (${variantLabel})` : ""} × ${qty}`,
        createdAt:     serverTimestamp(),
      });

      setAlert({
        show: true, type: "success",
        title: "Return Recorded! ↩️",
        message: `${description} — ${formatRs(returnAmount)} balance se minus ho gaya.`,
      });
      setReturnTarget(null);
      setReturnForm({ description: "", qty: "", rate: "", productId: "", variantId: "", variantLabel: "", variantUnit: "", maxQty: 0 });
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Return Failed", message: err.message || "Kuch masla hua." });
    }
    setSavingReturn(false);
  }

  // ── Save (create or update) ────────────────────────────────────────────────
  async function handleSave(formData) {
    if (!uid || saving) return;
    
    // ★ Check for non-inventory items (items without productId)
    const nonInvItems = formData.items.filter(it => 
      it.description && it.description.trim() && !it.productId && it.qty && it.unitPrice
    );
    
    if (nonInvItems.length > 0 && !editTarget) {
      // initialize costPrices array — blank for each item
      setNonInventoryDialog({ show: true, items: nonInvItems, costPrices: nonInvItems.map(() => ""), formData });
      return;
    }
    
    // Proceed with normal save
    await saveInvoiceToFirebase(formData);
  }
  
  // ★ Helper function to actually save invoice
  async function saveInvoiceToFirebase(formData) {
    if (!uid || saving) return;

    // ── Monthly invoice limit check (create only, not edit) ──────────────────
    if (!editTarget) {
      const plan        = userDoc?.plan || "starter";
      const fsPlans     = await loadPlansFromFirestore();
      const limits      = getLimits(plan, fsPlans);
      if (limits.invoicesPerMonth !== null) {
        const { allowed, current, limit } = await checkMonthlyLimit(
          collection(db, "users", uid, "invoices"),
          limits.invoicesPerMonth,
          userDoc?.activeFrom,
          userDoc?.extraLimits?.invoicesPerMonth,
          userDoc?.extraLimitsExpiresAt
        );
        if (!allowed) {
          setAlert({
            show: true, type: "error",
            title: "Monthly Limit Reached 🚫",
            message: `Aapne is mahine ${current} invoices bana liye hain. ${plan.charAt(0).toUpperCase()+plan.slice(1)} plan ki limit ${limit}/month hai. Aglay mahine phir bana sakte hain ya plan upgrade karein.`,
          });
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        logoDataUrl:          formData.logoDataUrl || "",
        customerName:         formData.customerName,
        customer:             formData.customerName, // backward compat
        address:              formData.address,
        phone:                formData.phone,
        email:                formData.email,
        // snapshot costPriceAtTime on each item so future price changes don't affect old invoices
        items: formData.items.map(item => {
          if (!item.productId) return item;
          const prod = products.find(p => p.id === item.productId);
          if (!prod) return item;
          // find cost price — variant first, then product level
          let cp = 0;
          if (prod.variants?.length > 0) {
            let v = null;
            if (item.variantId) {
              v = prod.variants.find(vr => vr.id === item.variantId);
              if (!v) { const idx = Number(item.variantId); if (!isNaN(idx)) v = prod.variants[idx]; }
            }
            if (!v && item.variantLabel) {
              v = prod.variants.find(vr => (vr.label || "").toLowerCase() === (item.variantLabel || "").toLowerCase());
              if (!v) { const n = parseFloat(item.variantLabel); if (!isNaN(n)) v = prod.variants.find(vr => parseFloat(vr.label) === n); }
            }
            if (!v && prod.variants.length === 1) v = prod.variants[0];
            cp = v ? (Number(v.costPrice) || 0) : (Number(prod.costPrice) || 0);
          } else {
            cp = Number(prod.costPrice) || 0;
          }
          return { ...item, costPriceAtTime: cp };
        }),
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
          // Use actualAmount (excluding prev balance carry-forward) for payment calculation
          const invActualAmount = payload.actualAmount || payload.amount;
          const currentPaid = Number(formData.amountPaid) || 0;
          const previousBalance = Math.max(0, invActualAmount - currentPaid);
          const newTotalPaid = currentPaid + paymentAmount;
          const newBalance = Math.max(0, invActualAmount - newTotalPaid);
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
            invoiceNumber: editTarget.invoiceNumber || `INV-${editTarget.id.slice(-4).toUpperCase()}`,
            customer: formData.customerName,
            payerName: formData.payerName || formData.customerName,
            payerContact: formData.payerContact || formData.phone,
            receiverName: formData.receiverName || "",
            receiverContact: formData.receiverContact || "",
            description: `Payment for invoice ${editTarget.invoiceNumber || editTarget.id.slice(-4).toUpperCase()}`,
            method: formData.paymentMethod || "cash",
            status: newStatus,                  // Partial / Paid
            createdAt: serverTimestamp(),
          });
          
          // ── Show send dialog if email OR phone available ────────────────
          const hasContact = !!(formData.email?.trim() || formData.phone?.trim());
          if (!hasContact) {
            setAlert({
              show: true,
              type: "success",
              title: "Payment Collected! 💰",
              message: `Payment of ${formatRs(paymentAmount)} collected from ${formData.payerName || formData.customerName}. Invoice updated to ${newStatus}.`,
            });
          } else {
            const updatedInvoice = { ...payload, id: editTarget.id, amountPaid: newTotalPaid, balance: newBalance, status: newStatus };
            setEmailConfirm({ show: true, invoice: updatedInvoice, isUpdate: true });
          }
        } else {
          // ── Show send dialog if email OR phone available ────────────────
          const hasContactUpd = !!(formData.email?.trim() || formData.phone?.trim());
          if (!hasContactUpd) {
            setAlert({
              show: true,
              type: "success",
              title: "Invoice Updated! ✓",
              message: `Invoice for ${formData.customerName} has been updated successfully.`,
            });
          } else {
            setEmailConfirm({ show: true, invoice: { ...payload, id: editTarget.id }, isUpdate: true });
          }
        }
      } else {
        // Create new invoice — generate global serial invoice number first
        const invoiceNumber = await getNextInvoiceNumber();

        const newDocRef = await addDoc(collection(db, "users", uid, "invoices"), {
          ...payload,
          invoiceNumber,
          originalAmountPaid: payload.amountPaid,
          originalBalance:    payload.balance,
          originalStatus:     payload.status,
          createdAt: serverTimestamp(),
        });

        // ── Create initial payment record if amountPaid > 0 at invoice creation ──
        if (Number(payload.amountPaid) > 0) {
          await addDoc(collection(db, "users", uid, "payments"), {
            type:            "received",
            amount:          Number(payload.amount) || 0,      // total invoice amount
            paid:            Number(payload.amountPaid),        // amount paid at creation
            balance:         Number(payload.balance) || 0,      // remaining balance
            historyBalance:  Number(payload.balance) || 0,
            invoiceId:       newDocRef.id,
            invoiceNumber:   invoiceNumber,
            customer:        payload.customerName,
            payerName:       formData.payerName || payload.customerName,
            payerContact:    formData.payerContact || payload.phone,
            receiverName:    formData.receiverName || "",
            receiverContact: formData.receiverContact || "",
            description:     `Initial payment for invoice ${invoiceNumber}`,
            method:          formData.paymentMethod || "cash",
            status:          payload.status,
            createdAt:       serverTimestamp(),
          });
        }
        
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
        
        // ── Show send dialog if customer has email OR phone (for WhatsApp) ──────
        const hasContactForNotify = !!(formData.email?.trim() || formData.phone?.trim());
        if (!hasContactForNotify) {
          setAlert({
            show: true,
            type: "success",
            title: "Invoice Created! 🧾",
            message: `New invoice for ${formData.customerName} has been created successfully. Stock updated.`,
          });
        } else {
          const invoiceForSend = { ...payload, id: newDocRef.id };
          setEmailConfirm({ show: true, invoice: invoiceForSend, isUpdate: false });
        }
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
  
  // ★ Handle adding non-inventory items to inventory
  async function handleAddToInventory() {
    // Validate — all cost prices must be filled
    const missing = nonInventoryDialog.costPrices.some(cp => !cp || isNaN(Number(cp)) || Number(cp) < 0);
    if (missing) {
      setAlert({ show: true, type: "error", title: "Cost Price Required", message: "Please enter cost price for all items before saving." });
      return;
    }
    
    try {
      const { items, costPrices, formData } = nonInventoryDialog;
      const updatedItems = [...formData.items];
      let nonInvIdx = 0; // tracks index into items/costPrices arrays
      
      // Create products in inventory for each non-inventory item
      for (let i = 0; i < updatedItems.length; i++) {
        const item = updatedItems[i];
        
        // Skip if already has productId
        if (item.productId) continue;
        
        // Check if this item needs to be added
        const shouldAdd = items.some(ni => ni.description === item.description);
        if (!shouldAdd) continue;
        
        const cp = Number(costPrices[nonInvIdx]) || 0;
        const sp = Number(item.unitPrice) || 0;
        nonInvIdx++;
        
        // Map variantUnit to proper variantType
        let variantType = "none";
        if (item.variantLabel) {
          const unit = (item.variantUnit || "").toLowerCase();
          if (unit === "kg") variantType = "weight";
          else if (unit === "l" || unit === "ltr" || unit === "liter") variantType = "volume";
          else if (unit === "m" || unit === "mtr" || unit === "meter") variantType = "length";
          else variantType = "custom";
        }
        
        // Create product in inventory
        const productData = {
          name: item.description,
          description: `Added from invoice on ${new Date().toLocaleDateString()}`,
          variantType,
          costPrice: cp,
          sellingPrice: sp,
          price: sp,
          stock: 0,
          createdAt: serverTimestamp(),
        };
        
        // If item has variant info, add it
        if (item.variantLabel) {
          productData.variants = [{
            label: item.variantLabel,
            costPrice: cp,
            sellingPrice: sp,
            price: sp,
            stock: 0,
          }];
        }
        
        // Add product to Firestore
        const newProductRef = await addDoc(collection(db, `users/${uid}/products`), productData);
        
        // Update item with new productId
        updatedItems[i] = { ...item, productId: newProductRef.id };
      }
      
      // Close dialog
      setNonInventoryDialog({ show: false, items: [], costPrices: [], formData: null });
      
      // Now save invoice with updated items
      await saveInvoiceToFirebase({ ...formData, items: updatedItems });
      
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        title: "Failed to Add Products",
        message: err.message || "Could not add products to inventory.",
      });
      setNonInventoryDialog({ show: false, items: [], formData: null });
    }
  }
  
  // ★ Handle skipping inventory addition
  function handleSkipInventory() {
    const { formData } = nonInventoryDialog;
    setNonInventoryDialog({ show: false, items: [], costPrices: [], formData: null });
    saveInvoiceToFirebase(formData);
  }

  // ── Delete (soft) — restores stock + reverses financials ─────────────────
  async function handleDelete(id) {
    const inv = invoices.find(i => i.id === id);
    if (!inv) { setDeleteConf(null); return; }

    try {
      // 1. Restore stock for every item in the invoice
      for (const item of (inv.items || [])) {
        const isPrevBal = (item.description || "").startsWith("Previous Balance · INV-");
        if (isPrevBal || !item.productId || !item.qty) continue;

        const product = products.find(p => p.id === item.productId);
        if (!product) continue;

        const qtyToRestore = Number(item.qty) || 0;
        const productRef = doc(db, "users", uid, "products", item.productId);

        if (item.variantId && product.variants?.length > 0) {
          const updatedVariants = product.variants.map((v, vIdx) => {
            const varId = v.id || `var_${vIdx}`;
            if (varId === item.variantId) {
              return { ...v, stock: (Number(v.stock) || 0) + qtyToRestore };
            }
            return v;
          });
          await updateDoc(productRef, { variants: updatedVariants, updatedAt: serverTimestamp() });
        } else {
          await updateDoc(productRef, {
            stock: (Number(product.stock) || 0) + qtyToRestore,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // 2. Soft-delete the invoice (with snapshot of stock-items for restore later)
      await updateDoc(doc(db, "users", uid, "invoices", id), {
        deleted:          true,
        deletedAt:        serverTimestamp(),
        // snapshot financials so restore can reverse them correctly
        _deletedAmount:   Number(inv.amount)      || 0,
        _deletedAmtPaid:  Number(inv.amountPaid)  || 0,
        _deletedBalance:  Number(inv.balance)     || 0,
      });

      // 3. Build a concise item description for the success message
      const itemSummary = (inv.items || [])
        .filter(it => !(it.description || "").startsWith("Previous Balance · INV-") && it.description)
        .map(it => `${it.qty}× ${it.description}${it.variantLabel ? ` (${it.variantLabel})` : ""}`)
        .join(", ");

      setAlert({
        show: true,
        type: "success",
        title: "Invoice Deleted 🗑️",
        message: `Invoice moved to Trash. Stock restored${itemSummary ? ": " + itemSummary : ""}. You can restore it within 15 days.`,
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

      {/* Monthly Usage Banner */}
      {(() => {
        const limit  = planLimitVal;
        if (limit === null || monthlyCount === null) return null;
        const used   = monthlyCount;
        const pct    = Math.min(100, Math.round((used / limit) * 100));
        const left   = limit - used;
        const isWarn = pct >= 80;
        const isFull = pct >= 100;
        return (
          <div className="rounded-xl px-4 py-3 flex items-center gap-4"
            style={{
              background: isFull ? "rgba(239,68,68,0.08)" : isWarn ? "rgba(251,191,36,0.08)" : "rgba(37,99,235,0.06)",
              border: `1px solid ${isFull ? "rgba(239,68,68,0.3)" : isWarn ? "rgba(251,191,36,0.3)" : "rgba(37,99,235,0.2)"}`,
            }}>
            <span className="text-xl flex-shrink-0">{isFull ? "🚫" : isWarn ? "⚠️" : "📊"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold" style={{ color: isFull ? "#f87171" : isWarn ? "#fbbf24" : "#93c5fd" }}>
                  {isFull ? "Monthly invoice limit reached!" : `This month: ${used} / ${limit} invoices created`}
                </p>
                <span className="text-xs font-bold" style={{ color: isFull ? "#f87171" : isWarn ? "#fbbf24" : "#60a5fa" }}>
                  {isFull ? "0 left" : `${left} left`}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: isFull ? "#ef4444" : isWarn ? "linear-gradient(90deg,#fbbf24,#f97316)" : "linear-gradient(90deg,#2563eb,#60a5fa)",
                  }} />
              </div>
            </div>
          </div>
        );
      })()}

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

        {/* list header — lg+ full columns */}
        <div className="hidden lg:flex px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-white border-b border-white/[0.05]">
          <span className="flex-1 min-w-0">Customer</span>
          <span style={{ width: 120, textAlign: "right", flexShrink: 0 }}>Amount</span>
          <span style={{ width: 110, textAlign: "right", flexShrink: 0 }}>Paid</span>
          <span style={{ width: 110, textAlign: "right", flexShrink: 0 }}>Balance</span>
          <span style={{ width: 100, textAlign: "center", flexShrink: 0 }}>Status</span>
          <span style={{ width: 150, textAlign: "right", flexShrink: 0 }}>Actions</span>
        </div>
        {/* md only header — no Paid/Balance columns */}
        <div className="hidden md:flex lg:hidden px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-white border-b border-white/[0.05]">
          <span className="flex-1 min-w-0">Customer</span>
          <span style={{ width: 110, textAlign: "right", flexShrink: 0 }}>Amount</span>
          <span style={{ width: 80, textAlign: "center", flexShrink: 0, marginLeft: 8 }}>Status</span>
          <span style={{ width: 100, textAlign: "right", flexShrink: 0 }}>Actions</span>
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
            const isPrevBalItem = it => (it.description || "").startsWith("Previous Balance · INV-");
            const invActualAmt = inv.actualAmount != null
              ? Number(inv.actualAmount)
              : (inv.items || []).filter(it => !isPrevBalItem(it))
                  .reduce((s, it) => s + (Number(it.qty) || 0) * getVarMult(it) * (Number(it.unitPrice) || 0), 0)
                || Number(inv.amount) || 0;
            const invAmtPaid = Number(inv.amountPaid) || 0;
            const invActualBalance = Math.max(0, invActualAmt - invAmtPaid);
            const effectiveStatus = invActualBalance === 0 && invActualAmt > 0
              ? "Paid"
              : invAmtPaid > 0 ? "Partial" : "Unpaid";

            const st       = STATUS_STYLE[effectiveStatus] || STATUS_STYLE["Unpaid"];
            const dateStr  = inv.createdAt?.toDate
              ? inv.createdAt.toDate().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
              : inv.invoiceDate || "—";
            const num      = inv.id.slice(-4).toUpperCase();
            const invNum   = inv.invoiceNumber || `INV-${num}`;
            // Badge: show serial part e.g. "01" from "INV-01140726", or fallback to num
            const badgeNum = inv.invoiceNumber
              ? inv.invoiceNumber.replace("INV-", "").slice(0, 2)
              : num;
            const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && effectiveStatus !== "Paid";

            return (
              <div
                key={inv.id}
                ref={el => { rowRefs.current[inv.id] = el; }}
                className={`border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors${flashId === inv.id ? " row-flash" : ""}`}
              >

                {/* ── Mobile ── */}
                <div className="flex flex-col px-4 py-3 gap-2 md:hidden">
                  {/* Row 1: avatar + name + date + status */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0"
                      style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", color: "#60A5FA" }}>
                      {badgeNum}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-semibold truncate">{inv.customerName || inv.customer || "Unknown"}</p>
                      <p className="text-gray-500 text-[10px] whitespace-nowrap">{inv.invoiceNumber || `INV-${num}`} · {dateStr}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {effectiveStatus}
                    </span>
                  </div>

                  {/* Row 2: amounts */}
                  <div className="flex items-center gap-4 pl-12">
                    <div>
                      <p className="text-white text-sm font-bold">{formatRs(inv.amount)}</p>
                      {Number(inv.balance) > 0 && (
                        <p className="text-[10px]" style={{ color: "#f87171" }}>Bal: {formatRs(inv.balance)}</p>
                      )}
                    </div>
                    {Number(inv.amountPaid) > 0 && (
                      <p className="text-[10px] font-semibold" style={{ color: "#34d399" }}>Paid: {formatRs(inv.amountPaid)}</p>
                    )}
                  </div>

                  {/* Row 3: action buttons — inline on mobile (no dropdown, avoids z-index/overflow issues) */}
                  <div className="flex flex-wrap gap-1.5 pl-12">
                    {/* View */}
                    <button onClick={() => setPdfInvoice(inv)}
                      className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                      style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
                      👁 View
                    </button>
                    {/* Edit */}
                    <button onClick={() => { setEditTarget({ id: inv.id, form: docToForm(inv) }); setShowModal(true); }}
                      className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                      style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", color: "#60A5FA" }}>
                      ✏️ Edit
                    </button>
                    {/* Pay — only if balance > 0 */}
                    {invActualBalance > 0 && (
                      <button onClick={() => { setPayForm({ amount: "", method: "cash", payerName: inv.customerName || "", payerContact: inv.phone || "", receiverName: "", receiverContact: "" }); setPayTarget(inv); }}
                        className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                        style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
                        💰 Pay
                      </button>
                    )}
                    {/* Return — only if real items exist */}
                    {(() => {
                      const realItems = (inv.items || []).filter(it => it.description && !it.description.startsWith("Previous Balance · INV-"));
                      return realItems.length > 0 ? (
                        <button onClick={() => { const pastReturns = inv._pastReturns || []; const firstItem = realItems[0]; const alreadyRet = pastReturns.filter(r => r.description === firstItem.description).reduce((s,r) => s + (Number(r.qty)||0), 0); const maxQty = Math.max(0, (Number(firstItem.qty)||0) - alreadyRet); setReturnForm({ description: firstItem.description, qty: maxQty > 0 ? String(maxQty) : "", rate: firstItem.unitPrice || "", productId: firstItem.productId || "", variantId: firstItem.variantId || "", variantLabel: firstItem.variantLabel || "", variantUnit: firstItem.variantUnit || "", maxQty }); setReturnTarget(inv); }}
                          className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", color: "#f87171" }}>
                          ↩️ Return
                        </button>
                      ) : null;
                    })()}
                    {/* Delete */}
                    <button onClick={() => setDeleteConf(inv.id)}
                      className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                      style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
                      🗑️
                    </button>
                  </div>
                </div>

                {/* ── Desktop ── */}
                <div className="hidden md:flex items-center px-5 py-3.5">

                  {/* Customer */}
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black flex-shrink-0"
                      style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", color: "#60A5FA" }}>
                      {badgeNum}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{inv.customerName || inv.customer || "Unknown"}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-500 text-[10px]">{inv.invoiceNumber || `INV-${num}`} · {dateStr}</p>
                        {isOverdue && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>OVERDUE</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amount — always */}
                  <p className="text-white text-sm font-bold text-right flex-shrink-0" style={{ width: 120 }}>{formatRs(inv.amount)}</p>

                  {/* Paid — lg only */}
                  <p className="hidden lg:block text-right text-sm font-semibold flex-shrink-0" style={{ width: 110, color: "#34d399" }}>{formatRs(inv.amountPaid || 0)}</p>

                  {/* Balance — lg only */}
                  <p className="hidden lg:block text-right text-sm font-semibold flex-shrink-0" style={{ width: 110, color: Number(inv.balance) > 0 ? "#f87171" : "#34d399" }}>
                    {formatRs(inv.balance || 0)}
                  </p>

                  {/* Status */}
                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: 100 }}>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {effectiveStatus}
                    </span>
                  </div>

                  {/* Actions — View + dropdown */}
                  <div className="flex items-center justify-end gap-1.5 flex-shrink-0" style={{ width: 150 }}>
                    {/* View */}
                    <button onClick={() => setPdfInvoice(inv)}
                      title="View Invoice"
                      className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-bold transition-all hover:scale-105 whitespace-nowrap"
                      style={{ background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                      👁 View
                    </button>

                    {/* Actions dropdown */}
                    <div className="relative" ref={openMenuId === inv.id ? menuRef : null}>
                      <button
                        onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                        title="More Actions"
                        className="flex items-center gap-0.5 px-2 h-7 rounded-lg text-[11px] font-bold transition-all hover:scale-105 whitespace-nowrap"
                        style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                        ⚡ <span className="hidden lg:inline">Actions</span> ▾
                      </button>

                      {openMenuId === inv.id && (
                        <div className="absolute right-0 top-full mt-1 z-30 rounded-xl overflow-hidden"
                          style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", minWidth: 160 }}>

                          {/* Edit */}
                          <button onClick={() => { setOpenMenuId(null); setEditTarget({ id: inv.id, form: docToForm(inv) }); setShowModal(true); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-white/[0.05]"
                            style={{ color: "#60A5FA" }}>
                            ✏️ Edit
                          </button>

                          {/* Pay */}
                          {invActualBalance > 0 && (
                            <button onClick={() => {
                              setOpenMenuId(null);
                              setPayForm({ amount: "", method: "cash", payerName: inv.customerName || "", payerContact: inv.phone || "", receiverName: "", receiverContact: "" });
                              setPayTarget(inv);
                            }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-white/[0.05]"
                              style={{ color: "#34d399" }}>
                              💰 Pay
                            </button>
                          )}

                          {/* Return */}
                          {(() => {
                            const realItems = (inv.items || []).filter(it => it.description && !it.description.startsWith("Previous Balance · INV-"));
                            return realItems.length > 0 ? (
                              <button onClick={() => {
                                setOpenMenuId(null);
                                const pastReturns = inv._pastReturns || [];
                                const firstItem   = realItems[0];
                                const alreadyRet  = pastReturns.filter(r => r.description === firstItem.description).reduce((s,r) => s + (Number(r.qty)||0), 0);
                                const maxQty      = Math.max(0, (Number(firstItem.qty)||0) - alreadyRet);
                                setReturnForm({ description: firstItem.description, qty: maxQty > 0 ? String(maxQty) : "", rate: firstItem.unitPrice || "", productId: firstItem.productId || "", variantId: firstItem.variantId || "", variantLabel: firstItem.variantLabel || "", variantUnit: firstItem.variantUnit || "", maxQty });
                                setReturnTarget(inv);
                              }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-white/[0.05]"
                                style={{ color: "#f87171" }}>
                                ↩️ Return
                              </button>
                            ) : null;
                          })()}

                          {/* Divider */}
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />

                          {/* Delete */}
                          <button onClick={() => { setOpenMenuId(null); setDeleteConf(inv.id); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-white/[0.05]"
                            style={{ color: "#f87171" }}>
                            🗑️ Delete
                          </button>
                        </div>
                      )}
                    </div>
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

      {/* ── Quick Pay Modal ── */}
      {payTarget && (() => {
        const inv = payTarget;
        const isPrevBalItem = it => (it.description || "").startsWith("Previous Balance · INV-");
        const invActualAmt  = inv.actualAmount != null
          ? Number(inv.actualAmount)
          : (inv.items || []).filter(it => !isPrevBalItem(it))
              .reduce((s, it) => s + (Number(it.qty) || 0) * getVarMult(it) * (Number(it.unitPrice) || 0), 0)
            || Number(inv.amount) || 0;
        const currentPaid   = Number(inv.amountPaid) || 0;
        const maxPayable    = Math.max(0, invActualAmt - currentPaid);
        const payAmt        = Number(payForm.amount) || 0;
        const newBal        = Math.max(0, maxPayable - payAmt);
        const num           = inv.id.slice(-4).toUpperCase();

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{ background: "#0d1117", border: "1px solid rgba(52,211,153,0.3)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid rgba(52,211,153,0.12)", background: "linear-gradient(135deg, rgba(52,211,153,0.08), rgba(16,185,129,0.04))" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)" }}>
                    💰
                  </div>
                  <div>
                    <h3 className="text-white font-black text-base">Collect Payment</h3>
                    <p className="text-gray-500 text-xs">{inv.invoiceNumber || `INV-${num}`} · {inv.customerName || inv.customer}</p>
                  </div>
                </div>
                <button onClick={() => setPayTarget(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {/* Balance info */}
                <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                  style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Outstanding Balance</p>
                    <p className="text-white font-black text-lg">{formatRs(maxPayable)}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                    {inv.status || "Unpaid"}
                  </span>
                </div>

                {/* Payer name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Payer Name</label>
                  <input type="text" placeholder="e.g. Ali Ahmed" value={payForm.payerName}
                    onChange={e => setPayForm(p => ({ ...p, payerName: e.target.value }))}
                    className="w-full rounded-xl text-white text-sm outline-none px-3 py-2.5"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)" }} />
                </div>

                {/* Receiver name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Receiver Name</label>
                  <input type="text" placeholder="e.g. Muhammad Salman" value={payForm.receiverName}
                    onChange={e => setPayForm(p => ({ ...p, receiverName: e.target.value }))}
                    className="w-full rounded-xl text-white text-sm outline-none px-3 py-2.5"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)" }} />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                    Payment Amount (Max: {formatRs(maxPayable)})
                  </label>
                  <input type="number" inputMode="decimal" min="0" max={maxPayable} placeholder="0"
                    value={payForm.amount}
                    onChange={e => {
                      const v = Number(e.target.value) || 0;
                      if (v <= maxPayable) setPayForm(p => ({ ...p, amount: e.target.value }));
                    }}
                    className="w-full rounded-xl text-white text-sm outline-none px-3 py-2.5 text-right font-bold"
                    style={{ background: "rgba(52,211,153,0.05)", border: `1.5px solid ${payAmt > 0 ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.1)"}` }} />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Payment Method</label>
                  <div className="flex gap-2">
                    {[
                      { id: "cash",   label: "💵 Cash" },
                      { id: "online", label: "📱 Online" },
                      { id: "cheque", label: "🏦 Cheque" },
                    ].map(m => (
                      <button key={m.id} type="button"
                        onClick={() => setPayForm(p => ({ ...p, method: m.id }))}
                        className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: payForm.method === m.id ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${payForm.method === m.id ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: payForm.method === m.id ? "#34d399" : "#6b7280",
                        }}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                {payAmt > 0 && (
                  <div className="rounded-xl px-4 py-3"
                    style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
                    <p className="text-xs text-green-300 font-semibold mb-1">✓ Payment Preview</p>
                    <p className="text-xs text-gray-400">
                      Amount: <span className="text-white font-bold">{formatRs(payAmt)}</span>
                      &nbsp;·&nbsp; New Balance: <span className="font-bold" style={{ color: newBal > 0 ? "#f87171" : "#34d399" }}>{formatRs(newBal)}</span>
                    </p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 mt-1">
                  <button onClick={() => setPayTarget(null)}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                    Cancel
                  </button>
                  <button onClick={handleQuickPay} disabled={savingPay || payAmt <= 0}
                    className="flex-1 py-3 rounded-2xl text-sm font-black transition-all hover:scale-[1.02]"
                    style={{
                      background: payAmt > 0 ? "linear-gradient(135deg,#34d399,#10b981)" : "rgba(52,211,153,0.2)",
                      color: payAmt > 0 ? "#000" : "#6b7280",
                      opacity: savingPay ? 0.7 : 1,
                      cursor: (savingPay || payAmt <= 0) ? "not-allowed" : "pointer",
                    }}>
                    {savingPay ? "Saving..." : "💰 Collect Payment →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Quick Return Modal ── */}
      {returnTarget && (() => {
        const inv        = returnTarget;
        const num        = inv.id.slice(-4).toUpperCase();
        const pastReturns = inv._pastReturns || [];
        const isPrevBalItem = it => (it.description || "").startsWith("Previous Balance · INV-");
        const realItems  = (inv.items || []).filter(it => it.description && !isPrevBalItem(it));

        function getMaxQty(it) {
          const done = pastReturns.filter(r => r.description === it.description).reduce((s, r) => s + (Number(r.qty) || 0), 0);
          return Math.max(0, (Number(it.qty) || 0) - done);
        }

        const retVarMult   = returnForm.variantLabel ? (parseFloat(returnForm.variantLabel) > 0 ? parseFloat(returnForm.variantLabel) : 1) : 1;
        const returnTotal  = (Number(returnForm.qty) || 0) * retVarMult * (Number(returnForm.rate) || 0);
        const canSave      = returnForm.description && Number(returnForm.qty) > 0 && Number(returnForm.rate) > 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{ background: "#0d1117", border: "1px solid rgba(248,113,113,0.3)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid rgba(248,113,113,0.12)", background: "linear-gradient(135deg, rgba(248,113,113,0.08), rgba(239,68,68,0.04))" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)" }}>
                    ↩️
                  </div>
                  <div>
                    <h3 className="text-white font-black text-base">Goods Return</h3>
                    <p className="text-gray-500 text-xs">{inv.invoiceNumber || `INV-${num}`} · {inv.customerName || inv.customer}</p>
                  </div>
                </div>
                <button onClick={() => setReturnTarget(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {/* Product selector pills */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Select Product to Return</label>
                  <div className="flex flex-wrap gap-1.5">
                    {realItems.map((it, i) => {
                      const maxQ      = getMaxQty(it);
                      const isSelected = returnForm.description === it.description;
                      const exhausted  = maxQ <= 0;
                      return (
                        <button key={i} type="button" disabled={exhausted}
                          onClick={() => {
                            if (exhausted) return;
                            setReturnForm({
                              description:  it.description,
                              qty:          maxQ > 0 ? String(maxQ) : "",
                              rate:         it.unitPrice || "",
                              productId:    it.productId || "",
                              variantId:    it.variantId || "",
                              variantLabel: it.variantLabel || "",
                              variantUnit:  it.variantUnit || "",
                              maxQty:       maxQ,
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background: isSelected ? "rgba(248,113,113,0.2)" : exhausted ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${isSelected ? "rgba(248,113,113,0.6)" : "rgba(255,255,255,0.1)"}`,
                            color: exhausted ? "#4b5563" : isSelected ? "#f87171" : "#9ca3af",
                            cursor: exhausted ? "not-allowed" : "pointer",
                            opacity: exhausted ? 0.5 : 1,
                          }}>
                          {it.description}
                          {it.variantLabel && <span style={{ color: "#6b7280" }}> · {it.variantLabel}</span>}
                          <span className="ml-1 font-bold" style={{ color: exhausted ? "#4b5563" : "#34d399" }}>
                            ({exhausted ? "fully returned" : `max ${maxQ}`})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Qty + Rate inputs */}
                {returnForm.description && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                          Qty {returnForm.variantLabel ? "(units)" : ""}
                          {returnForm.maxQty > 0 && <span className="text-gray-600 normal-case ml-1">(max {returnForm.maxQty})</span>}
                        </label>
                        <input type="number" inputMode="numeric" min="1" max={returnForm.maxQty || undefined}
                          placeholder="Qty" value={returnForm.qty}
                          onChange={e => {
                            const v = Number(e.target.value);
                            const capped = returnForm.maxQty > 0 ? Math.min(v, returnForm.maxQty) : v;
                            setReturnForm(p => ({ ...p, qty: String(capped > 0 ? capped : e.target.value) }));
                          }}
                          className="w-full rounded-xl text-white text-sm outline-none px-3 py-2.5 text-center font-bold"
                          style={{ background: "rgba(248,113,113,0.05)", border: "1.5px solid rgba(248,113,113,0.3)" }} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                          Rate {returnForm.variantUnit ? `/ ${returnForm.variantUnit}` : ""}
                        </label>
                        <input type="number" inputMode="decimal" min="0"
                          placeholder="Rate" value={returnForm.rate}
                          onChange={e => setReturnForm(p => ({ ...p, rate: e.target.value }))}
                          className="w-full rounded-xl text-white text-sm outline-none px-3 py-2.5 text-right font-bold"
                          style={{ background: "rgba(248,113,113,0.05)", border: "1.5px solid rgba(248,113,113,0.3)" }} />
                      </div>
                    </div>

                    {/* Variant info */}
                    {returnForm.variantLabel && (
                      <p className="text-[10px] text-gray-500 pl-1">
                        {returnForm.variantLabel} × {returnForm.qty || 0} units
                        {retVarMult !== 1 && Number(returnForm.qty) > 0 &&
                          ` = ${((Number(returnForm.qty) || 0) * retVarMult).toFixed(2).replace(/\.?0+$/, "")} ${returnForm.variantUnit} total`}
                      </p>
                    )}

                    {/* Return amount preview */}
                    {returnTotal > 0 && (
                      <div className="rounded-xl px-4 py-3"
                        style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
                        <p className="text-xs text-red-300 font-semibold mb-1">↩️ Return Preview</p>
                        <p className="text-xs text-gray-400">
                          <strong className="text-white">{returnForm.description}</strong>
                          {returnForm.variantLabel && ` · ${returnForm.variantLabel} × ${returnForm.qty}`}
                          &nbsp;·&nbsp; Return Amount: <span className="text-red-400 font-bold">- {formatRs(returnTotal)}</span>
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Past returns */}
                {pastReturns.length > 0 && (
                  <div className="rounded-xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-4 py-2.5"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      Previously Returned
                    </p>
                    {pastReturns.map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2 border-b border-white/5 last:border-0">
                        <p className="text-gray-400 text-xs truncate">{r.description}{r.variantLabel ? ` · ${r.variantLabel}` : ""} × {r.qty}</p>
                        <p className="text-xs font-bold flex-shrink-0 ml-2" style={{ color: "#f87171" }}>- {formatRs(r.returnAmount)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 mt-1">
                  <button onClick={() => setReturnTarget(null)}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                    Cancel
                  </button>
                  <button onClick={handleQuickReturn} disabled={savingReturn || !canSave}
                    className="flex-1 py-3 rounded-2xl text-sm font-black transition-all hover:scale-[1.02]"
                    style={{
                      background: canSave ? "linear-gradient(135deg,#f87171,#ef4444)" : "rgba(248,113,113,0.2)",
                      color: canSave ? "#fff" : "#6b7280",
                      opacity: savingReturn ? 0.7 : 1,
                      cursor: (savingReturn || !canSave) ? "not-allowed" : "pointer",
                    }}>
                    {savingReturn ? "Saving..." : "↩️ Record Return →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── PDF Preview Modal ── */}
      {pdfInvoice && (
        <InvoicePDFModal
          inv={pdfInvoice}
          userDoc={userDoc}
          onClose={() => setPdfInvoice(null)}
          payments={payments.filter(p => p.invoiceId === pdfInvoice.id)}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteConf && (() => {
        const inv = invoices.find(i => i.id === deleteConf);
        const isPrevBalItem = it => (it.description || "").startsWith("Previous Balance · INV-");
        const invActualAmt = inv
          ? (inv.actualAmount != null
              ? Number(inv.actualAmount)
              : (inv.items || []).filter(it => !isPrevBalItem(it))
                  .reduce((s, it) => s + (Number(it.qty) || 0) * getVarMult(it) * (Number(it.unitPrice) || 0), 0)
                || Number(inv.amount) || 0)
          : 0;
        const invAmtPaid   = inv ? (Number(inv.amountPaid) || 0) : 0;
        const invBalance   = Math.max(0, invActualAmt - invAmtPaid);
        const hasBalance   = invBalance > 0;

        // Build item summary for display
        const itemRows = (inv?.items || []).filter(
          it => !isPrevBalItem(it) && it.description && it.qty
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}>
            <div className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{ background: "#0d1117", border: "1px solid rgba(248,113,113,0.35)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}>

              {/* Header */}
              <div className="px-6 pt-6 pb-4 text-center border-b border-white/[0.06]">
                <p className="text-4xl mb-2">🗑️</p>
                <h3 className="text-white font-bold text-base">Delete this Invoice?</h3>
                {inv && (
                  <p className="text-gray-500 text-xs mt-1">
                    INV-{(inv.id || "").slice(-4).toUpperCase()} · {inv.customerName || inv.customer || "Unknown"}
                  </p>
                )}
              </div>

              {/* Balance warning */}
              {hasBalance && (
                <div className="mx-4 mt-4 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)" }}>
                  <p className="text-red-400 text-xs font-bold text-center">
                    ⚠️ This invoice still has <span className="text-white font-black">Rs. {invBalance.toLocaleString("en-PK")}</span> balance due
                  </p>
                </div>
              )}

              {/* Items that will be restocked */}
              {itemRows.length > 0 && (
                <div className="mx-4 mt-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
                  <p className="text-green-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                    📦 Stock will be returned
                  </p>
                  {itemRows.map((it, i) => (
                    <p key={i} className="text-gray-300 text-xs">
                      + {it.qty}{it.variantLabel ? ` ${it.variantLabel}` : ""} {it.description}
                    </p>
                  ))}
                </div>
              )}

              {/* Financial reversal note */}
              <div className="mx-4 mt-3 px-4 py-3 rounded-xl mb-1"
                style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)" }}>
                <p className="text-blue-300 text-xs leading-relaxed">
                  ℹ️ What happens after deleting:
                  <br />• Invoice moves to Trash (can restore within 15 days)
                  <br />• Stock will be fully returned to inventory
                  {invAmtPaid > 0 && <><br />• <span className="text-amber-400 font-semibold">Rs. {invAmtPaid.toLocaleString("en-PK")}</span> collected amount will be removed from records</>}
                  {invActualAmt > 0 && <><br />• Invoice total of <span className="text-amber-400 font-semibold">Rs. {invActualAmt.toLocaleString("en-PK")}</span> will be removed</>}
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 px-4 py-4">
                <button onClick={() => setDeleteConf(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteConf)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                  style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Email / WhatsApp Confirmation Dialog ── */}
      <EmailConfirmationDialog
        show={emailConfirm.show}
        recipientEmail={emailConfirm.invoice?.email}
        recipientPhone={emailConfirm.invoice?.phone}
        invoice={emailConfirm.invoice}
        userDoc={userDoc}
        isUpdate={emailConfirm.isUpdate}
        documentType="invoice"
        getInvoiceImageFn={emailConfirm.invoice ? async () => {
          const { generateInvoiceImageBase64 } = await import("@/lib/emailUtils");
          let invPayments = [];
          try {
            const { getDocs, collection: col, query: q, where } = await import("firebase/firestore");
            const snap = await getDocs(q(col(db, "users", uid, "payments"), where("invoiceId", "==", emailConfirm.invoice.id)));
            invPayments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          } catch (_) {}
          return generateInvoiceImageBase64(emailConfirm.invoice, userDoc, invPayments);
        } : undefined}
        onConfirm={async () => {
          if (emailConfirm.invoice) {
            try {
              let invPayments = [];
              try {
                const { getDocs, collection: col, query: q, where } = await import("firebase/firestore");
                const snap = await getDocs(q(col(db, "users", uid, "payments"), where("invoiceId", "==", emailConfirm.invoice.id)));
                invPayments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
              } catch (_) {}
              const pdfBase64 = await generateInvoicePdfBase64(emailConfirm.invoice, userDoc, invPayments);
              const result    = await sendInvoiceEmail(emailConfirm.invoice, userDoc, pdfBase64, uid, emailConfirm.isUpdate, invPayments);
              if (result.success) {
                setAlert({
                  show: true, type: "success",
                  title: emailConfirm.isUpdate ? "Invoice Updated & Emailed! 🧾📧" : "Invoice Created & Emailed! 🧾📧",
                  message: `${emailConfirm.isUpdate ? "Updated" : "New"} invoice emailed to ${emailConfirm.invoice.email}.`,
                });
              } else {
                setAlert({
                  show: true, type: "warning",
                  title: `Invoice ${emailConfirm.isUpdate ? "Updated" : "Created"} ✓ (Email Failed)`,
                  message: `Invoice saved, but email could not be sent: ${result.error}`,
                });
              }
            } catch (e) {
              setAlert({ show: true, type: "error", title: "Email Failed", message: "An error occurred while sending the email." });
            }
          }
          setEmailConfirm({ show: false, invoice: null, isUpdate: false });
        }}
        onCancel={(reason) => {
          const docType = emailConfirm.isUpdate ? "Updated" : "Created";
          if (reason === "whatsapp") {
            setAlert({ show: true, type: "success", title: `Invoice ${docType}! 🧾💬`, message: `Invoice ${docType.toLowerCase()} ho gayi. WhatsApp khul gaya — message bhej dein.` });
          } else if (reason === "both") {
            setAlert({ show: true, type: "success", title: `Invoice ${docType}! 🧾📧💬`, message: `Email bhej di gayi aur WhatsApp khul gaya.` });
          } else {
            setAlert({ show: true, type: "success", title: `Invoice ${docType}! 🧾`, message: `Invoice ${docType.toLowerCase()} ho gayi. Koi notification nahi bheja.` });
          }
          setEmailConfirm({ show: false, invoice: null, isUpdate: false });
        }}
      />
      
      {/* ── Add to Inventory Confirmation Dialog ── */}
      {nonInventoryDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            
            {/* Header */}
            <div className="px-6 py-5 flex items-start gap-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(251,191,36,0.04))" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
                📦
              </div>
              <div className="flex-1">
                <h3 className="text-white font-black text-lg leading-tight">Add to Inventory?</h3>
                <p className="text-gray-500 text-xs mt-1">
                  {nonInventoryDialog.items.length} item{nonInventoryDialog.items.length !== 1 ? "s are" : " is"} not in your inventory. Enter cost price for each.
                </p>
              </div>
            </div>
            
            {/* Items with cost price inputs */}
            <div className="p-5 max-h-[60vh] overflow-y-auto flex flex-col gap-3">
              {nonInventoryDialog.items.map((item, idx) => (
                <div key={idx} className="rounded-xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {/* Item name row */}
                  <div className="flex items-center gap-2.5 px-4 py-3"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-base">📌</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{item.description}</p>
                      {item.variantLabel && (
                        <p className="text-gray-500 text-[10px]">{item.variantLabel}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[9px] text-gray-600 uppercase tracking-widest">Selling</p>
                      <p className="text-amber-400 text-xs font-bold">Rs. {item.unitPrice}</p>
                    </div>
                  </div>
                  {/* Cost price input */}
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">
                        💰 Cost Price (Aapko kitna parta hai?)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        placeholder="e.g. 120"
                        autoFocus={idx === 0}
                        value={nonInventoryDialog.costPrices[idx] || ""}
                        onChange={e => {
                          const updated = [...nonInventoryDialog.costPrices];
                          updated[idx] = e.target.value;
                          setNonInventoryDialog(prev => ({ ...prev, costPrices: updated }));
                        }}
                        className="w-full rounded-lg text-white text-sm outline-none"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: `1.5px solid ${nonInventoryDialog.costPrices[idx] ? "rgba(52,211,153,0.4)" : "rgba(255,255,255,0.12)"}`,
                          padding: "8px 12px",
                          transition: "border-color 0.2s",
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            // Move focus to next input or to button
                            const inputs = document.querySelectorAll("[data-inv-cost-input]");
                            if (inputs[idx + 1]) inputs[idx + 1].focus();
                          }
                        }}
                        data-inv-cost-input
                      />
                    </div>
                    {/* Margin preview */}
                    {nonInventoryDialog.costPrices[idx] && Number(nonInventoryDialog.costPrices[idx]) > 0 && (
                      <div className="text-right flex-shrink-0 pt-5">
                        <p className="text-[9px] text-gray-600 uppercase tracking-widest">Margin</p>
                        <p className="text-xs font-bold"
                          style={{ color: Number(item.unitPrice) > Number(nonInventoryDialog.costPrices[idx]) ? "#34d399" : "#f87171" }}>
                          Rs. {(Number(item.unitPrice) - Number(nonInventoryDialog.costPrices[idx])).toFixed(0)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Info note */}
              <div className="px-4 py-3 rounded-xl"
                style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.12)" }}>
                <p className="text-blue-400 text-xs leading-relaxed">
                  ℹ️ Stock <strong>zero</strong> se start hoga. Inventory section se baad mein update kar sakte hain.
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="px-5 pb-5 flex gap-3 pt-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button onClick={handleSkipInventory}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                No, Skip
              </button>
              <button
                onClick={handleAddToInventory}
                disabled={nonInventoryDialog.costPrices.some(cp => !cp || Number(cp) < 0)}
                className="flex-1 py-3 rounded-xl text-sm font-black transition-all"
                style={{
                  background: nonInventoryDialog.costPrices.every(cp => cp && Number(cp) >= 0)
                    ? "linear-gradient(135deg, #F59E0B, #D97706)"
                    : "rgba(245,158,11,0.3)",
                  color: nonInventoryDialog.costPrices.every(cp => cp && Number(cp) >= 0) ? "#000" : "#9ca3af",
                  cursor: nonInventoryDialog.costPrices.some(cp => !cp || Number(cp) < 0) ? "not-allowed" : "pointer",
                }}>
                ✓ Add to Inventory
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
