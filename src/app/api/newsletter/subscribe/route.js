import { NextResponse } from "next/server";
import admin from "firebase-admin";
import nodemailer from "nodemailer";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } catch (error) {
    console.error("Firebase admin initialization error:", error);
  }
}

const db = admin.firestore();

// ── Email transporter ─────────────────────────────────────────────────────────
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.NOVEXA_SMTP_HOST,
    port: parseInt(process.env.NOVEXA_SMTP_PORT || "465"),
    secure: true, // SSL/TLS
    auth: {
      user: process.env.NOVEXA_EMAIL,
      pass: process.env.NOVEXA_EMAIL_PASSWORD,
    },
  });
}

// ── Admin notification email ──────────────────────────────────────────────────
function buildAdminEmailHTML({ email, timestamp }) {
  const now = new Date(timestamp).toLocaleString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>New Newsletter Subscriber — Novexa</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">

  <!-- Top bar -->
  <tr><td style="height:5px;background:linear-gradient(90deg,#F59E0B 0%,#FBBF24 50%,#F59E0B 100%);"></td></tr>

  <!-- Header -->
  <tr><td style="padding:32px 40px 24px;background:linear-gradient(135deg,#0f172a 0%,#78350f 55%,#F59E0B 100%);">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="display:inline-block;background:rgba(251,191,36,0.2);border:1px solid rgba(251,191,36,0.4);border-radius:8px;padding:5px 12px;margin-bottom:12px;">
          <span style="color:#fcd34d;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">📬 New Subscriber</span>
        </div>
        <div style="color:#ffffff;font-size:24px;font-weight:800;line-height:1.2;">Newsletter Subscription</div>
        <div style="color:#fcd34d;font-size:13px;margin-top:4px;">Someone just subscribed to your newsletter!</div>
      </td>
      <td align="right" valign="top">
        <div style="color:#64748b;font-size:11px;text-align:right;">Subscribed<br/>
          <span style="color:#94a3b8;font-weight:600;">${now}</span>
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- Subscriber info -->
  <tr><td style="padding:28px 40px;">
    <div style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:14px;overflow:hidden;">
      <div style="padding:11px 18px;background:#fef3c7;border-bottom:1.5px solid #fcd34d;">
        <span style="font-size:11px;font-weight:800;color:#78350f;text-transform:uppercase;letter-spacing:1px;">📧 Subscriber Email</span>
      </div>
      <div style="padding:18px 20px;">
        <div style="font-size:16px;font-weight:700;color:#F59E0B;word-break:break-all;">${email}</div>
      </div>
    </div>
  </td></tr>

  <!-- Quick stats -->
  <tr><td style="padding:0 40px 28px;">
    <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;padding:18px 20px;">
      <div style="font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">📊 Subscription Details</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0;width:40%;">
            <span style="font-size:12px;color:#64748b;font-weight:600;">Source</span>
          </td>
          <td style="padding:6px 0;text-align:right;">
            <span style="font-size:13px;font-weight:700;color:#0f172a;">Website Footer</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-top:1px solid #e2e8f0;">
            <span style="font-size:12px;color:#64748b;font-weight:600;">Status</span>
          </td>
          <td style="padding:6px 0;text-align:right;border-top:1px solid #e2e8f0;">
            <span style="display:inline-block;padding:3px 10px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:6px;font-size:11px;font-weight:700;color:#16a34a;">✓ Active</span>
          </td>
        </tr>
      </table>
    </div>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 40px;background:#f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="font-size:13px;font-weight:700;color:#F59E0B;">Novexa Admin</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px;">This is an automated notification from the newsletter system.</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- Bottom bar -->
  <tr><td style="height:4px;background:linear-gradient(90deg,#F59E0B 0%,#FBBF24 50%,#F59E0B 100%);"></td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── User thank you email ──────────────────────────────────────────────────────
function buildUserEmailHTML({ email }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Welcome to Novexa Newsletter</title>
</head>
<body style="margin:0;padding:0;background:#e8edf4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#e8edf4;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);">

  <!-- Top bar -->
  <tr><td style="height:5px;background:linear-gradient(90deg,#2563EB 0%,#F59E0B 50%,#2563EB 100%);"></td></tr>

  <!-- Header -->
  <tr><td style="padding:40px 40px 32px;background:linear-gradient(160deg,#0f172a 0%,#1e3a8a 50%,#2563EB 100%);text-align:center;">
    <!-- Icon -->
    <table cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 18px;">
      <tr><td width="68" height="68" align="center" valign="middle"
        style="width:68px;height:68px;background:rgba(251,191,36,0.18);border:2px solid rgba(251,191,36,0.5);border-radius:50%;font-size:30px;line-height:68px;text-align:center;">
        🎉
      </td></tr>
    </table>
    <div style="color:#ffffff;font-size:26px;font-weight:800;margin-bottom:8px;line-height:1.2;">You're Subscribed!</div>
    <div style="color:#bfdbfe;font-size:14px;font-weight:500;">Thank you for joining our newsletter</div>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:36px 40px 0;">
    <p style="margin:0 0 10px;font-size:19px;font-weight:800;color:#0f172a;">Hello! 👋</p>
    <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.8;">
      Thank you for subscribing to the <strong style="color:#F59E0B;">Novexa Newsletter</strong>!
      You'll now receive updates about new features, tips, product announcements, and special offers directly in your inbox.
    </p>
  </td></tr>

  <!-- What to expect box -->
  <tr><td style="padding:20px 40px;">
    <div style="background:#fffbeb;border:1.5px solid #fcd34d;border-radius:14px;padding:20px 22px;">
      <div style="font-size:11px;font-weight:800;color:#78350f;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:14px;">📬 What to Expect</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="34" valign="top" style="padding:0 10px 12px 0;">
            <table cellpadding="0" cellspacing="0">
              <tr><td width="28" height="28" align="center" valign="middle"
                style="width:28px;height:28px;background:#F59E0B;border-radius:50%;font-size:12px;font-weight:900;color:#fff;line-height:28px;text-align:center;">
                1
              </td></tr>
            </table>
          </td>
          <td style="padding-bottom:12px;">
            <div style="font-size:13px;font-weight:700;color:#1c1917;">Product Updates &amp; Features</div>
            <div style="font-size:12px;color:#78716c;margin-top:2px;">Be the first to know about new tools and improvements</div>
          </td>
        </tr>
        <tr>
          <td width="34" valign="top" style="padding:0 10px 12px 0;">
            <table cellpadding="0" cellspacing="0">
              <tr><td width="28" height="28" align="center" valign="middle"
                style="width:28px;height:28px;background:#F59E0B;border-radius:50%;font-size:12px;font-weight:900;color:#fff;line-height:28px;text-align:center;">
                2
              </td></tr>
            </table>
          </td>
          <td style="padding-bottom:12px;">
            <div style="font-size:13px;font-weight:700;color:#1c1917;">Tips &amp; Best Practices</div>
            <div style="font-size:12px;color:#78716c;margin-top:2px;">Learn how to get the most out of Novexa ERP</div>
          </td>
        </tr>
        <tr>
          <td width="34" valign="top" style="padding:0 10px 0 0;">
            <table cellpadding="0" cellspacing="0">
              <tr><td width="28" height="28" align="center" valign="middle"
                style="width:28px;height:28px;background:#F59E0B;border-radius:50%;font-size:12px;font-weight:900;color:#fff;line-height:28px;text-align:center;">
                3
              </td></tr>
            </table>
          </td>
          <td>
            <div style="font-size:13px;font-weight:700;color:#1c1917;">Exclusive Offers</div>
            <div style="font-size:12px;color:#78716c;margin-top:2px;">Special deals and promotions just for subscribers</div>
          </td>
        </tr>
      </table>
    </div>
  </td></tr>

  <!-- CTA buttons -->
  <tr><td style="padding:20px 40px 32px;">
    <p style="margin:0 0 12px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:1px;">Explore Novexa</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="48%" style="padding-right:8px;">
          <a href="https://novexaerp.codeverza.com/pages/features" style="display:block;padding:14px 10px;background:#eff6ff;border:1.5px solid #93c5fd;border-radius:12px;text-decoration:none;text-align:center;">
            <div style="font-size:22px;margin-bottom:5px;">✨</div>
            <div style="font-size:13px;font-weight:800;color:#2563EB;">View Features</div>
            <div style="font-size:11px;color:#1e40af;margin-top:2px;font-weight:600;">See what we offer</div>
          </a>
        </td>
        <td width="4%"></td>
        <td width="48%">
          <a href="https://novexaerp.codeverza.com/pages/contact" style="display:block;padding:14px 10px;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:12px;text-decoration:none;text-align:center;">
            <div style="font-size:22px;margin-bottom:5px;">💬</div>
            <div style="font-size:13px;font-weight:800;color:#F59E0B;">Contact Us</div>
            <div style="font-size:11px;color:#d97706;margin-top:2px;font-weight:600;">We're here to help</div>
          </a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:0 40px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 40px;background:#f8fafc;text-align:center;">
    <div style="font-size:16px;font-weight:900;color:#2563EB;margin-bottom:4px;">Novexa</div>
    <div style="font-size:12px;color:#64748b;font-weight:500;margin-bottom:10px;">Smart Business Management Platform</div>
    <div style="font-size:11px;color:#94a3b8;">
      Subscribed as: <span style="color:#2563EB;font-weight:600;">${email}</span>
    </div>
    <div style="margin-top:10px;font-size:11px;color:#94a3b8;">
      Don't want these emails? &nbsp;·&nbsp;
      <a href="mailto:${process.env.NOVEXA_EMAIL}?subject=Unsubscribe" style="color:#2563EB;text-decoration:none;font-weight:600;">Unsubscribe</a>
    </div>
  </td></tr>

  <!-- Bottom bar -->
  <tr><td style="height:4px;background:linear-gradient(90deg,#2563EB 0%,#F59E0B 50%,#2563EB 100%);"></td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// Track recent subscriptions to prevent duplicates in dev mode
const recentSubscriptions = new Set();
const COOLDOWN_MS = 5000; // 5 seconds cooldown

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    // Normalize email (lowercase)
    const normalizedEmail = email.toLowerCase().trim();
    
    // Deduplication check (prevent double API calls in dev mode)
    const dedupeKey = `${normalizedEmail}-${Date.now()}`;
    const recentKey = Array.from(recentSubscriptions).find(k => k.startsWith(normalizedEmail));
    
    if (recentKey) {
      // Already processing this email within cooldown period
      return NextResponse.json({ 
        success: true,
        message: "Already processing..." 
      });
    }
    
    // Add to recent subscriptions
    recentSubscriptions.add(dedupeKey);
    setTimeout(() => recentSubscriptions.delete(dedupeKey), COOLDOWN_MS);
    
    // Use email as document ID for easy duplicate checking
    const docRef = db.collection("newsletter").doc(normalizedEmail);
    
    // Check if already subscribed
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      return NextResponse.json(
        { 
          error: "already_subscribed",
          message: "This email is already subscribed to our newsletter." 
        }, 
        { status: 409 }
      );
    }

    const timestamp = Date.now();

    // Add new subscriber
    await docRef.set({
      email: normalizedEmail,
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "active",
      source: "website_footer",
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    // Send emails (don't wait for them to avoid delays)
    const transporter = getTransporter();
    
    // Send both emails in parallel (fire and forget)
    Promise.all([
      // 1. Admin notification
      transporter.sendMail({
        from: `"Novexa Newsletter" <${process.env.NOVEXA_EMAIL}>`,
        to: process.env.NOVEXA_EMAIL,
        subject: `[Newsletter] New Subscriber: ${normalizedEmail}`,
        html: buildAdminEmailHTML({ email: normalizedEmail, timestamp }),
        headers: {
          "X-Priority": "3",
          "Importance": "normal",
        },
      }),

      // 2. User welcome email
      transporter.sendMail({
        from: `"Novexa Team" <${process.env.NOVEXA_EMAIL}>`,
        to: normalizedEmail,
        subject: "Welcome to Novexa Newsletter! 🎉",
        html: buildUserEmailHTML({ email: normalizedEmail }),
        headers: {
          "X-Priority": "3",
          "Importance": "normal",
          "List-Unsubscribe": `<mailto:${process.env.NOVEXA_EMAIL}?subject=Unsubscribe>`,
        },
      }),
    ]).catch(err => {
      console.error("[newsletter] Email sending error:", err);
      // Don't fail the API call if emails fail
    });

    return NextResponse.json({ 
      success: true,
      message: "Successfully subscribed to newsletter!" 
    });

  } catch (err) {
    console.error("[newsletter/subscribe] ERROR:", err.message);
    return NextResponse.json({ 
      error: "Failed to subscribe. Please try again." 
    }, { status: 500 });
  }
}


