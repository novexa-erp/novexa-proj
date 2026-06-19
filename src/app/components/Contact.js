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
    value: "support@invorex.com",
    sub: "We reply within 24 hours",
    color: "#2563EB",
    bg: "rgba(37,99,235,0.08)",
    border: "rgba(37,99,235,0.25)",
    glow: "rgba(37,99,235,0.2)",
    href: "mailto:support@invorex.com",
  },
  {
    icon: "💬",
    label: "WhatsApp",
    value: "+92 300 1234567",
    sub: "Chat with us directly",
    color: "#10B981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.25)",
    glow: "rgba(16,185,129,0.2)",
    href: "https://wa.me/923001234567",
  },
  {
    icon: "🌐",
    label: "Social Media",
    value: "@invorex",
    sub: "Follow for updates",
    color: "#A855F7",
    bg: "rgba(168,85,247,0.08)",
    border: "rgba(168,85,247,0.25)",
    glow: "rgba(168,85,247,0.2)",
    href: "#",
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

  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [focused, setFocused] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1500);
  }

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
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #10B981 50%, #F59E0B)" }}
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

              {submitted ? (
                <SuccessState />
              ) : (
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full py-4 text-base font-semibold text-white rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{
                      background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 50%, #1E40AF 100%)",
                      boxShadow: "0 6px 25px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                    }}
                    onMouseEnter={e => !loading && (e.currentTarget.style.boxShadow = "0 8px 35px rgba(37,99,235,0.55), inset 0 1px 0 rgba(255,255,255,0.15)")}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 6px 25px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.15)")}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                          <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Sending...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Send Message
                        <span className="text-sm transition-transform duration-300 group-hover:translate-x-1">→</span>
                      </span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  </button>

                  <p className="text-center text-gray-600 text-xs">
                    🔒 Your information is safe. We never share your data.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SuccessState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
        style={{
          background: "rgba(16,185,129,0.1)",
          border: "1.5px solid rgba(16,185,129,0.35)",
          boxShadow: "0 0 40px rgba(16,185,129,0.15)",
          animation: "successPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        ✅
      </div>
      <h3 className="text-white font-bold text-xl">Message Sent!</h3>
      <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
        Thanks for reaching out. Our team will get back to you within 24 hours.
      </p>
      <div className="flex items-center gap-2 mt-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-emerald-400 text-xs font-semibold">We will be in touch soon</span>
      </div>
    </div>
  );
}
