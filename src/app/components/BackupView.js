"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  collection, getDocs, doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { encryptJson, decryptFile, isEncryptedFile, encryptedFileName } from "@/lib/backupCrypto";

// ── Collections to backup ────────────────────────────────────────────────────
const FLAT_COLLECTIONS = [
  { id: "invoices",         label: "Invoices",          icon: "🧾" },
  { id: "customers",        label: "Customers",         icon: "👥" },
  { id: "products",         label: "Inventory",         icon: "📦" },
  { id: "payments",         label: "Payments",          icon: "💳" },
  { id: "purchases",        label: "Purchases",         icon: "🛒" },
  { id: "suppliers",        label: "Suppliers",         icon: "🏭" },
  { id: "supplierPayments", label: "Supplier Payments", icon: "💰" },
  { id: "supplierReceipts", label: "Supplier Receipts", icon: "📄" },
  { id: "supplierReturns",  label: "Supplier Returns",  icon: "↩️" },
  { id: "expenses",         label: "Expenses",          icon: "📉" },
  { id: "quotations",       label: "Quotations",        icon: "📝" },
];
const SUPPLIER_NESTED = ["orders", "payments", "receipts", "returns"];
const CUSTOMER_NESTED = ["invoices"];

// ── Auto-backup interval options ─────────────────────────────────────────────
const AUTO_INTERVALS = [
  { id: "1h",      label: "Every 1 Hour",    ms: 1 * 60 * 60 * 1000 },
  { id: "6h",      label: "Every 6 Hours",   ms: 6 * 60 * 60 * 1000 },
  { id: "12h",     label: "Every 12 Hours",  ms: 12 * 60 * 60 * 1000 },
  { id: "daily",   label: "Daily (24 hrs)",  ms: 24 * 60 * 60 * 1000 },
  { id: "weekly",  label: "Weekly",          ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "monthly", label: "Monthly (30d)",   ms: 30 * 24 * 60 * 60 * 1000 },
];

// ── Shared style tokens ───────────────────────────────────────────────────────
const cardS = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" };

function SECT({ title, color = "#F59E0B", children }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="pb-2 border-b border-white/10">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color }}>{title}</p>
      </div>
      {children}
    </div>
  );
}

// ── Serialise Firestore doc → plain JSON ─────────────────────────────────────
function serializeDoc(id, data) {
  const out = { _id: id };
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v.toDate === "function") {
      out[k] = { _type: "Timestamp", _ms: v.toDate().getTime() };
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── Deserialise back (Timestamps → Date) ─────────────────────────────────────
function deserializeDoc(obj) {
  const { _id, ...rest } = obj;
  const out = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v && typeof v === "object" && v._type === "Timestamp") {
      out[k] = new Date(v._ms);
    } else {
      out[k] = v;
    }
  }
  return { id: _id, data: out };
}

