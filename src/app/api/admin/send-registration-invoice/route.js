import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

async function getAdminModules() {
  const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");
  return { adminAuth, adminDb };
}

async function verifyAdmin(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return null;
  try {
    const { adminAuth } = await getAdminModules();
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid === process.env.NEXT_PUBLIC_ADMIN_UID ? decoded : null;
  } catch { return null; }
}

// ── Fetch actual price from Firestore adminConfig/plans ───────────────────────
async function fetchPlanPrice(adminDb, planId, billingPeriod) {
  try {
    const snap = await adminDb.collection("adminConfig").doc("plans").get();
    if (snap.exists) {
      const list = snap.data().list || [];
      const plan = list.find(p => p.id === planId);
      if (plan) {
        if (billingPeriod === "yearly") {
          return Number(plan.afterYearlyPrice  || plan.yearlyPrice  || 0);
        } else {
          return Number(plan.afterMonthlyPrice || plan.monthlyPrice || 0);
        }
      }
    }
  } catch (e) {
    console.warn("[reg-invoice] Could not fetch plan price from Firestore:", e.message);
  }
  const FALLBACK = {
    starter:      { monthly: 2499,  yearly: 24990  },
    business:     { monthly: 4999,  yearly: 49990  },
    professional: { monthly: 8999,  yearly: 89990  },
    enterprise:   { monthly: 19999, yearly: 199990 },
  };
  const f = FALLBACK[planId] || FALLBACK.starter;
  return billingPeriod === "yearly" ? f.yearly : f.monthly;
}

