// Cached nur die App-Dateien. Musik kommt per Dateiauswahl (Blob-URLs) und wird nie gecacht.
importScripts("version.js");
const CACHE_NAME = `djpult-${APP_VERSION}`;

const ASSETS = [
  "./",
  "./index.html",
  "./remote.html",
  "./version.js",
  "./access.js",
  "./script.js",
  "./remote.js",
  "./style.css",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
  "./static/images/thumbnail_logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // einzeln hinzufuegen: eine fehlende Datei darf die Installation nicht kippen
      Promise.all(
        ASSETS.map((url) =>
          fetch(url, { cache: "reload" })
            .then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return cache.put(url, response);
            })
            .catch((err) => console.warn("Nicht gecacht:", url, err))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: sofort aus dem Cache, im Hintergrund aktualisieren.
// So kommen Aenderungen ohne manuelles Versions-Bump spaetestens beim zweiten Start an.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith("http")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        // "no-cache": immer beim Server nachfragen (GitHub Pages cached sonst 10 Min.)
        const network = fetch(request, { cache: "no-cache" })
          .then((response) => {
            if (response && (response.ok || response.type === "opaque")) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
