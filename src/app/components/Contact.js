"use client";

import { useEffect, useRef, useState } from "react";

function useInView(threshold = 0.15) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, visible];
}

const contactInfo = [
  {
    icon: "📧",
    label: "Email Us",
    value: "novexaerp@codeverza.com",
    sub: "We reply within 24 hours",
    color: "#2563EB",
    bg: "rgba(37,99,235,0.08)",
    border: "rgba(37,99,235,0.25)",
    glow: "rgba(37,99,235,0.2)",
    href: "mailto:novexaerp@codeverza.com",
  },
  {
    icon: "💬",
    label: "WhatsApp",
    value: "+92 325 1507557",
    sub: "Chat with us directly",
    color: "#10B981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.25)",
    glow: "rgba(16,185,129,0.2)",
    href: "https://wa.me/923251507557",
  },
  {
    icon: "🌐",
    label: "Instagram",
    value: "@Novexa_erp",
    sub: "Follow for updates",
    color: "#A855F7",
    bg: "rgba(168,85,247,0.08)",
    border: "rgba(168,85,247,0.25)",
    glow: "rgba(168,85,247,0.2)",
    href: "https://www.instagram.com/novexa_erp?igsi=NXp1cTNxcHVjdXJ6",
  },
];

function ContactCard({ info, index }) {
  const [ref, visible] = useInView(0.1);
  const [hovered, setHovered] = useState(false);

  return (
    <a
      ref={ref}
      href={info.href}
      target={info.href.startsWith("http") ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="relative block rounded-2xl p-6 transition-all duration-500 overflow-hidden cursor-pointer no-underline"
      style={{
        background: hovered ? info.bg : "rgba(255,255,255,0.025)",
        border: `1px solid ${hovered ? info.border : "rgba(255,255,255,0.07)"}`,
        boxShadow: hovered ? `0 12px 40px ${info.glow}` : "none",
        transform: hovered ? "translateY(-5px)" : "translateY(0)",
        opacity: visible ? 1 : 0,
        transition: `opacity 0.6s ease ${index * 120}ms, transform 0.5s ease, background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Shimmer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 50%, transparent 60%)",
          transform: hovered ? "translateX(100%)" : "translateX(-100%)",
          transition: "transform 0.8s ease",
        }}
      />

      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-all duration-500"
          style={{
            background: hovered ? info.bg : "rgba(255,255,255,0.05)",
            border: `1.5px solid ${hovered ? info.border : "rgba(255,255,255,0.09)"}`,
            boxShadow: hovered ? `0 0 20px ${info.glow}` : "none",
            transform: hovered ? "scale(1.1) rotate(-4deg)" : "scale(1) rotate(0deg)",
          }}
        >
          {info.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-bold tracking-widest uppercase mb-0.5 transition-colors duration-300"
            style={{ color: hovered ? info.color : "#6b7280" }}
          >
            {info.label}
          </p>
          <p
            className="font-semibold text-sm truncate transition-colors duration-300"
            style={{ color: hovered ? "#fff" : "#d1d5db" }}
          >
            {info.value}
          </p>
          <p className="text-gray-600 text-xs mt-0.5">{info.sub}</p>
        </div>
        <div
          className="text-sm transition-all duration-300"
          style={{
            color: info.color,
            opacity: hovered ? 1 : 0,
            transform: hovered ? "translateX(0)" : "translateX(-6px)",
          }}
        >
          →
        </div>
      </div>

      {/* Bottom glow */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl transition-all duration-500"
        style={{
          background: `linear-gradient(to right, transparent, ${info.color}, transparent)`,
          opacity: hovered ? 1 : 0,
          transform: hovered ? "scaleX(1)" : "scaleX(0)",
        }}
      />
    </a>
  );
}

export default function Contact() {
  const [headerRef, headerVisible] = useInView(0.2);
  const [formRef, formVisible] = useInView(0.1);

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [focused, setFocused] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setShowModal(true); // Show submitting modal
    setError(null);
    
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          category: form.subject || "General Enquiry",
          subject: form.subject || "Contact Form Submission",
          message: form.message,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send message");
      }

      setSubmitted(true);
      setLoading(false);
      // Keep modal open to show success state
      // Auto-close after 3 seconds
      setTimeout(() => {
        setShowModal(false);
        setSubmitted(false);
        setForm({ name: "", email: "", subject: "", message: "" }); // Reset form
      }, 3000);
    } catch (err) {
      console.error("Contact form error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
      setShowModal(false); // Close modal on error
    }
  }

  // Inject CSS to override autofill styles - aggressive dark mode enforcement
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Chrome, Safari, Edge autofill override */
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active,
      textarea:-webkit-autofill,
      textarea:-webkit-autofill:hover,
      textarea:-webkit-autofill:focus,
      textarea:-webkit-autofill:active {
        -webkit-text-fill-color: #ffffff !important;
        -webkit-box-shadow: 0 0 0 1000px rgba(13, 17, 23, 0.95) inset !important;
        box-shadow: 0 0 0 1000px rgba(13, 17, 23, 0.95) inset !important;
        background-color: transparent !important;
        background-clip: content-box !important;
        border-color: rgba(255,255,255,0.08) !important;
        caret-color: #ffffff !important;
        transition: background-color 5000s ease-in-out 0s !important;
      }
      
      /* Focus state for autofilled inputs */
      input:-webkit-autofill:focus,
      textarea:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 1000px rgba(37, 99, 235, 0.06) inset, 0 0 0 3px rgba(37,99,235,0.1) !important;
        box-shadow: 0 0 0 1000px rgba(37, 99, 235, 0.06) inset, 0 0 0 3px rgba(37,99,235,0.1) !important;
        border-color: rgba(37,99,235,0.45) !important;
      }

      /* Font consistency */
      input:-webkit-autofill::first-line,
      textarea:-webkit-autofill::first-line {
        font-size: 14px !important;
        font-family: 'Segoe UI', Helvetica, Arial, sans-serif !important;
        color: #ffffff !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const inputStyle = (field) => ({
    width: "100%",
    background: focused === field ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.03)",
    border: `1.5px solid ${focused === field ? "rgba(37,99,235,0.45)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: "12px",
    padding: "12px 16px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease",
    boxShadow: focused === field ? "0 0 0 3px rgba(37,99,235,0.1)" : "none",
  });

  return (
    <section id="contact" className="relative py-24 md:py-32 bg-[#0d1117] overflow-hidden">
      
      {/* Modal */}
      {showModal && <StatusModal loading={loading} submitted={submitted} />}
      
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB]/35 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#10B981]/25 to-transparent" />
        <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/3 -right-40 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[150px]" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div
          ref={headerRef}
          className="text-center max-w-2xl mx-auto mb-16 transition-all duration-700"
          style={{
            opacity: headerVisible ? 1 : 0,
            transform: headerVisible ? "translateY(0)" : "translateY(28px)",
          }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
            style={{
              background: "rgba(37,99,235,0.1)",
              border: "1px solid rgba(37,99,235,0.3)",
              color: "#93C5FD",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Get In Touch
          </div>

          <h2 className="text-white leading-tight mb-4">
            We Would Love to{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}
            >
              Hear From You
            </span>
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed">
            Have a question, feedback, or just want to say hello? Drop us a message and our team
            will get back to you within 24 hours.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-10 items-start">

          {/* Left — contact info + cards */}
          <div
            className="flex flex-col gap-5 transition-all duration-700"
            style={{
              opacity: formVisible ? 1 : 0,
              transform: formVisible ? "translateX(0)" : "translateX(-28px)",
              transitionDelay: "100ms",
            }}
            ref={formRef}
          >
            {/* Intro card */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <h3 className="text-white font-bold text-xl mb-2">Let us talk</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Whether you are a new user wanting to know more, or an existing customer who needs
                help — we are just one message away.
              </p>
              {/* Availability */}
              <div className="flex items-center gap-2 mt-4">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-xs font-semibold">Online — typically replies in under 1 hour</span>
              </div>
            </div>

            {contactInfo.map((info, i) => (
              <ContactCard key={info.label} info={info} index={i} />
            ))}
          </div>

          {/* Right — form */}
          <div
            className="transition-all duration-700"
            style={{
              opacity: formVisible ? 1 : 0,
              transform: formVisible ? "translateX(0)" : "translateX(28px)",
              transitionDelay: "200ms",
            }}
          >
            <div
              className="rounded-2xl p-8 relative overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Top glow line */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                  background: "linear-gradient(to right, transparent, rgba(37,99,235,0.6), transparent)",
                }}
              />

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">
                    Your Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Ahmed Raza"
                    value={form.name}
                    onChange={handleChange}
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                    style={inputStyle("name")}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    style={inputStyle("email")}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">
                    Subject (Optional)
                  </label>
                  <input
                    type="text"
                    name="subject"
                    placeholder="e.g. Demo Request"
                    value={form.subject}
                    onChange={handleChange}
                    onFocus={() => setFocused("subject")}
                    onBlur={() => setFocused(null)}
                    style={inputStyle("subject")}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase">
                    Message
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={5}
                    placeholder="Tell us how we can help..."
                    value={form.message}
                    onChange={handleChange}
                    onFocus={() => setFocused("message")}
                    onBlur={() => setFocused(null)}
                    style={{ ...inputStyle("message"), resize: "none" }}
                  />
                </div>

                {error && (
                  <div className="rounded-xl p-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
                    <p className="text-red-400 text-sm font-medium">❌ {error}</p>
                  </div>
                )}

                <div className="text-center">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                    style={{width: '40%', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer'}}
                  >
                    {loading ? "Sending..." : "Send Message →"}
                  </button>
                </div>

                <p className="text-center text-gray-600 text-xs">
                  🔒 Your information is safe. We never share your data.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusModal({ loading, submitted }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div className="relative max-w-md w-full rounded-3xl p-8 overflow-hidden"
        style={{ 
          background: "linear-gradient(135deg, rgba(13,17,23,0.98), rgba(30,58,138,0.25))",
          border: "1.5px solid rgba(255,255,255,0.12)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
          animation: "modalFadeIn 0.3s ease-out"
        }}>
        
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-1"
          style={{ background: "linear-gradient(90deg, #2563EB, #60A5FA, #F59E0B)" }} />
        
        {loading ? (
          // Submitting State
          <div className="flex flex-col items-center text-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ 
                  background: "rgba(37,99,235,0.15)",
                  border: "2px solid rgba(37,99,235,0.4)",
                  boxShadow: "0 0 30px rgba(37,99,235,0.3)"
                }}>
                <svg className="w-10 h-10 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(37,99,235,0.3)" strokeWidth="3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="absolute inset-0 rounded-full animate-ping"
                style={{ background: "rgba(37,99,235,0.2)" }} />
            </div>
            <div>
              <h3 className="text-white font-bold text-2xl mb-2">Sending Message...</h3>
              <p className="text-gray-400 text-sm">Please wait while we process your request</p>
            </div>
          </div>
        ) : submitted ? (
          // Success State
          <div className="flex flex-col items-center text-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                style={{ 
                  background: "rgba(16,185,129,0.15)",
                  border: "2px solid rgba(16,185,129,0.4)",
                  boxShadow: "0 0 40px rgba(16,185,129,0.3)",
                  animation: "successPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both"
                }}>
                ✅
              </div>
            </div>
            <div>
              <h3 className="text-white font-bold text-2xl mb-2">Message Sent!</h3>
              <p className="text-gray-400 text-sm max-w-xs leading-relaxed mx-auto">
                Thank you for reaching out. Our team will get back to you within 24 hours.
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-xs font-semibold">We'll be in touch soon</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes successPop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