// ── Generate global serial invoice number: REG-NNNDDMMYY ─────────────────────
// Format: REG-001082826  (serial 001, date 08-28-26)
// Only generates a NEW number if uid has no saved regInvoiceNumber yet.
async function makeInvoiceNumber(adminDb, uid) {
  // If uid provided, check if user already has a REG number saved
  if (uid) {
    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (userSnap.exists && userSnap.data().regInvoiceNumber) {
      return userSnap.data().regInvoiceNumber;
    }
  }

  // Generate a new serial number
  const counterRef = adminDb.collection("adminConfig").doc("regInvoiceCounter");
  let serial;
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    serial = snap.exists ? (snap.data().lastSerial + 1) : 1;
    tx.set(counterRef, { lastSerial: serial }, { merge: true });
  });
  const ts  = new Date();
  const dd  = String(ts.getDate()).padStart(2, "0");
  const mm  = String(ts.getMonth() + 1).padStart(2, "0");
  const yy  = String(ts.getFullYear()).slice(-2);
  const invoiceNumber = `REG-${String(serial).padStart(3, "0")}${dd}${mm}${yy}`;

  // Save the generated number back to user document so it never changes
  if (uid) {
    await adminDb.collection("users").doc(uid).set(
      { regInvoiceNumber: invoiceNumber },
      { merge: true }
    );
  }

  return invoiceNumber;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(str) {
  if (!str) return "—";
  try { return new Date(str + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return str; }
}
function fmtDateShort(str) {
  if (!str) return "—";
  try { return new Date(str + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return str; }
}
function fmtPayment(m) {
  if (m === "online") return "Online (Card / Bank Transfer)";
  if (m === "cheque") return "Cheque";
  return "Cash";
}
function fmtPeriod(p) { return p === "yearly" ? "Yearly" : "Monthly"; }
function planLabel(p) { return p ? p.charAt(0).toUpperCase() + p.slice(1) : "Starter"; }
function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.ceil((new Date(b + "T23:59:59") - new Date(a + "T00:00:00")) / 86400000);
}

// ── PDF ────────────────────────────────────────────────────────────────────────
async function buildRegistrationPDF({
  invoiceNumber, userName, userEmail, plan, billingPeriod,
  paymentMethod, activeFrom, activeTo, subscriptionType,
  amount, // actual amount fetched from Firestore
  referralDiscountApplied, discountPercentage, // NEW: referral discount info
}) {
  const doc  = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const W    = 595;
  const H    = 842;

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);
  const safe = (s) => (s || "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

  const isTrial = subscriptionType === "trial";
  // Use passed amount (fetched from Firestore); trial is always free
  const amtStr  = isTrial ? "FREE TRIAL" : "Rs. " + (amount || 0).toLocaleString("en-PK");
  const label   = planLabel(plan);
  const totalDays = daysBetween(activeFrom, activeTo);
  const issuedOn  = new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });

  const C = {
    blue:  rgb(0.114, 0.306, 0.847),
    amber: rgb(0.961, 0.620, 0.043),
    green: rgb(0.086, 0.725, 0.506),
    dark:  rgb(0.067, 0.067, 0.067),
    gray:  rgb(0.420, 0.447, 0.502),
    bg:    rgb(0.969, 0.980, 1.000),
    white: rgb(1, 1, 1),
    line:  rgb(0.878, 0.898, 0.918),
    gbg:   rgb(0.941, 0.992, 0.969),
    purple: rgb(0.545, 0.361, 0.965),
  };

  // Header
  const headerColor = isTrial ? C.purple : C.blue;
  page.drawRectangle({ x: 0, y: H - 105, width: W, height: 105, color: headerColor });
  page.drawRectangle({ x: 0, y: H - 5, width: W / 2, height: 5, color: headerColor });
  page.drawRectangle({ x: W / 2, y: H - 5, width: W / 2, height: 5, color: C.amber });

  page.drawText("INVOICE",    { x: 40, y: H - 42, size: 26, font: bold, color: C.white });
  page.drawText("Novexa ERP", { x: 40, y: H - 68, size: 13, font: bold, color: C.white });
  page.drawText(isTrial ? "Free Trial Registration" : "New Account Registration",
    { x: 40, y: H - 84, size: 9, font: reg, color: rgb(0.78, 0.88, 1.0) });

  const invRight = W - bold.widthOfTextAtSize(invoiceNumber, 12) - 40;
  page.drawText(invoiceNumber, { x: invRight, y: H - 42, size: 12, font: bold, color: C.white });
  page.drawText("REGISTRATION INVOICE",
    { x: W - 40 - reg.widthOfTextAtSize("REGISTRATION INVOICE", 8), y: H - 58, size: 8, font: reg, color: rgb(0.78, 0.88, 1.0) });

  // Badge
  const badgeColor = isTrial ? C.purple : C.green;
  const badgeText  = isTrial ? "TRIAL" : "ACTIVE";
  page.drawRectangle({ x: W - 106, y: H - 88, width: 68, height: 20, color: badgeColor });
  page.drawText(badgeText, { x: W - 101, y: H - 82, size: 9, font: bold, color: C.white });

  // Bill To
  let y = H - 130;
  page.drawText("BILL TO",                    { x: 40, y, size: 8, font: bold, color: C.gray });
  y -= 16;
  page.drawText(safe(userName).slice(0, 60),  { x: 40, y, size: 12, font: bold, color: C.dark });
  y -= 15;
  page.drawText(safe(userEmail).slice(0, 70), { x: 40, y, size: 9,  font: reg,  color: C.gray });

  // Right
  const rightX = 380;
  page.drawText("Invoice Date:",   { x: rightX, y: H - 130, size: 8, font: reg,  color: C.gray });
  page.drawText(issuedOn,          { x: rightX + 85, y: H - 130, size: 8, font: bold, color: C.dark });
  page.drawText("Plan:",           { x: rightX, y: H - 146, size: 8, font: reg,  color: C.gray });
  page.drawText(`${label} (${fmtPeriod(billingPeriod)})`,
    { x: rightX + 85, y: H - 146, size: 8, font: bold, color: C.dark });

  // Divider
  y = H - 190;
  page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 1, color: C.line });

  // Table header
  y -= 2;
  page.drawRectangle({ x: 40, y: y - 22, width: W - 80, height: 24, color: C.blue });
  page.drawText("Description", { x: 52,      y: y - 15, size: 9, font: bold, color: C.white });
  page.drawText("Period",      { x: 290,     y: y - 15, size: 9, font: bold, color: C.white });
  page.drawText("Amount",      { x: W - 110, y: y - 15, size: 9, font: bold, color: C.white });

  // Table row
  y -= 26;
  page.drawRectangle({ x: 40, y: y - 46, width: W - 80, height: 48, color: C.bg });
  const descLine1 = isTrial
    ? `${label} Plan - Free Trial`
    : `${label} Plan - ${fmtPeriod(billingPeriod)} Subscription`;
  const descLine2 = isTrial
    ? `${totalDays}-day trial period`
    : `New account registered, ${totalDays} days`;
  page.drawText(descLine1,                       { x: 52,  y: y - 12, size: 10, font: bold, color: C.dark });
  page.drawText(descLine2,                       { x: 52,  y: y - 28, size: 8,  font: reg,  color: C.gray });
  page.drawText(`${fmtDateShort(activeFrom)} to`, { x: 290, y: y - 12, size: 8, font: reg,  color: C.dark });
  page.drawText(fmtDateShort(activeTo),           { x: 290, y: y - 24, size: 8, font: reg,  color: C.dark });
  page.drawText(amtStr,
    { x: W - 45 - bold.widthOfTextAtSize(amtStr, 10), y: y - 12, size: 10, font: bold, color: C.dark });

  y -= 50;
  page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 0.5, color: C.line });

  // Totals section
  const lx = 360;
  const rx = W - 44;
  y -= 18;
  
  // Calculate amounts
  const hasDiscount = referralDiscountApplied && discountPercentage > 0;
  const originalAmount = hasDiscount ? Math.round(amount / (1 - discountPercentage / 100)) : amount;
  const discountAmount = hasDiscount ? originalAmount - amount : 0;

  // Subtotal (show original price if discount applied, otherwise same as amount)
  const subtotalStr = isTrial ? "FREE TRIAL" : `Rs. ${originalAmount.toLocaleString("en-PK")}`;
  page.drawText("Subtotal:", { x: lx, y, size: 9, font: reg, color: C.gray });
  page.drawText(subtotalStr, { x: rx - reg.widthOfTextAtSize(subtotalStr, 9), y, size: 9, font: reg, color: C.dark });

  // Discount (if applied)
  if (hasDiscount && !isTrial) {
    y -= 16;
    const discountLabel = `Referral Discount (${discountPercentage}%):`;
    const discountStr = `- Rs. ${discountAmount.toLocaleString("en-PK")}`;
    page.drawText(discountLabel, { x: lx, y, size: 9, font: reg, color: rgb(0.545, 0.361, 0.965) });
    page.drawText(discountStr, { x: rx - reg.widthOfTextAtSize(discountStr, 9), y, size: 9, font: bold, color: rgb(0.545, 0.361, 0.965) });
  }

  y -= 4;
  page.drawLine({ start: { x: lx, y }, end: { x: W - 40, y }, thickness: 0.5, color: C.line });
  y -= 14;
  page.drawText("Total:", { x: lx, y, size: 11, font: bold, color: C.dark });
  page.drawText(amtStr, { x: rx - bold.widthOfTextAtSize(amtStr, 11), y, size: 11, font: bold, color: isTrial ? C.purple : C.blue });

  y -= 18;
  page.drawRectangle({ x: lx - 8, y: y - 8, width: W - 40 - lx + 8, height: 26, color: C.gbg });
  const paidLabel = isTrial ? "Trial Activated:" : "Amount Paid:";
  page.drawText(paidLabel, { x: lx, y: y + 4, size: 9, font: bold, color: C.green });
  page.drawText(amtStr,    { x: rx - bold.widthOfTextAtSize(amtStr, 9), y: y + 4, size: 9, font: bold, color: C.green });

  // Account details box
  y -= 55;
  page.drawRectangle({ x: 40, y: y - 52, width: W - 80, height: 62, color: C.bg });
  page.drawLine({ start: { x: 40, y: y + 8 }, end: { x: 40, y: y - 44 }, thickness: 3, color: C.blue });
  page.drawText("ACCOUNT DETAILS",    { x: 52, y: y,      size: 7, font: bold, color: C.gray });
  page.drawText(`Email: ${safe(userEmail).slice(0, 60)}`, { x: 52, y: y - 16, size: 9, font: reg, color: C.dark });
  page.drawText(`Subscription: ${fmtDateShort(activeFrom)} to ${fmtDateShort(activeTo)} (${totalDays} days)`,
    { x: 52, y: y - 31, size: 9, font: reg, color: C.dark });
  if (!isTrial) {
    page.drawText(`Payment: ${fmtPayment(paymentMethod)}`,
      { x: 52, y: y - 46, size: 9, font: reg, color: C.dark });
  }

  // Footer
  page.drawLine({ start: { x: 40, y: 68 }, end: { x: W - 40, y: 68 }, thickness: 0.5, color: C.line });
  page.drawText("Novexa ERP - Smart Business Management",
    { x: 40, y: 50, size: 9, font: bold, color: C.blue });
  page.drawText("This is a computer-generated invoice. No signature required.",
    { x: 40, y: 34, size: 7, font: reg, color: C.gray });

  page.drawRectangle({ x: 0, y: 0, width: W / 2, height: 4, color: C.blue });
  page.drawRectangle({ x: W / 2, y: 0, width: W / 2, height: 4, color: C.amber });

  return await doc.save();
}

