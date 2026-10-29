import { previewRequestAllowed } from "./preview-policy";
const KEY = "energyforward_view_as";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requested = new URLSearchParams(window.location.search).get("view_as");
if (requested && UUID.test(requested)) sessionStorage.setItem(KEY, requested);
export const previewUserId = sessionStorage.getItem(KEY);
export const isUserPreview = Boolean(previewUserId);
if (isUserPreview) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`) return originalFetch(input, init);
    let action = url.searchParams.get("action") ?? "";
    if (!action && request.method === "POST") {
      const body = await request.clone().json().catch(() => ({}));
      action = body.action ?? "";
    }
    if (!previewRequestAllowed(url, request.method, action)) {
      return new Response(JSON.stringify({ error: "User preview is read-only. Exit preview to make changes." }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname.startsWith("/functions/v1/") && !url.pathname.endsWith("/admin-preview") && previewUserId) {
      url.searchParams.set("preview_user", previewUserId);
      return originalFetch(new Request(url, request));
    }
    return originalFetch(request);
  };
}
export function previewUrl(url: string) {
  if (!previewUserId) return url;
  const parsed = new URL(url, window.location.origin);
  parsed.searchParams.set("preview_user", previewUserId);
  return parsed.toString();
}
export function exitUserPreview() {
  sessionStorage.removeItem(KEY);
  window.location.replace("/admin");
}