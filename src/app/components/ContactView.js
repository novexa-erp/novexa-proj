"use client";

import { useState } from "react";

// ── Contact Form ──────────────────────────────────────────────────────────────
function ContactForm({ userDoc, user }) {
  const [form, setForm] = useState({
    name:     userDoc?.name  || user?.displayName || "",
    email:    user?.email    || "",
    subject:  "",
    category: "",
    message:  "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [focused,   setFocused]   = useState(null);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const categories = [
    "Subscription / Renewal",
    "Account Issue",
    "Billing Query",
    "Feature Request",
    "Bug Report",
    "Other",
  ];

  function handleSubmit(e) {
    e.preventDefault();
    // TODO: wire up submission (email / Firestore / API)
    setSubmitted(true);
  }

  const inputStyle = (name) => ({
    width: "100%",
    outline: "none",
    background: focused === name ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.03)",
    border: `1.5px solid ${focused === name ? "rgba(37,99,235,0.45)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 12,
    padding: "11px 14px",
    color: "#fff",
    fontSize: 13,
    transition: "all .2s ease",
    boxShadow: focused === name ? "0 0 0 3px rgba(37,99,235,0.08)" : "none",
  });

  const labelStyle = {
    display: "block",
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: 6,
  };

  if (submitted) {
    return (
      <div className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
        style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.2)" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
          style={{ background: "rgba(52,211,153,0.1)", border: "2px solid rgba(52,211,153,0.25)" }}>
          ✓
        </div>
        <div>
          <p className="text-white font-black text-lg mb-1">Message Sent!</p>
          <p className="text-gray-400 text-sm">We have received your message and will get back to you shortly.</p>
        </div>
        <button onClick={() => { setSubmitted(false); setForm(f => ({ ...f, subject: "", category: "", message: "" })); }}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
          style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-2 mb-5">
        <span className="text-lg">✉️</span>
        <p className="text-white font-bold text-sm uppercase tracking-widest">Send Us a Message</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input
              type="text" required value={form.name} onChange={set("name")}
              placeholder="Your name"
              style={inputStyle("name")}
              onFocus={() => setFocused("name")}
              onBlur={() => setFocused(null)}
            />
          </div>
          <div>
            <label style={labelStyle}>Email Address *</label>
            <input
              type="email" required value={form.email} onChange={set("email")}
              placeholder="your@email.com"
              style={inputStyle("email")}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label style={labelStyle}>Category *</label>
          <select
            required value={form.category} onChange={set("category")}
            style={{ ...inputStyle("category"), appearance: "none" }}
            onFocus={() => setFocused("category")}
            onBlur={() => setFocused(null)}
          >
            <option value="" disabled style={{ background: "#0d1117" }}>Select a category...</option>
            {categories.map((c) => (
              <option key={c} value={c} style={{ background: "#0d1117" }}>{c}</option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label style={labelStyle}>Subject *</label>
          <input
            type="text" required value={form.subject} onChange={set("subject")}
            placeholder="Brief description of your issue"
            style={inputStyle("subject")}
            onFocus={() => setFocused("subject")}
            onBlur={() => setFocused(null)}
          />
        </div>

        {/* Message */}
        <div>
          <label style={labelStyle}>Message *</label>
          <textarea
            required value={form.message} onChange={set("message")}
            placeholder="Describe your issue or question in detail..."
            rows={5}
            style={{ ...inputStyle("message"), resize: "vertical", minHeight: 110 }}
            onFocus={() => setFocused("message")}
            onBlur={() => setFocused(null)}
          />
          <p className="text-gray-600 text-[10px] mt-1 text-right">{form.message.length} characters</p>
        </div>

        {/* Submit */}
        <button type="submit"
          className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all hover:scale-[1.01] hover:brightness-110"
          style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", boxShadow: "0 4px 20px rgba(37,99,235,0.25)" }}>
          Send Message →
        </button>
      </form>
    </div>
  );
}

const WHATSAPP_NUMBER = "923320262457"; // Change to actual Novexa number

export default function ContactView({ userDoc, user }) {
  const [copied, setCopied] = useState(null);

  function copyToClipboard(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const userName    = userDoc?.name  || user?.displayName || "User";
  const userEmail   = user?.email    || "";
  const waMessage   = encodeURIComponent(
    `Hello Novexa Support,\n\nMy name is ${userName} and my email is ${userEmail}.\n\nI need help with: `
  );

  const contactOptions = [
    {
      id:       "whatsapp",
      icon:     "💬",
      label:    "WhatsApp",
      sublabel: "Fastest response",
      value:    "+92 332 0262457",
      color:    "from-green-500 to-emerald-600",
      border:   "rgba(52,211,153,0.25)",
      bg:       "rgba(52,211,153,0.06)",
      badge:    { text: "Recommended", color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.25)" },
      action: () => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${waMessage}`, "_blank"),
      actionLabel: "Open WhatsApp →",
    },
    {
      id:       "email",
      icon:     "📧",
      label:    "Email",
      sublabel: "Response within 24 hours",
      value:    "support@novexa.pk",
      color:    "from-blue-500 to-cyan-600",
      border:   "rgba(96,165,250,0.25)",
      bg:       "rgba(96,165,250,0.06)",
      badge:    null,
      action: () => window.open(`mailto:support@novexa.pk?subject=Support Request - ${userName}&body=Hello Novexa Support,%0A%0AMy name is ${userName} and my email is ${userEmail}.%0A%0AI need help with: `, "_blank"),
      actionLabel: "Send Email →",
    },
    {
      id:       "phone",
      icon:     "📞",
      label:    "Phone Call",
      sublabel: "Mon – Sat, 9 AM – 8 PM",
      value:    "+92 332 0262457",
      color:    "from-purple-500 to-violet-600",
      border:   "rgba(139,92,246,0.25)",
      bg:       "rgba(139,92,246,0.06)",
      badge:    null,
      action: () => window.open("tel:+923320262457"),
      actionLabel: "Call Now →",
    },
  ];

  const faqs = [
    {
      q: "How do I renew my subscription?",
      a: "Contact us on WhatsApp or call us directly. We will send you payment details and activate your account within minutes after confirmation.",
    },
    {
      q: "My account got frozen — what do I do?",
      a: "Your subscription may have expired. Contact our team with your registered email and we will reactivate it after renewal.",
    },
    {
      q: "How do I add a new user or employee?",
      a: "Only the admin can create new accounts. Ask your administrator to log in to the Admin Panel and register your account.",
    },
    {
      q: "I lost my data — can it be recovered?",
      a: "All your data is securely stored in the cloud. It cannot be lost unless manually deleted. Contact support if you face any issues.",
    },
    {
      q: "Can I use Novexa on multiple devices?",
      a: "Yes, depending on your plan. Your account has a device limit set by the admin. Contact us to upgrade your plan.",
    },
  ];

  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8 pb-10">

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-white font-black text-2xl">Contact Support</h2>
        <p className="text-gray-500 text-sm">We are here to help. Reach out through any channel below.</p>
      </div>

      {/* Contact cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {contactOptions.map((c) => (
          <div key={c.id} className="rounded-2xl p-5 flex flex-col gap-4 transition-all hover:scale-[1.01]"
            style={{ background: c.bg, border: `1px solid ${c.border}` }}>

            {/* Icon + badge */}
            <div className="flex items-start justify-between">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br ${c.color}`}>
                {c.icon}
              </div>
              {c.badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ color: c.badge.color, background: c.badge.bg, border: `1px solid ${c.badge.border}` }}>
                  {c.badge.text}
                </span>
              )}
            </div>

            {/* Info */}
            <div>
              <p className="text-white font-bold text-sm">{c.label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{c.sublabel}</p>
            </div>

            {/* Value + copy */}
            <div className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-gray-300 text-xs font-mono">{c.value}</span>
              <button onClick={() => copyToClipboard(c.value, c.id)}
                className="text-gray-500 hover:text-white transition-colors text-xs ml-2">
                {copied === c.id ? "✓" : "⎘"}
              </button>
            </div>

            {/* CTA */}
            <button onClick={c.action}
              className={`w-full py-2.5 rounded-xl text-white text-xs font-bold bg-gradient-to-r ${c.color} transition-all hover:brightness-110 hover:scale-[1.02]`}>
              {c.actionLabel}
            </button>
          </div>
        ))}
      </div>

      {/* Contact Form */}
      <ContactForm userDoc={userDoc} user={user} />

      {/* Business hours */}
      <div className="rounded-2xl p-5"
        style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🕐</span>
          <p className="text-amber-400 text-xs font-bold uppercase tracking-widest">Business Hours</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { day: "Monday – Friday", hours: "9:00 AM – 8:00 PM", status: "open" },
            { day: "Saturday",        hours: "10:00 AM – 6:00 PM", status: "open" },
            { day: "Sunday",          hours: "Closed",             status: "closed" },
            { day: "Public Holidays", hours: "Closed",             status: "closed" },
          ].map((h) => (
            <div key={h.day} className="rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-gray-500 text-[10px] uppercase tracking-wide font-bold mb-1">{h.day}</p>
              <p className={`text-xs font-semibold ${h.status === "open" ? "text-green-400" : "text-red-400"}`}>
                {h.hours}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">❓</span>
          <p className="text-white font-bold text-sm uppercase tracking-widest">Frequently Asked Questions</p>
        </div>
        <div className="flex flex-col gap-2">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl overflow-hidden transition-all"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${openFaq === i ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.07)"}` }}>
              <button className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span className="text-white text-sm font-semibold pr-4">{faq.q}</span>
                <span className="text-gray-500 text-xs flex-shrink-0 transition-transform duration-200"
                  style={{ transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4">
                  <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.12)" }}>
        <span className="text-blue-400 text-lg flex-shrink-0">ℹ️</span>
        <p className="text-gray-400 text-xs leading-relaxed">
          For urgent issues, WhatsApp is the fastest way to reach us. Please include your registered email address and a brief description of your issue so we can help you quickly.
        </p>
      </div>

    </div>
  );
}
