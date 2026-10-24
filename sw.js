const CACHE = "Haleia Academy-v3";


const SKIP_CACHE = [
    "firebaseapp.com",
    "googleapis.com",
    "gstatic.com",
    "firestore.googleapis.com"
];

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", e => {
   const req = e.request;
   if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;
   if (SKIP_CACHE.some(s => req.url.includes(s))) return;
   e.respondWith(
       fetch(req, { cache: "no-cache" })
           .then(res => {
               if (res.ok) {
                   const copy = res.clone();
                   caches.open(CACHE).then(c => c.put(req, copy));
               }
               return res;
           })
           .catch(() => caches.match(req))
   );
});

self.addEventListener("message", e => {
    if (e.data?.type === "CACHE_COURSE") {
        const url = e.data.url;
        caches.open(CACHE).then(cache => {
            fetch(url).then(res => cache.put(url, res));
        });
    }
});