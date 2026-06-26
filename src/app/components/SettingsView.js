"use client";
import { useState, useRef, useEffect } from "react";
import { doc, setDoc, serverTimestamp, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/firestore";
import { updatePassword as fbUpdatePassword, EmailAuthProvider as FBEmailAuthProvider, reauthenticateWithCredential as fbReauth } from "firebase/auth";
import { db } from "@/lib/firebase";

const base = {
  width: "100%", outline: "none", background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: 10,
  padding: "10px 14px", color: "#fff", fontSize: 13,
  transition: "border-color .2s, background .2s",
};
const focusStyle = {
  background: "rgba(37,99,235,0.07)", borderColor: "rgba(37,99,235,0.5)",
  boxShadow: "0 0 0 3px rgba(37,99,235,0.08)",
};
const lbl = {
  display: "block", color: "#9ca3af", fontSize: 11, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5,
};

function SInput({ type = "text", placeholder, value, onChange, req, disabled }) {
  const [f, setF] = useState(false);
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      required={req} disabled={disabled} autoComplete="off"
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...base, ...(f && !disabled ? focusStyle : {}), opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "text" }} />
  );
}

function SSelect({ value, onChange, children }) {
  const [f, setF] = useState(false);
  return (
    <select value={value} onChange={onChange}
      onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ ...base, ...(f ? focusStyle : {}), cursor: "pointer" }}>
      {children}
    </select>
  );
}

const CURRENCIES = [
  { code: "PKR", symbol: "Rs.", label: "Pakistani Rupee (Rs.)" },
  { code: "USD", symbol: "$",   label: "US Dollar ($)" },
  { code: "EUR", symbol: "€",   label: "Euro (€)" },
  { code: "GBP", symbol: "£",   label: "British Pound (£)" },
  { code: "AED", symbol: "AED", label: "UAE Dirham (AED)" },
  { code: "SAR", symbol: "SAR", label: "Saudi Riyal (SAR)" },
  { code: "INR", symbol: "₹",   label: "Indian Rupee (₹)" },
];

const SECT = ({ title, color = "#F59E0B", children }) => (
  <div className="flex flex-col gap-4">
    <div className="pb-2 border-b border-white/10">
      <p className="text-xs font-black uppercase tracking-widest" style={{ color }}>{title}</p>
    </div>
    {children}
  </div>
);

