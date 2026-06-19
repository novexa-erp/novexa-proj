"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

function useInView(t = 0.05) {
  const [v, setV] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: t });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, [t]);
  return [ref, v];
}

// ─── Content Data ─────────────────────────────────────────────────────────────

const privacyData = {
  badge: "Privacy Policy",
  updated: "June 19, 2025",
  title: "Your Privacy,",
  titleGrad: "Our Responsibility",
  subtitle: "We are committed to protecting your personal data. This policy explains exactly what we collect, why, and how you can control it.",
  breadcrumb: "Privacy Policy",
  href: "/privacy-policy",
  sections: [
    {
      icon: "📋",
      title: "Information We Collect",
      color: "#2563EB",
      items: [
        { heading: "Account Information", body: "When you create a Novexa account, we collect your name, email address, phone number, and business details. This is required to provide you access to the platform." },
        { heading: "Business Data", body: "All data you enter — customers, products, invoices, payments — is your data. We store it securely to provide the service. We never read, sell, or share your business data." },
        { heading: "Usage Data", body: "We collect anonymized usage analytics (pages visited, features used, session duration) to improve the product. This data is never linked to your identity." },
        { heading: "Technical Data", body: "IP address, browser type, device information, and cookies are collected automatically for security and performance purposes." },
      ],
    },
    {
      icon: "🎯",
      title: "How We Use Your Data",
      color: "#F59E0B",
      items: [
        { heading: "To Provide the Service", body: "Your account and business data is used solely to operate and deliver the Novexa ERP platform to you." },
        { heading: "To Improve the Product", body: "Anonymized usage patterns help us identify bugs, improve features, and build better tools for you." },
        { heading: "To Communicate With You", body: "We use your email to send account-related notifications, security alerts, and (with your consent) product updates." },
        { heading: "For Security", body: "Technical data helps us detect unauthorized access, prevent fraud, and protect your account." },
      ],
    },
    {
      icon: "🔒",
      title: "Data Security",
      color: "#2563EB",
      items: [
        { heading: "Encryption in Transit", body: "All data transmitted between your browser and our servers is encrypted using TLS 1.3 — the same standard used by banks." },
        { heading: "Encryption at Rest", body: "Your stored data is encrypted using AES-256 at the database level. Even our own staff cannot read your business data." },
        { heading: "Access Controls", body: "Strict role-based access means only authorized engineers can access production systems, and all access is logged and audited." },
        { heading: "Automated Backups", body: "Your data is automatically backed up daily to geographically redundant storage. Backups are retained for 30 days." },
      ],
    },
    {
      icon: "🤝",
      title: "Data Sharing",
      color: "#F59E0B",
      items: [
        { heading: "We Never Sell Your Data", body: "We do not sell, trade, or rent your personal information or business data to any third party. Ever." },
        { heading: "Service Providers", body: "We use trusted third-party services (hosting, email, analytics) that are contractually bound to our privacy standards and cannot use your data independently." },
        { heading: "Legal Requirements", body: "We may disclose data if required by law, court order, or government authority. We will notify you unless legally prohibited." },
        { heading: "Business Transfers", body: "If Novexa is acquired or merged, your data will be transferred to the new entity under the same privacy protections." },
      ],
    },
    {
      icon: "⚙️",
      title: "Your Rights",
      color: "#2563EB",
      items: [
        { heading: "Access Your Data", body: "You can export all your account and business data at any time from your dashboard in standard formats (CSV, PDF, JSON)." },
        { heading: "Correct Your Data", body: "You can update or correct your account information at any time through your profile settings." },
        { heading: "Delete Your Account", body: "You can permanently delete your account and all associated data from Settings. Deletion is irreversible and takes effect within 30 days." },
        { heading: "Withdraw Consent", body: "You can opt out of marketing emails at any time using the unsubscribe link. Note: transactional and security emails cannot be disabled." },
      ],
    },
    {
      icon: "🍪",
      title: "Cookies",
      color: "#F59E0B",
      items: [
        { heading: "Essential Cookies", body: "Required for the platform to function — authentication sessions, security tokens, and user preferences. Cannot be disabled." },
        { heading: "Analytics Cookies", body: "Help us understand how users interact with the product. Anonymized and can be disabled in your browser settings." },
        { heading: "No Tracking Cookies", body: "We do not use third-party advertising or cross-site tracking cookies. Your browsing behavior outside Novexa is never tracked." },
      ],
    },
  ],
};

