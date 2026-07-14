"use client";

import { useState, useEffect, useRef } from "react";

// ── Success Popup ─────────────────────────────────────────────────────────────
function SuccessPopup({ email, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // slight delay for mount animation
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        transition: "opacity .3s",
        opacity: visible ? 1 : 0,
      }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "linear-gradient(145deg,#0d1117,#0f1f3d)",
          border: "1px solid rgba(52,211,153,0.3)",
          borderRadius: 24,
          padding: "40px 36px",
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(52,211,153,0.1)",
          transition: "transform .35s cubic-bezier(.34,1.56,.64,1), opacity .3s",
          transform: visible ? "scale(1) translateY(0)" : "scale(0.85) translateY(30px)",
          opacity: visible ? 1 : 0,
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow rings */}
        <div style={{
          position:"absolute", top:-60, left:"50%", transform:"translateX(-50%)",
          width:200, height:200, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(52,211,153,0.12) 0%,transparent 70%)",
          pointerEvents:"none",
        }}/>

        {/* Animated checkmark */}
        <div style={{ position:"relative", marginBottom:24 }}>
          <div style={{
            width:80, height:80, borderRadius:"50%", margin:"0 auto",
            background:"linear-gradient(135deg,rgba(52,211,153,0.2),rgba(16,185,129,0.1))",
            border:"2px solid rgba(52,211,153,0.5)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:36,
            boxShadow:"0 0 0 12px rgba(52,211,153,0.06), 0 0 0 24px rgba(52,211,153,0.03)",
          }}>
            ✅
          </div>
        </div>

        {/* Title */}
        <h2 style={{
          margin:"0 0 8px",
          fontSize:24, fontWeight:900, color:"#ffffff",
          letterSpacing:"-0.5px", lineHeight:1.2,
        }}>
          Email Sent Successfully!
        </h2>

        {/* Subtitle */}
        <p style={{ margin:"0 0 24px", fontSize:14, color:"#94a3b8", lineHeight:1.7 }}>
          Your message has been delivered to our team.<br/>
          A confirmation has also been sent to
        </p>

        {/* Email badge */}
        <div style={{
          display:"inline-block",
          background:"rgba(37,99,235,0.12)",
          border:"1px solid rgba(37,99,235,0.3)",
          borderRadius:10, padding:"8px 16px",
          marginBottom:28,
        }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#60a5fa", fontFamily:"monospace" }}>
            📧 {email}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"0 0 24px" }}/>

        {/* Response time info */}
        <div style={{
          background:"rgba(245,158,11,0.07)",
          border:"1px solid rgba(245,158,11,0.2)",
          borderRadius:12, padding:"12px 16px",
          marginBottom:28, textAlign:"left",
          display:"flex", gap:12, alignItems:"flex-start",
        }}>
          <span style={{ fontSize:20, flexShrink:0 }}>⏱️</span>
          <div>
            <p style={{ margin:"0 0 2px", fontSize:12, fontWeight:700, color:"#fbbf24" }}>
              Expected Response Time
            </p>
            <p style={{ margin:0, fontSize:12, color:"#92400e", color:"#fcd34d" }}>
              Within <strong style={{color:"#f59e0b"}}>24 hours</strong> on business days · WhatsApp for urgent help
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display:"flex", gap:10 }}>
          <a
            href="https://wa.me/923320262457"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex:1, padding:"12px 0", borderRadius:12,
              background:"linear-gradient(135deg,#16a34a,#15803d)",
              color:"#fff", fontWeight:800, fontSize:13,
              textDecoration:"none", display:"block", textAlign:"center",
              boxShadow:"0 4px 16px rgba(22,163,74,0.3)",
            }}>
            💬 WhatsApp
          </a>
          <button
            onClick={handleClose}
            style={{
              flex:1, padding:"12px 0", borderRadius:12,
              background:"linear-gradient(135deg,#2563eb,#1d4ed8)",
              color:"#fff", fontWeight:800, fontSize:13,
              border:"none", cursor:"pointer",
              boxShadow:"0 4px 16px rgba(37,99,235,0.3)",
            }}>
            Done ✓
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Contact Form ──────────────────────────────────────────────────────────────
function ContactForm({ userDoc, user }) {
  const [form, setForm] = useState({
    name:     userDoc?.name  || user?.displayName || "",
    email:    user?.email    || "",
    subject:  "",
    category: "",
    message:  "",
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [sending,     setSending]     = useState(false);
  const [error,       setError]       = useState("");
  const [focused,     setFocused]     = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showValidationPopup, setShowValidationPopup] = useState(false);
  const [missingFields,       setMissingFields]       = useState([]);
  const [catOpen, setCatOpen] = useState(false);
  const catRef   = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (catRef.current && !catRef.current.contains(e.target)) setCatOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    // clear field error on change
    if (fieldErrors[k]) setFieldErrors(p => ({ ...p, [k]: false }));
  };

  const FIELD_LABELS = {
    name:     "Full Name",
    email:    "Email Address",
    category: "Category",
    subject:  "Subject",
    message:  "Message",
  };

  async function handleSubmit(e) {
    e.preventDefault();

    // ── Custom validation ────────────────────────────────────────────────────
    const missing = Object.keys(FIELD_LABELS).filter(k => !form[k]?.trim());
    if (missing.length > 0) {
      const errors = {};
      missing.forEach(k => errors[k] = true);
      setFieldErrors(errors);
      setMissingFields(missing.map(k => FIELD_LABELS[k]));
      setShowValidationPopup(true);
      return;
    }

    setSending(true);
    setError("");
    try {
      // Get Firebase auth token
      const { auth } = await import("@/lib/firebase");
      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : null;

      const res = await fetch("/api/support-ticket", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          business: userDoc?.business || "",
          priority: "Medium",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message.");
      setShowSuccess(true);
      setForm(f => ({ ...f, subject: "", category: "", message: "" }));
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  }

  const categories = [
    "Subscription / Renewal",
    "Account Issue",
    "Billing Query",
    "Feature Request",
    "Bug Report",
    "Other",
  ];

  const CAT_META = {
    "Subscription / Renewal": { icon:"🔄", bg:"rgba(37,99,235,0.15)",  desc:"Renew or extend your plan"         },
    "Account Issue":           { icon:"🔐", bg:"rgba(239,68,68,0.12)",  desc:"Login, access or account problems"  },
    "Billing Query":           { icon:"💳", bg:"rgba(245,158,11,0.12)", desc:"Payment or invoice questions"       },
    "Feature Request":         { icon:"✨", bg:"rgba(139,92,246,0.12)", desc:"Suggest a new feature"              },
    "Bug Report":              { icon:"🐛", bg:"rgba(34,197,94,0.12)",  desc:"Something isn't working right"      },
    "Other":                   { icon:"💬", bg:"rgba(255,255,255,0.06)",desc:"General questions or feedback"      },
  };

  const inputStyle = (name) => ({
    width: "100%",
    outline: "none",
    background: fieldErrors[name] ? "rgba(239,68,68,0.06)" : focused === name ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.03)",
    border: `1.5px solid ${fieldErrors[name] ? "rgba(239,68,68,0.5)" : focused === name ? "rgba(37,99,235,0.45)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 12,
    padding: "11px 14px",
    color: "#fff",
    fontSize: 13,
    transition: "all .2s ease",
    boxShadow: fieldErrors[name] ? "0 0 0 3px rgba(239,68,68,0.08)" : focused === name ? "0 0 0 3px rgba(37,99,235,0.08)" : "none",
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

  return (
    <>
      {showSuccess && (
        <SuccessPopup
          email={form.email}
          onClose={() => setShowSuccess(false)}
        />
      )}

      {/* ── Validation Missing Fields Popup ── */}
      {showValidationPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)" }}
          onClick={() => setShowValidationPopup(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background:"linear-gradient(145deg,#0d1117,#1a0a0a)",
              border:"1px solid rgba(239,68,68,0.35)",
              borderRadius:20, padding:"32px 28px",
              width:"100%", maxWidth:380,
              boxShadow:"0 24px 60px rgba(0,0,0,0.6)",
              textAlign:"center",
            }}>
            {/* Icon */}
            <div style={{
              width:64, height:64, borderRadius:"50%", margin:"0 auto 18px",
              background:"rgba(239,68,68,0.12)", border:"2px solid rgba(239,68,68,0.4)",
              fontSize:28, lineHeight:"64px", textAlign:"center",
            }}>⚠️</div>

            <h3 style={{ margin:"0 0 8px", fontSize:18, fontWeight:900, color:"#fff" }}>
              Please Fill Required Fields
            </h3>
            <p style={{ margin:"0 0 20px", fontSize:13, color:"#94a3b8", lineHeight:1.6 }}>
              The following fields are required to send your message:
            </p>

            {/* Missing fields list */}
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
              {missingFields.map((field, i) => (
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap:10,
                  background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)",
                  borderRadius:10, padding:"10px 14px",
                }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>❌</span>
                  <span style={{ fontSize:13, fontWeight:700, color:"#fca5a5" }}>{field}</span>
                  <span style={{ fontSize:11, color:"#6b7280", marginLeft:"auto" }}>Required</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowValidationPopup(false)}
              style={{
                width:"100%", padding:"12px 0", borderRadius:12,
                background:"linear-gradient(135deg,#dc2626,#b91c1c)",
                color:"#fff", fontWeight:800, fontSize:14,
                border:"none", cursor:"pointer",
                boxShadow:"0 4px 16px rgba(220,38,38,0.3)",
              }}>
              Got it, I'll fill them →
            </button>
          </div>
        </div>
      )}
      <div className="rounded-2xl p-6"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-2 mb-5">
        <span className="text-lg">✉️</span>
        <p className="text-white font-bold text-sm uppercase tracking-widest">Send Us a Message</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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

        {/* Category — Custom Dropdown */}
        <div ref={catRef} style={{ position:"relative" }}>
          <label style={labelStyle}>Category *</label>

          {/* Trigger button */}
          <button
            type="button"
            onClick={() => setCatOpen(o => !o)}
            style={{
              ...inputStyle("category"),
              display:"flex", alignItems:"center", justifyContent:"space-between",
              cursor:"pointer", textAlign:"left",
              color: form.category ? "#fff" : "#6b7280",
            }}>
            <span style={{ display:"flex", alignItems:"center", gap:8 }}>
              {form.category ? (
                <>
                  <span>{CAT_META[form.category]?.icon}</span>
                  <span style={{ fontWeight:600 }}>{form.category}</span>
                </>
              ) : "Select a category..."}
            </span>
            <span style={{
              fontSize:10, color:"#6b7280",
              transition:"transform .2s",
              transform: catOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}>▼</span>
          </button>

          {/* Dropdown panel */}
          {catOpen && (
            <div style={{
              position:"absolute", top:"calc(100% + 6px)", left:0, right:0, zIndex:50,
              background:"#0f1729",
              border:"1.5px solid rgba(37,99,235,0.35)",
              borderRadius:14,
              overflow:"hidden",
              boxShadow:"0 16px 40px rgba(0,0,0,0.6)",
              animation:"fadeIn .15s ease",
            }}>
              {categories.map((c) => {
                const meta   = CAT_META[c] || {};
                const active = form.category === c;
                return (
                  <button
                    key={c} type="button"
                    onClick={() => {
                      set("category")({ target:{ value:c } });
                      setCatOpen(false);
                    }}
                    style={{
                      width:"100%", display:"flex", alignItems:"center", gap:12,
                      padding:"11px 16px", border:"none", cursor:"pointer",
                      background: active
                        ? "rgba(37,99,235,0.15)"
                        : "transparent",
                      borderLeft: active ? "3px solid #2563eb" : "3px solid transparent",
                      transition:"background .15s",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background="rgba(255,255,255,0.05)"; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background="transparent"; }}
                  >
                    {/* Color dot */}
                    <div style={{
                      width:32, height:32, borderRadius:8, flexShrink:0,
                      background: meta.bg || "rgba(255,255,255,0.08)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:15,
                    }}>
                      {meta.icon}
                    </div>
                    <div style={{ textAlign:"left", flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color: active ? "#60a5fa" : "#e2e8f0" }}>{c}</div>
                      <div style={{ fontSize:11, color:"#6b7280", marginTop:1 }}>{meta.desc}</div>
                    </div>
                    {active && <span style={{ fontSize:14, color:"#2563eb" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
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
        <div className="flex flex-col gap-2">
          {error && (
            <div className="px-4 py-3 rounded-xl text-xs font-medium"
              style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#fca5a5" }}>
              ⚠ {error}
            </div>
          )}
          <button type="submit" disabled={sending}
            className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all hover:scale-[1.01] hover:brightness-110 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", boxShadow: "0 4px 20px rgba(37,99,235,0.25)", opacity: sending ? 0.7 : 1, cursor: sending ? "not-allowed" : "pointer" }}>
            {sending ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Sending...</>
            ) : "Send Message →"}
          </button>
        </div>
      </form>
    </div>
    </>
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
