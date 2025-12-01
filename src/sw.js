// Service worker intentionally simplified to a no-op to disable caching.
// The original caching behavior was removed to avoid stale assets during development.

self.addEventListener('install', (e) => {
	// Activate immediately
	self.skipWaiting();
});

self.addEventListener('activate', (e) => {
	// Take control of uncontrolled clients as quickly as possible
	e.waitUntil(self.clients.claim());
});