"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, onSnapshot, query, orderBy, doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import SweetAlert from "./SweetAlert";

// ── All assignable modules (same IDs as navItems) ─────────────────────────────
const ALL_MODULES = [
  { id: "overview",    label: "Overview",         icon: "📊" },
  { id: "invoices",    label: "Invoices",          icon: "🧾" },
  { id: "customers",   label: "Customers",         icon: "👥" },
  { id: "inventory",   label: "Inventory",         icon: "📦" },
  { id: "payments",    label: "Payments",          icon: "💳" },
  { id: "purchases",   label: "Purchases",         icon: "🛒" },
  { id: "order-form",  label: "Order Form",        icon: "📋" },
  { id: "analytics",   label: "Analytics",         icon: "📈" },
  { id: "hr",          label: "HR",                icon: "👔" },
  { id: "branches",    label: "Branches",          icon: "🏢" },
  { id: "settings",    label: "Settings",          icon: "⚙️" },
  { id: "contact",     label: "Contact Us",        icon: "📞" },
  { id: "my-tickets",  label: "My Tickets",        icon: "🎫" },
  { id: "addons",      label: "Add-ons",           icon: "⚡" },
  { id: "backup",      label: "Backup",            icon: "💾" },
  { id: "bill-book",   label: "Digital Register",  icon: "📒" },
];

// ── Hardcoded plan → tab mapping (mirrors DashboardPage) ──────────────────────
const PLAN_MODULES = {
  starter:      new Set(["overview","invoices","customers","inventory","payments","purchases","settings","contact","my-tickets","addons","backup","bill-book"]),
  business:     new Set(["overview","invoices","customers","inventory","payments","purchases","order-form","analytics","settings","contact","my-tickets","addons","backup","bill-book"]),
  professional: new Set(["overview","invoices","customers","inventory","payments","purchases","order-form","analytics","hr","branches","settings","contact","my-tickets","addons","backup","bill-book"]),
  enterprise:   new Set(["overview","invoices","customers","inventory","payments","purchases","order-form","analytics","hr","branches","settings","contact","my-tickets","addons","backup","bill-book"]),
};

function getPlanModules(plan) {
  return PLAN_MODULES[plan] || PLAN_MODULES.starter;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name = "") {
  return name.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "S";
}

// Common input style
const inp = {
  width: "100%", outline: "none",
  background: "rgba(255,255,255,0.05)",
  border: "1.5px solid rgba(255,255,255,0.1)",
  borderRadius: 10, padding: "10px 14px",
  color: "#fff", fontSize: 14,
};
const lbl = {
  display: "block", color: "#9ca3af", fontSize: 11,
  fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.07em", marginBottom: 6,
};

// ── Module toggle chip ────────────────────────────────────────────────────────
function ModuleChip({ mod, checked, disabled, onChange }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(mod.id, !checked)}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 select-none"
      style={{
        background:  checked  ? "rgba(37,99,235,0.18)"  : "rgba(255,255,255,0.04)",
        border:      checked  ? "1.5px solid rgba(37,99,235,0.5)" : "1.5px solid rgba(255,255,255,0.08)",
        color:       disabled ? "#374151" : checked ? "#93c5fd" : "#6b7280",
        cursor:      disabled ? "not-allowed" : "pointer",
        opacity:     disabled ? 0.45 : 1,
      }}
      title={disabled ? "Not available in your plan" : ""}
    >
      <span>{mod.icon}</span>
      <span>{mod.label}</span>
      {checked && !disabled && <span style={{ color: "#3b82f6", fontSize: 10, marginLeft: "auto" }}>✓</span>}
      {disabled && <span style={{ fontSize: 10, marginLeft: "auto" }}>🔒</span>}
    </button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5"
        style={{ background: "rgba(37,99,235,0.1)", border: "2px solid rgba(37,99,235,0.2)" }}>
        👨‍💼
      </div>
      <h3 className="text-white font-black text-xl mb-2">No Staff Yet</h3>
      <p className="text-gray-400 text-sm max-w-xs mb-6 leading-relaxed">
        Create staff accounts to divide work among your team. Each staff member gets their own login and only sees the modules you assign.
      </p>
      <button onClick={onAdd}
        className="px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
        style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", boxShadow: "0 4px 16px rgba(37,99,235,0.35)" }}>
        ➕ Add First Staff Member
      </button>
    </div>
  );
}

