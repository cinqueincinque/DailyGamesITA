// Service Worker per 5 in 5 - Gestione PWA e Notifiche
const CACHE_NAME = "cinque-in-cinque-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Ascolta i messaggi dall'app per mostrare notifiche
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: "https://fav.farm/🧩",
      badge: "https://fav.farm/🧩",
      vibrate: [200, 100, 200],
      tag: "daily-reminder-5in5"
    });
  }
});

// Cliccando sulla notifica apre il gioco
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});