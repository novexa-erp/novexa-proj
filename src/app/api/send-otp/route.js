import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

// ── Generate 6-digit OTP ──────────────────────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── OTP Email HTML ────────────────────────────────────────────────────────────
function buildOTPEmailHTML({ otp, bizName, purpose }) {
  const now = new Date().toLocaleString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Novexa — Security Verification</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:40px 16px;">
<tr><td align="center">

  <!-- Card -->
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">

    <!-- Top accent bar -->
    <tr><td style="height:5px;background:linear-gradient(90deg,#1d4ed8 0%,#6366f1 50%,#f59e0b 100%);"></td></tr>

    <!-- Header -->
    <tr><td style="padding:36px 48px 28px;background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 55%,#1d4ed8 100%);">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:6px 14px;margin-bottom:14px;">
            <span style="color:#93c5fd;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">🔐 Security Verification</span>
          </div>
          <div style="color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;line-height:1.2;">Novexa</div>
          <div style="color:#93c5fd;font-size:13px;margin-top:4px;">Smart Business Management</div>
        </td>
        <td align="right" valign="top">
          <div style="width:52px;height:52px;background:rgba(255,255,255,0.1);border:2px solid rgba(255,255,255,0.2);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;text-align:center;line-height:52px;">🔑</div>
        </td>
      </tr></table>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:40px 48px 32px;">

      <p style="margin:0 0 6px;font-size:20px;font-weight:800;color:#0f172a;">Your One-Time Password</p>
      <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.6;">
        Hi <strong style="color:#1e293b;">${bizName || "there"}</strong>, we received a request to verify your identity.<br/>
        Use the code below to proceed. <strong style="color:#dc2626;">Do not share this with anyone.</strong>
      </p>

      <!-- OTP Box -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr><td align="center">
          <div style="display:inline-block;background:linear-gradient(135deg,#0f172a,#1e3a8a,#2563eb);border-radius:18px;padding:28px 56px;box-shadow:0 8px 30px rgba(37,99,235,0.35);">
            <div style="font-size:11px;font-weight:700;color:#93c5fd;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">Your OTP Code</div>
            <div style="font-size:48px;font-weight:900;color:#ffffff;letter-spacing:14px;font-family:'Courier New',Courier,monospace;line-height:1;">${otp}</div>
          </div>
        </td></tr>
      </table>

      <!-- Info pills -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td width="50%" style="padding-right:8px;">
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 16px;">
              <div style="font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">⏰ Expires In</div>
              <div style="font-size:14px;font-weight:700;color:#991b1b;">10 Minutes</div>
            </div>
          </td>
          <td width="50%" style="padding-left:8px;">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;">
              <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">🕐 Sent At</div>
              <div style="font-size:13px;font-weight:600;color:#15803d;">${now}</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Warning -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 18px;margin-bottom:8px;">
        <p style="margin:0;font-size:12px;color:#92400e;line-height:1.6;">
          ⚠️ <strong>Security Notice:</strong> Novexa will never ask for this code via phone or chat.
          If you did not request this OTP, please ignore this email — your account is safe.
        </p>
      </div>

    </td></tr>

    <!-- Divider -->
    <tr><td style="padding:0 48px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

    <!-- Footer -->
    <tr><td style="padding:24px 48px;background:#f8fafc;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="font-size:13px;font-weight:700;color:#1d4ed8;">Novexa</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Smart Business Management Platform</div>
        </td>
        <td align="right">
          <div style="font-size:11px;color:#cbd5e1;">This is an automated email.<br/>Please do not reply.</div>
        </td>
      </tr></table>
    </td></tr>

    <!-- Bottom accent bar -->
    <tr><td style="height:4px;background:linear-gradient(90deg,#1d4ed8 0%,#6366f1 50%,#f59e0b 100%);"></td></tr>

  </table>
  <!-- End Card -->

</td></tr>
</table>
</body>
</html>`;
}

export async function POST(request) {
  try {
    const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let decoded;
    try { decoded = await adminAuth.verifyIdToken(token); }
    catch { return NextResponse.json({ error: "Invalid token" }, { status: 401 }); }

    const uid = decoded.uid;

    // ── Get user doc from Firestore ──────────────────────────────────────────
    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const userData = userSnap.data();
    const bizName  = userData.business || userData.name || "Novexa";
    const userEmail = decoded.email || userData.email;

    if (!userEmail) {
      return NextResponse.json({ error: "No email found for this account." }, { status: 400 });
    }

    // ── Use Novexa system Gmail for OTP (not user's personal Gmail) ──────────
    const novexaGmail    = process.env.NOVEXA_GMAIL;
    const novexaPassword = process.env.NOVEXA_GMAIL_APP_PASSWORD;

    if (!novexaGmail || !novexaPassword) {
      return NextResponse.json({ error: "OTP service not configured. Contact support." }, { status: 500 });
    }

    // ── Rate limiting: allow resend after 60 seconds ─────────────────────────
    const { purpose = "change_credentials", isResend = false } = await request.json().catch(() => ({}));

    const existingOtp = userData._pendingOTP;
    if (existingOtp && !isResend) {
      const createdAt = existingOtp.createdAt?.toDate?.() || new Date(existingOtp.createdAt);
      const ageMs = Date.now() - createdAt.getTime();
      if (ageMs < 60 * 1000) {
        const secondsLeft = Math.ceil((60 * 1000 - ageMs) / 1000);
        return NextResponse.json({ error: `Please wait ${secondsLeft}s before requesting a new OTP.` }, { status: 429 });
      }
    }

    // ── Generate & store OTP ─────────────────────────────────────────────────
    const otp     = generateOTP();
    const expiry  = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await adminDb.collection("users").doc(uid).update({
      _pendingOTP: {
        code:      otp,
        purpose,
        createdAt: new Date().toISOString(),
        expiresAt: expiry.toISOString(),
        verified:  false,
      },
    });

    // ── Send OTP via Novexa system Gmail ────────────────────────────────────
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: novexaGmail,
        pass: novexaPassword,
      },
    });

    await transporter.sendMail({
      from:    `"Novexa" <${novexaGmail}>`,
      to:      userEmail,
      subject: `Your Novexa OTP: ${otp}`,
      html:    buildOTPEmailHTML({ otp, bizName, purpose }),
    });

    return NextResponse.json({ success: true, sentTo: userEmail });
  } catch (err) {
    console.error("[send-otp] ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
