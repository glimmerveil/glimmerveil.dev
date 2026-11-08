// The Shard's cross-origin isolation (office 11-08): GitHub Pages can't send COOP/COEP, so this worker adds them to the
// Shard's own responses. With them the page is crossOriginIsolated and Pixie's mind (wllama) thinks on every core instead
// of one (10-28: 8 threads read a 1,870-token prompt in 160 s; one would take many minutes). Cross-origin requests (her
// mind from Hugging Face, which sends CORS) pass untouched. Nothing is stored or sent anywhere by this worker.
// © 2026 Glimmerveil. All rights reserved.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;                                     // (only what the page loads; anything sent goes as it is)
  if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') return;
  if (new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r).then(res => {
    if (!res || res.status === 0 || res.type === 'opaque') return res;
    const h = new Headers(res.headers);
    h.set('Cross-Origin-Embedder-Policy', 'require-corp');
    h.set('Cross-Origin-Opener-Policy', 'same-origin');
    h.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  }).catch(() => fetch(r)));
});
