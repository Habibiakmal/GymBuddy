const CACHE_NAME = "gymbuddy-pwa-v4";
const STATIC_ASSETS = [
  "/manifest.json",
  "/favicon.png",
  "/favicon.svg",
  "/logo.svg",
  "/icon-192.png",
  "/icon-512.png"
];

// Install Event: Pre-cache App Shell & Skip Waiting
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("PWA pre-cache item warning:", err);
      });
    })
  );
});

// Activate Event: Cleanup All Old Caches and Claim Clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-First for Navigation & HTML, Stale-While-Revalidate for other assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and browser extensions
  if (request.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // 1. Navigation / HTML Requests: Always NETWORK-FIRST (Never serve stale HTML)
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html") || url.pathname === "/" || url.pathname === "/index.html") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() => caches.match("/index.html") || caches.match("/"))
    );
    return;
  }

  // 2. API Calls: Network-First
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. Static Assets: Cache with Network Fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(request).then((networkResponse) => {
          return networkResponse;
        })
      );
    })
  );
});

// Push & Notification Click Handlers (For Apple Watch, Wear OS, and Mobile PWA)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});

// Push Event from Server/WebPush
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "Waktunya melanjutkan sesi latihanmu di GymBuddy!",
      icon: data.icon || "/icon-192.png",
      badge: "/favicon.png",
      vibrate: [200, 100, 200, 100, 200],
      data: { url: data.url || "/" }
    };
    event.waitUntil(self.registration.showNotification(data.title || "GymBuddy AI Coach", options));
  } catch (e) {
    event.waitUntil(
      self.registration.showNotification("GymBuddy", {
        body: event.data.text(),
        icon: "/icon-192.png"
      })
    );
  }
});
