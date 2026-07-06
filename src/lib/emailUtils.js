/**
 * Shared email utilities — used by InvoicesView, CustomersView, SupplierDetail
 * Client-side only (uses html2canvas + jsPDF in browser)
 */

// ── Generate PDF base64 from invoice/order data ───────────────────────────────
export async function generateInvoicePdfBase64(invoice, userDoc, payments = []) {
  try {
    const html2canvas = (await import("html2canvas")).default;
    const jsPDF       = (await import("jspdf")).default;

    const container = document.createElement("div");
    container.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;width:794px;background:#fff;z-index:-1;";
    document.body.appendChild(container);

    const { createRoot } = await import("react-dom/client");
    const React = (await import("react")).default;
    const { InvoiceTemplateForEmail } = await import("@/app/components/InvoicePDF");

    await new Promise(resolve => {
      const root = createRoot(container);
      root.render(React.createElement(InvoiceTemplateForEmail, { inv: invoice, userDoc, payments }));
      setTimeout(resolve, 400);
    });

    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, backgroundColor: "#ffffff",
      logging: false, width: 794,
    });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf     = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pdfW    = pdf.internal.pageSize.getWidth();
    const pdfH    = (canvas.height / canvas.width) * pdfW;
    const pageH   = pdf.internal.pageSize.getHeight();

    if (pdfH <= pageH) {
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
    } else {
      let yPos = 0, remaining = pdfH;
      while (remaining > 0) {
        pdf.addImage(imgData, "JPEG", 0, -yPos, pdfW, pdfH);
        remaining -= pageH;
        yPos      += pageH;
        if (remaining > 0) pdf.addPage();
      }
    }
    return pdf.output("datauristring").split(",")[1];
  } catch (err) {
    console.error("[generateInvoicePdfBase64]", err);
    return null;
  }
}

// ── Generate PDF base64 for Supplier Purchase Order (uses PurchaseOrderPDFTemplate) ──
export async function generateSupplierOrderPdfBase64(order, supplier, userDoc, receipts = [], returns = [], payments = []) {
  try {
    const html2canvas = (await import("html2canvas")).default;
    const jsPDF       = (await import("jspdf")).default;

    const container = document.createElement("div");
    container.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;width:794px;background:#fff;z-index:-1;";
    document.body.appendChild(container);

    const { createRoot } = await import("react-dom/client");
    const React = (await import("react")).default;
    const { PurchaseOrderPDFTemplate } = await import("@/app/components/SupplierDetail");

    await new Promise(resolve => {
      const root = createRoot(container);
      root.render(React.createElement(PurchaseOrderPDFTemplate, {
        order, supplier, userDoc, receipts, returns, payments,
      }));
      setTimeout(resolve, 500);
    });

    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, backgroundColor: "#ffffff",
      logging: false, width: 794,
    });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf     = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pdfW    = pdf.internal.pageSize.getWidth();
    const pdfH    = (canvas.height / canvas.width) * pdfW;
    const pageH   = pdf.internal.pageSize.getHeight();

    if (pdfH <= pageH) {
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
    } else {
      let yPos = 0, remaining = pdfH;
      while (remaining > 0) {
        pdf.addImage(imgData, "JPEG", 0, -yPos, pdfW, pdfH);
        remaining -= pageH;
        yPos      += pageH;
        if (remaining > 0) pdf.addPage();
      }
    }
    return pdf.output("datauristring").split(",")[1];
  } catch (err) {
    console.error("[generateSupplierOrderPdfBase64]", err);
    return null;
  }
}

