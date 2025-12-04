// sw.js

// Install event → skip waiting so new SW activates immediately
self.addEventListener("install", (event) => {
    self.skipWaiting();
});

// Activate event → claim clients so SW controls pages immediately
self.addEventListener("activate", (event) => {
    clients.claim();
});

// Fetch event → always fetch from network (no offline cache)
self.addEventListener("fetch", (event) => {
    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return new Response(
                    "Internet connection required to use this app.",
                    { headers: { "Content-Type": "text/plain" } }
                );
            })
    );
});
