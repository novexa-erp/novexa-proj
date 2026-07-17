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
    professional: new Set(["overview","invoices","customers","inventory","payments","purchases","order-form","analytics","hr","branches","settings","contact","my-tickets","trash"]),
    enterprise:   new Set(["overview","invoices","customers","inventory","payments","purchases","order-form","analytics","hr","branches","settings","contact","my-tickets","trash"]),
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
 * Returns the start of the current billing cycle based on the user's activeFrom date.
 * e.g. activeFrom = "2026-06-14", today = "2026-07-20"
 *   → cycle start = "2026-07-14", cycle end = "2026-08-14"
 * e.g. activeFrom = "2026-06-14", today = "2026-07-10"
 *   → cycle start = "2026-06-14", cycle end = "2026-07-14"
 *
 * Falls back to calendar month if activeFrom is not provided.
 */
export function getCurrentCycleWindow(activeFromStr) {
  const now = new Date();

  if (!activeFromStr) {
    // Fallback: calendar month
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start, end };
  }

  const from    = new Date(activeFromStr + "T00:00:00");
  const dayOfMonth = from.getDate(); // e.g. 14

  // Find the most recent cycle start (on or before today)
  let cycleStart = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, 0, 0, 0, 0);

  // If cycleStart is in the future (e.g. today is the 10th, cycle day is the 14th)
  // → go back one month
  if (cycleStart > now) {
    cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth, 0, 0, 0, 0);
  }

  // Cycle end = exactly 1 month after cycle start
  const cycleEnd = new Date(
    cycleStart.getFullYear(),
    cycleStart.getMonth() + 1,
    dayOfMonth,
    0, 0, 0, 0
  );

  // Never go before the actual activeFrom date
  const actualStart = cycleStart < from ? from : cycleStart;

  return { start: actualStart, end: cycleEnd };
}

/**
 * Counts Firestore documents created in the current billing cycle.
 * Pass activeFrom (ISO date string "YYYY-MM-DD") from userDoc for subscription-cycle counting.
 * Falls back to calendar month if activeFrom is not provided.
 */
export async function countThisMonth(collRef, activeFrom) {
  const { start, end } = getCurrentCycleWindow(activeFrom);

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
 * Pass activeFrom from userDoc for subscription-cycle-based counting.
 * Pass extraAmount to add on top of the plan limit (admin-granted extras).
 * Pass extraLimitsExpiresAt to auto-ignore extras after expiry.
 */
export async function checkMonthlyLimit(collRef, limitValue, activeFrom, extraAmount = 0, extraLimitsExpiresAt = null) {
  // If base limit is null (unlimited), still unlimited even without extras
  if (limitValue === null || limitValue === undefined) return { allowed: true, current: 0, limit: null };

  // Ignore extras if expired
  let effectiveExtra = Number(extraAmount) || 0;
  if (extraLimitsExpiresAt && new Date(extraLimitsExpiresAt) < new Date()) {
    effectiveExtra = 0;
  }

  const effectiveLimit = limitValue + effectiveExtra;
  const current = await countThisMonth(collRef, activeFrom);
  return { allowed: current < effectiveLimit, current, limit: effectiveLimit, baseLimit: limitValue, extra: effectiveExtra };
}

/**
 * Returns the effective limit for a given limit key,
 * combining the plan's base limit with admin-granted extras for this month.
 * extraLimits        = userDoc.extraLimits object, e.g. { invoicesPerMonth: 50, customersPerMonth: 20 }
 * extraLimitsExpiresAt = userDoc.extraLimitsExpiresAt ISO string — if expired, extras are ignored.
 */
export function getEffectiveLimit(baseLimitValue, limitKey, extraLimits, extraLimitsExpiresAt) {
  if (baseLimitValue === null || baseLimitValue === undefined) return null; // unlimited stays unlimited

  // If an expiry is set and has passed, treat extras as 0
  if (extraLimitsExpiresAt) {
    const expired = new Date(extraLimitsExpiresAt) < new Date();
    if (expired) return baseLimitValue;
  }

  const extra = extraLimits?.[limitKey];
  return baseLimitValue + (Number(extra) || 0);
}