// ── Email HTML ─────────────────────────────────────────────────────────────────
function buildRegistrationEmailHTML({
  userName, userEmail, plan, billingPeriod, paymentMethod,
  activeFrom, activeTo, subscriptionType, invoiceNumber, password,
  amount, // actual amount from Firestore
  referralDiscountApplied, discountPercentage, // NEW: referral discount info
}) {
  const isTrial   = subscriptionType === "trial";
  const label     = planLabel(plan);
  const totalDays = daysBetween(activeFrom, activeTo);
  const icons     = { enterprise: "🏢", professional: "👑", business: "🚀", starter: "⭐" };
  const icon      = icons[plan] || "⭐";
  const headerBg  = isTrial
    ? "linear-gradient(135deg,#4c1d95 0%,#6d28d9 60%,#7c3aed 100%)"
    : "linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#2563eb 100%)";
  const accentColor = isTrial ? "#a78bfa" : "#93c5fd";
  const badgeColor  = isTrial ? "#7c3aed" : "#10b981";
  const badgeText   = isTrial ? "Free Trial" : "Active";
  const planColor   = isTrial ? "#8b5cf6" : "#2563eb";
  
  // Calculate discount amounts
  const hasDiscount = referralDiscountApplied && discountPercentage > 0;
  const originalAmount = hasDiscount ? Math.round(amount / (1 - discountPercentage / 100)) : amount;
  const discountAmount = hasDiscount ? originalAmount - amount : 0;
  
  const amtStr      = isTrial ? "Free" : `Rs. ${(amount || 0).toLocaleString("en-PK")}`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Welcome to Novexa ERP</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

<tr><td style="height:6px;background:linear-gradient(to right,#1d4ed8,#3b82f6,#f59e0b);"></td></tr>

<tr><td style="padding:36px 40px 24px;background:${headerBg};">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>
      <div style="color:${accentColor};font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Welcome to Novexa ERP</div>
      <div style="color:#fff;font-size:24px;font-weight:800;">🎉 Your Account is Ready!</div>
      <div style="color:${accentColor};font-size:13px;margin-top:8px;">Hi <strong style="color:#fff;">${userName}</strong>, your Novexa ERP account has been created.</div>
    </td>
    <td align="right" valign="top" style="padding-left:16px;">
      <div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);font-size:24px;line-height:48px;text-align:center;">${icon}</div>
    </td>
  </tr></table>