const termsData = {
  badge: "Terms of Service",
  updated: "June 19, 2025",
  title: "Terms That Are",
  titleGrad: "Clear & Fair",
  subtitle: "These terms govern your use of Novexa ERP. We have written them in plain language so you actually understand what you are agreeing to.",
  breadcrumb: "Terms of Service",
  href: "/terms",
  sections: [
    {
      icon: "✅",
      title: "Acceptance of Terms",
      color: "#2563EB",
      items: [
        { heading: "Agreement", body: "By creating an account or using Novexa ERP, you agree to these Terms of Service. If you do not agree, please do not use the platform." },
        { heading: "Updates", body: "We may update these terms from time to time. We will notify you by email at least 14 days before significant changes take effect. Continued use after changes means acceptance." },
        { heading: "Eligibility", body: "You must be at least 18 years old and have the authority to enter into this agreement on behalf of your business to use Novexa ERP." },
      ],
    },
    {
      icon: "🧾",
      title: "Your Account",
      color: "#F59E0B",
      items: [
        { heading: "Account Responsibility", body: "You are responsible for maintaining the security of your account credentials. Do not share your password. You are responsible for all activity that occurs under your account." },
        { heading: "Accurate Information", body: "You agree to provide accurate, current, and complete information when creating your account and to keep it updated." },
        { heading: "One Account Per Business", body: "Each subscription covers one business entity. Using one account for multiple unrelated businesses is not permitted without a multi-business plan." },
        { heading: "Account Termination", body: "We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or abuse the platform." },
      ],
    },
    {
      icon: "💳",
      title: "Billing & Payments",
      color: "#2563EB",
      items: [
        { heading: "Subscription Plans", body: "Novexa ERP is offered on monthly and annual subscription plans. Prices are listed on our pricing page and are inclusive of all modules." },
        { heading: "Auto-Renewal", body: "Subscriptions automatically renew at the end of each billing period. You can cancel auto-renewal at any time from your account settings." },
        { heading: "Refunds", body: "We offer a 14-day money-back guarantee for new subscriptions. After 14 days, payments are non-refundable except where required by law." },
        { heading: "Price Changes", body: "We will notify you at least 30 days in advance of any price changes. You can cancel before the new price takes effect." },
      ],
    },
    {
      icon: "📦",
      title: "Acceptable Use",
      color: "#F59E0B",
      items: [
        { heading: "Permitted Use", body: "Novexa ERP is for legitimate business operations — invoicing, inventory, customer management, and related activities." },
        { heading: "Prohibited Activities", body: "You may not use Novexa ERP for illegal activities, to harm others, to distribute malware, to spam, or to attempt to reverse-engineer the platform." },
        { heading: "Data Integrity", body: "You are responsible for the accuracy of data you enter. Do not enter false, misleading, or fraudulent business records." },
        { heading: "API Usage", body: "If you access Novexa via API, you must comply with our API terms. Excessive usage that degrades performance for other users is prohibited." },
      ],
    },
    {
      icon: "🛡️",
      title: "Intellectual Property",
      color: "#2563EB",
      items: [
        { heading: "Our IP", body: "Novexa ERP, its design, code, brand, and all platform content are the intellectual property of Novexa. You may not copy, reproduce, or resell any part of the platform." },
        { heading: "Your Data", body: "You own all data you enter into Novexa ERP. We claim no rights over your business data, invoices, customer lists, or any content you create." },
        { heading: "Feedback", body: "If you provide suggestions or feedback, you grant us the right to use them to improve the platform without any obligation to compensate you." },
      ],
    },
    {
      icon: "⚖️",
      title: "Limitation of Liability",
      color: "#F59E0B",
      items: [
        { heading: "Service Availability", body: "We target 99.9% uptime but do not guarantee uninterrupted service. We are not liable for losses due to planned or unplanned downtime." },
        { heading: "Data Loss", body: "While we maintain daily backups, we are not liable for data loss due to user error. We strongly recommend exporting your data regularly." },
        { heading: "Indirect Damages", body: "Novexa is not liable for indirect, incidental, or consequential damages arising from your use of the platform, to the extent permitted by law." },
        { heading: "Maximum Liability", body: "Our maximum liability to you for any claim is limited to the amount you paid us in the 3 months prior to the claim." },
      ],
    },
  ],
};

