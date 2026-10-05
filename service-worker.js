// Cached nur die App-Dateien. Musik kommt per Dateiauswahl (Blob-URLs) und wird nie gecacht.
const CACHE_NAME = "djpult-cache-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./remote.html",
  "./script.js",
  "./remote.js",
  "./style.css",
  "./manifest.json",
  "./icon-192.png",
  "./static/images/thumbnail_logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // einzeln hinzufuegen: eine fehlende Datei darf die Installation nicht kippen
      Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn("Nicht gecacht:", url, err))
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
        const network = fetch(request)
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
