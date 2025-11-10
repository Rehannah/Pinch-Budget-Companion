const CACHE_NAME = 'pinch-cache-v1';
const ASSETS = [
	'/', '/index.html', '/dashboard.html', '/transactions.html', '/settings.html',
	'/css/styles.css', '/js/app.js'
];

self.addEventListener('install', (e) => {
	e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
	e.respondWith(caches.match(e.request).then(resp => resp || fetch(e.request)));
});

self.addEventListener('activate', (e) => {
	e.waitUntil(self.clients.claim());
});