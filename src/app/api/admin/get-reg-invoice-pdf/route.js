import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

// ── Helpers ────────────────────────────────────────────────────────────────────
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

// ── Fetch actual price from Firestore ──────────────────────────────────────────
async function fetchPlanPrice(adminDb, planId, billingPeriod) {
  try {
    const snap = await adminDb.collection("adminConfig").doc("plans").get();
    if (snap.exists) {
      const list = snap.data().list || [];
      const plan = list.find(p => p.id === planId);
      if (plan) {
        return billingPeriod === "yearly"
          ? Number(plan.afterYearlyPrice  || plan.yearlyPrice  || 0)
          : Number(plan.afterMonthlyPrice || plan.monthlyPrice || 0);
      }
    }
  } catch (e) {
    console.warn("[get-reg-invoice-pdf] price fetch warn:", e.message);
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

// ── Global serial invoice number: REG-NNNDDMMYY ───────────────────────────────
// Format: REG-001082826  (serial 001, date DD=08 MM=28 YY=26)
// Counter: adminConfig/regInvoiceCounter → { lastSerial: N }
// Only generates a NEW number if uid has no saved regInvoiceNumber yet.
async function generateInvoiceNumber(adminDb, uid) {
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
  const ts = new Date();
  const dd = String(ts.getDate()).padStart(2, "0");
  const mm = String(ts.getMonth() + 1).padStart(2, "0");
  const yy = String(ts.getFullYear()).slice(-2);
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

// ── Build PDF ──────────────────────────────────────────────────────────────────
async function buildPDF({ invoiceNumber, userName, userEmail, plan, billingPeriod,
                           paymentMethod, activeFrom, activeTo, subscriptionType, amount,
                           referralDiscountApplied, discountPercentage }) {
  const doc  = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const W = 595, H = 842;
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);
  const safe = s => (s || "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

  const isTrial   = subscriptionType === "trial";
  const amtStr    = isTrial ? "FREE TRIAL" : "Rs. " + (amount || 0).toLocaleString("en-PK");
  const label     = planLabel(plan);
  const totalDays = daysBetween(activeFrom, activeTo);
  const issuedOn  = new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });

  const C = {
    blue:   rgb(0.114, 0.306, 0.847),
    amber:  rgb(0.961, 0.620, 0.043),
    green:  rgb(0.086, 0.725, 0.506),
    dark:   rgb(0.067, 0.067, 0.067),
    gray:   rgb(0.420, 0.447, 0.502),
    bg:     rgb(0.969, 0.980, 1.000),
    white:  rgb(1, 1, 1),
    line:   rgb(0.878, 0.898, 0.918),
    gbg:    rgb(0.941, 0.992, 0.969),
    purple: rgb(0.545, 0.361, 0.965),
  };

  const hCol = isTrial ? C.purple : C.blue;
  page.drawRectangle({ x: 0, y: H - 105, width: W, height: 105, color: hCol });
  page.drawRectangle({ x: 0, y: H - 5, width: W / 2, height: 5, color: hCol });
  page.drawRectangle({ x: W / 2, y: H - 5, width: W / 2, height: 5, color: C.amber });

  page.drawText("INVOICE",    { x: 40, y: H - 42, size: 26, font: bold, color: C.white });
  page.drawText("Novexa ERP", { x: 40, y: H - 68, size: 13, font: bold, color: C.white });
  page.drawText(isTrial ? "Free Trial Registration" : "New Account Registration",
    { x: 40, y: H - 84, size: 9, font: reg, color: rgb(0.78, 0.88, 1.0) });

  const invRight = W - bold.widthOfTextAtSize(invoiceNumber, 12) - 40;
  page.drawText(invoiceNumber, { x: invRight, y: H - 42, size: 12, font: bold, color: C.white });
  page.drawText("REGISTRATION INVOICE",
    { x: W - 40 - reg.widthOfTextAtSize("REGISTRATION INVOICE", 8), y: H - 58, size: 8, font: reg, color: rgb(0.78, 0.88, 1.0) });

  const badgeText = isTrial ? "TRIAL" : "ACTIVE";
  page.drawRectangle({ x: W - 106, y: H - 88, width: 68, height: 20, color: isTrial ? C.purple : C.green });
  page.drawText(badgeText, { x: W - 101, y: H - 82, size: 9, font: bold, color: C.white });

  let y = H - 130;
  page.drawText("BILL TO",                    { x: 40, y, size: 8, font: bold, color: C.gray });
  y -= 16;
  page.drawText(safe(userName).slice(0, 60),  { x: 40, y, size: 12, font: bold, color: C.dark });
  y -= 15;
  page.drawText(safe(userEmail).slice(0, 70), { x: 40, y, size: 9,  font: reg,  color: C.gray });

  const rX = 380;
  page.drawText("Invoice Date:", { x: rX, y: H - 130, size: 8, font: reg,  color: C.gray });
  page.drawText(issuedOn,        { x: rX + 85, y: H - 130, size: 8, font: bold, color: C.dark });
  page.drawText("Plan:",         { x: rX, y: H - 146, size: 8, font: reg,  color: C.gray });
  page.drawText(`${label} (${fmtPeriod(billingPeriod)})`,
    { x: rX + 85, y: H - 146, size: 8, font: bold, color: C.dark });

  y = H - 190;
  page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 1, color: C.line });

  y -= 2;
  page.drawRectangle({ x: 40, y: y - 22, width: W - 80, height: 24, color: C.blue });
  page.drawText("Description", { x: 52,      y: y - 15, size: 9, font: bold, color: C.white });
  page.drawText("Period",      { x: 290,     y: y - 15, size: 9, font: bold, color: C.white });
  page.drawText("Amount",      { x: W - 110, y: y - 15, size: 9, font: bold, color: C.white });

  y -= 26;
  page.drawRectangle({ x: 40, y: y - 46, width: W - 80, height: 48, color: C.bg });
  const d1 = isTrial ? `${label} Plan - Free Trial` : `${label} Plan - ${fmtPeriod(billingPeriod)} Subscription`;
  const d2 = isTrial ? `${totalDays}-day trial period` : `New account registered, ${totalDays} days`;
  page.drawText(d1, { x: 52, y: y - 12, size: 10, font: bold, color: C.dark });
  page.drawText(d2, { x: 52, y: y - 28, size: 8,  font: reg,  color: C.gray });
  page.drawText(`${fmtDateShort(activeFrom)} to`, { x: 290, y: y - 12, size: 8, font: reg, color: C.dark });
  page.drawText(fmtDateShort(activeTo),           { x: 290, y: y - 24, size: 8, font: reg, color: C.dark });
  page.drawText(amtStr, { x: W - 45 - bold.widthOfTextAtSize(amtStr, 10), y: y - 12, size: 10, font: bold, color: C.dark });

  y -= 50;
  page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 0.5, color: C.line });

  const lx = 360, rx = W - 44;
  y -= 18;
  
  // Calculate amounts
  const hasDiscount = referralDiscountApplied && discountPercentage > 0;
  const originalAmount = hasDiscount ? Math.round(amount / (1 - discountPercentage / 100)) : amount;
  const discountAmount = hasDiscount ? originalAmount - amount : 0;
  
  // Subtotal (show original price if discount applied)
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

  y -= 55;
  page.drawRectangle({ x: 40, y: y - 52, width: W - 80, height: 62, color: C.bg });
  page.drawLine({ start: { x: 40, y: y + 8 }, end: { x: 40, y: y - 44 }, thickness: 3, color: C.blue });
  page.drawText("ACCOUNT DETAILS", { x: 52, y: y, size: 7, font: bold, color: C.gray });
  page.drawText(`Email: ${safe(userEmail).slice(0, 60)}`, { x: 52, y: y - 16, size: 9, font: reg, color: C.dark });
  page.drawText(`Subscription: ${fmtDateShort(activeFrom)} to ${fmtDateShort(activeTo)} (${totalDays} days)`,
    { x: 52, y: y - 31, size: 9, font: reg, color: C.dark });
  if (!isTrial) {
    page.drawText(`Payment: ${fmtPayment(paymentMethod)}`, { x: 52, y: y - 46, size: 9, font: reg, color: C.dark });
  }

  page.drawLine({ start: { x: 40, y: 68 }, end: { x: W - 40, y: 68 }, thickness: 0.5, color: C.line });
  page.drawText("Novexa ERP - Smart Business Management", { x: 40, y: 50, size: 9, font: bold, color: C.blue });
  page.drawText("This is a computer-generated invoice. No signature required.", { x: 40, y: 34, size: 7, font: reg, color: C.gray });
  page.drawRectangle({ x: 0, y: 0, width: W / 2, height: 4, color: C.blue });
  page.drawRectangle({ x: W / 2, y: 0, width: W / 2, height: 4, color: C.amber });

  return await doc.save();
}

