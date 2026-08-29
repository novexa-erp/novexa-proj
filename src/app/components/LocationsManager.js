"use client";
import { useState, useEffect } from "react";
import {
  collection, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import SweetAlert from "./SweetAlert";

const cardStyle = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
  border: "1px solid rgba(255,255,255,0.1)",
  backdropFilter: "blur(12px)",
};

const base = {
  width: "100%", outline: "none",
  background: "rgba(255,255,255,0.04)",
  borderWidth: "1.5px", borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.09)",
  borderRadius: 10, padding: "9px 13px",
  color: "#fff", fontSize: 13,
  transition: "border-color .2s, background .2s",
};

const LOCATION_TYPES = [
  { id: "shop",      label: "Shop",      icon: "🏪", color: "from-amber-500 to-orange-600" },
  { id: "warehouse", label: "Warehouse", icon: "🏭", color: "from-blue-500 to-cyan-600"   },
  { id: "other",     label: "Other",     icon: "📍", color: "from-purple-500 to-pink-600" },
];

export function getLocationIcon(type) {
  return LOCATION_TYPES.find(t => t.id === type)?.icon || "📍";
}

export function getLocationLabel(type) {
  return LOCATION_TYPES.find(t => t.id === type)?.label || "Location";
}

// ── Add/Edit Location Modal ────────────────────────────────────────────────────
function LocationModal({ location, onSave, onClose }) {
  const [form, setForm] = useState({
    name:    location?.name    || "",
    type:    location?.type    || "shop",
    address: location?.address || "",
    notes:   location?.notes   || "",
  });
  const [saving, setSaving] = useState(false);

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave({ ...form, name: form.name.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-md rounded-2xl flex flex-col gap-0 overflow-hidden"
        style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-white font-bold text-base">
            {location ? "Edit Location" : "Add New Location"}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          {/* Type Selection */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Location Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {LOCATION_TYPES.map(lt => (
                <button key={lt.id} type="button"
                  onClick={() => set("type", lt.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl font-semibold text-xs transition-all ${
                    form.type === lt.id ? "scale-105" : "opacity-60 hover:opacity-80"
                  }`}
                  style={{
                    background: form.type === lt.id
                      ? "rgba(245,158,11,0.15)"
                      : "rgba(255,255,255,0.04)",
                    border: `1.5px solid ${form.type === lt.id ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`,
                    color: form.type === lt.id ? "#f59e0b" : "#9ca3af",
                  }}>
                  <span className="text-xl">{lt.icon}</span>
                  <span>{lt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Location Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder={`e.g. ${form.type === "shop" ? "Main Shop" : form.type === "warehouse" ? "Warehouse A" : "Storage Unit"}`}
              value={form.name}
              onChange={e => set("name", e.target.value)}
              required
              autoFocus
              style={base}
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Address / Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Main Bazaar, Block 5..."
              value={form.address}
              onChange={e => set("address", e.target.value)}
              style={base}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
              Cancel
            </button>
            <button type="submit" disabled={!form.name.trim() || saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#000" }}>
              {saving ? "Saving..." : location ? "Update" : "Add Location"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main LocationsManager ──────────────────────────────────────────────────────
export default function LocationsManager({ uid, locations, userDoc, onClose }) {
  const [showModal, setShowModal]   = useState(false);
  const [editLoc,   setEditLoc]     = useState(null);
  const [deleteConf, setDeleteConf] = useState(null);
  const [alert, setAlert] = useState({ show: false, type: "", title: "", message: "" });
  const [planConfig, setPlanConfig] = useState(null); // Firestore plan config

  // Fetch plan config from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "adminConfig", "plans"),
      (snap) => {
        if (snap.exists()) {
          const list = snap.data().list || [];
          const config = {};
          list.forEach(p => { config[p.id] = p; });
          setPlanConfig(config);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  // Get location limit based on plan (from Firestore or fallback)
  function getLocationLimit(plan) {
    // Try to get from Firestore first
    if (planConfig && planConfig[plan]?.maxLocations !== undefined) {
      return planConfig[plan].maxLocations;
    }
    // Fallback to hardcoded
    const limits = {
      starter:      0,
      business:     1,
      professional: 2,
      enterprise:   4,
    };
    return limits[plan] || 0;
  }

  const currentPlan = userDoc?.plan || "starter";
  const locationLimit = getLocationLimit(currentPlan);
  const activeLocations = (locations || []).filter(l => !l.deleted);
  // Count only non-default locations (warehouses)
  const warehouseCount = activeLocations.filter(l => !l.isDefault && l.id !== "default").length;
  const canAddLocation = warehouseCount < locationLimit;

  function openAddModal() {
    if (!canAddLocation) {
      setAlert({ 
        show: true, 
        type: "error", 
        title: "Location Limit Reached", 
        message: `Your ${currentPlan} plan allows maximum ${locationLimit} warehouse location${locationLimit !== 1 ? 's' : ''} (excluding default). Upgrade your plan to add more locations.`
      });
      return;
    }
    setShowModal(true);
  }

  async function handleSave(data) {
    // Double-check limit on save (in case of race condition)
    if (!editLoc && !canAddLocation) {
      setAlert({ 
        show: true, 
        type: "error", 
        title: "Location Limit Reached", 
        message: `Your ${currentPlan} plan allows maximum ${locationLimit} warehouse location${locationLimit !== 1 ? 's' : ''}.`
      });
      setShowModal(false);
      return;
    }

    try {
      if (editLoc) {
        await updateDoc(doc(db, "users", uid, "locations", editLoc.id), {
          ...data, updatedAt: serverTimestamp(),
        });
        setShowModal(false);
        setEditLoc(null);
        setAlert({ show: true, type: "success", title: "Location Updated! ✓", message: `"${data.name}" has been updated.` });
      } else {
        await addDoc(collection(db, "users", uid, "locations"), {
          ...data, createdAt: serverTimestamp(),
        });
        setShowModal(false);
        setEditLoc(null);
        setAlert({ show: true, type: "success", title: "Location Added! 📍", message: `"${data.name}" has been added.` });
      }
    } catch (err) {
      console.error("Location save error:", err);
      setAlert({ show: true, type: "error", title: "Error", message: err.message || "Kuch masla hua. Dobara try karein." });
      // modal band mat karo — user retry kar sake
    }
  }

  async function handleDelete(loc) {
    try {
      await updateDoc(doc(db, "users", uid, "locations", loc.id), {
        deleted: true, deletedAt: serverTimestamp(),
      });
      setAlert({ show: true, type: "success", title: "Removed! 🗑️", message: `"${loc.name}" has been removed.` });
    } catch (err) {
      setAlert({ show: true, type: "error", title: "Error", message: err.message });
    }
    setDeleteConf(null);
  }

  return (
    <>
      <SweetAlert
        show={alert.show}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert(a => ({ ...a, show: false }))}
      />

      {/* Delete Confirm */}
      {deleteConf && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 text-center"
            style={{ background: "#0d1117", border: "1px solid rgba(248,113,113,0.3)" }}>
            <p className="text-4xl">🗑️</p>
            <h3 className="text-white font-bold text-lg">Remove Location?</h3>
            <p className="text-gray-400 text-sm">
              <span className="text-white font-semibold">&quot;{deleteConf.name}&quot;</span> ko remove karein?
              Products jinka yeh location tha, unka location blank ho jayega.
            </p>
            <div className="flex gap-3 mt-1">
              <button onClick={() => setDeleteConf(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConf)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <LocationModal
          location={editLoc}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditLoc(null); }}
        />
      )}

      {/* Panel */}
      <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}>
        <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden"
          style={{
            background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            maxHeight: "85vh",
          }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div>
              <h3 className="text-white font-bold text-base">📍 Locations</h3>
              <p className="text-gray-500 text-[11px] mt-0.5">
                Warehouses: <span className={warehouseCount >= locationLimit ? "text-red-400" : "text-blue-400"}>
                  {warehouseCount}/{locationLimit}
                </span>
                {!canAddLocation && <span className="text-amber-400 ml-2">⚠️ Limit reached</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openAddModal}
                disabled={!canAddLocation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ 
                  background: canAddLocation ? "linear-gradient(135deg, #F59E0B, #D97706)" : "rgba(107,114,128,0.3)", 
                  color: canAddLocation ? "#000" : "#6b7280",
                  opacity: canAddLocation ? 1 : 0.6,
                  cursor: canAddLocation ? "pointer" : "not-allowed",
                }}>
                + Add
              </button>
              <button onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                ✕
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
            {activeLocations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-5xl mb-3">📍</p>
                <p className="text-white font-semibold mb-1">Koi location nahi hai</p>
                <p className="text-gray-500 text-sm">Add karein apni shop ya warehouse</p>
                <button
                  onClick={() => { setEditLoc(null); setShowModal(true); }}
                  className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "#000" }}>
                  + Add First Location
                </button>
              </div>
            ) : (
              activeLocations.map(loc => {
                const typeInfo = LOCATION_TYPES.find(t => t.id === loc.type) || LOCATION_TYPES[0];
                return (
                  <div key={loc.id}
                    className="flex items-center gap-3 rounded-xl p-4"
                    style={cardStyle}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${typeInfo.color} bg-opacity-20`}
                      style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                      <span className="text-xl">{typeInfo.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-white font-semibold text-sm truncate">{loc.name}</p>
                        {loc.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                            style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24" }}>
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-[11px]">
                        {typeInfo.label}{loc.address ? ` · ${loc.address}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => { setEditLoc(loc); setShowModal(true); }}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-105"
                        style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }}>
                        Edit
                      </button>
                      {!loc.isDefault && (
                        <button
                          onClick={() => setDeleteConf(loc)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-105"
                          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