</td></tr>

<tr><td style="padding:20px 40px 8px;">
  <span style="display:inline-block;padding:5px 14px;border-radius:20px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:${badgeColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">
    ✓ ${badgeText} — Registered Today
  </span>
</td></tr>

<tr><td style="padding:8px 40px 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1.5px solid ${planColor}44;">
    <tr><td colspan="2" style="padding:14px 20px;background:${planColor}22;border-bottom:1px solid ${planColor}33;">
      <strong style="font-size:13px;color:${planColor};text-transform:uppercase;letter-spacing:1px;">${icon} ${label} Plan${isTrial ? " — Free Trial" : ` — ${billingPeriod === "yearly" ? "Yearly" : "Monthly"}`}</strong>
    </td></tr>
    <tr>
      <td width="50%" style="padding:16px 20px;border-right:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Active From</div>
        <div style="font-size:15px;font-weight:800;color:#111827;">${fmtDate(activeFrom)}</div>
      </td>
      <td width="50%" style="padding:16px 20px;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Expires On</div>
        <div style="font-size:15px;font-weight:800;color:#111827;">${fmtDate(activeTo)}</div>
      </td>
    </tr>
    <tr>
      <td width="50%" style="padding:16px 20px;border-right:1px solid #f1f5f9;">
        <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">Total Days</div>
        <div style="font-size:15px;font-weight:800;color:${planColor};">${totalDays} Days</div>
      </td>
      <td width="50%" style="padding:16px 20px;">
        <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">${isTrial ? "Trial Amount" : "Payment Method"}</div>
        <div style="font-size:13px;font-weight:700;color:#374151;">${isTrial ? "Free" : fmtPayment(paymentMethod)}</div>
      </td>
    </tr>
  </table>