// ── IndexedDB helpers ────────────────────────────────────────────────────────
const IDB_NAME  = "novexa_backup";
const IDB_STORE = "handles";
const IDB_KEY_DIR     = "backupDirHandle";
const IDB_KEY_AUTO    = "autoBackupSettings";   // { intervalId, nextAt }
const IDB_KEY_HISTORY = "backupHistory";         // array of history entries

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 2);
    req.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains(IDB_STORE))
        idb.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPut(key, value) {
  try {
    const idb = await openIDB();
    const tx  = idb.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch { /* non-critical */ }
}

async function idbGet(key) {
  try {
    const idb = await openIDB();
    const tx  = idb.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    return await new Promise((res) => { req.onsuccess = () => res(req.result ?? null); req.onerror = () => res(null); });
  } catch { return null; }
}

async function idbDel(key) {
  try {
    const idb = await openIDB();
    const tx  = idb.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
  } catch { /* non-critical */ }
}

// Convenience wrappers
const saveDirHandle    = (h)  => idbPut(IDB_KEY_DIR, h);
const loadDirHandle    = ()   => idbGet(IDB_KEY_DIR);
const clearDirHandle   = ()   => idbDel(IDB_KEY_DIR);
const saveAutoSettings = (v)  => idbPut(IDB_KEY_AUTO, v);
const loadAutoSettings = ()   => idbGet(IDB_KEY_AUTO);
const clearAutoSettings= ()   => idbDel(IDB_KEY_AUTO);

// ── History helpers (kept in IndexedDB, max 50 entries) ───────────────────────
async function loadHistory() {
  const h = await idbGet(IDB_KEY_HISTORY);
  return Array.isArray(h) ? h : [];
}

async function addHistoryEntry(entry) {
  // entry: { at, fileName, docCount, type }  type: "manual" | "auto"
  const history = await loadHistory();
  history.unshift(entry);
  if (history.length > 50) history.length = 50;
  await idbPut(IDB_KEY_HISTORY, history);
  return history;
}

async function clearHistory() {
  await idbDel(IDB_KEY_HISTORY);
}

// ── Export ───────────────────────────────────────────────────────────────────
async function exportUserData(uid, onProgress) {
  const backup = { version: 2, exportedAt: new Date().toISOString(), uid, collections: {} };
  const total = FLAT_COLLECTIONS.length + 2;
  let done = 0;

  for (const col of FLAT_COLLECTIONS) {
    onProgress(`Reading ${col.label}...`, Math.round((done / total) * 100));
    const snap = await getDocs(collection(db, "users", uid, col.id));
    backup.collections[col.id] = snap.docs.map(d => serializeDoc(d.id, d.data()));
    done++;
  }

  onProgress("Reading customer invoices...", Math.round((done / total) * 100));
  backup.customerNested = {};
  const custSnap = await getDocs(collection(db, "users", uid, "customers"));
  for (const custDoc of custSnap.docs) {
    backup.customerNested[custDoc.id] = {};
    for (const sub of CUSTOMER_NESTED) {
      const subSnap = await getDocs(collection(db, "users", uid, "customers", custDoc.id, sub));
      if (subSnap.docs.length > 0)
        backup.customerNested[custDoc.id][sub] = subSnap.docs.map(d => serializeDoc(d.id, d.data()));
    }
  }
  done++;

  onProgress("Reading supplier data...", Math.round((done / total) * 100));
  backup.supplierNested = {};
  const supSnap = await getDocs(collection(db, "users", uid, "suppliers"));
  for (const supDoc of supSnap.docs) {
    backup.supplierNested[supDoc.id] = {};
    for (const sub of SUPPLIER_NESTED) {
      const subSnap = await getDocs(collection(db, "users", uid, "suppliers", supDoc.id, sub));
      if (subSnap.docs.length > 0)
        backup.supplierNested[supDoc.id][sub] = subSnap.docs.map(d => serializeDoc(d.id, d.data()));
    }
  }
  done++;
  onProgress("Backup ready!", 100);
  return backup;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function countDocs(data) {
  let n = 0;
  Object.values(data.collections).forEach(arr => { n += arr.length; });
  if (data.customerNested) Object.values(data.customerNested).forEach(subs =>
    Object.values(subs).forEach(arr => { n += arr.length; }));
  if (data.supplierNested) Object.values(data.supplierNested).forEach(subs =>
    Object.values(subs).forEach(arr => { n += arr.length; }));
  return n;
}

function makeFileName() {
  const now     = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "-");
  return `novexa-backup-${dateStr}_${timeStr}.json`;
}

// ── Batch helpers ─────────────────────────────────────────────────────────────
async function batchWrite(writes) {
  let batch = writeBatch(db);
  let count = 0;
  for (const { ref, data } of writes) {
    batch.set(ref, data, { merge: false });
    count++;
    if (count === 490) { await batch.commit(); batch = writeBatch(db); count = 0; }
  }
  if (count > 0) await batch.commit();
}

async function batchDelete(refs) {
  let batch = writeBatch(db);
  let count = 0;
  for (const ref of refs) {
    batch.delete(ref);
    count++;
    if (count === 490) { await batch.commit(); batch = writeBatch(db); count = 0; }
  }
  if (count > 0) await batch.commit();
}

// ── Restore ───────────────────────────────────────────────────────────────────
async function restoreUserData(uid, backup, mode, onProgress) {
  if (!backup?.version || !backup?.collections)
    throw new Error("Invalid backup file format.");
  if (backup.uid && backup.uid !== uid)
    throw new Error("This backup belongs to a different account. Restore cancelled.");

  const backupDate = backup.exportedAt ? new Date(backup.exportedAt) : new Date(0);
  const allCols    = Object.keys(backup.collections);
  const total      = allCols.length + 2;
  let done         = 0;

  for (const colId of allCols) {
    const colLabel = FLAT_COLLECTIONS.find(c => c.id === colId)?.label || colId;
    onProgress(`Restoring ${colLabel}...`, Math.round((done / total) * 100));
    const backupDocs = backup.collections[colId] || [];
    const backupIds  = new Set(backupDocs.map(d => d._id));

    if (mode === "replace") {
      const liveSnap = await getDocs(collection(db, "users", uid, colId));
      const toDelete = liveSnap.docs.filter(d => !backupIds.has(d.id))
        .map(d => doc(db, "users", uid, colId, d.id));
      if (toDelete.length) await batchDelete(toDelete);
    } else {
      const liveSnap = await getDocs(collection(db, "users", uid, colId));
      const toDelete = liveSnap.docs.filter(d => {
        if (backupIds.has(d.id)) return false;
        const ct = d.data().createdAt;
        const ms = ct?.toDate ? ct.toDate().getTime() : ct ? new Date(ct).getTime() : 0;
        return ms <= backupDate.getTime();
      }).map(d => doc(db, "users", uid, colId, d.id));
      if (toDelete.length) await batchDelete(toDelete);
    }
    const writes = backupDocs.map(raw => {
      const { id, data } = deserializeDoc(raw);
      return { ref: doc(db, "users", uid, colId, id), data };
    });
    if (writes.length) await batchWrite(writes);
    done++;
  }

  onProgress("Restoring customer invoices...", Math.round((done / total) * 100));
  if (backup.customerNested) {
    for (const [custId, subs] of Object.entries(backup.customerNested)) {
      for (const [sub, docs] of Object.entries(subs || {})) {
        const backupIds = new Set(docs.map(d => d._id));
        if (mode === "replace") {
          const liveSnap = await getDocs(collection(db, "users", uid, "customers", custId, sub));
          const toDelete = liveSnap.docs.filter(d => !backupIds.has(d.id))
            .map(d => doc(db, "users", uid, "customers", custId, sub, d.id));
          if (toDelete.length) await batchDelete(toDelete);
        } else {
          const liveSnap = await getDocs(collection(db, "users", uid, "customers", custId, sub));
          const toDelete = liveSnap.docs.filter(d => {
            if (backupIds.has(d.id)) return false;
            const ct = d.data().createdAt;
            const ms = ct?.toDate ? ct.toDate().getTime() : ct ? new Date(ct).getTime() : 0;
            return ms <= backupDate.getTime();
          }).map(d => doc(db, "users", uid, "customers", custId, sub, d.id));
          if (toDelete.length) await batchDelete(toDelete);
        }
        const writes = docs.map(raw => {
          const { id, data } = deserializeDoc(raw);
          return { ref: doc(db, "users", uid, "customers", custId, sub, id), data };
        });
        if (writes.length) await batchWrite(writes);
      }
    }
  }
  done++;

  onProgress("Restoring supplier data...", Math.round((done / total) * 100));
  if (backup.supplierNested) {
    for (const [supId, subs] of Object.entries(backup.supplierNested)) {
      for (const [sub, docs] of Object.entries(subs || {})) {
        const backupIds = new Set(docs.map(d => d._id));
        if (mode === "replace") {
          const liveSnap = await getDocs(collection(db, "users", uid, "suppliers", supId, sub));
          const toDelete = liveSnap.docs.filter(d => !backupIds.has(d.id))
            .map(d => doc(db, "users", uid, "suppliers", supId, sub, d.id));
          if (toDelete.length) await batchDelete(toDelete);
        } else {
          const liveSnap = await getDocs(collection(db, "users", uid, "suppliers", supId, sub));
          const toDelete = liveSnap.docs.filter(d => {
            if (backupIds.has(d.id)) return false;
            const ct = d.data().createdAt;
            const ms = ct?.toDate ? ct.toDate().getTime() : ct ? new Date(ct).getTime() : 0;
            return ms <= backupDate.getTime();
          }).map(d => doc(db, "users", uid, "suppliers", supId, sub, d.id));
          if (toDelete.length) await batchDelete(toDelete);
        }
        const writes = docs.map(raw => {
          const { id, data } = deserializeDoc(raw);
          return { ref: doc(db, "users", uid, "suppliers", supId, sub, id), data };
        });
        if (writes.length) await batchWrite(writes);
      }
    }
  }
  done++;
  onProgress("Restore complete!", 100);
}

export default function BackupView({ uid }) {
  const fileInputRef = useRef(null);

  // ── Export state ──────────────────────────────────────────────────────────
  const [exporting,   setExporting]   = useState(false);
  const [exportMsg,   setExportMsg]   = useState({ type: "", text: "" });
  const [exportProg,  setExportProg]  = useState(0);
  const [exportLabel, setExportLabel] = useState("");

  // ── Folder handle ─────────────────────────────────────────────────────────
  const [savedHandle,     setSavedHandle]     = useState(null);
  const [savedFolderName, setSavedFolderName] = useState("");
  const [folderPromptStep, setFolderPromptStep] = useState(null);
  // "auto" | "manual" — which flow triggered the folder prompt
  const folderPromptTypeRef = useRef("manual");
  const pendingJsonRef = useRef(null); // { json, fileName, totalDocs, type }

  // ── Restore state ─────────────────────────────────────────────────────────
  const [restoring,    setRestoring]    = useState(false);
  const [restoreMsg,   setRestoreMsg]   = useState({ type: "", text: "" });
  const [restoreProg,  setRestoreProg]  = useState(0);
  const [restoreLabel, setRestoreLabel] = useState("");
  const [modalStep,    setModalStep]    = useState(null);
  const [pendingFile,  setPendingFile]  = useState(null);
  const [fileInfo,     setFileInfo]     = useState(null);

  // ── Auto-backup state ─────────────────────────────────────────────────────
  const [autoEnabled,    setAutoEnabled]    = useState(false);
  const [autoIntervalId, setAutoIntervalId] = useState("daily");
  const [autoNextAt,     setAutoNextAt]     = useState(null);   // ms timestamp
  const [autoMsg,        setAutoMsg]        = useState({ type: "", text: "" });
  const [countdown,      setCountdown]      = useState("");
  // "ask-dest" modal for auto-backup destination choice
  const [autoDestModal,  setAutoDestModal]  = useState(false);
  const autoTimerRef   = useRef(null);   // setInterval handle
  const autoNextAtRef  = useRef(null);   // mirror of autoNextAt for interval closure

  // ── History ───────────────────────────────────────────────────────────────
  const [history,      setHistory]      = useState([]);

  // ── Password protection ───────────────────────────────────────────────────
  // "idle" | "ask" | "set" | "enter"
  const [pwModal,      setPwModal]      = useState("idle");
  const [pwInput,      setPwInput]      = useState("");
  const [pwConfirm,    setPwConfirm]    = useState("");
  const [pwShow,       setPwShow]       = useState(false);
  const [pwError,      setPwError]      = useState("");
  // held while modal is open
  const pwPendingRef   = useRef(null); // { dirHandle, json, fileName, totalDocs, type }
  // held for decrypt during restore
  const pwRestoreRef   = useRef(null); // { rawBuffer, fileName }

  // ── Formatters ────────────────────────────────────────────────────────────
  const fmtDate = (iso) => iso
    ? new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  function fmtCountdown(ms) {
    if (ms <= 0) return "now";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }

  // ── Core write-to-dir (shared by manual + auto) ───────────────────────────
  async function writeToDir(dirHandle, json, fileName) {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable   = await fileHandle.createWritable();
    await writable.write(json);
    await writable.close();
  }

  // ── Password-protected write ───────────────────────────────────────────────
  // Saves encrypted as .novexa; caller gets final fileName back
  async function writeToDirEncrypted(dirHandle, json, baseFileName, password) {
    const encFileName = encryptedFileName(baseFileName);
    const buffer      = await encryptJson(json, password);
    const fileHandle  = await dirHandle.getFileHandle(encFileName, { create: true });
    const writable    = await fileHandle.createWritable();
    await writable.write(buffer);
    await writable.close();
    return encFileName;
  }

  // ── Ask password then write ────────────────────────────────────────────────
  // Opens the "ask" modal; after confirm → writes and records history
  function askPasswordThenWrite(dirHandle, json, fileName, totalDocs, type) {
    pwPendingRef.current = { dirHandle, json, fileName, totalDocs, type };
    setPwInput(""); setPwConfirm(""); setPwError(""); setPwShow(false);
    setPwModal("ask");
  }

  // Called when user clicks "Yes, protect" in the ask modal
  function handleAskYes() { setPwModal("set"); }

  // Called when user clicks "Skip, no password"
  async function handleAskSkip() {
    setPwModal("idle");
    const { dirHandle, json, fileName, totalDocs, type } = pwPendingRef.current || {};
    if (!json) return;
    setExporting(true);
    try {
      await writeToDir(dirHandle, json, fileName);
      setExportMsg({ type: "success", text: `✅ Saved to "${dirHandle.name}" — ${totalDocs?.toLocaleString()} records.` });
      await recordHistory(fileName, totalDocs, type || "manual");
    } catch (err) {
      setExportMsg({ type: "error", text: "Save failed: " + err.message });
    }
    setExporting(false); pwPendingRef.current = null;
  }

  // Called when user confirms their password in the "set" modal
  async function handlePwSet() {
    if (!pwInput) { setPwError("Please enter a password."); return; }
    if (pwInput !== pwConfirm) { setPwError("Passwords don't match."); return; }
    if (pwInput.length < 6) { setPwError("Password must be at least 6 characters."); return; }
    setPwModal("idle");
    const { dirHandle, json, fileName, totalDocs, type } = pwPendingRef.current || {};
    if (!json) return;
    setExporting(true);
    try {
      const savedName = await writeToDirEncrypted(dirHandle, json, fileName, pwInput);
      setExportMsg({
        type: "success",
        text: `🔐 Encrypted backup saved as "${savedName}" (${totalDocs?.toLocaleString()} records). Open it only via "Select Backup File" on this page — Notepad/Windows will show unreadable text.`,
      });
      await recordHistory(savedName, totalDocs, type || "manual");
    } catch (err) {
      setExportMsg({ type: "error", text: "Encrypted save failed: " + err.message });
    }
    setExporting(false); pwPendingRef.current = null;
    setPwInput(""); setPwConfirm("");
  }

  // ── Add to history ────────────────────────────────────────────────────────
  async function recordHistory(fileName, docCount, type) {
    const entry = { at: new Date().toISOString(), fileName, docCount, type };
    const updated = await addHistoryEntry(entry);
    setHistory(updated);
  }

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    // folder handle
    if ("showDirectoryPicker" in window) {
      loadDirHandle().then(handle => {
        if (handle) { setSavedHandle(handle); setSavedFolderName(handle.name || "Saved Folder"); }
      });
    }
    // auto settings
    loadAutoSettings().then(s => {
      if (s?.intervalId) {
        setAutoEnabled(true);
        setAutoIntervalId(s.intervalId);
        setAutoNextAt(s.nextAt);
        autoNextAtRef.current = s.nextAt;
      }
    });
    // history
    loadHistory().then(h => setHistory(h));
  }, []);

  // ── Auto-backup runner (runs a backup silently) ───────────────────────────
  const runAutoBackup = useCallback(async () => {
    if (!savedHandle && !savedFolderName) return; // no destination — skip silently
    const dirHandle = savedHandle;
    if (!dirHandle) return;
    try {
      const perm = await dirHandle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") return;
      const data     = await exportUserData(uid, () => {});
      const total    = countDocs(data);
      const json     = JSON.stringify(data, null, 2);
      const fileName = makeFileName();
      await writeToDir(dirHandle, json, fileName);
      await recordHistory(fileName, total, "auto");
      setAutoMsg({ type: "success", text: `Auto backup saved: ${fileName}` });
    } catch (err) {
      setAutoMsg({ type: "error", text: "Auto backup failed: " + err.message });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, savedHandle]);

  // ── Auto-backup scheduler ─────────────────────────────────────────────────
  useEffect(() => {
    if (autoTimerRef.current) { clearInterval(autoTimerRef.current); autoTimerRef.current = null; }
    if (!autoEnabled || !autoNextAt) { setCountdown(""); return; }

    const tick = () => {
      const remaining = (autoNextAtRef.current || 0) - Date.now();
      setCountdown(fmtCountdown(remaining));
      if (remaining <= 0) {
        // fire backup
        runAutoBackup();
        // schedule next
        const intervalMs = AUTO_INTERVALS.find(i => i.id === autoIntervalId)?.ms || 24 * 3600 * 1000;
        const nextAt = Date.now() + intervalMs;
        autoNextAtRef.current = nextAt;
        setAutoNextAt(nextAt);
        saveAutoSettings({ intervalId: autoIntervalId, nextAt });
      }
    };

    tick();
    autoTimerRef.current = setInterval(tick, 1000);
    return () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnabled, autoNextAt, autoIntervalId]);

  // ── Enable auto-backup ────────────────────────────────────────────────────
  function handleEnableAuto() {
    if (!("showDirectoryPicker" in window)) {
      setAutoMsg({ type: "error", text: "Auto-backup requires a modern browser that supports the File System Access API." });
      return;
    }
    if (savedHandle) {
      // ask: same folder or new?
      setAutoDestModal(true);
    } else {
      // no folder saved — open picker directly
      activateAutoWithNewFolder();
    }
  }

  async function activateAutoWithSameFolder() {
    setAutoDestModal(false);
    try {
      const perm = await savedHandle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") throw new Error("Folder permission was not granted.");
    } catch (err) {
      setAutoMsg({ type: "error", text: "Could not access folder: " + err.message });
      return;
    }
    commitAutoEnable();
  }

  async function activateAutoWithNewFolder() {
    setAutoDestModal(false);
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      setSavedHandle(dirHandle);
      setSavedFolderName(dirHandle.name || "Saved Folder");
      await saveDirHandle(dirHandle);
    } catch (err) {
      if (err.name !== "AbortError")
        setAutoMsg({ type: "error", text: "Error selecting folder: " + err.message });
      return;
    }
    commitAutoEnable();
  }

  function commitAutoEnable() {
    const intervalMs = AUTO_INTERVALS.find(i => i.id === autoIntervalId)?.ms || 24 * 3600 * 1000;
    const nextAt = Date.now() + intervalMs;
    autoNextAtRef.current = nextAt;
    setAutoNextAt(nextAt);
    setAutoEnabled(true);
    saveAutoSettings({ intervalId: autoIntervalId, nextAt });
    setAutoMsg({ type: "success", text: `Auto-backup enabled. First backup in ${fmtCountdown(intervalMs)}.` });
  }

  function handleDisableAuto() {
    setAutoEnabled(false);
    setAutoNextAt(null);
    autoNextAtRef.current = null;
    setCountdown("");
    clearAutoSettings();
    setAutoMsg({ type: "", text: "" });
  }

  // ── Manual export ─────────────────────────────────────────────────────────
  // Step 1: read data → store pending → show folder prompt (or go direct)
  async function handleExport() {
    setExporting(true);
    setExportMsg({ type: "", text: "" });
    setExportProg(0);
    try {
      const data      = await exportUserData(uid, (label, pct) => { setExportLabel(label); setExportProg(pct); });
      const totalDocs = countDocs(data);
      const json      = JSON.stringify(data, null, 2);
      const fileName  = makeFileName();

      if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
        // Store pending — folder picker will be opened on the NEXT user click
        // to keep it inside a user gesture
        pendingJsonRef.current = { json, fileName, totalDocs, type: "manual" };
        setExporting(false); setExportProg(0); setExportLabel("");
        if (savedHandle) {
          setFolderPromptStep("ask-same-folder");
        } else {
          // No saved folder: show the "choose folder" prompt card in UI
          // User will click the button which directly calls showDirectoryPicker
          setFolderPromptStep("need-folder");
        }
        return;
      }

      if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: "Novexa Backup File", accept: { "application/json": [".json"] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(json); await writable.close();
          setExportMsg({ type: "success", text: `Backup complete! ${totalDocs.toLocaleString()} records saved.` });
          await recordHistory(fileName, totalDocs, "manual");
          setExporting(false); setExportProg(0); setExportLabel("");
          return;
        } catch (err) {
          if (err.name === "AbortError") { setExporting(false); setExportProg(0); setExportLabel(""); return; }
        }
      }

      // Last fallback: auto-download
      const blob = new Blob([json], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      setExportMsg({ type: "success", text: `Backup complete! ${totalDocs.toLocaleString()} records downloaded.` });
      await recordHistory(fileName, totalDocs, "manual");
    } catch (err) {
      setExportMsg({ type: "error", text: "Backup failed: " + err.message });
    }
    setExporting(false); setExportProg(0); setExportLabel("");
  }

  // ── Folder prompt handlers ────────────────────────────────────────────────
  // Called directly from button onClick — user gesture is intact here
  async function handleUseSameFolder() {
    setFolderPromptStep(null);
    const { json, fileName, totalDocs, type } = pendingJsonRef.current || {};
    if (!json || !savedHandle) return;
    pendingJsonRef.current = null;
    try {
      const perm = await savedHandle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") throw new Error("Folder permission was not granted.");
      askPasswordThenWrite(savedHandle, json, fileName, totalDocs, type || "manual");
    } catch (err) {
      if (err.name !== "AbortError")
        setExportMsg({ type: "error", text: "Folder access failed: " + err.message });
    }
  }

  // Called directly from button onClick — showDirectoryPicker fires in user gesture
  async function handleChooseNewFolder() {
    setFolderPromptStep(null);
    const { json, fileName, totalDocs, type } = pendingJsonRef.current || {};
    if (!json) return;
    pendingJsonRef.current = null;
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      setSavedHandle(dirHandle);
      setSavedFolderName(dirHandle.name || "Saved Folder");
      await saveDirHandle(dirHandle);
      askPasswordThenWrite(dirHandle, json, fileName, totalDocs, type || "manual");
    } catch (err) {
      if (err.name !== "AbortError")
        setExportMsg({ type: "error", text: "Error choosing folder: " + err.message });
    }
  }

  async function handleForgetFolder() {
    setSavedHandle(null);
    setSavedFolderName("");
    await clearDirHandle();
  }

  // ── File select (restore) ─────────────────────────────────────────────────
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Encrypted .novexa — ask for password first
    if (isEncryptedFile(file.name)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        pwRestoreRef.current = { rawBuffer: ev.target.result, fileName: file.name };
        setPwInput(""); setPwError(""); setPwShow(false);
        setPwModal("enter");
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // Plain .json
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        processBackupFile(parsed, file.name);
      } catch {
        setRestoreMsg({ type: "error", text: "Error reading file. Please select a valid JSON or .novexa backup file." });
      }
    };
    reader.readAsText(file);
  }

  async function handlePwEnter() {
    if (!pwInput) { setPwError("Please enter the password."); return; }
    setPwError("");
    const { rawBuffer, fileName } = pwRestoreRef.current || {};
    if (!rawBuffer) return;
    try {
      const json   = await decryptFile(rawBuffer, pwInput);
      const parsed = JSON.parse(json);
      setPwModal("idle"); setPwInput("");
      processBackupFile(parsed, fileName);
    } catch {
      setPwError("Wrong password or corrupted file. Please try again.");
    }
  }

  function processBackupFile(parsed, fileName) {
    if (!parsed?.version || !parsed?.collections) {
      setRestoreMsg({ type: "error", text: "Invalid backup file. Please select a valid Novexa backup file." });
      return;
    }
    if (parsed.uid && parsed.uid !== uid) {
      setRestoreMsg({ type: "error", text: "This backup belongs to a different account. Restore cancelled." });
      return;
    }
    let count = 0;
    Object.values(parsed.collections).forEach(arr => { count += arr?.length || 0; });
    if (parsed.customerNested) Object.values(parsed.customerNested).forEach(subs =>
      Object.values(subs).forEach(arr => { count += arr?.length || 0; }));
    if (parsed.supplierNested) Object.values(parsed.supplierNested).forEach(subs =>
      Object.values(subs).forEach(arr => { count += arr?.length || 0; }));
    setPendingFile(parsed);
    setFileInfo({ name: fileName, exportedAt: parsed.exportedAt, docCount: count, encrypted: isEncryptedFile(fileName) });
    setRestoreMsg({ type: "", text: "" });
    setModalStep("choose");
  }

  // ── Restore execute ───────────────────────────────────────────────────────
  async function executeRestore(mode) {
    setModalStep(null);
    setRestoring(true);
    setRestoreMsg({ type: "", text: "" });
    setRestoreProg(0);
    try {
      await restoreUserData(uid, pendingFile, mode, (label, pct) => {
        setRestoreLabel(label); setRestoreProg(pct);
      });
      const modeLabel = mode === "replace" ? "Full replace" : "Smart merge";
      setRestoreMsg({ type: "success", text: `${modeLabel} complete! ${fileInfo?.docCount?.toLocaleString() || ""} records restored.` });
    } catch (err) {
      setRestoreMsg({ type: "error", text: "Restore failed: " + err.message });
    }
    setRestoring(false); setRestoreProg(0); setRestoreLabel("");
    setPendingFile(null); setFileInfo(null);
  }

  function closeModal() { setModalStep(null); setPendingFile(null); setFileInfo(null); }

  return (
    <>
    {/* ══════════════════════════════════════════════════════════════════════
        AUTO-BACKUP DESTINATION MODAL
    ══════════════════════════════════════════════════════════════════════ */}
    {autoDestModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background: "#0d1117", border: "1px solid rgba(139,92,246,0.35)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,#8b5cf6,#6d28d9)" }} />
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)" }}>⏱️</div>
              <div>
                <p className="text-white font-black text-sm">Auto-Backup Destination</p>
                <p className="text-gray-200 text-xs">Where should auto-backups be saved?</p>
              </div>
              <button onClick={() => setAutoDestModal(false)} className="ml-auto text-gray-200 hover:text-gray-200 text-lg">✕</button>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <span className="text-2xl flex-shrink-0">🗂️</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-200 uppercase tracking-widest font-bold mb-0.5">Current Saved Folder</p>
                <p className="text-amber-300 font-bold text-sm truncate">{savedFolderName}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={activateAutoWithSameFolder}
                className="w-full py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff" }}>
                ✅ Use this folder
              </button>
              <button onClick={activateAutoWithNewFolder}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                📂 Choose a different folder
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════════════════
        PASSWORD MODALS
    ══════════════════════════════════════════════════════════════════════ */}

    {/* STEP 1 — Ask: want password protection? */}
    {pwModal === "ask" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background:"#0d1117", border:"1px solid rgba(99,102,241,0.4)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height:4, background:"linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.3)" }}>🔐</div>
              <div>
                <p className="text-white font-black text-sm">Protect this backup?</p>
                <p className="text-gray-200 text-xs">Encrypt with a password before saving</p>
              </div>
              <button onClick={() => { setPwModal("idle"); pwPendingRef.current = null; }}
                className="ml-auto text-gray-200 hover:text-gray-200 text-lg">✕</button>
            </div>
            <div className="rounded-xl px-4 py-3 text-xs leading-relaxed text-gray-200"
              style={{ background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.18)" }}>
              🔒 <span className="text-indigo-300 font-semibold">Encrypted (.novexa)</span> — password is asked when you restore from this dashboard, not when opening the file in Notepad.<br />
              📄 <span className="text-gray-300 font-semibold">Unencrypted (.json)</span> — plain readable JSON, anyone can open it.
            </div>
            <div className="flex gap-3">
              <button onClick={handleAskSkip}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
                📄 Skip, save plain
              </button>
              <button onClick={handleAskYes}
                className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"#fff" }}>
                🔐 Yes, add password
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* STEP 2 — Set password */}
    {pwModal === "set" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background:"#0d1117", border:"1px solid rgba(99,102,241,0.4)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height:4, background:"linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.3)" }}>🔑</div>
              <div>
                <p className="text-white font-black text-sm">Set Backup Password</p>
                <p className="text-gray-200 text-xs">AES-256 encryption — remember this password!</p>
              </div>
            </div>

            {/* Password input */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-200 uppercase tracking-widest font-bold">Password</label>
              <div className="relative">
                <input
                  type={pwShow ? "text" : "password"}
                  value={pwInput}
                  onChange={e => { setPwInput(e.target.value); setPwError(""); }}
                  onKeyDown={e => e.key === "Enter" && handlePwSet()}
                  placeholder="Enter password (min 6 chars)"
                  className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none pr-10"
                  style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)" }}
                  autoFocus
                />
                <button type="button" onClick={() => setPwShow(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-200 hover:text-gray-300 text-xs">
                  {pwShow ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Confirm input */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-200 uppercase tracking-widest font-bold">Confirm Password</label>
              <input
                type={pwShow ? "text" : "password"}
                value={pwConfirm}
                onChange={e => { setPwConfirm(e.target.value); setPwError(""); }}
                onKeyDown={e => e.key === "Enter" && handlePwSet()}
                placeholder="Repeat password"
                className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)" }}
              />
            </div>

            {pwError && <p className="text-red-400 text-xs font-semibold">{pwError}</p>}

            <div className="rounded-xl px-3 py-2 text-[11px] text-amber-500"
              style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)" }}>
              ⚠️ If you forget this password, the backup <strong>cannot be recovered</strong>. Store it safely.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setPwModal("ask")}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>
                ← Back
              </button>
              <button onClick={handlePwSet}
                className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"#fff" }}>
                🔐 Encrypt &amp; Save
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* STEP 3 — Enter password to decrypt on restore */}
    {pwModal === "enter" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background:"#0d1117", border:"1px solid rgba(245,158,11,0.35)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height:4, background:"linear-gradient(90deg,#F59E0B,#f97316)" }} />
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.3)" }}>🔐</div>
              <div>
                <p className="text-white font-black text-sm">Encrypted Backup</p>
                <p className="text-gray-200 text-xs truncate max-w-[180px]">{pwRestoreRef.current?.fileName}</p>
              </div>
              <button onClick={() => { setPwModal("idle"); pwRestoreRef.current = null; }}
                className="ml-auto text-gray-200 hover:text-gray-200 text-lg">✕</button>
            </div>

            <p className="text-gray-200 text-xs">Enter the password you used when creating this backup.</p>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-200 uppercase tracking-widest font-bold">Password</label>
              <div className="relative">
                <input
                  type={pwShow ? "text" : "password"}
                  value={pwInput}
                  onChange={e => { setPwInput(e.target.value); setPwError(""); }}
                  onKeyDown={e => e.key === "Enter" && handlePwEnter()}
                  placeholder="Enter backup password"
                  className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none pr-10"
                  style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)" }}
                  autoFocus
                />
                <button type="button" onClick={() => setPwShow(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-200 hover:text-gray-300 text-xs">
                  {pwShow ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {pwError && <p className="text-red-400 text-xs font-semibold">{pwError}</p>}

            <button onClick={handlePwEnter}
              className="w-full py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
              style={{ background:"linear-gradient(135deg,#F59E0B,#D97706)", color:"#000" }}>
              🔓 Unlock &amp; Continue
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════════════════
        MANUAL FOLDER PROMPT — same or new?
    ══════════════════════════════════════════════════════════════════════ */}
    {folderPromptStep === "ask-same-folder" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background: "#0d1117", border: "1px solid rgba(245,158,11,0.35)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,#F59E0B,#f97316)" }} />
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }}>📁</div>
              <div>
                <p className="text-white font-black text-sm">Where would you like to save?</p>
                <p className="text-gray-200 text-xs">A previously saved folder exists</p>
              </div>
              <button onClick={() => { setFolderPromptStep(null); pendingJsonRef.current = null; }}
                className="ml-auto text-gray-200 hover:text-gray-200 text-lg">✕</button>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <span className="text-2xl flex-shrink-0">🗂️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-200 uppercase tracking-widest font-bold mb-0.5">Saved Folder</p>
                <p className="text-amber-300 font-bold text-sm truncate">{savedFolderName}</p>
              </div>
            </div>
            <p className="text-gray-200 text-xs leading-relaxed text-center">The backup will be saved to this folder. Would you like to use it?</p>
            <div className="flex flex-col gap-2">
              <button onClick={handleUseSameFolder}
                className="w-full py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#000" }}>
                ✅ Yes, save to this folder
              </button>
              <button onClick={handleChooseNewFolder}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                📂 Choose a different folder
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {folderPromptStep === "need-folder" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background:"rgba(0,0,0,0.80)", backdropFilter:"blur(8px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background:"#0d1117", border:"1px solid rgba(52,211,153,0.35)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height:4, background:"linear-gradient(90deg,#34d399,#059669)" }} />
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background:"rgba(52,211,153,0.12)", border:"1px solid rgba(52,211,153,0.3)" }}>📁</div>
              <div>
                <p className="text-white font-black text-sm">Choose Save Folder</p>
                <p className="text-gray-200 text-xs">Backup is ready — pick where to save it</p>
              </div>
              <button onClick={() => { setFolderPromptStep(null); pendingJsonRef.current = null; }}
                className="ml-auto text-gray-200 hover:text-gray-200 text-lg">✕</button>
            </div>
            <p className="text-gray-200 text-xs leading-relaxed">
              Click the button below to choose a folder on your device. The backup file will be saved there.
            </p>
            <button onClick={handleChooseNewFolder}
              className="w-full py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
              style={{ background:"linear-gradient(135deg,#34d399,#059669)", color:"#000" }}>
              📂 Choose Folder &amp; Save
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════════════════
        RESTORE — STEP 1: Choose mode
    ══════════════════════════════════════════════════════════════════════ */}
    {modalStep === "choose" && fileInfo && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}>
        <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
          style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,#3b82f6,#8b5cf6,#F59E0B)" }} />
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)" }}>♻️</div>
              <div>
                <p className="text-white font-black text-sm">Choose Restore Mode</p>
                <p className="text-gray-200 text-xs">How would you like to restore?</p>
              </div>
              <button onClick={closeModal} className="ml-auto text-gray-200 hover:text-gray-200 text-lg">✕</button>
            </div>
            <div className="rounded-xl px-4 py-3 flex flex-col gap-1.5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex gap-2 text-xs"><span className="text-gray-200 w-20 flex-shrink-0">File:</span><span className="text-white font-medium truncate">{fileInfo.name}</span>{fileInfo.encrypted && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0" style={{ background:"rgba(99,102,241,0.15)", color:"#818cf8", border:"1px solid rgba(99,102,241,0.3)" }}>🔐 Encrypted</span>}</div>
              <div className="flex gap-2 text-xs"><span className="text-gray-200 w-20 flex-shrink-0">Backup Date:</span><span className="text-amber-300 font-medium">{fmtDate(fileInfo.exportedAt)}</span></div>
              <div className="flex gap-2 text-xs"><span className="text-gray-200 w-20 flex-shrink-0">Records:</span><span className="text-green-400 font-bold">{fileInfo.docCount?.toLocaleString()}</span></div>
            </div>
            <button onClick={() => setModalStep("confirm-merge")}
              className="w-full text-left rounded-2xl p-4 flex items-start gap-3 transition-all hover:scale-[1.01]"
              style={{ background: "rgba(52,211,153,0.06)", border: "2px solid rgba(52,211,153,0.35)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 mt-0.5"
                style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}>🔀</div>
              <div className="flex flex-col gap-1">
                <p className="text-white font-black text-sm">Smart Merge — Recommended</p>
                <p className="text-gray-200 text-xs leading-relaxed">Backup data will be restored. Records created <span className="text-green-400 font-semibold">after</span> the backup date will <span className="text-green-400 font-semibold">remain safe</span>.</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(52,211,153,0.12)", color:"#34d399" }}>✅ New data safe</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(52,211,153,0.12)", color:"#34d399" }}>✅ Backup restored</span>
                </div>
              </div>
            </button>
            <button onClick={() => setModalStep("confirm-replace")}
              className="w-full text-left rounded-2xl p-4 flex items-start gap-3 transition-all hover:scale-[1.01]"
              style={{ background: "rgba(239,68,68,0.05)", border: "1.5px solid rgba(239,68,68,0.25)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 mt-0.5"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>🔄</div>
              <div className="flex flex-col gap-1">
                <p className="text-white font-black text-sm">Full Replace</p>
                <p className="text-gray-200 text-xs leading-relaxed">Your <span className="text-red-400 font-semibold">entire current data will be deleted</span> and only the backup data will remain. Any work done after the backup will be <span className="text-red-400 font-semibold">permanently lost</span>.</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background:"rgba(239,68,68,0.12)", color:"#f87171" }}>⚠️ New data will be deleted</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* STEP 2a — Confirm MERGE */}
    {modalStep === "confirm-merge" && fileInfo && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background: "#0d1117", border: "1px solid rgba(52,211,153,0.35)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,#34d399,#059669)" }} />
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)" }}>🔀</div>
              <div>
                <p className="text-white font-black text-sm">Confirm Smart Merge</p>
                <p className="text-gray-200 text-xs">Today&apos;s work will be kept safe</p>
              </div>
            </div>
            <div className="rounded-xl px-4 py-3 text-xs leading-relaxed text-gray-200"
              style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.2)" }}>
              📅 Backup date: <span className="text-amber-300 font-semibold">{fmtDate(fileInfo.exportedAt)}</span><br />
              Records created <span className="text-green-400 font-medium">after this date</span> will be kept safe.<br />
              Backup records will be overwritten.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalStep("choose")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>← Back</button>
              <button onClick={() => executeRestore("merge")} className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background:"linear-gradient(135deg,#34d399,#059669)", color:"#000" }}>Smart Merge →</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* STEP 2b — Confirm REPLACE */}
    {modalStep === "confirm-replace" && fileInfo && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}>
        <div className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background: "#0d1117", border: "1px solid rgba(239,68,68,0.4)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,#ef4444,#f97316)" }} />
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>⚠️</div>
              <div>
                <p className="text-white font-black text-sm">Full Replace — Danger!</p>
                <p className="text-gray-200 text-xs">This action cannot be undone</p>
              </div>
            </div>
            <div className="rounded-xl px-4 py-3 text-xs leading-relaxed"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color:"#fca5a5" }}>
              ❌ Everything created <span className="font-semibold text-amber-300">after the backup date ({fmtDate(fileInfo.exportedAt)})</span> will be <span className="font-bold text-red-300">permanently deleted</span>.<br /><br />
              Are you sure? Make sure you have already taken a new backup first.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalStep("choose")} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#9ca3af" }}>← Back</button>
              <button onClick={() => executeRestore("replace")} className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all hover:scale-[1.02]"
                style={{ background:"linear-gradient(135deg,#ef4444,#c62828)", color:"#fff" }}>Yes, Delete &amp; Replace</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ══════════════════════════════════════════════════════════════════════
        PAGE BODY
    ══════════════════════════════════════════════════════════════════════ */}
    <div className="flex flex-col gap-4 sm:gap-6 w-full max-w-5xl">

      {/* ── ROW 1: Backup + Restore ── */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">

        {/* ── LEFT: Manual Backup ── */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="rounded-2xl p-4 sm:p-6 flex flex-col gap-5" style={cardS}>
            <SECT title="📦 Data Backup" color="#34d399">
              <div className="rounded-xl p-4 flex flex-col gap-3"
                style={{ background:"rgba(52,211,153,0.04)", border:"1px solid rgba(52,211,153,0.15)" }}>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Download your entire Novexa data as a <span className="text-green-400 font-semibold">JSON file</span> — invoices, customers, inventory, payments, suppliers, and everything else.
                </p>
                <p className="text-gray-200 text-xs">
                  ✅ Only <span className="text-white font-medium">your own data</span> — no other user&apos;s data.<br />
                  ✅ File stays on your device only — never uploaded to the cloud.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FLAT_COLLECTIONS.map(c => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <span>{c.icon}</span><span className="text-gray-200">{c.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                  style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <span>🔗</span><span className="text-gray-200">Nested Data</span>
                </div>
              </div>

              {savedFolderName && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <span className="text-lg flex-shrink-0">🗂️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-200 uppercase tracking-widest font-bold mb-0.5">Saved Folder</p>
                    <p className="text-amber-300 font-semibold text-xs truncate">{savedFolderName}</p>
                  </div>
                  <button onClick={handleForgetFolder} title="Forget this folder"
                    className="text-gray-200 hover:text-red-400 transition-colors text-sm flex-shrink-0">✕</button>
                </div>
              )}

              {exporting && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-200">{exportLabel}</span>
                    <span className="text-green-400 font-bold">{exportProg}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.07)" }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width:`${exportProg}%`, background:"linear-gradient(90deg,#34d399,#059669)" }} />
                  </div>
                </div>
              )}

              {exportMsg.text && (
                <div className="px-4 py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: exportMsg.type==="success" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                    border: `1px solid ${exportMsg.type==="success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                    color: exportMsg.type==="success" ? "#34d399" : "#f87171",
                  }}>
                  {exportMsg.type==="success" ? "✅ " : "❌ "}{exportMsg.text}
                </div>
              )}

              <button onClick={handleExport} disabled={exporting}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-95"
                style={{
                  background: exporting ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg,#34d399,#059669)",
                  color: exporting ? "#34d399" : "#000",
                  border: exporting ? "1px solid rgba(52,211,153,0.3)" : "none",
                  cursor: exporting ? "not-allowed" : "pointer",
                }}>
                {exporting ? (<><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/>
                </svg>Backing up...</>) : "⬇️ Download Backup"}
              </button>
            </SECT>
          </div>
        </div>

        {/* ── RIGHT: Restore ── */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="rounded-2xl p-4 sm:p-6 flex flex-col gap-5" style={cardS}>
            <SECT title="♻️ Data Restore" color="#F59E0B">
              <div className="rounded-xl p-4 flex flex-col gap-3"
                style={{ background:"rgba(245,158,11,0.04)", border:"1px solid rgba(245,158,11,0.15)" }}>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Restore your data from a previously downloaded <span className="text-amber-400 font-semibold">backup file</span>.
                  Encrypted <span className="text-indigo-300 font-semibold">.novexa</span> files will ask for your password here — do not open them in Notepad.
                </p>
                <div className="flex flex-col gap-2 mt-1">
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
                    style={{ background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)" }}>
                    <span className="text-lg flex-shrink-0">🔀</span>
                    <div>
                      <p className="text-green-400 font-bold">Smart Merge</p>
                      <p className="text-gray-200 leading-relaxed">Backup restored. New work done <span className="text-green-400">after</span> the backup date stays safe.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
                    style={{ background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.2)" }}>
                    <span className="text-lg flex-shrink-0">🔄</span>
                    <div>
                      <p className="text-red-400 font-bold">Full Replace</p>
                      <p className="text-gray-200 leading-relaxed">All current data deleted and replaced entirely with the backup.</p>
                    </div>
                  </div>
                </div>
              </div>

              {restoring && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-200">{restoreLabel}</span>
                    <span className="text-amber-400 font-bold">{restoreProg}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.07)" }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width:`${restoreProg}%`, background:"linear-gradient(90deg,#F59E0B,#D97706)" }} />
                  </div>
                </div>
              )}

              {restoreMsg.text && (
                <div className="px-4 py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: restoreMsg.type==="success" ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                    border: `1px solid ${restoreMsg.type==="success" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                    color: restoreMsg.type==="success" ? "#34d399" : "#f87171",
                  }}>
                  {restoreMsg.type==="success" ? "✅ " : "❌ "}{restoreMsg.text}
                </div>
              )}

              <input ref={fileInputRef} type="file" accept=".json,.novexa,application/json" className="hidden" onChange={handleFileSelect} />
              <button onClick={() => fileInputRef.current?.click()} disabled={restoring}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-95"
                style={{
                  background: restoring ? "rgba(245,158,11,0.15)" : "linear-gradient(135deg,#F59E0B,#D97706)",
                  color: restoring ? "#F59E0B" : "#000",
                  border: restoring ? "1px solid rgba(245,158,11,0.3)" : "none",
                  cursor: restoring ? "not-allowed" : "pointer",
                }}>
                {restoring ? (<><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/>
                </svg>Restoring...</>) : "⬆️ Select Backup File"}
              </button>
            </SECT>
          </div>

          {/* Info card */}
          <div className="rounded-2xl p-4 flex flex-col gap-3"
            style={{ background:"rgba(37,99,235,0.04)", border:"1px solid rgba(37,99,235,0.15)" }}>
            <p className="text-xs font-black uppercase tracking-widest" style={{ color:"#60a5fa" }}>ℹ️ Important Notes</p>
            <ul className="flex flex-col gap-2">
              {[
                "Smart Merge is recommended — today's work stays safe.",
                "Encrypted .novexa files look like gibberish in Notepad — that is normal. Use \"Select Backup File\" above to unlock with password.",
                "Always take a new backup before restoring.",
                "Only a backup from this account can be restored here.",
                "Refresh the page after restoring to see the updated data.",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-200">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>{tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Auto-Backup ── */}
      <div className="rounded-2xl p-4 sm:p-6 flex flex-col gap-5" style={cardS}>
        <SECT title="⏱️ Auto-Backup" color="#8b5cf6">
          <div className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background:"rgba(139,92,246,0.04)", border:"1px solid rgba(139,92,246,0.15)" }}>
            <p className="text-gray-300 text-sm leading-relaxed">
              Let Novexa automatically back up your data at a set interval. Each backup is saved as a <span className="text-purple-400 font-semibold">new file</span> in your chosen folder — nothing gets overwritten.
            </p>
            <p className="text-gray-200 text-xs">
              ✅ Requires a folder destination to be set.<br />
              ✅ Works only while this browser tab is open.
            </p>
          </div>

          {/* Interval selector */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-200 font-semibold uppercase tracking-wider">Backup Frequency</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AUTO_INTERVALS.map(opt => (
                <button key={opt.id}
                  onClick={() => { setAutoIntervalId(opt.id); if (autoEnabled) { /* re-schedule */ } }}
                  disabled={autoEnabled}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: autoIntervalId === opt.id ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)",
                    border: autoIntervalId === opt.id ? "2px solid rgba(139,92,246,0.6)" : "1px solid rgba(255,255,255,0.07)",
                    color: autoIntervalId === opt.id ? "#c4b5fd" : "#6b7280",
                    cursor: autoEnabled ? "not-allowed" : "pointer",
                    opacity: autoEnabled && autoIntervalId !== opt.id ? 0.4 : 1,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status + countdown */}
          {autoEnabled && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background:"rgba(139,92,246,0.06)", border:"1px solid rgba(139,92,246,0.25)" }}>
              <span className="text-xl flex-shrink-0">🟣</span>
              <div className="flex-1">
                <p className="text-purple-300 font-black text-xs uppercase tracking-wider">Auto-Backup Active</p>
                <p className="text-gray-200 text-xs mt-0.5">
                  Next backup in <span className="text-purple-200 font-bold">{countdown || "…"}</span>
                  {savedFolderName && <> → <span className="text-amber-300 font-semibold">{savedFolderName}</span></>}
                </p>
              </div>
            </div>
          )}

          {autoMsg.text && (
            <div className="px-4 py-3 rounded-xl text-sm font-medium"
              style={{
                background: autoMsg.type==="success" ? "rgba(139,92,246,0.08)" : "rgba(248,113,113,0.08)",
                border: `1px solid ${autoMsg.type==="success" ? "rgba(139,92,246,0.35)" : "rgba(248,113,113,0.3)"}`,
                color: autoMsg.type==="success" ? "#c4b5fd" : "#f87171",
              }}>
              {autoMsg.type==="success" ? "✅ " : "❌ "}{autoMsg.text}
            </div>
          )}

          <div className="flex gap-3">
            {!autoEnabled ? (
              <button onClick={handleEnableAuto}
                className="flex-1 py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-95"
                style={{ background:"linear-gradient(135deg,#8b5cf6,#6d28d9)", color:"#fff" }}>
                ▶ Enable Auto-Backup
              </button>
            ) : (
              <button onClick={handleDisableAuto}
                className="flex-1 py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-95"
                style={{ background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", color:"#f87171" }}>
                ⏹ Disable Auto-Backup
              </button>
            )}
          </div>
        </SECT>
      </div>

      {/* ── ROW 3: Backup History ── */}
      <div className="rounded-2xl p-4 sm:p-6 flex flex-col gap-5" style={cardS}>
        <SECT title="📋 Backup History" color="#60a5fa">
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="text-4xl opacity-30">🗂️</span>
              <p className="text-gray-200 text-sm">No backups yet</p>
              <p className="text-gray-200 text-xs">Every backup you create (manual or auto) will appear here.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {history.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    {/* Type badge */}
                    <div className="flex-shrink-0">
                      {entry.type === "auto" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                          style={{ background:"rgba(139,92,246,0.15)", color:"#c4b5fd", border:"1px solid rgba(139,92,246,0.3)" }}>
                          ⏱ Auto
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                          style={{ background:"rgba(52,211,153,0.12)", color:"#34d399", border:"1px solid rgba(52,211,153,0.3)" }}>
                          ✋ Manual
                        </span>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{entry.fileName}</p>
                      <p className="text-gray-200 text-[11px] mt-0.5">{fmtDate(entry.at)}</p>
                    </div>
                    {/* Doc count */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-green-400 text-xs font-bold">{entry.docCount?.toLocaleString()}</p>
                      <p className="text-gray-200 text-[10px]">records</p>
                    </div>
                  </div>
                ))}
              </div>
              {history.length > 0 && (
                <button onClick={async () => { await clearHistory(); setHistory([]); }}
                  className="self-end text-xs text-gray-200 hover:text-red-400 transition-colors underline underline-offset-2">
                  Clear history
                </button>
              )}
            </>
          )}
        </SECT>
      </div>

    </div>
    </>
  );
}
