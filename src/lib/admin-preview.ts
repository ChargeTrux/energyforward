const KEY = "energyforward_view_as";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requested = new URLSearchParams(window.location.search).get("view_as");
if (requested && UUID.test(requested)) sessionStorage.setItem(KEY, requested);
export const previewUserId = sessionStorage.getItem(KEY);
export const isUserPreview = Boolean(previewUserId);
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