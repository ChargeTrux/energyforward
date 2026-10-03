// Adds the signed-in user's credentials to protected video stream requests.
let videoAuth = null;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  if (event.data?.type === "ENERGY_FORWARD_VIDEO_AUTH") {
    videoAuth = { token: event.data.token, apikey: event.data.apikey };
  }
});

// The worker can be stopped and restarted by the browser, losing memory; ask the page again.
async function getAuth(clientId) {
  if (videoAuth) return videoAuth;
  const list = clientId ? [await self.clients.get(clientId)] : await self.clients.matchAll({ type: "window" });
  for (const client of list.filter(Boolean)) {
    const auth = await new Promise((resolve) => {
      const ch = new MessageChannel();
      const t = setTimeout(() => resolve(null), 3000);
      ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data); };
      client.postMessage({ type: "ENERGY_FORWARD_VIDEO_AUTH_REQUEST" }, [ch.port2]);
    });
    if (auth?.token) { videoAuth = auth; return auth; }
  }
  return null;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.endsWith("/functions/v1/investor-videos") || url.searchParams.get("action") !== "stream") return;
  event.respondWith((async () => {
    const auth = await getAuth(event.clientId);
    const headers = new Headers();
    const range = event.request.headers.get("Range");
    if (range) headers.set("Range", range);
    if (auth) {
      headers.set("Authorization", `Bearer ${auth.token}`);
      headers.set("apikey", auth.apikey);
    }
    // Media elements issue "no-cors" requests, which silently drop auth headers; force cors mode.
    return fetch(url.toString(), { method: "GET", headers, mode: "cors", credentials: "omit", cache: "no-store" });
  })());
});
