// Novexa PWA Service Worker
const CACHE_NAME = "novexa-v1";

// Static assets to cache on install
const PRECACHE = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/images/Novexa N Logo.png",
  "/images/Novexa-logo-text.png",
];

// ── Install: precache static assets ──────────────────────────────────────────
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first, fallback to cache ───────────────────────────────────
self.addEventListener("fetch", (e) => {
  // Skip non-GET and cross-origin requests
  if (e.request.method !== "GET") return;
  if (!e.request.url.startsWith(self.location.origin)) return;
  // Skip Firebase / API calls — always fresh
  if (e.request.url.includes("/api/") ||
      e.request.url.includes("firestore.googleapis.com") ||
      e.request.url.includes("firebase")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache a clone of fresh response
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
