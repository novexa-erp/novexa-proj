/**
 * Shared email utilities — used by InvoicesView, CustomersView, SupplierDetail
 * Client-side only (uses html2canvas + jsPDF in browser)
 */

// ── Generate PDF base64 from invoice/order data ───────────────────────────────
export async function generateInvoicePdfBase64(invoice, userDoc) {
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
      root.render(React.createElement(InvoiceTemplateForEmail, { inv: invoice, userDoc }));
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

// ── Send customer invoice email ───────────────────────────────────────────────
export async function sendInvoiceEmail(invoice, userDoc, pdfBase64, uid, isUpdate = false) {
  try {
    const res = await fetch("/api/send-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice, userDoc, pdfBase64, uid, isUpdate }),
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
export async function sendSupplierOrderEmail(order, supplier, userDoc, pdfBase64, uid, isUpdate = false) {
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
 * Helper — fire-and-forget email after any invoice create/update
 * Pass setAlert to show feedback toast.
 */
export function autoEmailInvoice({ invoice, userDoc, uid, setAlert, isUpdate = false }) {
  if (!invoice?.email?.trim()) return;

  (async () => {
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
    }
  })();
}

/**
 * Helper — fire-and-forget email for supplier PO create/update
 */
export function autoEmailSupplierOrder({ order, supplier, userDoc, uid, setAlert, isUpdate = false }) {
  if (!supplier?.email?.trim()) return;

  (async () => {
    try {
      const orderForEmail = {
        ...order,
        email:        supplier.email,
        customerName: supplier.name,
        address:      supplier.address || "",
        phone:        supplier.phone   || "",
      };
      const pdfBase64 = await generateInvoicePdfBase64(orderForEmail, userDoc);
      const result    = await sendSupplierOrderEmail(order, supplier, userDoc, pdfBase64, uid, isUpdate);
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
    }
  })();
}
