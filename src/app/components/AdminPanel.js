"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AdminUserDetail from "./AdminUserDetail";

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID;

/* ── helpers ──────────────────────────────────────────────────────────────── */
function todayStr() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}
function daysLeft(activeTo, activeToTime) {
  if (!activeTo) return null;
  const timeStr = activeToTime || "23:59:59";
  const expStr  = `${activeTo}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}`;
  return Math.ceil((new Date(expStr) - new Date()) / 86400000);
}

/* ── Digital Clock ────────────────────────────────────────────────────────── */
function DigitalClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh  = String(time.getHours()).padStart(2, "0");
  const mm  = String(time.getMinutes()).padStart(2, "0");
  const ss  = String(time.getSeconds()).padStart(2, "0");
  const ampm = time.getHours() >= 12 ? "PM" : "AM";
  const hh12 = String(time.getHours() % 12 || 12).padStart(2, "0");

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0"
      style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}>
      <span className="text-blue-400 text-[10px]">🕐</span>
      <span className="font-mono font-bold tracking-widest"
        style={{ color: "#60a5fa", fontSize: 13, letterSpacing: "0.12em" }}>
        {hh12}:{mm}
        <span className="animate-pulse">:</span>
        {ss}
      </span>
      <span className="text-blue-500 text-[10px] font-bold">{ampm}</span>
    </div>
  );
}

const STATUS_STYLE = {
  active:      { color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)",  label: "Active"   },
  frozen:      { color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  border: "rgba(96,165,250,0.3)",  label: "Frozen"   },
  deleted:     { color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)", label: "Deleted"  },
  not_started: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  label: "Pending"  },
};

const inputStyle = {
  width: "100%", outline: "none",
  background: "rgba(255,255,255,0.04)",
  border: "1.5px solid rgba(255,255,255,0.09)",
  borderRadius: 10, padding: "9px 13px",
  color: "#fff", fontSize: 13,
};
const labelStyle = {
  display: "block", color: "#9ca3af", fontSize: 11,
  fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.07em", marginBottom: 5,
};

/* ── Reusable Input ───────────────────────────────────────────────────────── */
function SInput({ label, type = "text", value, onChange, placeholder, required, min, max }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} required={required} min={min} max={max}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          ...inputStyle,
          ...(focused ? { borderColor: "rgba(37,99,235,0.6)", background: "rgba(37,99,235,0.07)", boxShadow: "0 0 0 3px rgba(37,99,235,0.1)" } : {}),
        }}
      />
    </div>
  );
}

/* ── Toast ────────────────────────────────────────────────────────────────── */
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold"
          style={{
            background: t.type === "success" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
            border: `1px solid ${t.type === "success" ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)"}`,
            color: t.type === "success" ? "#34d399" : "#f87171",
            backdropFilter: "blur(16px)",
            minWidth: 260,
            animation: "slideUp 0.3s ease",
          }}>
          <span className="text-base">{t.type === "success" ? "✓" : "✕"}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Confirm Dialog ───────────────────────────────────────────────────────── */
function ConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <p className="text-4xl">⚠️</p>
        <h3 className="text-white font-bold text-lg">{title}</h3>
        <p className="text-gray-400 text-sm">{message}</p>
        <div className="flex gap-3 mt-1">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
            style={{ background: confirmColor || "rgba(239,68,68,0.15)", border: `1px solid ${confirmColor ? confirmColor.replace("0.15","0.4") : "rgba(239,68,68,0.4)"}`, color: "#fff" }}>
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── User Form Modal ──────────────────────────────────────────────────────── */
const EMPTY_FORM = { name: "", email: "", password: "", phone: "", address: "", activeFrom: "", activeTo: "", activeToTime: "", maxDevices: "1" };

