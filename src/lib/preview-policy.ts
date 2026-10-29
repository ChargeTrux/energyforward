export function canPreviewPage(path: string, targetIsAdmin: boolean) {
  return ["/", "/investor", "/investor/welcome", "/investor/videos", "/investor/project", "/investor/documents", "/customer"].includes(path) || (path === "/admin" && targetIsAdmin);
}

export function previewRequestAllowed(url: URL, method: string, action: string) {
  if (url.pathname.startsWith("/rest/v1/")) return method === "GET" || method === "HEAD";
  if (url.pathname.startsWith("/auth/v1/")) return method === "GET" || (method === "POST" && url.pathname.endsWith("/token") && url.searchParams.get("grant_type") === "refresh_token");
  if (!url.pathname.startsWith("/functions/v1/")) return true;
  const fn = url.pathname.split("/").pop();
  if (fn === "admin-preview") return method === "POST";
  if (fn === "investor-drive") return (method === "POST" && action === "profiles") || (method === "GET" && ["profiles", "list", "file"].includes(action));
  if (fn === "investor-videos") return method === "GET" && ["mine", "catalog", "stream"].includes(action);
  if (fn === "project-pages") return method === "GET" && ["mine", "catalog", "view"].includes(action);
  return false;
}