</td></tr>

<tr><td style="padding:0 40px 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #dbeafe;border-radius:10px;">
  <tr><td style="padding:16px 20px;font-size:13px;color:#374151;line-height:1.8;">
    <strong>Login Details & Payment Summary:</strong><br/>
    🌐 <strong>App URL:</strong> <a href="https://novexaerp.codeverza.com" style="color:#2563eb;">novexaerp.codeverza.com</a><br/>
    📧 <strong>Email:</strong> ${userEmail}<br/>
    ${password ? `🔑 <strong>Password:</strong> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;">${password}</code><br/>` : ""}
    ${hasDiscount && !isTrial ? `<br/><span style="color:#8b5cf6;font-weight:700;">🎁 Referral Discount Applied: ${discountPercentage}% OFF</span><br/>` : ""}
    ${hasDiscount && !isTrial ? `<span style="color:#6b7280;">Original Price: Rs. ${originalAmount.toLocaleString("en-PK")}</span><br/>` : ""}
    ${hasDiscount && !isTrial ? `<span style="color:#8b5cf6;">Discount: - Rs. ${discountAmount.toLocaleString("en-PK")}</span><br/>` : ""}
    💰 <strong>Final Amount Paid:</strong> <span style="font-size:16px;font-weight:800;color:#10b981;">${amtStr}</span>
  </td></tr>
  </table>
</td></tr>

<tr><td style="padding:0 40px 24px;">
  <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:12px 16px;">
    <div style="font-size:12px;font-weight:700;color:#10b981;margin-bottom:3px;">📄 PDF Invoice Attached</div>
    <div style="font-size:11px;color:#6b7280;">Invoice <strong>${invoiceNumber}</strong> is attached. Open it in any PDF viewer to print your receipt.</div>
  </div>
</td></tr>

<tr><td style="padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
  <div style="font-size:13px;font-weight:700;color:#1d4ed8;">Novexa ERP</div>
  <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Smart Business Management Platform</div>
  <div style="font-size:10px;color:#d1d5db;margin-top:10px;">Automated email — please do not reply.</div>
</td></tr>
<tr><td style="height:4px;background:linear-gradient(to right,#1d4ed8,#3b82f6,#f59e0b);"></td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

