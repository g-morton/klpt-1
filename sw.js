const APP_CACHE = "klpt-app-v3";
const RUNTIME_CACHE = "klpt-runtime-v3";
const APP_ASSETS = [
  "./",
  "index.html",
  "observation.html",
  "report.html",
  "robots.txt",
  "styles.css",
  "script.js",
  "manifest.webmanifest",
  "assets/vendor/fontawesome/css/all.min.css",
  "assets/vendor/fontawesome/webfonts/fa-brands-400.woff2",
  "assets/vendor/fontawesome/webfonts/fa-regular-400.woff2",
  "assets/vendor/fontawesome/webfonts/fa-solid-900.woff2",
  "assets/vendor/fontawesome/webfonts/fa-v4compatibility.woff2",
  "assets/data/navigation.json",
  "assets/data/domains.json",
  "assets/data/help.json",
  "assets/images/klpt-logo-icon.svg",
  "assets/images/klpt-logo-circle.svg",
  "assets/images/helper-1.svg",
  "assets/images/abc-chart.png"
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isAppRequest(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

async function networkFirst(request, fallbackKey) {
  try {
    const networkRequest =
      request.mode === "navigate" ? request : new Request(request, { cache: "no-store" });
    const response = await fetch(networkRequest);
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    if (fallbackKey) {
      return caches.match(fallbackKey);
    }

    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    const fallbackPage = url.pathname.includes("observation")
      ? "observation.html"
      : (url.pathname.includes("report") ? "report.html" : "index.html");
    event.respondWith(networkFirst(request, fallbackPage));
    return;
  }

  if (isAppRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
