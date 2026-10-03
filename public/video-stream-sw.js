let videoAuth = null;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  if (event.data?.type === "ENERGY_FORWARD_VIDEO_AUTH") {
    videoAuth = { token: event.data.token, apikey: event.data.apikey };
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!videoAuth || !url.pathname.endsWith("/functions/v1/investor-videos") || url.searchParams.get("action") !== "stream") return;
  const headers = new Headers(event.request.headers);
  headers.set("Authorization", `Bearer ${videoAuth.token}`);
  headers.set("apikey", videoAuth.apikey);
  event.respondWith(fetch(new Request(event.request, { headers })));
});