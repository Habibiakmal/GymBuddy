// GymBuddy PWA Service Worker - NUCLEAR RESET MODE
// This SW immediately unregisters itself and clears ALL caches
// to fix stale cache issues causing blank/error screens.

// Step 1: Immediately install and skip waiting
self.addEventListener("install", (event) => {
  console.log("[SW] New SW installed - clearing all caches");
  self.skipWaiting();
  // Delete ALL caches immediately on install
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        console.log("[SW] Deleting cache:", key);
        return caches.delete(key);
      }));
    })
  );
});

// Step 2: On activate, claim all clients and reload them
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete all remaining caches
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      
      // Claim all clients
      await self.clients.claim();
      
      // Tell all clients to reload to get fresh content
      const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
      for (const client of allClients) {
        client.navigate(client.url);
      }
    })()
  );
});

// Step 3: NEVER intercept requests - always go to network
self.addEventListener("fetch", (event) => {
  // Pass through everything - no caching whatsoever
  return;
});
