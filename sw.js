// Minimal service worker to avoid 404s when browsers request /sw.js
// This worker does nothing aggressive — it installs and immediately becomes active.
self.addEventListener('install', (evt) => {
  self.skipWaiting();
});
self.addEventListener('activate', (evt) => {
  // claim clients so that subsequent navigation uses the active worker if any
  if (self.clients && self.clients.claim) self.clients.claim();
});
// Basic fetch handler: fall back to network (no caching here)
self.addEventListener('fetch', (evt) => {
  // no-op: let browser handle the request by default
});