// ── Staff avatar ──────────────────────────────────────────────────────────────
function Avatar({ name, size = 36 }) {
  const colors = ["#2563EB","#7c3aed","#059669","#d97706","#dc2626","#0891b2"];
  const idx    = name.charCodeAt(0) % colors.length;
  return (
    <div className="flex-shrink-0 rounded-full flex items-center justify-center font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36, background: colors[idx] }}>
      {initials(name)}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StaffManagementView({ uid, userDoc, locations = [] }) {
  const [staffList, setStaffList]       = useState([]);
  const [loading,   setLoading]         = useState(true);
  const [saving,    setSaving]          = useState(false);
  const [alert,     setAlert]           = useState({ show: false, type: "", title: "", message: "" });
  const [planModules, setPlanModules]   = useState(new Set());

  // Modal state
  const [showModal,  setShowModal]      = useState(false);
  const [editTarget, setEditTarget]     = useState(null); // null = create, object = edit

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState(null); // { uid, name }

  // Activity log drawer
  const [activityStaff, setActivityStaff] = useState(null); // staff doc

  // Helper: Get default location ID
  const getDefaultLocationId = () => {
    const active = (locations || []).filter(l => !l.deleted);
    // Strictly find default location only (don't fallback to first location)
    const def = active.find(l => l.isDefault) || active.find(l => l.id === "default");
    return def?.id || "";
  };

  // Form state
  const BLANK_FORM = {
    name: "", email: "", password: "", role: "",
    allowedModules: ["overview", "settings"],
    assignedLocationId: "", // Staff's assigned location - defaults to main shop if empty
    permissions: {
      invoices: { view: "own", create: false, edit: false, delete: false },
      customers: { view: "all", create: false, edit: false, delete: false },
      inventory: { 
        view: "own", // "own" = only own products, "all" = all products in location
        create: false, 
        edit: false, 
        delete: false, 
        canManageLocations: false
      },
      payments: { view: "all", create: false, edit: false, delete: false },
      purchases: { view: "all", create: false, edit: false, delete: false },
    },
    isActive: true,
  };
  const [form, setForm] = useState(BLANK_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordReset, setPasswordReset] = useState(""); // separate field when editing

  // ── Load plan modules ─────────────────────────────────────────────────────
  useEffect(() => {
    async function loadPlanModules() {
      const plan = userDoc?.plan || "starter";
      try {
        const { getDoc: gd, doc: fsDoc } = await import("firebase/firestore");
        const { db: fdb } = await import("@/lib/firebase");
        const snap = await gd(fsDoc(fdb, "adminConfig", "plans"));
        if (snap.exists()) {
          const list = snap.data().list || [];
          const planData = list.find(p => p.id === plan);
          if (planData?.allowedTabs) {
            setPlanModules(new Set([...planData.allowedTabs, "addons", "backup"]));
            return;
          }
        }
      } catch { /* fallback */ }
      setPlanModules(getPlanModules(plan));
    }
    loadPlanModules();
  }, [userDoc?.plan]);

  // ── Real-time staff list ──────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "users", uid, "staff"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q,
      snap => {
        setStaffList(snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => !s.deleted)
        );
        setLoading(false);
      },
      err => {
        if (err.code !== "permission-denied") console.error("[staff list]", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function openCreate() {
    setEditTarget(null);
    setForm({ ...BLANK_FORM, assignedLocationId: "" }); // Start with empty - user will select if needed
    setPasswordReset("");
    setShowPassword(false);
    setShowModal(true);
  }

  function openEdit(staff) {
    setEditTarget(staff);
    setForm({
      name:           staff.name || "",
      email:          staff.email || "",
      password:       "", // not pre-filled on edit
      role:           staff.role || "",
      allowedModules: [...(staff.allowedModules || [])],
      assignedLocationId: staff.assignedLocationId || "",
      permissions:    staff.permissions || {
        invoices:  { view: "own", create: false, edit: false, delete: false },
        customers: { view: "all", create: false, edit: false, delete: false },
        inventory: { 
          view: "own", 
          create: false, 
          edit: false, 
          delete: false, 
          canManageLocations: false
        },
        payments:  { view: "all", create: false, edit: false, delete: false },
        purchases: { view: "all", create: false, edit: false, delete: false },
      },
      isActive:       staff.isActive !== false,
    });
    setPasswordReset("");
    setShowPassword(false);
    setShowModal(true);
  }

  function toggleModule(id, checked) {
    setForm(prev => ({
      ...prev,
      allowedModules: checked
        ? [...prev.allowedModules, id]
        : prev.allowedModules.filter(m => m !== id),
    }));
  }

  function selectAll() {
    setForm(prev => ({
      ...prev,
      allowedModules: ALL_MODULES.filter(m => planModules.has(m.id)).map(m => m.id),
    }));
  }

  function clearAll() {
    setForm(prev => ({ ...prev, allowedModules: ["overview", "settings"] }));
  }

  // ── API call helper ───────────────────────────────────────────────────────
  async function callManage(method, body) {
    const token = await auth.currentUser.getIdToken();
    const res   = await fetch("/api/staff/manage", {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body:    JSON.stringify(body),
    });
    return res.json();
  }

  // ── Create / Update ───────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    // Basic validation
    if (!form.name.trim())  return showAlert("error", "Required", "Name is required.");
    if (!editTarget && !form.email.trim()) return showAlert("error", "Required", "Email is required.");
    if (!editTarget && !form.password) return showAlert("error", "Required", "Password is required for new staff.");
    if (!editTarget && form.password.length < 8) return showAlert("error", "Weak Password", "Password must be at least 8 characters.");

    // Validate assigned location for inventory "own" view
    // Removed validation - if empty, will auto-assign to default location
    // if (form.permissions.inventory?.view === "own" && !form.assignedLocationId) {
    //   return showAlert("error", "Location Required", "Please select an assigned location for 'Own Only' inventory view.");
    // }

    setSaving(true);
    try {
      // If assignedLocationId is empty, auto-assign to default location
      const finalLocationId = form.assignedLocationId || getDefaultLocationId() || "";
      
      if (!editTarget) {
        // Create
        const data = await callManage("POST", {
          name:           form.name.trim(),
          email:          form.email.trim().toLowerCase(),
          password:       form.password,
          role:           form.role.trim(),
          allowedModules: form.allowedModules,
          assignedLocationId: finalLocationId,
          permissions:    form.permissions,
          isActive:       form.isActive,
        });
        if (data.error) return showAlert("error", "Failed", data.error);
        showAlert("success", "Staff Created! 👨‍💼", `${form.name} has been added as staff.`);
      } else {
        // Update
        const body = {
          staffUid:       editTarget.id,
          name:           form.name.trim(),
          role:           form.role.trim(),
          allowedModules: form.allowedModules,
          assignedLocationId: finalLocationId,
          permissions:    form.permissions,
          isActive:       form.isActive,
        };
        if (passwordReset && passwordReset.length >= 8) {
          body.password = passwordReset;
        } else if (passwordReset && passwordReset.length > 0 && passwordReset.length < 8) {
          return showAlert("error", "Weak Password", "New password must be at least 8 characters.");
        }
        const data = await callManage("PATCH", body);
        if (data.error) return showAlert("error", "Failed", data.error);
        showAlert("success", "Updated! ✅", `${form.name}'s details have been updated.`);
      }
      setShowModal(false);
    } catch (err) {
      showAlert("error", "Error", err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle active status ──────────────────────────────────────────────────
  async function toggleActive(staff) {
    try {
      const data = await callManage("PATCH", {
        staffUid: staff.id,
        isActive: !staff.isActive,
      });
      if (data.error) return showAlert("error", "Failed", data.error);
      showAlert(
        "success",
        staff.isActive ? "Deactivated" : "Activated",
        `${staff.name} has been ${staff.isActive ? "deactivated" : "activated"}.`
      );
    } catch (err) {
      showAlert("error", "Error", err.message);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(staffUid) {
    setSaving(true);
    try {
      const data = await callManage("DELETE", { staffUid });
      if (data.error) return showAlert("error", "Failed", data.error);
      showAlert("success", "Removed", "Staff member has been removed.");
    } catch (err) {
      showAlert("error", "Error", err.message);
    } finally {
      setSaving(false);
      setConfirmDelete(null);
    }
  }

  function showAlert(type, title, message) {
    setSaving(false);
    setAlert({ show: true, type, title, message });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-full">
      <SweetAlert
        show={alert.show} type={alert.type} title={alert.title} message={alert.message}
        onClose={() => setAlert(a => ({ ...a, show: false }))}
      />

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-2xl leading-tight">Staff Management</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage your team — create accounts, assign modules, control access.
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:scale-105 flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}>
          <span>➕</span>
          <span className="hidden sm:inline">Add Staff</span>
        </button>
      </div>

      {/* ── Stats strip ── */}
      {staffList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Staff",  value: staffList.length,                              color: "from-blue-500 to-blue-600",    icon: "👥" },
            { label: "Active",       value: staffList.filter(s => s.isActive).length,      color: "from-green-500 to-emerald-600", icon: "✅" },
            { label: "Inactive",     value: staffList.filter(s => !s.isActive).length,     color: "from-gray-500 to-gray-600",     icon: "⏸️" },
            { label: "Roles",        value: new Set(staffList.map(s => s.role || "Staff")).size, color: "from-purple-500 to-violet-600", icon: "🏷️" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg bg-gradient-to-br ${s.color} opacity-90`}>
                {s.icon}
              </div>
              <div>
                <p className="text-white font-black text-xl leading-none">{s.value}</p>
                <p className="text-gray-500 text-[11px] font-medium mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-16 h-16 rounded-full border-4 border-t-blue-500 border-r-purple-500 border-b-blue-500 border-l-transparent animate-spin" />
        </div>
      ) : staffList.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        /* ── Staff Cards Grid ── */
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {staffList.map(staff => (
            <StaffCard
              key={staff.id}
              staff={staff}
              planModules={planModules}
              onEdit={() => openEdit(staff)}
              onToggleActive={() => toggleActive(staff)}
              onDelete={() => setConfirmDelete({ uid: staff.id, name: staff.name })}
              onViewActivity={() => setActivityStaff(staff)}
            />
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <StaffFormModal
          editTarget={editTarget}
          form={form}
          setForm={setForm}
          planModules={planModules}
          saving={saving}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          passwordReset={passwordReset}
          setPasswordReset={setPasswordReset}
          onToggleModule={toggleModule}
          onSelectAll={selectAll}
          onClearAll={clearAll}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
          locations={locations}
        />
      )}

      {/* ── Delete Confirm Modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
          onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: "#0d1117", border: "1.5px solid rgba(239,68,68,0.4)" }}>
            <div style={{ height: 4, background: "linear-gradient(to right,#ef4444,#f97316)" }} />
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                style={{ background: "rgba(239,68,68,0.1)", border: "2px solid rgba(239,68,68,0.3)" }}>
                🗑️
              </div>
              <h3 className="text-white font-black text-lg">Remove Staff Member?</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                <strong className="text-white">{confirmDelete.name}</strong> will be removed and their login access will be revoked immediately.
              </p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                  Cancel
                </button>
                <button onClick={() => handleDelete(confirmDelete.uid)} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Removing..." : "Yes, Remove"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Activity Log Drawer ── */}
      {activityStaff && (
        <ActivityDrawer
          staff={activityStaff}
          adminUid={uid}
          onClose={() => setActivityStaff(null)}
        />
      )}
    </div>
  );
}

// ── Staff Card ────────────────────────────────────────────────────────────────
function StaffCard({ staff, planModules, onEdit, onToggleActive, onDelete, onViewActivity }) {
  const moduleCount = (staff.allowedModules || []).filter(m => planModules.has(m)).length;

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:translate-y-[-2px]"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${staff.isActive ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.07)"}` }}>

      {/* Top accent */}
      <div style={{ height: 3, background: staff.isActive ? "linear-gradient(to right,#2563EB,#7c3aed)" : "linear-gradient(to right,#374151,#4b5563)" }} />

      <div className="p-5 flex-1">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar name={staff.name} size={42} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{staff.name}</p>
            <p className="text-gray-400 text-xs truncate">{staff.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", color: "#c084fc" }}>
                {staff.role || "Staff"}
              </span>
              {/* Assigned Location Badge */}
              {staff.assignedLocationId && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24" }}>
                  📍 Location
                </span>
              )}
            </div>
          </div>
          {/* Active toggle */}
          <button onClick={onToggleActive}
            className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all hover:scale-105"
            style={{
              background: staff.isActive ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.12)",
              border:     staff.isActive ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(107,114,128,0.3)",
              color:      staff.isActive ? "#34d399" : "#6b7280",
            }}
            title={staff.isActive ? "Click to deactivate" : "Click to activate"}>
            {staff.isActive ? "Active" : "Inactive"}
          </button>
        </div>

        {/* Module pills */}
        <div className="mb-4">
          <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-2">
            Modules ({moduleCount})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(staff.allowedModules || []).filter(m => planModules.has(m)).slice(0, 6).map(modId => {
              const mod = ALL_MODULES.find(m => m.id === modId);
              if (!mod) return null;
              return (
                <span key={modId}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)", color: "#93c5fd" }}>
                  {mod.icon} {mod.label}
                </span>
              );
            })}
            {moduleCount > 6 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280" }}>
                +{moduleCount - 6} more
              </span>
            )}
            {moduleCount === 0 && (
              <span className="text-[11px] text-gray-600 italic">No modules assigned</span>
            )}
          </div>
        </div>

        {/* Joined date */}
        <p className="text-gray-600 text-[10px]">
          Added {formatDate(staff.createdAt)}
        </p>
      </div>

      {/* Action bar */}
      <div className="flex border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {[
          { icon: "✏️", label: "Edit",     action: onEdit,           color: "#60a5fa" },
          { icon: "📋", label: "Activity", action: onViewActivity,   color: "#a78bfa" },
          { icon: "🗑️", label: "Remove",   action: onDelete,         color: "#f87171" },
        ].map((btn, i) => (
          <button key={btn.label} onClick={btn.action}
            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all hover:bg-white/5"
            style={{
              color:       btn.color,
              borderLeft:  i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
            <span>{btn.icon}</span>
            <span className="hidden sm:inline">{btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────
function StaffFormModal({
  editTarget, form, setForm, planModules, saving,
  showPassword, setShowPassword, passwordReset, setPasswordReset,
  onToggleModule, onSelectAll, onClearAll, onSubmit, onClose,
  locations = [],
}) {
  const isEdit = Boolean(editTarget);
  const [step, setStep] = useState(1); // 1 = Basic Info + Modules, 2 = Permissions
  
  // Auto-show permissions only for selected modules
  const selectedModulesList = form.allowedModules.filter(m => planModules.has(m));
  const hasPermissionModules = selectedModulesList.some(m => 
    ["invoices", "customers", "inventory", "payments", "purchases"].includes(m)
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden"
        style={{ background: "#0d1117", border: "1.5px solid rgba(37,99,235,0.35)", maxHeight: "90vh" }}>
        {/* Top accent */}
        <div style={{ height: 4, background: "linear-gradient(to right,#2563EB,#7c3aed)", flexShrink: 0 }} />

        {/* Header with Step Indicator */}
        <div className="px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                style={{ background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.25)" }}>
                {isEdit ? "✏️" : "➕"}
              </div>
              <h2 className="text-white font-black text-base">
                {isEdit ? `Edit — ${editTarget.name}` : "Add Staff Member"}
              </h2>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all"
              style={{ color: "#6b7280" }}>✕</button>
          </div>
          
          {/* Step Indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all ${
                step === 1 ? "bg-blue-500 text-white" : "bg-blue-500/30 text-blue-300"
              }`}>1</div>
              <span className={`text-xs font-semibold transition-colors ${
                step === 1 ? "text-white" : "text-gray-500"
              }`}>Basic Info & Modules</span>
            </div>
            <div className="w-8 h-0.5" style={{ background: step === 2 ? "#3b82f6" : "rgba(255,255,255,0.1)" }} />
            <div className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all ${
                step === 2 ? "bg-purple-500 text-white" : "bg-gray-700 text-gray-500"
              }`}>2</div>
              <span className={`text-xs font-semibold transition-colors ${
                step === 2 ? "text-white" : "text-gray-500"
              }`}>Permissions</span>
            </div>
          </div>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* ═══ STEP 1: Basic Info + Modules ═══ */}
          {step === 1 && (
            <>
              {/* Name + Role row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={lbl}>Full Name *</label>
                  <input style={inp} placeholder="Ali Ahmed" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label style={lbl}>Role / Designation</label>
                  <input style={inp} placeholder="Cashier, Manager…" value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
                </div>
              </div>

              {/* Email — readonly on edit */}
              {!isEdit && (
                <div>
                  <label style={lbl}>Email Address *</label>
                  <input style={inp} type="email" placeholder="staff@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
              )}
              {isEdit && (
                <div>
                  <label style={lbl}>Email Address</label>
                  <div style={{ ...inp, color: "#6b7280", cursor: "not-allowed" }}>{editTarget.email}</div>
                </div>
              )}

              {/* Password */}
              {!isEdit ? (
                <div>
                  <label style={lbl}>Password *</label>
                  <div style={{ position: "relative" }}>
                    <input style={{ ...inp, paddingRight: 44 }}
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 8 characters"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label style={lbl}>Reset Password <span style={{ color: "#6b7280", fontWeight: 400 }}>(leave blank to keep current)</span></label>
                  <div style={{ position: "relative" }}>
                    <input style={{ ...inp, paddingRight: 44 }}
                      type={showPassword ? "text" : "password"}
                      placeholder="New password (min 8 chars)"
                      value={passwordReset}
                      onChange={e => setPasswordReset(e.target.value)} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
              )}

              {/* Active toggle */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div>
                  <p className="text-white text-sm font-semibold">Account Status</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {form.isActive ? "Staff can log in and access assigned modules" : "Staff cannot log in"}
                  </p>
                </div>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className="w-12 h-6 rounded-full transition-all flex-shrink-0 relative"
                  style={{ background: form.isActive ? "#2563EB" : "#374151" }}>
                  <span className="absolute top-0.5 transition-all duration-200 w-5 h-5 rounded-full bg-white"
                    style={{ left: form.isActive ? "calc(100% - 22px)" : "2px" }} />
                </button>
              </div>

              {/* Module assignment */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label style={{ ...lbl, marginBottom: 0 }}>Allowed Modules *</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={onSelectAll}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all hover:bg-blue-500/20"
                      style={{ color: "#60a5fa", background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.2)" }}>
                      All
                    </button>
                    <button type="button" onClick={onClearAll}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all hover:bg-gray-500/20"
                      style={{ color: "#9ca3af", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 text-[11px] mb-3">
                  🔒 Greyed modules are not included in your plan. Staff can only access modules your plan allows.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_MODULES.map(mod => (
                    <ModuleChip
                      key={mod.id}
                      mod={mod}
                      checked={form.allowedModules.includes(mod.id)}
                      disabled={!planModules.has(mod.id)}
                      onChange={onToggleModule}
                    />
                  ))}
                </div>
              </div>
              
              {/* Next Button */}
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={onClose}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                  Cancel
                </button>
                {hasPermissionModules ? (
                  <button type="button" onClick={() => setStep(2)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.01]"
                    style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", color: "#fff" }}>
                    Next: Set Permissions →
                  </button>
                ) : (
                  <button type="submit" disabled={saving}
                    className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.01]"
                    style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", color: "#fff", opacity: saving ? 0.7 : 1 }}>
                    {saving ? "Saving…" : isEdit ? "Save Changes →" : "Create Staff →"}
                  </button>
                )}
              </div>
            </>
          )}

          {/* ═══ STEP 2: Permissions ═══ */}
          {step === 2 && (
            <>
              {/* Permissions Header */}
              <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(168,85,247,0.05)", border: "1.5px solid rgba(168,85,247,0.2)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔐</span>
                  <div>
                    <p className="text-purple-300 text-xs font-bold uppercase tracking-widest">Granular Permissions</p>
                    <p className="text-gray-500 text-[10px] mt-0.5">Set detailed access control for selected modules</p>
                  </div>
                </div>
                <p className="text-gray-400 text-[11px]">
                  Selected modules: <span className="text-blue-400 font-semibold">{selectedModulesList.length} modules</span>
                </p>
              </div>

              {/* Invoices Permissions - Only show if selected */}
              {form.allowedModules.includes("invoices") && (
                <div className="mb-4 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">🧾</span>
                    <p className="text-white text-xs font-bold">Invoices</p>
                  </div>
                  
                  {/* View Permission */}
                  <div className="mb-2">
                    <label style={{ ...lbl, fontSize: 10, marginBottom: 4 }}>View Access</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, invoices: { ...f.permissions.invoices, view: "all" } } }))}
                        className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                          background: form.permissions.invoices.view === "all" ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${form.permissions.invoices.view === "all" ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: form.permissions.invoices.view === "all" ? "#93c5fd" : "#6b7280",
                        }}>
                        👁️ All Invoices
                      </button>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, invoices: { ...f.permissions.invoices, view: "own" } } }))}
                        className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                          background: form.permissions.invoices.view === "own" ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${form.permissions.invoices.view === "own" ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: form.permissions.invoices.view === "own" ? "#fbbf24" : "#6b7280",
                        }}>
                        👤 Own Only
                      </button>
                    </div>
                  </div>

                  {/* Create, Edit, Delete */}
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, invoices: { ...f.permissions.invoices, create: !f.permissions.invoices.create } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.invoices.create ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.invoices.create ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.invoices.create ? "#34d399" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.invoices.create ? "✅" : "➕"}</span>
                      <span>Create</span>
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, invoices: { ...f.permissions.invoices, edit: !f.permissions.invoices.edit } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.invoices.edit ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.invoices.edit ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.invoices.edit ? "#60a5fa" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.invoices.edit ? "✅" : "✏️"}</span>
                      <span>Edit</span>
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, invoices: { ...f.permissions.invoices, delete: !f.permissions.invoices.delete } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.invoices.delete ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.invoices.delete ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.invoices.delete ? "#f87171" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.invoices.delete ? "✅" : "🗑️"}</span>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Customers Permissions - Only show if selected */}
              {form.allowedModules.includes("customers") && (
                <div className="mb-4 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">👥</span>
                    <p className="text-white text-xs font-bold">Customers</p>
                  </div>
                  
                  {/* View Permission */}
                  <div className="mb-2">
                    <label style={{ ...lbl, fontSize: 10, marginBottom: 4 }}>View Access</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, customers: { ...f.permissions.customers, view: "all" } } }))}
                        className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                          background: form.permissions.customers.view === "all" ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${form.permissions.customers.view === "all" ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: form.permissions.customers.view === "all" ? "#93c5fd" : "#6b7280",
                        }}>
                        👁️ All Customers
                      </button>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, customers: { ...f.permissions.customers, view: "own" } } }))}
                        className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                          background: form.permissions.customers.view === "own" ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${form.permissions.customers.view === "own" ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: form.permissions.customers.view === "own" ? "#fbbf24" : "#6b7280",
                        }}>
                        👤 Own Only
                      </button>
                    </div>
                  </div>

                  {/* Create, Edit, Delete */}
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, customers: { ...f.permissions.customers, create: !f.permissions.customers.create } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.customers.create ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.customers.create ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.customers.create ? "#34d399" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.customers.create ? "✅" : "➕"}</span>
                      <span>Create</span>
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, customers: { ...f.permissions.customers, edit: !f.permissions.customers.edit } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.customers.edit ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.customers.edit ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.customers.edit ? "#60a5fa" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.customers.edit ? "✅" : "✏️"}</span>
                      <span>Edit</span>
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, customers: { ...f.permissions.customers, delete: !f.permissions.customers.delete } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.customers.delete ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.customers.delete ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.customers.delete ? "#f87171" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.customers.delete ? "✅" : "🗑️"}</span>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Inventory Permissions - Only show if selected */}
              {form.allowedModules.includes("inventory") && (
                <div className="mb-4 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">📦</span>
                    <p className="text-white text-xs font-bold">Inventory</p>
                  </div>
                  
                  {/* View Permission */}
                  <div className="mb-2">
                    <label style={{ ...lbl, fontSize: 10, marginBottom: 4 }}>View Access</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, inventory: { ...f.permissions.inventory, view: "all" } } }))}
                        className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                          background: form.permissions.inventory.view === "all" ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${form.permissions.inventory.view === "all" ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: form.permissions.inventory.view === "all" ? "#93c5fd" : "#6b7280",
                        }}>
                        👁️ All Products
                      </button>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, inventory: { ...f.permissions.inventory, view: "own" } } }))}
                        className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                          background: form.permissions.inventory.view === "own" ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${form.permissions.inventory.view === "own" ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: form.permissions.inventory.view === "own" ? "#fbbf24" : "#6b7280",
                        }}>
                        👤 Own Only
                      </button>
                    </div>
                  </div>

                  {/* Assigned Location - Always visible for inventory module */}
                  <div className="mb-2">
                    <label style={{ ...lbl, fontSize: 10, marginBottom: 4 }}>
                      📍 Assigned Location
                      <span className="ml-2 text-[9px] text-blue-400">(Controls inventory access)</span>
                    </label>
                    <select
                      value={form.assignedLocationId || ""}
                      onChange={(e) => setForm(f => ({ ...f, assignedLocationId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-xs text-white transition-all"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1.5px solid rgba(255,255,255,0.08)",
                      }}>
                      <option value="" style={{ background: "#1a1a1a", color: "#6b7280" }}>
                        🏪 Default Location (Main Shop Only)
                      </option>
                      <option value="__both__" style={{ background: "#1a1a1a", color: "#6b7280" }}>
                        🏪+🏭 Both (Default Shop + All Warehouses)
                      </option>
                      {locations.filter(loc => !loc.deleted).map(loc => (
                        <option key={loc.id} value={loc.id} style={{ background: "#1a1a1a" }}>
                          {loc.type === "warehouse" ? "🏭" : loc.type === "shop" ? "🏪" : "📍"} {loc.name} Only
                        </option>
                      ))}
                    </select>
                    {!form.assignedLocationId && (
                      <p className="text-blue-400 text-[9px] mt-1">
                        ℹ️ Staff will work with <strong>default shop location</strong> only
                      </p>
                    )}
                    {form.assignedLocationId === "__both__" && (
                      <p className="text-green-400 text-[9px] mt-1">
                        ℹ️ Staff will have access to <strong>default shop + all warehouses</strong>
                      </p>
                    )}
                    {form.assignedLocationId && form.assignedLocationId !== "__both__" && (
                      <p className="text-amber-400 text-[9px] mt-1">
                        📍 Staff will only see products from <strong>{locations.find(l => l.id === form.assignedLocationId)?.name || "selected location"}</strong>
                      </p>
                    )}
                  </div>

                  {/* Create, Edit, Delete */}
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, inventory: { ...f.permissions.inventory, create: !f.permissions.inventory.create } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.inventory.create ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.inventory.create ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.inventory.create ? "#34d399" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.inventory.create ? "✅" : "➕"}</span>
                      <span>Create</span>
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, inventory: { ...f.permissions.inventory, edit: !f.permissions.inventory.edit } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.inventory.edit ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.inventory.edit ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.inventory.edit ? "#60a5fa" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.inventory.edit ? "✅" : "✏️"}</span>
                      <span>Edit</span>
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, inventory: { ...f.permissions.inventory, delete: !f.permissions.inventory.delete } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.inventory.delete ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.inventory.delete ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.inventory.delete ? "#f87171" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.inventory.delete ? "✅" : "🗑️"}</span>
                      <span>Delete</span>
                    </button>
                  </div>

                  {/* Can Manage Locations Checkbox */}
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, inventory: { ...f.permissions.inventory, canManageLocations: !f.permissions.inventory.canManageLocations } } }))}
                    className="w-full px-3 py-2 rounded-lg text-[10px] font-semibold transition-all flex items-center justify-center gap-2"
                    style={{
                      background: form.permissions.inventory.canManageLocations ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${form.permissions.inventory.canManageLocations ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: form.permissions.inventory.canManageLocations ? "#c084fc" : "#6b7280",
                    }}>
                    <span className="text-sm">{form.permissions.inventory.canManageLocations ? "✅" : "📍"}</span>
                    <span>Can Manage Locations</span>
                  </button>

                  {/* Show Only Default Location Checkbox */}
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, inventory: { ...f.permissions.inventory, showOnlyDefaultLocation: !f.permissions.inventory.showOnlyDefaultLocation } } }))}
                    className="w-full px-3 py-2 rounded-lg text-[10px] font-semibold transition-all flex items-center justify-center gap-2 mt-2"
                    style={{
                      background: form.permissions.inventory.showOnlyDefaultLocation ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${form.permissions.inventory.showOnlyDefaultLocation ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: form.permissions.inventory.showOnlyDefaultLocation ? "#4ade80" : "#6b7280",
                    }}>
                    <span className="text-sm">{form.permissions.inventory.showOnlyDefaultLocation ? "✅" : "🏠"}</span>
                    <span>Hide Custom Locations (Only show default)</span>
                  </button>
                  {form.permissions.inventory.showOnlyDefaultLocation && (
                    <p className="text-green-400 text-[9px] mt-1 text-center">
                      ℹ️ Staff will only see default inventory location, custom locations will be hidden
                    </p>
                  )}
                </div>
              )}

              {/* Payments Permissions - Only show if selected */}
              {form.allowedModules.includes("payments") && (
                <div className="mb-4 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">💳</span>
                    <p className="text-white text-xs font-bold">Payments</p>
                  </div>
                  
                  {/* View Permission */}
                  <div className="mb-2">
                    <label style={{ ...lbl, fontSize: 10, marginBottom: 4 }}>View Access</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, payments: { ...f.permissions.payments, view: "all" } } }))}
                        className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                          background: form.permissions.payments.view === "all" ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${form.permissions.payments.view === "all" ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: form.permissions.payments.view === "all" ? "#93c5fd" : "#6b7280",
                        }}>
                        👁️ All Payments
                      </button>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, payments: { ...f.permissions.payments, view: "own" } } }))}
                        className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                          background: form.permissions.payments.view === "own" ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${form.permissions.payments.view === "own" ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: form.permissions.payments.view === "own" ? "#fbbf24" : "#6b7280",
                        }}>
                        👤 Own Only
                      </button>
                    </div>
                  </div>

                  {/* Create, Edit, Delete */}
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, payments: { ...f.permissions.payments, create: !f.permissions.payments.create } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.payments.create ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.payments.create ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.payments.create ? "#34d399" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.payments.create ? "✅" : "➕"}</span>
                      <span>Create</span>
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, payments: { ...f.permissions.payments, edit: !f.permissions.payments.edit } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.payments.edit ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.payments.edit ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.payments.edit ? "#60a5fa" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.payments.edit ? "✅" : "✏️"}</span>
                      <span>Edit</span>
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, payments: { ...f.permissions.payments, delete: !f.permissions.payments.delete } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.payments.delete ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.payments.delete ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.payments.delete ? "#f87171" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.payments.delete ? "✅" : "🗑️"}</span>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Purchases Permissions - Only show if selected */}
              {form.allowedModules.includes("purchases") && (
                <div className="mb-4 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">🛒</span>
                    <p className="text-white text-xs font-bold">Purchases</p>
                  </div>
                  
                  {/* View Permission */}
                  <div className="mb-2">
                    <label style={{ ...lbl, fontSize: 10, marginBottom: 4 }}>View Access</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, purchases: { ...f.permissions.purchases, view: "all" } } }))}
                        className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                          background: form.permissions.purchases.view === "all" ? "rgba(37,99,235,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${form.permissions.purchases.view === "all" ? "rgba(37,99,235,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: form.permissions.purchases.view === "all" ? "#93c5fd" : "#6b7280",
                        }}>
                        👁️ All Purchases
                      </button>
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, purchases: { ...f.permissions.purchases, view: "own" } } }))}
                        className="px-3 py-2 rounded-lg text-[11px] font-semibold transition-all"
                        style={{
                          background: form.permissions.purchases.view === "own" ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${form.permissions.purchases.view === "own" ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: form.permissions.purchases.view === "own" ? "#fbbf24" : "#6b7280",
                        }}>
                        👤 Own Only
                      </button>
                    </div>
                  </div>

                  {/* Create, Edit, Delete */}
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, purchases: { ...f.permissions.purchases, create: !f.permissions.purchases.create } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.purchases.create ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.purchases.create ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.purchases.create ? "#34d399" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.purchases.create ? "✅" : "➕"}</span>
                      <span>Create</span>
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, purchases: { ...f.permissions.purchases, edit: !f.permissions.purchases.edit } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.purchases.edit ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.purchases.edit ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.purchases.edit ? "#60a5fa" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.purchases.edit ? "✅" : "✏️"}</span>
                      <span>Edit</span>
                    </button>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, permissions: { ...f.permissions, purchases: { ...f.permissions.purchases, delete: !f.permissions.purchases.delete } } }))}
                      className="px-2 py-2 rounded-lg text-[10px] font-semibold transition-all flex flex-col items-center gap-1"
                      style={{
                        background: form.permissions.purchases.delete ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${form.permissions.purchases.delete ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
                        color: form.permissions.purchases.delete ? "#f87171" : "#6b7280",
                      }}>
                      <span className="text-sm">{form.permissions.purchases.delete ? "✅" : "🗑️"}</span>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}
          
          {/* Back and Submit Buttons for Step 2 */}
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={() => setStep(1)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
              ← Back
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg,#2563EB,#1d4ed8)", color: "#fff", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : isEdit ? "Save Changes →" : "Create Staff →"}
            </button>
          </div>
            </>
          )}

        </form>
      </div>
    </div>
  );
}