// ── POST ───────────────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const {
      uid, userName, userEmail, password,
      plan, billingPeriod, paymentMethod,
      activeFrom, activeTo, subscriptionType,
      referralDiscountApplied, discountPercentage, // NEW: referral discount info
    } = body;

    if (!userEmail) return NextResponse.json({ error: "Missing userEmail" }, { status: 400 });
    if (!activeTo)  return NextResponse.json({ error: "Missing activeTo"  }, { status: 400 });

    const gmailUser = process.env.NOVEXA_GMAIL;
    const gmailPass = process.env.NOVEXA_GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass)
      return NextResponse.json({ error: "Gmail not configured." }, { status: 503 });

    const { adminDb } = await getAdminModules();
    
    // If discount info not provided but uid exists, check user document
    let finalDiscountApplied = referralDiscountApplied;
    let finalDiscountPercentage = discountPercentage;
    
    if (uid && (!referralDiscountApplied || !discountPercentage)) {
      try {
        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          // Check if user was referred
          if (userData.referredBy || userData.referralDiscountApplied) {
            finalDiscountApplied = true;
            finalDiscountPercentage = userData.discountPercentage || 10; // Default 10%
            console.log('[send-reg-invoice] Fetched discount from user doc:', {
              referredBy: userData.referredBy,
              discountPercentage: finalDiscountPercentage
            });
          }
        }
      } catch (err) {
        console.warn('[send-reg-invoice] Could not fetch user discount info:', err.message);
      }
    }
    
    const isTrial = subscriptionType === "trial";
    
    // Fetch base price and apply discount if applicable
    let amount = 0;
    if (!isTrial) {
      const basePrice = await fetchPlanPrice(adminDb, plan, billingPeriod);
      if (finalDiscountApplied && finalDiscountPercentage > 0) {
        // Apply discount to base price
        amount = Math.round(basePrice * (1 - finalDiscountPercentage / 100));
      } else {
        amount = basePrice;
      }
    }

    const invoiceNumber = await makeInvoiceNumber(adminDb, uid);

    console.log(`[reg-invoice] Plan: ${plan} | Period: ${billingPeriod} | Amount: ${amount} | Invoice: ${invoiceNumber}`);

    let pdfBytes;
    try {
      pdfBytes = await buildRegistrationPDF({
        invoiceNumber,
        userName: userName || userEmail,
        userEmail,
        plan,
        billingPeriod,
        paymentMethod,
        activeFrom,
        activeTo,
        subscriptionType,
        amount,
        referralDiscountApplied: finalDiscountApplied || false,
        discountPercentage: finalDiscountPercentage || 0,
      });
      console.log(`[reg-invoice] PDF OK, ${pdfBytes.length} bytes`);
    } catch (pdfErr) {
      console.error("[reg-invoice] PDF failed:", pdfErr.message);
      return NextResponse.json({ error: `PDF error: ${pdfErr.message}` }, { status: 500 });
    }

    const html = buildRegistrationEmailHTML({
      userName: userName || userEmail,
      userEmail,
      password,
      plan,
      billingPeriod,
      paymentMethod,
      activeFrom,
      activeTo,
      subscriptionType,
      invoiceNumber,
      amount,
      referralDiscountApplied: finalDiscountApplied || false,
      discountPercentage: finalDiscountPercentage || 0,
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    const label = planLabel(plan);
    console.log(`[reg-invoice] Sending to ${userEmail}...`);
    try {
      await transporter.sendMail({
        from:    `"Novexa ERP" <${gmailUser}>`,
        to:      userEmail,
        subject: `Welcome to Novexa ERP — ${label} Plan Activated · ${invoiceNumber}`,
        html,
        attachments: [{
          filename:    `${invoiceNumber}.pdf`,
          content:     Buffer.from(pdfBytes),
          contentType: "application/pdf",
        }],
      });
    } catch (mailErr) {
      console.error("[reg-invoice] sendMail failed:", mailErr.message);
      return NextResponse.json({ error: `Email failed: ${mailErr.message}` }, { status: 500 });
    }

    console.log(`[reg-invoice] Sent: ${invoiceNumber}`);
    return NextResponse.json({ success: true, invoiceNumber });

  } catch (err) {
    console.error("[reg-invoice] Unexpected:", err.message, err.stack);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
