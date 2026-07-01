"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID;

function formatRs(n) {
  if (!n && n !== 0) return "—";
  return "Rs. " + Number(n).toLocaleString("en-PK");
}
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
  const diff    = Math.ceil((new Date(expStr) - new Date()) / 86400000);
  return diff;
}

const STATUS_STYLE = {
  active:      { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)",  label: "Active"   },
  frozen:      { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.25)",  label: "Frozen"   },
  deleted:     { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)", label: "Deleted"  },
  not_started: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)",  label: "Pending"  },
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
const cardStyle = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(12px)",
};

// ── Reusable Input ────────────────────────────────────────────────────────────
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
          ...(focused ? { borderColor: "rgba(37,99,235,0.5)", background: "rgba(37,99,235,0.06)", boxShadow: "0 0 0 3px rgba(37,99,235,0.08)" } : {}),
        }}
      />
    </div>
  );
}

// ── Toast notification ────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold animate-slideUp"
          style={{
            background: t.type === "success" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
            border: `1px solid ${t.type === "success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
            color: t.type === "success" ? "#34d399" : "#f87171",
            backdropFilter: "blur(12px)",
            minWidth: 260,
          }}>
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>
        <p className="text-3xl">⚠️</p>
        <h3 className="text-white font-bold text-lg">{title}</h3>
        <p className="text-gray-400 text-sm">{message}</p>
        <div className="flex gap-3 mt-1">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: confirmColor || "rgba(239,68,68,0.15)", border: `1px solid ${confirmColor ? confirmColor.replace("0.15", "0.4") : "rgba(239,68,68,0.4)"}`, color: confirmColor ? "#fff" : "#ef4444" }}>
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User Form Modal ───────────────────────────────────────────────────────────
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
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg my-6 rounded-2xl overflow-hidden"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-white font-black text-xl">{isEdit ? "Edit User" : "Register New User"}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{isEdit ? "Update user details and subscription" : "Create a new Novexa ERP account"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>
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

          {/* Subscription dates */}
          <div className="rounded-xl p-4" style={{ background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.15)" }}>
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">📅 Subscription Period</p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <SInput label="Active From *" type="date" value={form.activeFrom} onChange={set("activeFrom")} required />
              <SInput label="Active Until *" type="date" value={form.activeTo} onChange={set("activeTo")} required />
            </div>
            {/* Optional freeze time */}
            <div>
              <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                ⏰ Freeze Time
                <span className="text-gray-600 normal-case font-normal tracking-normal" style={{ fontSize: 10 }}>
                  (optional — default: end of day 11:59 PM)
                </span>
              </label>
              <SInput
                type="time"
                value={form.activeToTime}
                onChange={set("activeToTime")}
                placeholder="e.g. 18:00"
              />
              {form.activeToTime && form.activeTo && (
                <p className="text-blue-400 text-[11px] mt-1.5 font-medium">
                  ✓ Will freeze on {form.activeTo} at {form.activeToTime}
                </p>
              )}
            </div>
          </div>

          {/* Device limit */}
          <div className="rounded-xl p-4" style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)" }}>
            <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-3">📱 Device / Session Limit</p>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map(n => (
                <button key={n} type="button"
                  onClick={() => setForm(p => ({ ...p, maxDevices: String(n) }))}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: form.maxDevices === String(n) ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${form.maxDevices === String(n) ? "rgba(139,92,246,0.6)" : "rgba(255,255,255,0.08)"}`,
                    color: form.maxDevices === String(n) ? "#c4b5fd" : "#6b7280",
                  }}>
                  {n} {n === 1 ? "Device" : "Devices"}
                </button>
              ))}
            </div>
            <p className="text-gray-600 text-[10px] mt-2">
              Max simultaneous logins. Old session auto-logs out when limit exceeded.
            </p>
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-3 rounded-xl text-white font-bold text-sm mt-1 transition-all hover:scale-[1.01]"
            style={{ background: saving ? "rgba(37,99,235,0.4)" : "linear-gradient(135deg,#2563EB,#1d4ed8)", opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : isEdit ? "Save Changes →" : "Register User →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Admin Panel ──────────────────────────────────────────────────────────
export default function AdminPanel() {
  const router = useRouter();
  const [user,        setUser]        = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [editUser,    setEditUser]    = useState(null);   // null = create, object = edit
  const [confirm,     setConfirm]     = useState(null);  // { type, uid, name }
  const [search,      setSearch]      = useState("");
  const [toasts,      setToasts]      = useState([]);

  // ── Auth guard — only admin UID allowed ──────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      if (!u || u.uid !== ADMIN_UID) {
        router.replace("/pages/login");
        return;
      }
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const toast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  // ── Get fresh ID token — always use the user object directly ────────────────
  const getToken = useCallback(async () => {
    // Force refresh=true to always get a valid non-expired token
    if (user) return user.getIdToken(true);
    if (auth.currentUser) return auth.currentUser.getIdToken(true);
    throw new Error("Not authenticated");
  }, [user]);

  // ── Fetch users ───────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/list-users", {
        headers: { authorization: `Bearer ${token}` },
      });
      // Guard against HTML error responses
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error("Server error: " + text.slice(0, 120));
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setUsers(data.users || []);
    } catch (err) {
      toast(err.message || "Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  }, [user, toast, getToken]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Create / Edit user ────────────────────────────────────────────────────────
  async function handleSaveUser(form) {
    setSaving(true);
    try {
      const token = await getToken();
      const headers = { "Content-Type": "application/json", authorization: `Bearer ${token}` };
      if (editUser) {
        const body = { uid: editUser.uid, name: form.name, phone: form.phone, address: form.address, activeFrom: form.activeFrom, activeTo: form.activeTo, activeToTime: form.activeToTime, maxDevices: form.maxDevices };
        if (form.password) body.newPassword = form.password;
        const res = await fetch("/api/admin/update-user", { method: "POST", headers, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast(`${form.name} updated successfully`);
      } else {
        const res = await fetch("/api/admin/create-user", { method: "POST", headers, body: JSON.stringify(form) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast(`${form.name} registered successfully`);
      }
      setShowForm(false);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      toast(err.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Freeze / Unfreeze ─────────────────────────────────────────────────────────
  async function handleToggleFreeze(uid, name, currentStatus) {
    const newStatus = currentStatus === "frozen" ? "active" : "frozen";
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`${name} ${newStatus === "frozen" ? "frozen" : "unfrozen"} successfully`);
      fetchUsers();
    } catch (err) {
      toast(err.message || "Action failed", "error");
    } finally {
      setConfirm(null);
    }
  }

  // ── Delete user ───────────────────────────────────────────────────────────────
  async function handleDeleteUser(uid, name) {
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`${name} has been removed`);
      fetchUsers();
    } catch (err) {
      toast(err.message || "Delete failed", "error");
    } finally {
      setConfirm(null);
    }
  }

  // ── Debug: check what the API sees ───────────────────────────────────────────
  const [debugInfo,    setDebugInfo]    = useState(null);
  const [detailUser,   setDetailUser]   = useState(null); // { user, authRecord, activityLogs }
  const [detailLoading, setDetailLoading] = useState(false);
  async function runDebug() {
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/debug", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDebugInfo(data);
      console.log("🔍 Admin debug:", data);
      toast("Debug info logged to console + shown below", "success");
    } catch (err) {
      toast("Debug failed: " + err.message, "error");
    }
  }

  // ── Fetch single user detail + activity logs ──────────────────────────────
  async function fetchUserDetail(uid) {
    setDetailLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/user-detail?uid=${uid}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetailUser(data);
    } catch (err) {
      toast(err.message || "Failed to load user details", "error");
    } finally {
      setDetailLoading(false);
    }
  }
  const activeCount  = users.filter(u => u.status === "active").length;
  const frozenCount  = users.filter(u => u.status === "frozen").length;
  const totalCount   = users.filter(u => u.status !== "deleted").length;
  const expiringIn7  = users.filter(u => { const d = daysLeft(u.activeTo); return d !== null && d >= 0 && d <= 7 && u.status === "active"; }).length;

  const filteredUsers = users.filter(u => {
    if (u.status === "deleted") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || (u.phone || "").includes(q);
  });

  // ── Loading screen ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-t-blue-500 border-r-amber-500 border-b-blue-500 border-l-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117]" style={{ fontFamily: "var(--font-poppins, sans-serif)" }}>
      <Toast toasts={toasts} />

      {/* Modals */}
      {(showForm || editUser) && (
        <UserFormModal initial={editUser} saving={saving}
          onClose={() => { setShowForm(false); setEditUser(null); }}
          onSave={handleSaveUser} />
      )}

      {/* ── User Detail Modal ── */}
      {(detailUser || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          onClick={e => e.target === e.currentTarget && setDetailUser(null)}>
          <div className="w-full max-w-2xl my-6 rounded-2xl overflow-hidden"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]"
              style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.08),rgba(139,92,246,0.05))" }}>
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
              <button onClick={() => setDetailUser(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-transparent animate-spin" />
              </div>
            ) : detailUser && (
              <div className="p-6 flex flex-col gap-5">

                {/* Profile Info */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">👤 Profile</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Phone",    value: detailUser.user.phone   || "—" },
                      { label: "Address",  value: detailUser.user.address || "—" },
                      { label: "Registered", value: detailUser.user.createdAt ? new Date(detailUser.user.createdAt).toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" }) : "—" },
                      { label: "Email Verified", value: detailUser.authRecord?.emailVerified ? "✅ Yes" : "❌ No" },
                      { label: "Device Limit", value: `${detailUser.user.maxDevices || 1} device${(detailUser.user.maxDevices || 1) > 1 ? "s" : ""}` },
                    ].map(r => (
                      <div key={r.label} className="rounded-xl px-4 py-3"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                        <p className="text-white text-sm font-medium">{r.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subscription */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">📅 Subscription</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Active From", value: fmtDate(detailUser.user.activeFrom) },
                      { label: "Active Until", value: fmtDate(detailUser.user.activeTo) },
                      { label: "Days Left", value: (() => { const d = daysLeft(detailUser.user.activeTo); return d === null ? "—" : d < 0 ? `Expired ${Math.abs(d)}d ago` : d === 0 ? "Expires today!" : `${d} days`; })() },
                    ].map(r => (
                      <div key={r.label} className="rounded-xl px-4 py-3"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                        <p className="text-white text-sm font-medium">{r.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity / Last Login */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">⚡ Activity</p>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: "Last Login",   value: detailUser.user.lastLogin    ? new Date(detailUser.user.lastLogin).toLocaleString("en-PK")  : detailUser.authRecord?.lastSignInTime || "Never" },
                      { label: "Last Active",  value: detailUser.user.lastActiveAt ? new Date(detailUser.user.lastActiveAt).toLocaleString("en-PK") : "—" },
                      { label: "Login IP",     value: detailUser.user.lastLoginIP  || "—" },
                      { label: "Browser",      value: detailUser.user.lastBrowser  || "—" },
                      { label: "Device",       value: detailUser.user.lastDevice   || "—" },
                      { label: "Auth Created", value: detailUser.authRecord?.creationTime ? new Date(detailUser.authRecord.creationTime).toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" }) : "—" },
                      { label: "Active Sessions", value: `${detailUser.activityLogs.filter ? (detailUser.sessions?.filter(s=>s.active)?.length ?? "—") : "—"} / ${detailUser.user.maxDevices || 1}` },
                    ].map(r => (
                      <div key={r.label} className="rounded-xl px-4 py-3"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1">{r.label}</p>
                        <p className="text-white text-sm font-medium truncate">{r.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Login history */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">🕐 Login History (last 20)</p>
                  {detailUser.activityLogs.length === 0 ? (
                    <p className="text-gray-600 text-xs px-1">No login history yet. History is recorded after next login.</p>
                  ) : (
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="grid text-[10px] font-bold uppercase tracking-widest px-4 py-2"
                        style={{ color: "#4b5563", borderBottom: "1px solid rgba(255,255,255,0.05)", gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
                        <span>Date & Time</span><span>IP</span><span>Browser</span><span>Device</span>
                      </div>
                      {detailUser.activityLogs.map((log, i) => (
                        <div key={log.id} className="grid px-4 py-2.5 text-xs transition-colors hover:bg-white/[0.02]"
                          style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr", borderBottom: i < detailUser.activityLogs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
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
      )}

      {confirm?.type === "freeze" && (
        <ConfirmDialog
          title={confirm.currentStatus === "frozen" ? `Unfreeze ${confirm.name}?` : `Freeze ${confirm.name}?`}
          message={confirm.currentStatus === "frozen" ? "This will restore their dashboard access immediately." : "Their dashboard access will be blocked until you unfreeze."}
          confirmLabel={confirm.currentStatus === "frozen" ? "Yes, Unfreeze" : "Yes, Freeze"}
          confirmColor={confirm.currentStatus === "frozen" ? "rgba(52,211,153,0.15)" : "rgba(96,165,250,0.15)"}
          onConfirm={() => handleToggleFreeze(confirm.uid, confirm.name, confirm.currentStatus)}
          onCancel={() => setConfirm(null)} />
      )}

      {confirm?.type === "delete" && (
        <ConfirmDialog
          title={`Remove ${confirm.name}?`}
          message="Their account will be disabled. Their data stays safe in Firestore."
          confirmLabel="Yes, Remove"
          onConfirm={() => handleDeleteUser(confirm.uid, confirm.name)}
          onCancel={() => setConfirm(null)} />
      )}

      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4"
        style={{ background: "rgba(8,13,20,0.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 flex-shrink-0">
            <Image src="/images/Novexa N Logo.png" alt="Novexa" fill className="object-contain" />
          </div>
          <div>
            <h1 className="text-white font-black text-base leading-none">Admin Panel</h1>
            <p className="text-gray-600 text-[10px] mt-0.5 font-semibold tracking-widest uppercase">Novexa ERP — Restricted Access</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-xs hidden sm:block">{todayStr()}</span>
          <button onClick={() => signOut(auth).then(() => router.push("/pages/login"))}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-red-500/10"
            style={{ border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
            🚪 Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: "👥", label: "Total Users",     value: totalCount,  color: "from-blue-500 to-cyan-600" },
            { icon: "✅", label: "Active",           value: activeCount, color: "from-green-500 to-emerald-600" },
            { icon: "🔒", label: "Frozen",           value: frozenCount, color: "from-blue-400 to-indigo-600" },
            { icon: "⚠️", label: "Expiring (7 days)", value: expiringIn7, color: "from-amber-500 to-orange-600" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4" style={cardStyle}>
              <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-lg mb-3 bg-gradient-to-br ${s.color}`}
                style={{ fontSize: 18 }}>{s.icon}</div>
              <p className="text-white font-black text-2xl leading-none">{s.value}</p>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, phone..."
              style={{ ...inputStyle, paddingLeft: 34, width: "100%" }} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={runDebug}
              className="px-3 py-2.5 rounded-xl text-xs font-semibold transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" }}>
              🔍 Debug
            </button>
            <button onClick={fetchUsers} disabled={loading}
              className="px-3 py-2.5 rounded-xl text-xs font-semibold transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
              {loading ? "⏳" : "↻"} Refresh
            </button>
            <button onClick={() => { setEditUser(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", color: "#fff" }}>
              ＋ Register User
            </button>
          </div>
        </div>

        {/* ── Debug Panel ── */}
        {debugInfo && (
          <div className="rounded-xl p-4 mb-5 text-xs font-mono"
            style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-400 font-bold text-xs uppercase tracking-widest">🔍 Debug Info</span>
              <button onClick={() => setDebugInfo(null)} className="text-gray-600 hover:text-gray-400">✕</button>
            </div>
            {Object.entries(debugInfo).map(([k, v]) => (
              <div key={k} className="flex gap-2 py-0.5">
                <span className="text-gray-500 w-40 flex-shrink-0">{k}:</span>
                <span className={String(v).includes("MISSING") || String(v).includes("FAILED") || String(v).includes("Unauthorized")
                  ? "text-red-400" : "text-green-400"}>
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Users Table ── */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          {/* Table Header */}
          <div className="hidden md:grid gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "#6b7280", borderBottom: "1px solid rgba(255,255,255,0.06)", gridTemplateColumns: "2fr 2fr 1fr 1.5fr 1fr 1fr" }}>
            <span>User</span><span>Email</span><span>Phone</span><span>Subscription</span><span>Status</span><span>Actions</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-transparent animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-white font-semibold text-sm">No users found</p>
              <p className="text-gray-500 text-xs mt-1">{search ? "Try a different search" : "Register your first user to get started"}</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredUsers.map((u, idx) => {
                const ss = STATUS_STYLE[u.status] || STATUS_STYLE.active;
                const dl = daysLeft(u.activeTo);
                const isExpiringSoon = dl !== null && dl >= 0 && dl <= 7 && u.status === "active";
                return (
                  <div key={u.uid}
                    className="flex flex-col md:grid gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02]"
                    style={{
                      gridTemplateColumns: "2fr 2fr 1fr 1.5fr 1fr 1fr",
                      borderBottom: idx < filteredUsers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}>

                    {/* Name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.2),rgba(245,158,11,0.15))", color: "#60A5FA", border: "1px solid rgba(37,99,235,0.2)" }}>
                        {(u.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{u.name}</p>
                        <p className="text-gray-600 text-[10px] md:hidden truncate">{u.email}</p>
                      </div>
                    </div>

                    {/* Email */}
                    <p className="text-gray-400 text-xs hidden md:flex items-center truncate">{u.email}</p>

                    {/* Phone */}
                    <p className="text-gray-400 text-xs flex items-center">{u.phone || "—"}</p>

                    {/* Subscription */}
                    <div className="flex flex-col justify-center gap-0.5">
                      <p className="text-gray-400 text-[11px]">{fmtDate(u.activeFrom)} → {fmtDate(u.activeTo)}</p>
                      {dl !== null && (
                        <p className="text-[10px] font-semibold" style={{ color: isExpiringSoon ? "#fbbf24" : dl < 0 ? "#f87171" : "#6b7280" }}>
                          {dl < 0 ? `Expired ${Math.abs(dl)}d ago` : dl === 0 ? "Expires today!" : isExpiringSoon ? `${dl}d left ⚠️` : `${dl}d left`}
                        </p>
                      )}
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                        style={{ background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>
                        {ss.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => fetchUserDetail(u.uid)} title="View Details"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors hover:bg-white/10"
                        style={{ color: "#a78bfa" }}>👁️</button>
                      <button onClick={() => setEditUser(u)} title="Edit"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors hover:bg-white/10"
                        style={{ color: "#9ca3af" }}>✏️</button>
                      <button
                        onClick={() => setConfirm({ type: "freeze", uid: u.uid, name: u.name, currentStatus: u.status })}
                        title={u.status === "frozen" ? "Unfreeze" : "Freeze"}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors hover:bg-white/10"
                        style={{ color: u.status === "frozen" ? "#34d399" : "#60a5fa" }}>
                        {u.status === "frozen" ? "🔓" : "🔒"}
                      </button>
                      <button onClick={() => setConfirm({ type: "delete", uid: u.uid, name: u.name })} title="Remove"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors hover:bg-red-500/10"
                        style={{ color: "#ef4444" }}>🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-gray-700 text-xs mt-6 font-mono">
          🔐 Admin-only panel — Novexa ERP v1.0
        </p>
      </main>
    </div>
  );
}