// ── POST ───────────────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { userName, userEmail, plan, billingPeriod, paymentMethod,
            activeFrom, activeTo, subscriptionType, uploadToCloudinary, uid,
            referralDiscountApplied, discountPercentage } = body;

    console.log('[get-reg-invoice-pdf] Received params:', {
      uid, referralDiscountApplied, discountPercentage, plan, billingPeriod
    });

    if (!userEmail) return NextResponse.json({ error: "Missing userEmail" }, { status: 400 });

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
            console.log('[get-reg-invoice-pdf] Fetched discount from user doc:', {
              referredBy: userData.referredBy,
              discountPercentage: finalDiscountPercentage
            });
          }
        }
      } catch (err) {
        console.warn('[get-reg-invoice-pdf] Could not fetch user discount info:', err.message);
      }
    }

    const isTrial = subscriptionType === "trial";
    
    // Fetch base price and apply discount if applicable
    let amount = 0;
    if (!isTrial) {
      const basePrice = await fetchPlanPrice(adminDb, plan, billingPeriod);
      console.log('[get-reg-invoice-pdf] Base price:', basePrice);
      if (finalDiscountApplied && finalDiscountPercentage > 0) {
        // Apply discount to base price
        amount = Math.round(basePrice * (1 - finalDiscountPercentage / 100));
        console.log('[get-reg-invoice-pdf] Discount applied! Original:', basePrice, 'Discounted:', amount);
      } else {
        amount = basePrice;
        console.log('[get-reg-invoice-pdf] No discount. Amount:', amount);
      }
    }

    const invoiceNumber = await generateInvoiceNumber(adminDb, uid);

    console.log('[get-reg-invoice-pdf] Building PDF with:', {
      invoiceNumber, amount, referralDiscountApplied: finalDiscountApplied, discountPercentage: finalDiscountPercentage
    });

    const pdfBytes = await buildPDF({
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

    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    let cloudinaryUrl = null;
    if (uploadToCloudinary) {
      try {
        const dataUri = `data:application/pdf;base64,${pdfBase64}`;
        const result  = await cloudinary.uploader.upload(dataUri, {
          resource_type: "raw",
          folder:        "novexa-reg-invoices",
          public_id:     invoiceNumber,
          overwrite:     true,
        });
        cloudinaryUrl = result.secure_url;
      } catch (cErr) {
        console.error("[get-reg-invoice-pdf] Cloudinary upload failed:", cErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      invoiceNumber,
      pdfBase64,
      cloudinaryUrl,
      amount,
    });

  } catch (err) {
    console.error("[get-reg-invoice-pdf] Error:", err.message);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
