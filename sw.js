const CACHE_VERSION = "vitruvian-v1.33.0";  // bump on EVERY deploy, including content edits
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./splash.js",
  "./content.js",
  "./skill.js",
  "./schema.js",
  "./storage.js",
  "./renderer-diagram.js",
  "./renderer-doc.js",
  "./generator.js",
  "./engine.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./flagships/railway.json",
  "./flagships/whatsapp.json",
  "./flagships/youtube.json",
  "./flagships/video-transcoding.json",
  "./flagships/content-delivery-network.json",
  "./flagships/recommendation-feed.json",
  "./flagships/news-feed.json",
  "./flagships/url-shortener.json",
  "./flagships/distributed-cache.json",
  "./flagships/object-storage.json",
  "./flagships/message-queue.json",
  "./flagships/notification-system.json",
  "./flagships/unique-id-generator.json",
  "./flagships/rate-limiter.json",
  "./flagships/search-typeahead.json",
  "./flagships/ride-matching.json",
  "./flagships/ticket-booking.json",
  "./flagships/payment-ledger.json",
  "./flagships/photo-store.json",
  "./assets/enso-gate.svg",
  "./assets/enso-complete.svg",
  "./fonts/BricolageGrotesque.woff2",
  "./fonts/HankenGrotesk.woff2",
  "./fonts/JetBrainsMono.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./lab/transmission.html",
  "./lab/transmission.css",
  "./lab/ink3d.js",
  "./lab/lab-page.js",
  "./lab/transmission-scene.js",
  "./lab/transmission-copy.js",
  "./lab/transmission-page.js"
];
self.addEventListener("install", e => {
  // Fetch each shell asset with cache:"reload" so a stale entry in the browser's
  // HTTP cache can never poison this cache — the SW always precaches the version
  // that was just deployed, not whatever the disk cache happened to hold.
  e.waitUntil(caches.open(CACHE_VERSION).then(c =>
    Promise.all(SHELL.map(u =>
      fetch(new Request(u, { cache: "reload" })).then(r => { if (r.ok) return c.put(u, r); })
    ))
  ));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // never cache/serve api.anthropic.com
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request))
  );
});
self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