function UserFormModal({ initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name || "", email: initial.email || "",
    password: "", phone: initial.phone || "",
    address: initial.address || "",
    activeFrom: initial.activeFrom || "", activeTo: initial.activeTo || "",
    activeToTime: initial.activeToTime || "",
    maxDevices: String(initial.maxDevices || "1"),
  } : { ...EMPTY_FORM });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const isEdit = !!initial;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg my-6 rounded-2xl overflow-hidden"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>

        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(245,158,11,0.04))" }}>
          <div>
            <h2 className="text-white font-black text-xl">{isEdit ? "Edit User" : "Register New User"}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{isEdit ? "Update user details and subscription" : "Create a new Novexa ERP account"}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">✕</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <SInput label="Full Name *" value={form.name} onChange={set("name")} placeholder="e.g. Ahmed Raza" required />
            <SInput label="Phone" value={form.phone} onChange={set("phone")} placeholder="+92 300 0000000" />
          </div>
          <SInput label="Email Address *" type="email" value={form.email} onChange={set("email")} placeholder="user@example.com" required />
          <SInput label={isEdit ? "New Password (leave blank to keep)" : "Password *"} type="password"
            value={form.password} onChange={set("password")} placeholder="Min. 8 characters" required={!isEdit} />
          <SInput label="Address" value={form.address} onChange={set("address")} placeholder="City, Street..." />

          <div className="rounded-xl p-4" style={{ background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.15)" }}>
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">📅 Subscription Period</p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <SInput label="Active From *" type="date" value={form.activeFrom} onChange={set("activeFrom")} required />
              <SInput label="Active Until *" type="date" value={form.activeTo} onChange={set("activeTo")} required />
            </div>
            <div>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                ⏰ Freeze Time
                <span className="text-gray-600 normal-case font-normal tracking-normal" style={{ fontSize: 10 }}>(optional — default 11:59 PM)</span>
              </label>
              <SInput type="time" value={form.activeToTime} onChange={set("activeToTime")} />
              {form.activeToTime && form.activeTo && (
                <p className="text-blue-400 text-[11px] mt-1.5 font-medium">✓ Will freeze on {form.activeTo} at {form.activeToTime}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)" }}>
            <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-3">📱 Device / Session Limit</p>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map(n => (
                <button key={n} type="button"
                  onClick={() => setForm(p => ({ ...p, maxDevices: String(n) }))}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                  style={{
                    background: form.maxDevices === String(n) ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${form.maxDevices === String(n) ? "rgba(139,92,246,0.6)" : "rgba(255,255,255,0.08)"}`,
                    color: form.maxDevices === String(n) ? "#c4b5fd" : "#6b7280",
                  }}>
                  {n} {n === 1 ? "Device" : "Devices"}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl text-white font-bold text-sm mt-1 transition-all hover:scale-[1.01]"
            style={{ background: saving ? "rgba(37,99,235,0.4)" : "linear-gradient(135deg,#2563EB,#1d4ed8)", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving..." : isEdit ? "Save Changes →" : "Register User →"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── User Detail Modal ────────────────────────────────────────────────────── */
function UserDetailModal({ detailUser, detailLoading, onClose, fmtDate, daysLeft }) {
  if (!detailUser && !detailLoading) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl my-6 rounded-2xl overflow-hidden"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>

        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(139,92,246,0.05))" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black"
              style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.25),rgba(245,158,11,0.15))", color: "#60A5FA", border: "1px solid rgba(37,99,235,0.3)" }}>
              {(detailUser?.user?.name || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-white font-black text-lg leading-none">{detailUser?.user?.name || "Loading..."}</h2>
              <p className="text-gray-500 text-xs mt-0.5">{detailUser?.user?.email}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">✕</button>
        </div>

        {detailLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-transparent animate-spin" />
          </div>
        ) : detailUser && (
          <div className="p-6 flex flex-col gap-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">👤 Profile</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Phone",    value: detailUser.user.phone   || "—" },
                  { label: "Address",  value: detailUser.user.address || "—" },
                  { label: "Registered", value: detailUser.user.createdAt ? new Date(detailUser.user.createdAt).toLocaleDateString("en-PK",{day:"2-digit",month:"short",year:"numeric"}) : "—" },
                  { label: "Email Verified", value: detailUser.authRecord?.emailVerified ? "✅ Yes" : "❌ No" },
                  { label: "Device Limit", value: `${detailUser.user.maxDevices||1} device${(detailUser.user.maxDevices||1)>1?"s":""}` },
                ].map(r => (
                  <div key={r.label} className="rounded-xl px-4 py-3"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                    <p className="text-white text-sm font-medium">{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">📅 Subscription</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label:"Active From", value: fmtDate(detailUser.user.activeFrom) },
                  { label:"Active Until", value: fmtDate(detailUser.user.activeTo) },
                  { label:"Days Left", value: (() => { const d=daysLeft(detailUser.user.activeTo); return d===null?"—":d<0?`Expired ${Math.abs(d)}d ago`:d===0?"Expires today!":`${d} days`; })() },
                ].map(r => (
                  <div key={r.label} className="rounded-xl px-4 py-3"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                    <p className="text-white text-sm font-medium">{r.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">⚡ Activity</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label:"Last Login",   value: detailUser.user.lastLogin    ? new Date(detailUser.user.lastLogin).toLocaleString("en-PK")    : detailUser.authRecord?.lastSignInTime || "Never" },
                  { label:"Last Active",  value: detailUser.user.lastActiveAt ? new Date(detailUser.user.lastActiveAt).toLocaleString("en-PK") : "—" },
                  { label:"Login IP",     value: detailUser.user.lastLoginIP  || "—" },
                  { label:"Browser",      value: detailUser.user.lastBrowser  || "—" },
                  { label:"Device",       value: detailUser.user.lastDevice   || "—" },
                ].map(r => (
                  <div key={r.label} className="rounded-xl px-4 py-3"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                    <p className="text-white text-sm font-medium truncate">{r.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">🕐 Login History (last 20)</p>
              {detailUser.activityLogs.length === 0 ? (
                <p className="text-gray-600 text-xs px-1">No login history yet.</p>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div className="grid text-[10px] font-bold uppercase tracking-widest px-4 py-2"
                    style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.05)", gridTemplateColumns:"2fr 1fr 1fr 1fr" }}>
                    <span>Date & Time</span><span>IP</span><span>Browser</span><span>Device</span>
                  </div>
                  {detailUser.activityLogs.map((log, i) => (
                    <div key={log.id} className="grid px-4 py-2.5 text-xs hover:bg-white/[0.02] transition-colors"
                      style={{ gridTemplateColumns:"2fr 1fr 1fr 1fr", borderBottom: i<detailUser.activityLogs.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                      <span className="text-gray-400">{new Date(log.timestamp).toLocaleString("en-PK")}</span>
                      <span className="text-gray-500 font-mono text-[10px]">{log.ip}</span>
                      <span className="text-gray-400">{log.browser}</span>
                      <span className="text-gray-400">{log.device}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sidebar nav items ────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: "users",     icon: "👥", label: "Users",     badge: null },
  { id: "analytics", icon: "📊", label: "Analytics", badge: null },
  { id: "debug",     icon: "🔍", label: "Debug",     badge: null },
];

/* ── Stat Card ────────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, gradient, glow }) {
  return (
    <div className="relative rounded-2xl p-5 overflow-hidden group transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
      style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.08)", boxShadow: `0 0 0 0 ${glow}` }}>
      {/* glow bg */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20"
        style={{ background: gradient }} />
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-lg"
          style={{ background: gradient, boxShadow: `0 4px 16px ${glow}` }}>
          {icon}
        </div>
        <p className="text-white font-black text-3xl leading-none mb-1">{value}</p>
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

/* ── Main AdminPanel ──────────────────────────────────────────────────────── */
export default function AdminPanel() {
  const router = useRouter();
  const [user,          setUser]          = useState(null);
  const [authLoading,   setAuthLoading]   = useState(true);
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [showForm,      setShowForm]      = useState(false);
  const [editUser,      setEditUser]      = useState(null);
  const [confirm,       setConfirm]       = useState(null);
  const [search,        setSearch]        = useState("");
  const [toasts,        setToasts]        = useState([]);
  const [activeTab,     setActiveTab]     = useState("users");
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [debugInfo,     setDebugInfo]     = useState(null);
  const [detailUser,    setDetailUser]    = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedUid,   setSelectedUid]   = useState(null); // user detail screen

  /* ── auth guard ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u || u.uid !== ADMIN_UID) { router.replace("/pages/login"); return; }
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  /* ── toast ── */
  const toast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  /* ── token ── */
  const getToken = useCallback(async () => {
    if (user) return user.getIdToken(true);
    if (auth.currentUser) return auth.currentUser.getIdToken(true);
    throw new Error("Not authenticated");
  }, [user]);

  /* ── fetch users ── */
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/list-users", { headers: { authorization: `Bearer ${token}` } });
      const ct    = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) throw new Error("Server error: " + (await res.text()).slice(0,120));
      const data  = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setUsers(data.users || []);
    } catch (err) {
      toast(err.message || "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  }, [user, toast, getToken]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /* ── save user ── */
  async function handleSaveUser(form) {
    setSaving(true);
    try {
      const token   = await getToken();
      const headers = { "Content-Type": "application/json", authorization: `Bearer ${token}` };
      if (editUser) {
        const body = { uid: editUser.uid, name: form.name, phone: form.phone, address: form.address, activeFrom: form.activeFrom, activeTo: form.activeTo, activeToTime: form.activeToTime, maxDevices: form.maxDevices };
        if (form.password) body.newPassword = form.password;
        const res  = await fetch("/api/admin/update-user", { method:"POST", headers, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast(`${form.name} updated successfully`);
      } else {
        const res  = await fetch("/api/admin/create-user", { method:"POST", headers, body: JSON.stringify(form) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast(`${form.name} registered successfully`);
      }
      setShowForm(false); setEditUser(null); fetchUsers();
    } catch (err) { toast(err.message || "Save failed", "error"); }
    finally { setSaving(false); }
  }

  /* ── freeze / unfreeze ── */
  async function handleToggleFreeze(uid, name, currentStatus) {
    const newStatus = currentStatus === "frozen" ? "active" : "frozen";
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type":"application/json", authorization:`Bearer ${token}` },
        body: JSON.stringify({ uid, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`${name} ${newStatus==="frozen"?"frozen":"unfrozen"} successfully`);
      fetchUsers();
    } catch (err) { toast(err.message||"Action failed","error"); }
    finally { setConfirm(null); }
  }

  /* ── toggle email feature ── */
  async function handleToggleEmail(uid, name, currentEnabled) {
    const newVal = !currentEnabled;
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid, emailFeatureEnabled: newVal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Email feature ${newVal ? "enabled" : "disabled"} for ${name}`);
      fetchUsers();
    } catch (err) { toast(err.message || "Action failed", "error"); }
    finally { setConfirm(null); }
  }

  /* ── delete user ── */
  async function handleDeleteUser(uid, name) {
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/delete-user", {
        method:"POST",
        headers:{ "Content-Type":"application/json", authorization:`Bearer ${token}` },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`${name} has been removed`);
      fetchUsers();
    } catch (err) { toast(err.message||"Delete failed","error"); }
    finally { setConfirm(null); }
  }

  /* ── debug ── */
  async function runDebug() {
    try {
      const token = await getToken();
      const res   = await fetch("/api/admin/debug", { headers:{ authorization:`Bearer ${token}` } });
      const data  = await res.json();
      setDebugInfo(data);
      setActiveTab("debug");
      toast("Debug info loaded","success");
    } catch (err) { toast("Debug failed: "+err.message,"error"); }
  }

  /* ── user detail ── */
  async function fetchUserDetail(uid) {
    setDetailLoading(true);
    try {
      const token = await getToken();
      const res   = await fetch(`/api/admin/user-detail?uid=${uid}`, { headers:{ authorization:`Bearer ${token}` } });
      const data  = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetailUser(data);
    } catch (err) { toast(err.message||"Failed to load details","error"); }
    finally { setDetailLoading(false); }
  }

  /* ── derived ── */
  const activeCount = users.filter(u => u.status==="active").length;
  const frozenCount = users.filter(u => u.status==="frozen").length;
  const totalCount  = users.filter(u => u.status!=="deleted").length;
  const expiringIn7 = users.filter(u => { const d=daysLeft(u.activeTo); return d!==null&&d>=0&&d<=7&&u.status==="active"; }).length;

  const filteredUsers = users.filter(u => {
    if (u.status==="deleted") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q)||(u.phone||"").includes(q);
  });

  /* ── loading screen ── */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full border-4 border-transparent animate-spin"
            style={{ borderTopColor:"#2563EB", borderRightColor:"#F59E0B" }} />
          <p className="text-gray-600 text-sm font-medium tracking-widest uppercase">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex" style={{ fontFamily:"var(--font-poppins,sans-serif)" }}>
      <Toast toasts={toasts} />

      {/* ── User Detail Full-Screen Overlay ── */}
      {selectedUid && (
        <AdminUserDetail
          uid={selectedUid}
          getToken={getToken}
          onClose={() => setSelectedUid(null)}
          onToast={toast}
        />
      )}

      {/* Modals */}
      {(showForm || editUser) && (
        <UserFormModal initial={editUser} saving={saving}
          onClose={() => { setShowForm(false); setEditUser(null); }}
          onSave={handleSaveUser} />
      )}
      <UserDetailModal
        detailUser={detailUser} detailLoading={detailLoading}
        onClose={() => setDetailUser(null)} fmtDate={fmtDate} daysLeft={daysLeft} />

      {confirm?.type==="freeze" && (
        <ConfirmDialog
          title={confirm.currentStatus==="frozen"?`Unfreeze ${confirm.name}?`:`Freeze ${confirm.name}?`}
          message={confirm.currentStatus==="frozen"?"This will restore their dashboard access immediately.":"Their dashboard access will be blocked until you unfreeze."}
          confirmLabel={confirm.currentStatus==="frozen"?"Yes, Unfreeze":"Yes, Freeze"}
          confirmColor={confirm.currentStatus==="frozen"?"rgba(52,211,153,0.2)":"rgba(96,165,250,0.2)"}
          onConfirm={() => handleToggleFreeze(confirm.uid,confirm.name,confirm.currentStatus)}
          onCancel={() => setConfirm(null)} />
      )}
      {confirm?.type==="delete" && (
        <ConfirmDialog
          title={`Remove ${confirm.name}?`}
          message="Their account will be disabled. Data stays safe in Firestore."
          confirmLabel="Yes, Remove"
          confirmColor="rgba(239,68,68,0.2)"
          onConfirm={() => handleDeleteUser(confirm.uid,confirm.name)}
          onCancel={() => setConfirm(null)} />
      )}
      {confirm?.type==="emailToggle" && (
        <ConfirmDialog
          title={confirm.currentEnabled ? `Disable Email for ${confirm.name}?` : `Enable Email for ${confirm.name}?`}
          message={confirm.currentEnabled
            ? "Invoice email feature will be disabled. Their Settings page will show a locked notice."
            : "Invoice email feature will be enabled. They can connect their Gmail and send invoice emails."}
          confirmLabel={confirm.currentEnabled ? "Yes, Disable" : "Yes, Enable"}
          confirmColor={confirm.currentEnabled ? "rgba(245,158,11,0.2)" : "rgba(52,211,153,0.2)"}
          onConfirm={() => handleToggleEmail(confirm.uid, confirm.name, confirm.currentEnabled)}
          onCancel={() => setConfirm(null)} />
      )}

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside
        className="flex flex-col h-screen sticky top-0 transition-all duration-300 z-30 flex-shrink-0"
        style={{
          width: sidebarOpen ? 240 : 72,
          background: "rgba(8,13,20,0.98)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px)",
        }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
          <div className="relative w-10 h-10 flex-shrink-0">
            <Image src="/images/Novexa N Logo.png" alt="Novexa" fill className="object-contain" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-white font-black text-sm leading-tight whitespace-nowrap">Super Admin</p>
              <p className="text-gray-600 text-[9px] font-bold tracking-widest uppercase whitespace-nowrap">Novexa ERP</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className="flex items-center gap-3 rounded-xl transition-all duration-200 group relative"
                style={{
                  padding: sidebarOpen ? "10px 12px" : "10px 0",
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                  background: isActive
                    ? "linear-gradient(135deg,rgba(37,99,235,0.2),rgba(245,158,11,0.08))"
                    : "transparent",
                  border: isActive ? "1px solid rgba(37,99,235,0.25)" : "1px solid transparent",
                  color: isActive ? "#fff" : "#6b7280",
                }}>
                {/* active left bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ background:"linear-gradient(to bottom,#2563EB,#F59E0B)" }} />
                )}
                <span className="text-base flex-shrink-0 transition-transform group-hover:scale-110">{item.icon}</span>
                {sidebarOpen && (
                  <span className="text-sm font-semibold whitespace-nowrap">{item.label}</span>
                )}
                {!sidebarOpen && (
                  <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                    style={{ background:"rgba(13,17,23,0.95)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff" }}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="px-3 pb-4" style={{ borderTop:"1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => setSidebarOpen(o => !o)}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-gray-600 hover:text-gray-400 hover:bg-white/5 transition-all text-xs font-semibold mt-3">
            <span className="text-base transition-transform duration-300" style={{ transform: sidebarOpen?"rotate(0deg)":"rotate(180deg)" }}>◀</span>
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ══════════════════ MAIN CONTENT ══════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">

        {/* ── Top bar ── */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
          style={{ background:"rgba(8,13,20,0.97)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>

          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-white font-black text-base leading-tight">
                {NAV_ITEMS.find(n=>n.id===activeTab)?.icon} {" "}
                {activeTab==="users"?"User Management":activeTab==="analytics"?"Analytics Overview":"Debug Console"}
              </h1>
              <p className="text-gray-600 text-[10px] font-semibold tracking-widest uppercase">{todayStr()}</p>
            </div>
            <DigitalClock />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={fetchUsers} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-white/10"
              style={{ border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
              <span className={loading?"animate-spin":""}>↻</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={runDebug}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-amber-500/10"
              style={{ border:"1px solid rgba(245,158,11,0.25)", color:"#fbbf24" }}>
              🔍 <span className="hidden sm:inline">Debug</span>
            </button>
            <button onClick={() => { setEditUser(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] hover:shadow-lg"
              style={{ background:"linear-gradient(135deg,#2563EB,#1d4ed8)", color:"#fff", boxShadow:"0 4px 16px rgba(37,99,235,0.3)" }}>
              ＋ <span className="hidden sm:inline">Register User</span>
            </button>
            <button onClick={() => signOut(auth).then(() => router.push("/pages/login"))}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-red-500/10"
              style={{ border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444" }}>
              🚪 <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 px-6 py-7">

          {/* ──────────── USERS TAB ──────────── */}
          {activeTab==="users" && (
            <div>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard icon="👥" label="Total Users"     value={totalCount}  gradient="linear-gradient(135deg,#2563EB,#1d4ed8)" glow="rgba(37,99,235,0.35)" />
                <StatCard icon="✅" label="Active"          value={activeCount} gradient="linear-gradient(135deg,#10b981,#059669)" glow="rgba(16,185,129,0.35)" />
                <StatCard icon="🔒" label="Frozen"          value={frozenCount} gradient="linear-gradient(135deg,#60a5fa,#3b82f6)" glow="rgba(96,165,250,0.35)" />
                <StatCard icon="⚠️" label="Expiring (7d)"  value={expiringIn7} gradient="linear-gradient(135deg,#F59E0B,#d97706)" glow="rgba(245,158,11,0.35)" />
              </div>

              {/* ── Subscription Expiry Timeline ── */}
              {(() => {
                const timeline = users
                  .filter(u => u.status !== "deleted" && u.activeTo)
                  .map(u => ({ ...u, dl: daysLeft(u.activeTo, u.activeToTime) }))
                  .filter(u => u.dl !== null && u.dl <= 30)
                  .sort((a, b) => a.dl - b.dl);

                if (timeline.length === 0) return null;

                return (
                  <div className="rounded-2xl mb-6 overflow-hidden"
                    style={{ background:"linear-gradient(135deg,rgba(245,158,11,0.05),rgba(255,255,255,0.02))", border:"1px solid rgba(245,158,11,0.18)" }}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3"
                      style={{ borderBottom:"1px solid rgba(245,158,11,0.1)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">⏳</span>
                        <p className="text-white font-bold text-sm">Subscription Expiry Watchlist</p>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background:"rgba(245,158,11,0.15)", color:"#fbbf24", border:"1px solid rgba(245,158,11,0.25)" }}>
                          {timeline.length} user{timeline.length!==1?"s":""}
                        </span>
                      </div>
                      <p className="text-gray-600 text-[10px] uppercase tracking-widest">Next 30 days</p>
                    </div>

                    {/* List */}
                    <div className="divide-y divide-white/[0.04]">
                      {timeline.map(u => {
                        const dl     = u.dl;
                        const isExp  = dl < 0;
                        const isToday = dl === 0;
                        const isCrit = dl >= 0 && dl <= 3;
                        const isWarn = dl > 3  && dl <= 7;
                        const color  = isExp ? "#f87171" : isToday ? "#f87171" : isCrit ? "#fb923c" : isWarn ? "#fbbf24" : "#a3a3a3";
                        const bgCol  = isExp ? "rgba(248,113,113,0.08)" : isCrit ? "rgba(251,146,60,0.06)" : isWarn ? "rgba(251,191,36,0.06)" : "transparent";

                        return (
                          <div key={u.uid}
                            className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-white/[0.02]"
                            style={{ background: bgCol }}>

                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
                              style={{ background:"linear-gradient(135deg,rgba(37,99,235,0.25),rgba(245,158,11,0.15))", color:"#60A5FA", border:"1px solid rgba(37,99,235,0.2)" }}>
                              {(u.name||"?").charAt(0).toUpperCase()}
                            </div>

                            {/* Name + email */}
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-semibold truncate">{u.name}</p>
                              <p className="text-gray-500 text-[11px] truncate">{u.email}</p>
                            </div>

                            {/* Expiry date */}
                            <div className="hidden sm:block text-right flex-shrink-0">
                              <p className="text-gray-600 text-[10px] uppercase tracking-widest">Expires</p>
                              <p className="text-gray-400 text-xs">{fmtDate(u.activeTo)}</p>
                            </div>

                            {/* Countdown pill */}
                            <div className="flex-shrink-0">
                              <span className="px-3 py-1.5 rounded-xl text-xs font-black tabular-nums"
                                style={{
                                  background: isExp ? "rgba(248,113,113,0.15)" : isCrit ? "rgba(251,146,60,0.15)" : isWarn ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.06)",
                                  border: `1px solid ${isExp ? "rgba(248,113,113,0.35)" : isCrit ? "rgba(251,146,60,0.35)" : isWarn ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.1)"}`,
                                  color,
                                }}>
                                {isExp   ? `Expired ${Math.abs(dl)}d ago`
                                 : isToday ? "🔴 Today!"
                                 : isCrit  ? `🔴 ${dl}d left`
                                 : isWarn  ? `🟡 ${dl}d left`
                                 :           `${dl}d left`}
                              </span>
                            </div>

                            {/* Status badge */}
                            <div className="hidden md:block flex-shrink-0">
                              {(() => { const ss = STATUS_STYLE[u.status]||STATUS_STYLE.active; return (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                  style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}` }}>
                                  {ss.label}
                                </span>
                              ); })()}
                            </div>

                            {/* Quick edit */}
                            <button onClick={() => setEditUser(u)} title="Renew subscription"
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all hover:bg-amber-500/20 hover:scale-110">
                              <span className="text-sm">✏️</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Search */}
              <div className="flex items-center gap-3 mb-5">
                <div className="relative flex-1 max-w-sm">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Search by name, email, phone..."
                    style={{ ...inputStyle, paddingLeft:34, width:"100%" }} />
                </div>
                <span className="text-gray-600 text-xs">{filteredUsers.length} user{filteredUsers.length!==1?"s":""}</span>
              </div>

              {/* Table */}
              <div className="rounded-2xl overflow-hidden"
                style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))", border:"1px solid rgba(255,255,255,0.08)" }}>

                <div className="hidden md:grid gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.06)", gridTemplateColumns:"2fr 2fr 1.2fr 1.8fr 1fr 0.8fr 1fr" }}>
                  <span>User</span><span>Email</span><span>Phone</span><span>Subscription</span><span>Status</span><span className="text-center">📧 Email</span><span>Actions</span>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-transparent animate-spin" />
                  </div>
                ) : filteredUsers.length===0 ? (
                  <div className="text-center py-16">
                    <p className="text-5xl mb-3">👥</p>
                    <p className="text-white font-semibold text-sm">No users found</p>
                    <p className="text-gray-500 text-xs mt-1">{search?"Try a different search":"Register your first user"}</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {filteredUsers.map((u, idx) => {
                      const ss = STATUS_STYLE[u.status] || STATUS_STYLE.active;
                      const dl = daysLeft(u.activeTo);
                      const isExpiringSoon = dl!==null&&dl>=0&&dl<=7&&u.status==="active";
                      return (
                        <div key={u.uid}
                          className="flex flex-col md:grid gap-4 px-5 py-4 transition-all duration-150 hover:bg-white/[0.025] group"
                          style={{ gridTemplateColumns:"2fr 2fr 1.2fr 1.8fr 1fr 0.8fr 1fr", borderBottom: idx<filteredUsers.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>

                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-transform group-hover:scale-105"
                              style={{ background:"linear-gradient(135deg,rgba(37,99,235,0.25),rgba(245,158,11,0.15))", color:"#60A5FA", border:"1px solid rgba(37,99,235,0.25)" }}>
                              {(u.name||"?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-white text-sm font-semibold truncate">{u.name}</p>
                              <p className="text-gray-600 text-[10px] md:hidden truncate">{u.email}</p>
                            </div>
                          </div>

                          <p className="text-gray-400 text-xs hidden md:flex items-center truncate">{u.email}</p>
                          <p className="text-gray-400 text-xs flex items-center">{u.phone||"—"}</p>

                          <div className="flex flex-col justify-center gap-0.5">
                            <p className="text-gray-400 text-[11px]">{fmtDate(u.activeFrom)} → {fmtDate(u.activeTo)}</p>
                            {dl!==null && (
                              <p className="text-[10px] font-semibold"
                                style={{ color: isExpiringSoon?"#fbbf24":dl<0?"#f87171":"#4b5563" }}>
                                {dl<0?`Expired ${Math.abs(dl)}d ago`:dl===0?"Expires today!":isExpiringSoon?`${dl}d left ⚠️`:`${dl}d left`}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center">
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                              style={{ background:ss.bg, color:ss.color, border:`1px solid ${ss.border}` }}>
                              {ss.label}
                            </span>
                          </div>

                          {/* Email feature toggle */}
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => setConfirm({ type: "emailToggle", uid: u.uid, name: u.name, currentEnabled: u.emailFeatureEnabled !== false })}
                              title={u.emailFeatureEnabled !== false ? "Disable Email Feature" : "Enable Email Feature"}
                              className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-300 focus:outline-none"
                              style={{
                                background: u.emailFeatureEnabled !== false
                                  ? "linear-gradient(135deg,#34d399,#059669)"
                                  : "rgba(255,255,255,0.1)",
                                border: u.emailFeatureEnabled !== false
                                  ? "1px solid rgba(52,211,153,0.4)"
                                  : "1px solid rgba(255,255,255,0.15)",
                              }}>
                              <span
                                className="inline-block w-4 h-4 transform bg-white rounded-full shadow-md transition-transform duration-300"
                                style={{ transform: u.emailFeatureEnabled !== false ? "translateX(24px)" : "translateX(4px)" }}
                              />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setSelectedUid(u.uid)} title="View Details"
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-purple-500/20 hover:scale-110">
                              <span className="text-sm">👁️</span>
                            </button>
                            <button onClick={() => setEditUser(u)} title="Edit"
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10 hover:scale-110">
                              <span className="text-sm">✏️</span>
                            </button>
                            <button
                              onClick={() => setConfirm({ type:"freeze", uid:u.uid, name:u.name, currentStatus:u.status })}
                              title={u.status==="frozen"?"Unfreeze":"Freeze"}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-blue-500/20 hover:scale-110">
                              <span className="text-sm">{u.status==="frozen"?"🔓":"🔒"}</span>
                            </button>
                            <button onClick={() => setConfirm({ type:"delete", uid:u.uid, name:u.name })} title="Remove"
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/20 hover:scale-110">
                              <span className="text-sm">🗑️</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────── ANALYTICS TAB ──────────── */}
          {activeTab==="analytics" && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard icon="👥" label="Total Users"     value={totalCount}  gradient="linear-gradient(135deg,#2563EB,#1d4ed8)" glow="rgba(37,99,235,0.35)" />
                <StatCard icon="✅" label="Active"          value={activeCount} gradient="linear-gradient(135deg,#10b981,#059669)" glow="rgba(16,185,129,0.35)" />
                <StatCard icon="🔒" label="Frozen"          value={frozenCount} gradient="linear-gradient(135deg,#60a5fa,#3b82f6)" glow="rgba(96,165,250,0.35)" />
                <StatCard icon="⚠️" label="Expiring (7d)"  value={expiringIn7} gradient="linear-gradient(135deg,#F59E0B,#d97706)" glow="rgba(245,158,11,0.35)" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Subscription breakdown */}
                <div className="rounded-2xl p-6"
                  style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))", border:"1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-white font-bold text-sm mb-5">📊 Subscription Breakdown</p>
                  {[
                    { label:"Active Users",     value:activeCount,  total:totalCount, color:"#34d399", bg:"rgba(52,211,153,0.15)" },
                    { label:"Frozen Users",     value:frozenCount,  total:totalCount, color:"#60a5fa", bg:"rgba(96,165,250,0.15)" },
                    { label:"Expiring in 7d",   value:expiringIn7,  total:totalCount, color:"#fbbf24", bg:"rgba(251,191,36,0.15)" },
                  ].map(item => (
                    <div key={item.label} className="mb-4">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-gray-400 text-xs font-medium">{item.label}</span>
                        <span className="text-white text-xs font-bold">{item.value} / {item.total}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.05)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width:`${item.total>0?(item.value/item.total)*100:0}%`, background:item.color, boxShadow:`0 0 8px ${item.color}60` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Expiring soon list */}
                <div className="rounded-2xl p-6"
                  style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))", border:"1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-white font-bold text-sm mb-5">⚠️ Expiring Soon</p>
                  {users.filter(u => { const d=daysLeft(u.activeTo); return d!==null&&d>=0&&d<=7&&u.status==="active"; }).length===0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                      <p className="text-3xl mb-2">🎉</p>
                      <p className="text-gray-500 text-sm">No subscriptions expiring soon</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {users.filter(u => { const d=daysLeft(u.activeTo); return d!==null&&d>=0&&d<=7&&u.status==="active"; }).map(u => (
                        <div key={u.uid} className="flex items-center justify-between px-4 py-3 rounded-xl"
                          style={{ background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.15)" }}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{ background:"rgba(245,158,11,0.15)", color:"#fbbf24" }}>
                              {(u.name||"?").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-white text-sm font-medium">{u.name}</span>
                          </div>
                          <span className="text-amber-400 text-xs font-bold">{daysLeft(u.activeTo)}d left</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ──────────── DEBUG TAB ──────────── */}
          {activeTab==="debug" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white font-bold text-base">Debug Console</h2>
                  <p className="text-gray-500 text-xs mt-0.5">Inspect API state and admin auth tokens</p>
                </div>
                <button onClick={runDebug}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={{ background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.25)", color:"#fbbf24" }}>
                  🔍 Run Debug
                </button>
              </div>

              {!debugInfo ? (
                <div className="rounded-2xl p-10 text-center"
                  style={{ background:"rgba(245,158,11,0.03)", border:"1px dashed rgba(245,158,11,0.15)" }}>
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="text-gray-400 text-sm font-medium">Click "Run Debug" to inspect admin state</p>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden"
                  style={{ background:"rgba(8,13,20,0.8)", border:"1px solid rgba(245,158,11,0.2)" }}>
                  <div className="flex items-center justify-between px-5 py-3"
                    style={{ borderBottom:"1px solid rgba(245,158,11,0.12)", background:"rgba(245,158,11,0.05)" }}>
                    <span className="text-amber-400 font-bold text-xs uppercase tracking-widest">🔍 Debug Output</span>
                    <button onClick={() => setDebugInfo(null)} className="text-gray-600 hover:text-gray-400 transition-colors text-sm">✕</button>
                  </div>
                  <div className="p-5">
                    {Object.entries(debugInfo).map(([k,v]) => (
                      <div key={k} className="flex gap-3 py-1.5 font-mono text-xs"
                        style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
                        <span className="text-gray-500 w-44 flex-shrink-0">{k}:</span>
                        <span className={String(v).includes("MISSING")||String(v).includes("FAILED")||String(v).includes("Unauthorized")
                          ?"text-red-400":"text-green-400"}>
                          {typeof v==="object"?JSON.stringify(v):String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </main>

        {/* Footer */}
        <footer className="px-6 py-3 text-center" style={{ borderTop:"1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-gray-700 text-[10px] font-mono">🔐 Super Admin-only panel — Novexa ERP v1.0</p>
        </footer>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}