export default function SettingsView({ uid, user, userDoc, onSettingsSaved, loading }) {
  const logoInputRef = useRef(null);

  const [profile, setProfile] = useState({
    name:        userDoc?.name        || "",
    business:    userDoc?.business    || "",
    phone:       userDoc?.phone       || "",
    email:       userDoc?.email       || user?.email || "",
    address:     userDoc?.address     || "",
    website:     userDoc?.website     || "",
    currency:    userDoc?.currency    || "PKR",
    logoDataUrl: userDoc?.logoDataUrl || "",
  });

  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });

  const [saving,   setSaving]   = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [pwMsg,    setPwMsg]    = useState({ type: "", text: "" });

  // sync if userDoc changes externally
  useEffect(() => {
    if (userDoc) {
      setProfile(p => ({
        name:        userDoc.name        || p.name,
        business:    userDoc.business    || p.business,
        phone:       userDoc.phone       || p.phone,
        email:       userDoc.email       || p.email,
        address:     userDoc.address     || p.address,
        website:     userDoc.website     || p.website,
        currency:    userDoc.currency    || p.currency || "PKR",
        logoDataUrl: userDoc.logoDataUrl || p.logoDataUrl,
      }));
    }
  }, [userDoc]);

  const set = k => e => setProfile(p => ({ ...p, [k]: e.target.value }));

  // ── Logo ──────────────────────────────────────────────────────────────────
  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { alert("Logo too large — max 1 MB."); return; }
    const reader = new FileReader();
    reader.onload = ev => setProfile(p => ({ ...p, logoDataUrl: ev.target.result }));
    reader.readAsDataURL(file);
  }

  // ── Save profile ──────────────────────────────────────────────────────────
  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!uid || saving) return;
    setSaving(true);
    try {
      const { setDoc: sd } = await import("firebase/firestore");
      await sd(doc(db, "users", uid), {
        ...profile,
        uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (onSettingsSaved) onSettingsSaved(profile);
    } catch (err) { alert("Save failed: " + err.message); }
    setSaving(false);
  }

  // ── Change password ───────────────────────────────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMsg({ type: "", text: "" });
    if (pwForm.newPw !== pwForm.confirm) {
      setPwMsg({ type: "error", text: "New passwords don't match." }); return;
    }
    if (pwForm.newPw.length < 6) {
      setPwMsg({ type: "error", text: "Password must be at least 6 characters." }); return;
    }
    setPwSaving(true);
    try {
      const credential = FBEmailAuthProvider.credential(user.email, pwForm.current);
      await fbReauth(user, credential);
      await fbUpdatePassword(user, pwForm.newPw);
      setPwMsg({ type: "success", text: "Password changed successfully!" });
      setPwForm({ current: "", newPw: "", confirm: "" });
    } catch (err) {
      const map = {
        "auth/wrong-password":       "Current password is incorrect.",
        "auth/invalid-credential":   "Current password is incorrect.",
        "auth/too-many-requests":    "Too many attempts. Try again later.",
        "auth/requires-recent-login":"Please sign out and sign in again before changing your password.",
      };
      setPwMsg({ type: "error", text: map[err.code] || err.message });
    }
    setPwSaving(false);
  }

  const cardS = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" };

  // ── Professional Loader ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-t-amber-500 border-r-purple-500 border-b-blue-500 border-l-pink-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">⚙️</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl">
      
      {/* ────────────── LEFT COLUMN: Forms ────────────── */}
      <div className="flex-1 flex flex-col gap-6">

      {/* ── Profile & Business form ── */}
      <form onSubmit={handleSaveProfile} className="rounded-2xl p-6 flex flex-col gap-6" style={cardS}>

        {/* Logo section */}
        <SECT title="Business Logo" color="#9ca3af">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed rgba(255,255,255,0.12)" }}>
              {profile.logoDataUrl ? (
                <img src={profile.logoDataUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-3xl">🏢</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-white text-sm font-semibold">Business Logo</p>
              <p className="text-gray-500 text-xs leading-relaxed">
                This logo will be used automatically on all invoices. PNG or JPG, max 1 MB.
              </p>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => logoInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                  style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#60A5FA" }}>
                  {profile.logoDataUrl ? "Change Logo" : "Upload Logo"}
                </button>
                {profile.logoDataUrl && (
                  <button type="button" onClick={() => setProfile(p => ({ ...p, logoDataUrl: "" }))}
                    className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                    style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>
        </SECT>

        {/* Business info */}
        <SECT title="Business Information" color="#F59E0B">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={lbl}>Your Name</label>
              <SInput placeholder="e.g. Ahmed Raza" value={profile.name} onChange={set("name")} />
            </div>
            <div>
              <label style={lbl}>Business / Company Name</label>
              <SInput placeholder="e.g. Ali Traders" value={profile.business} onChange={set("business")} />
            </div>
            <div>
              <label style={lbl}>Phone Number</label>
              <SInput type="tel" placeholder="+92 300 1234567" value={profile.phone} onChange={set("phone")} />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <SInput type="email" placeholder="you@business.com" value={profile.email} onChange={set("email")} />
            </div>
            <div className="col-span-2">
              <label style={lbl}>Address</label>
              <SInput placeholder="Street, City, Country" value={profile.address} onChange={set("address")} />
            </div>
            <div className="col-span-2">
              <label style={lbl}>Website (optional)</label>
              <SInput placeholder="https://yourbusiness.com" value={profile.website} onChange={set("website")} />
            </div>
          </div>
        </SECT>

        {/* Currency */}
        <SECT title="Currency" color="#2563EB">
          <div className="max-w-xs">
            <label style={lbl}>Default Currency</label>
            <SSelect value={profile.currency} onChange={set("currency")}>
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code} style={{ background: "#0d1117" }}>
                  {c.label}
                </option>
              ))}
            </SSelect>
            <p className="text-gray-600 text-xs mt-2">
              Selected: <span className="text-gray-400 font-semibold">
                {CURRENCIES.find(c => c.code === profile.currency)?.symbol} ({profile.currency})
              </span>
            </p>
          </div>
        </SECT>

        {/* save btn */}
        <div className="flex items-center gap-3 pt-2 border-t border-white/[0.06]">
          <button type="submit" disabled={saving}
            className="px-6 py-3 rounded-2xl text-sm font-black transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000",
              opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : "Save Changes →"}
          </button>
          {saved && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
              ✓ Saved successfully
            </span>
          )}
        </div>
      </form>

      {/* ── Change Password ── */}
      <form onSubmit={handleChangePassword} className="rounded-2xl p-6 flex flex-col gap-5" style={cardS}>
        <SECT title="Change Password" color="#f87171">
          <div className="flex flex-col gap-3">
            {[
              { key: "current", label: "Current Password",  placeholder: "Enter current password" },
              { key: "newPw",   label: "New Password",      placeholder: "Min. 6 characters"      },
              { key: "confirm", label: "Confirm New Password", placeholder: "Repeat new password" },
            ].map(f => (
              <div key={f.key}>
                <label style={lbl}>{f.label}</label>
                <div className="relative">
                  <input
                    type={showPw[f.key] ? "text" : "password"}
                    placeholder={f.placeholder}
                    value={pwForm[f.key]}
                    onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                    autoComplete="new-password"
                    style={{ ...base, paddingRight: 42 }} />
                  <button type="button"
                    onClick={() => setShowPw(p => ({ ...p, [f.key]: !p[f.key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-sm">
                    {showPw[f.key] ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
            ))}

            {pwMsg.text && (
              <div className="px-4 py-3 rounded-xl text-xs font-medium"
                style={{
                  background: pwMsg.type === "success" ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${pwMsg.type === "success" ? "rgba(52,211,153,0.25)" : "rgba(239,68,68,0.25)"}`,
                  color: pwMsg.type === "success" ? "#34d399" : "#fca5a5",
                }}>
                {pwMsg.type === "success" ? "✓ " : "⚠ "}{pwMsg.text}
              </div>
            )}

            <button type="submit" disabled={pwSaving || !pwForm.current || !pwForm.newPw || !pwForm.confirm}
              className="px-6 py-3 rounded-2xl text-sm font-bold transition-all w-fit"
              style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171",
                opacity: (pwSaving || !pwForm.current || !pwForm.newPw || !pwForm.confirm) ? 0.5 : 1,
                cursor: (pwSaving || !pwForm.current || !pwForm.newPw || !pwForm.confirm) ? "not-allowed" : "pointer" }}>
              {pwSaving ? "Updating..." : "Update Password →"}
            </button>
          </div>
        </SECT>
      </form>

      </div>

      {/* ────────────── RIGHT COLUMN: Info Cards ────────────── */}
      <div className="lg:w-96 flex flex-col gap-4">
        
        {/* Quick Tips Card */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={cardS}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)" }}>
              💡
            </div>
            <h3 className="text-white font-bold text-sm">Quick Tips</h3>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { icon: "🏢", text: "Add your business logo for professional invoices" },
              { icon: "💰", text: "Select your default currency for all transactions" },
              { icon: "🔒", text: "Change password regularly for better security" },
              { icon: "📧", text: "Keep your email updated for notifications" },
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className="text-lg leading-none mt-0.5">{tip.icon}</span>
                <p className="text-gray-400 leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Account Stats Card */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={cardS}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "rgba(37,99,235,0.12)" }}>
              📊
            </div>
            <h3 className="text-white font-bold text-sm">Account Info</h3>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-gray-500 text-xs">Account Status</span>
              <span className="px-2 py-1 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
                Active
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-gray-500 text-xs">User ID</span>
              <span className="text-gray-400 text-xs font-mono">{uid?.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-500 text-xs">Email Verified</span>
              <span className="text-xs">
                {user?.emailVerified ? "✓ Yes" : "⚠ No"}
              </span>
            </div>
          </div>
        </div>

        {/* Security Tips Card */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" 
          style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "rgba(248,113,113,0.15)" }}>
              🛡️
            </div>
            <h3 className="text-white font-bold text-sm">Security Best Practices</h3>
          </div>
          <div className="flex flex-col gap-2.5 text-xs text-gray-400 leading-relaxed">
            <p>✓ Use a strong password with uppercase, lowercase, numbers & symbols</p>
            <p>✓ Never share your password with anyone</p>
            <p>✓ Change your password every 3-6 months</p>
            <p>✓ Sign out from shared or public devices</p>
          </div>
        </div>

        {/* Help Card */}
        <div className="rounded-2xl p-5 flex flex-col gap-3" style={cardS}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤝</span>
            <h3 className="text-white font-bold text-sm">Need Help?</h3>
          </div>
          <p className="text-gray-400 text-xs leading-relaxed">
            Having trouble with settings? Contact our support team for assistance.
          </p>
          <button type="button" 
            className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 w-full"
            style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", color: "#60A5FA" }}>
            Contact Support
          </button>
        </div>

      </div>

    </div>
  );
}
