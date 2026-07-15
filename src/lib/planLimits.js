/**
 * planLimits.js
 * ─────────────
 * Central place for all plan-based monthly usage limits.
 * Plans are loaded dynamically from Firestore (adminConfig/plans).
 * Hardcoded defaults are used as fallback.
 *
 * null = unlimited
 */
import { getDocs, getDoc, query, where, Timestamp, doc, collection } from "firebase/firestore";

// ── Hardcoded fallback (used if Firestore is unavailable) ─────────────────────
export const PLAN_LIMITS = {
  starter: {
    invoicesPerMonth:              100,
    invoicesPerCustomerPerMonth:   100,
    customersPerMonth:             100,
    suppliersPerMonth:              20,
    ordersPerSupplierPerMonth:     100,
  },
  business: {
    invoicesPerMonth:             1000,
    invoicesPerCustomerPerMonth:  1000,
    customersPerMonth:             500,
    suppliersPerMonth:             100,
    ordersPerSupplierPerMonth:     500,
  },
  professional: {
    invoicesPerMonth:             5000,
    invoicesPerCustomerPerMonth:  5000,
    customersPerMonth:            2000,
    suppliersPerMonth:             500,
    ordersPerSupplierPerMonth:    2000,
  },
  enterprise: {
    invoicesPerMonth:             null,
    invoicesPerCustomerPerMonth:  null,
    customersPerMonth:            null,
    suppliersPerMonth:            null,
    ordersPerSupplierPerMonth:    null,
  },
};

// ── Cache: avoids re-fetching on every save attempt ───────────────────────────
let _cachedPlans = null;
let _cacheTime   = 0;
const CACHE_TTL  = 0; // disabled — always fetch fresh

/**
 * Loads plan config from Firestore (with 5-min cache).
 * Falls back to PLAN_LIMITS if Firestore unavailable.
 */
export async function loadPlansFromFirestore() {
  const now = Date.now();
  if (_cachedPlans && (now - _cacheTime) < CACHE_TTL) return _cachedPlans;

  try {
    const { db } = await import("@/lib/firebase");
    const snap = await getDoc(doc(db, "adminConfig", "plans"));
    if (snap.exists()) {
      const list = snap.data().list || [];
      const map  = {};
      list.forEach(p => { if (p.id) map[p.id] = p.limits || {}; });
      _cachedPlans = map;
      _cacheTime   = now;
      return map;
    }
  } catch { /* fall through */ }

  return PLAN_LIMITS;
}

/**
 * Loads allowed tabs for a plan from Firestore (with cache).
 */
export async function loadAllowedTabsFromFirestore(planId) {
  try {
    const { db } = await import("@/lib/firebase");
    const snap = await getDoc(doc(db, "adminConfig", "plans"));
    if (snap.exists()) {
      const list = snap.data().list || [];
      const plan = list.find(p => p.id === planId);
      if (plan?.allowedTabs) return new Set(plan.allowedTabs);
    }
  } catch { /* fall through */ }

  // fallback
  return getPlanPermissions(planId);
}

/**
 * Returns limits for a given plan — tries Firestore first, falls back to hardcoded.
 */
export function getLimits(plan, firestorePlans = null) {
  const source = firestorePlans || PLAN_LIMITS;
  return source[plan] || source["starter"] || PLAN_LIMITS.starter;
}

/**
 * Hardcoded tab permissions fallback.
 */
export function getPlanPermissions(plan) {
  const map = {
    starter:      new Set(["overview","invoices","customers","inventory","payments","purchases","settings","contact","my-tickets","trash"]),
    business:     new Set(["overview","invoices","customers","inventory","payments","purchases","order-form","analytics","settings","contact","my-tickets","trash"]),
    professional: new Set(["overview","invoices","customers","inventory","payments","purchases","order-form","analytics","settings","contact","my-tickets","trash"]),
    enterprise:   new Set(["overview","invoices","customers","inventory","payments","purchases","order-form","analytics","settings","contact","my-tickets","trash"]),
  };
  return map[plan] || map.starter;
}

/**
 * Returns the current month string "YYYY-MM".
 */
export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Counts Firestore documents created in the current calendar month.
 */
export async function countThisMonth(collRef) {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

  const q = query(
    collRef,
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<",  Timestamp.fromDate(end))
  );

  const snap = await getDocs(q);
  return snap.size;
}

/**
 * Checks if creating one more record would exceed the monthly limit.
 */
export async function checkMonthlyLimit(collRef, limitValue) {
  if (limitValue === null || limitValue === undefined) return { allowed: true, current: 0, limit: null };
  const current = await countThisMonth(collRef);
  return { allowed: current < limitValue, current, limit: limitValue };
}