// ── Activity Log Drawer ───────────────────────────────────────────────────────
function ActivityDrawer({ staff, adminUid, onClose }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);

  // Load activity logs from the staff member's own activityLogs subcollection
  // (stored under users/{staffUid}/activityLogs — same pattern as admin)
  useEffect(() => {
    if (!staff?.id) return;
    let cancelled = false;
    async function load() {
      try {
        const { collection: col, query: q, orderBy: ob, getDocs, limit } = await import("firebase/firestore");
        const { db: fdb } = await import("@/lib/firebase");
        const snap = await getDocs(
          q(col(fdb, "users", staff.id, "activityLogs"), ob("timestamp", "desc"), limit(30))
        );
        if (!cancelled) {
          setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [staff?.id]);

  return (
    <div className="fixed inset-0 z-[100] flex justify-end"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="h-full w-full max-w-sm flex flex-col"
        style={{ background: "#0d1117", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <Avatar name={staff.name} size={38} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{staff.name}</p>
            <p className="text-gray-500 text-xs">Activity Log</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10"
            style={{ color: "#6b7280" }}>✕</button>
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 rounded-full border-2 border-t-blue-500 border-r-purple-500 border-b-transparent border-l-transparent animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-500 text-sm">No activity recorded yet.</p>
              <p className="text-gray-600 text-xs mt-1">Activity will appear here once this staff member logs in.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {logs.map(log => (
                <div key={log.id}
                  className="px-4 py-3 rounded-xl flex items-start gap-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {log.type === "login" ? "🔐" : log.type === "logout" ? "🚪" : "📋"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold capitalize">{log.type || "Activity"}</p>
                    {log.browser && (
                      <p className="text-gray-500 text-[11px] truncate mt-0.5">
                        {log.browser} · {log.device}
                      </p>
                    )}
                    {log.ip && (
                      <p className="text-gray-600 text-[10px]">IP: {log.ip}</p>
                    )}
                    <p className="text-gray-600 text-[10px] mt-1">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString("en-PK", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      }) : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="px-5 py-3 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-gray-600 text-[10px] text-center">Showing last 30 activities</p>
        </div>
      </div>
    </div>
  );
}