// ─── Section Component ────────────────────────────────────────────────────────
function Section({ section, index }) {
  const [ref, v] = useInView(0.05);
  return (
    <div ref={ref} className="transition-all duration-700"
      style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(24px)", transitionDelay: `${index * 60}ms` }}>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: section.color === "#2563EB" ? "rgba(37,99,235,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${section.color === "#2563EB" ? "rgba(37,99,235,0.3)" : "rgba(245,158,11,0.3)"}` }}>
          {section.icon}
        </div>
        <h2 className="text-white font-bold" style={{ fontSize: "20px" }}>{section.title}</h2>
      </div>
      {/* Items */}
      <div className="flex flex-col gap-4 ml-0 pl-0">
        {section.items.map((item, i) => (
          <div key={i} className="rounded-2xl p-5 transition-all duration-300 cursor-default"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
            onMouseEnter={e => {
              e.currentTarget.style.background = section.color === "#2563EB" ? "rgba(37,99,235,0.06)" : "rgba(245,158,11,0.06)";
              e.currentTarget.style.borderColor = section.color === "#2563EB" ? "rgba(37,99,235,0.25)" : "rgba(245,158,11,0.25)";
              e.currentTarget.style.transform = "translateX(4px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.025)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
              e.currentTarget.style.transform = "translateX(0)";
            }}>
            <div className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                style={{ background: section.color }} />
              <div>
                <h4 className="text-white font-semibold text-sm mb-1">{item.heading}</h4>
                <p className="text-gray-400 text-sm leading-relaxed">{item.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Legal Page ──────────────────────────────────────────────────────────
export default function LegalPage({ type }) {
  const data = type === "privacy" ? privacyData : termsData;
  const [heroRef, heroV] = useInView(0.1);
  const [activeSection, setActiveSection] = useState(0);

  return (
    <div className="bg-[#0d1117] min-h-screen">

      {/* ── HERO ── */}
      <section className="relative pt-36 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2563EB]/40 to-transparent" />
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/7 rounded-full blur-[140px]" />
          <div className="absolute inset-0 opacity-[0.08]"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>
        <div ref={heroRef} className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-700"
          style={{ opacity: heroV ? 1 : 0, transform: heroV ? "translateY(0)" : "translateY(32px)" }}>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-8">
            <Link href="/" className="hover:text-gray-300 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-gray-300">{data.breadcrumb}</span>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-widest uppercase"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", color: "#93C5FD" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            {data.badge}
          </div>
          <h1 className="text-white leading-tight mb-6">
            {data.title}{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #2563EB, #60A5FA 50%, #F59E0B)" }}>
              {data.titleGrad}
            </span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto mb-6">{data.subtitle}</p>
          <p className="text-gray-600 text-sm">Last updated: <span className="text-gray-400 font-medium">{data.updated}</span></p>
        </div>
      </section>

      {/* ── CONTENT ── */}
      <section className="relative py-10 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-10 items-start">

            {/* Sticky TOC sidebar */}
            <aside className="lg:w-64 flex-shrink-0 lg:sticky lg:top-24">
              <div className="rounded-2xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-xs font-bold tracking-widest uppercase text-gray-500">Contents</p>
                </div>
                <nav className="p-3 flex flex-col gap-1">
                  {data.sections.map((s, i) => (
                    <button key={i} onClick={() => setActiveSection(i)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium transition-all duration-200 w-full"
                      style={{
                        background: activeSection === i ? (s.color === "#2563EB" ? "rgba(37,99,235,0.12)" : "rgba(245,158,11,0.1)") : "transparent",
                        color: activeSection === i ? (s.color === "#2563EB" ? "#93C5FD" : "#FCD34D") : "#6b7280",
                      }}>
                      <span>{s.icon}</span>
                      <span>{s.title}</span>
                    </button>
                  ))}
                </nav>
                <div className="px-4 py-4 border-t border-white/5">
                  <Link href="/contact" className="block text-center text-xs font-semibold py-2 rounded-xl transition-all duration-200"
                    style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)", color: "#93C5FD" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,99,235,0.18)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(37,99,235,0.08)"; e.currentTarget.style.color = "#93C5FD"; }}>
                    Questions? Contact Us →
                  </Link>
                </div>
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col gap-10 min-w-0">
              {/* Intro card */}
              <div className="rounded-2xl p-6"
                style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)" }}>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {type === "privacy"
                    ? "This Privacy Policy applies to all users of Novexa ERP. By using our platform, you agree to the collection and use of data as described here. If you have questions, contact us at privacy@novexa.com."
                    : "These Terms of Service govern your use of Novexa ERP. By accessing or using the platform, you agree to be bound by these terms. Please read them carefully."}
                </p>
              </div>
              {data.sections.map((s, i) => <Section key={i} section={s} index={i} />)}
              {/* Contact footer */}
              <div className="rounded-2xl p-6 text-center"
                style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <p className="text-gray-400 text-sm mb-3">
                  {type === "privacy" ? "Questions about your privacy? We're here to help." : "Questions about these terms? Our team can clarify."}
                </p>
                <Link href="/contact" className="btn-secondary text-sm">Contact Us →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
