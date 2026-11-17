// Karobar360 service worker: lets the app install and open fast.
// Business data is never cached here; every screen loads live numbers from the server.
const CACHE = "k360-static-v1";

const OFFLINE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Karobar360</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#d3d8d0;color:#111412;font-family:system-ui,sans-serif;text-align:center;padding:24px}
@media (prefers-color-scheme:dark){body{background:#0d100f;color:#eaeeea}}h1{font-size:1.5rem;margin:0 0 8px}p{opacity:.7;max-width:32ch;margin:0 auto 20px}
button{background:#0d6b4e;color:#fff;border:0;border-radius:999px;padding:12px 22px;font-size:1rem;font-weight:600}</style></head>
<body><div><h1>You're offline</h1><p>Karobar360 needs the internet to show your latest stock and sales. Check the connection and try again.</p><button onclick="location.reload()">Try again</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Built files have a unique name per version, so a saved copy is always correct.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // Pages always come from the server; show a friendly screen when there is no internet.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
  }
});