// ── Send customer invoice email ───────────────────────────────────────────────
export async function sendInvoiceEmail(invoice, userDoc, pdfBase64, uid, isUpdate = false, payments = []) {
  try {
    const res = await fetch("/api/send-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice: { ...invoice, payments },
        userDoc, pdfBase64, uid, isUpdate,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Email send failed");
    return { success: true };
  } catch (err) {
    console.error("[sendInvoiceEmail]", err);
    return { success: false, error: err.message };
  }
}

// ── Send supplier PO email ────────────────────────────────────────────────────
export async function sendSupplierOrderEmail(order, supplier, userDoc, pdfBase64, uid, isUpdate = false, receipts = [], returns = [], payments = []) {
  try {
    const res = await fetch("/api/send-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice:         { ...order, email: supplier.email, customerName: supplier.name },
        userDoc,
        pdfBase64,
        uid,
        isSupplierOrder: true,
        isUpdate,
        supplier,
        receipts,
        returns,
        payments,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Email send failed");
    return { success: true };
  } catch (err) {
    console.error("[sendSupplierOrderEmail]", err);
    return { success: false, error: err.message };
  }
}

/**
 * Helper — prompt user confirmation before emailing invoice
 * Pass setAlert to show feedback toast, and onConfirm callback for custom UI.
 * Returns a Promise that resolves when the email is sent (or skipped).
 */
export function autoEmailInvoice({ invoice, userDoc, uid, setAlert, isUpdate = false, onConfirm }) {
  if (!invoice?.email?.trim()) return Promise.resolve();

  return new Promise((resolve) => {
    if (onConfirm) {
      // sendEmailFn is called by the dialog when user clicks "Yes"
      onConfirm(async () => {
        try {
          const pdfBase64 = await generateInvoicePdfBase64(invoice, userDoc);
          const result    = await sendInvoiceEmail(invoice, userDoc, pdfBase64, uid, isUpdate);
          if (result.success) {
            setAlert({
              show: true, type: "success",
              title: isUpdate ? "Invoice Updated & Emailed! 🧾📧" : "Invoice Created & Emailed! 🧾📧",
              message: `${isUpdate ? "Updated" : "New"} invoice emailed to ${invoice.email}.`,
            });
          } else {
            setAlert({
              show: true, type: "warning",
              title: `Invoice ${isUpdate ? "Updated" : "Created"} ✓ (Email Failed)`,
              message: `Invoice saved, but email could not be sent: ${result.error}`,
            });
          }
        } catch (e) {
          console.error("[autoEmailInvoice]", e);
          setAlert({
            show: true, type: "error",
            title: "Email Failed",
            message: "An error occurred while sending the email.",
          });
        } finally {
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

/**
 * Helper — prompt user confirmation before emailing supplier PO
 * Pass setAlert to show feedback toast, and onConfirm callback for custom UI.
 * receipts/returns/payments arrays are optional — passed to PurchaseOrderPDFTemplate for full history
 * Returns a Promise that resolves when the email is sent (or skipped).
 */
export function autoEmailSupplierOrder({ order, supplier, userDoc, uid, setAlert, isUpdate = false, onConfirm, receipts = [], returns = [], payments = [] }) {
  if (!supplier?.email?.trim()) return Promise.resolve();

  return new Promise((resolve) => {
    if (onConfirm) {
      onConfirm(async () => {
        try {
          const pdfBase64 = await generateSupplierOrderPdfBase64(order, supplier, userDoc, receipts, returns, payments);
          const result    = await sendSupplierOrderEmail(order, supplier, userDoc, pdfBase64, uid, isUpdate, receipts, returns, payments);
          if (result.success) {
            setAlert({
              show: true, type: "success",
              title: isUpdate ? "Order Updated & Emailed! 🛒📧" : "Order Created & Emailed! 🛒📧",
              message: `Purchase order emailed to ${supplier.email}.`,
            });
          } else {
            setAlert({
              show: true, type: "warning",
              title: `Order ${isUpdate ? "Updated" : "Created"} ✓ (Email Failed)`,
              message: `Order saved, but email could not be sent: ${result.error}`,
            });
          }
        } catch (e) {
          console.error("[autoEmailSupplierOrder]", e);
          setAlert({
            show: true, type: "error",
            title: "Email Failed",
            message: "An error occurred while sending the email.",
          });
        } finally {
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}
