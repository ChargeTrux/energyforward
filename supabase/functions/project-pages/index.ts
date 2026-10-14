import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// "Project Run" Drive folder (under Investors). Its id is never sent to browsers.
const ROOT_FOLDER = "13tAkcFzs6eneJ-TFqPESFFpFqFW3JFqB";
const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const DRIVE_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
const ORDER_RE = /^\s*(\d+)\s*[-_.)\]]\s*/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function gateway(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return fetch(`${GATEWAY}${path}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": DRIVE_KEY ?? "" },
  });
}

type Page = { id: string; name: string; order: number };
// Short-lived content cache (authorization is still checked on every request).
const htmlCache = new Map<string, { html: string; exp: number }>();

async function listPages(): Promise<Page[]> {
  const res = await gateway("/drive/v3/files", {
    q: `'${ROOT_FOLDER}' in parents and trashed = false and (mimeType = 'text/html' or name contains '.html' or name contains '.htm')`,
    fields: "files(id,name,mimeType)",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${res.status}]: ${text}`);
  const files = (JSON.parse(text).files ?? []) as { id: string; name: string }[];
  return files
    .map((f) => {
      const m = f.name.match(ORDER_RE);
      const clean = f.name.replace(ORDER_RE, "").replace(/\.html?$/i, "").trim();
      return { id: f.id, name: clean || f.name, order: m ? Number(m[1]) : Number.MAX_SAFE_INTEGER };
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY || !DRIVE_KEY) return json({ error: "Google Drive is not connected yet." }, 500);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";
    const fileId = url.searchParams.get("file_id") ?? "";

    // Speed: start Drive downloads while the user is verified; nothing is sent until authorized.
    const cachedHit = action === "view" && fileId ? htmlCache.get(fileId) : undefined;
    const spec = action === "view" && fileId && !(cachedHit && cachedHit.exp > Date.now())
      ? [
          gateway(`/drive/v3/files/${encodeURIComponent(fileId)}`, { fields: "id,name,parents", supportsAllDrives: "true" }),
          gateway(`/drive/v3/files/${encodeURIComponent(fileId)}`, { alt: "media", supportsAllDrives: "true" }),
        ] as const
      : null;
    const discard = () => spec?.forEach((p) => p.then((r) => r.body?.cancel()).catch(() => {}));

    const { data: u, error: ue } = await admin.auth.getUser(token);
    const user = u?.user;
    if (ue || !user) { discard(); return json({ error: ue?.message ?? "Not signed in" }, 401); }

    const [{ data: roleRows }, { data: grants }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", user.id),
      admin.from("project_page_access").select("file_id").eq("user_id", user.id),
    ]);
    const roles = new Set((roleRows ?? []).map((r: { role: string }) => r.role));
    const isAdmin = roles.has("admin");
    const granted = new Set((grants ?? []).map((g: { file_id: string }) => g.file_id));

    if (action === "catalog") {
      if (!isAdmin) return json({ error: "Admins only" }, 403);
      return json({ pages: await listPages() });
    }

    if (action === "mine") {
      if (!isAdmin && !roles.has("project")) return json({ pages: [] });
      const pages = await listPages();
      return json({ pages: isAdmin ? pages : pages.filter((p) => granted.has(p.id)) });
    }

    if (action === "view") {
      if (!fileId) return json({ error: "Missing page" }, 400);
      if (!isAdmin && !(roles.has("project") && granted.has(fileId))) { discard(); return json({ error: "Not authorized for this page" }, 403); }
      const send = (h: string) => new Response(h, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
      });
      const hit = htmlCache.get(fileId);
      if (hit && hit.exp > Date.now()) return send(hit.html);
      // Fetch metadata and content at the same time to cut waiting.
      const [metaRes, res] = await Promise.all(spec ?? [
        gateway(`/drive/v3/files/${encodeURIComponent(fileId)}`, { fields: "id,name,parents", supportsAllDrives: "true" }),
        gateway(`/drive/v3/files/${encodeURIComponent(fileId)}`, { alt: "media", supportsAllDrives: "true" }),
      ]);
      const metaText = await metaRes.text();
      if (!metaRes.ok) { void res.body?.cancel(); return json({ error: "Page not available", status: metaRes.status, details: metaText }, metaRes.status); }
      const meta = JSON.parse(metaText) as { parents?: string[] };
      if (!(meta.parents ?? []).includes(ROOT_FOLDER)) { void res.body?.cancel(); return json({ error: "Page is outside Project Run" }, 403); }
      if (!res.ok) {
        const t = await res.text();
        return json({ error: "Could not open page", status: res.status, details: t }, res.status);
      }
      const html = await res.text();
      htmlCache.set(fileId, { html, exp: Date.now() + 15 * 60_000 });
      return send(html);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("project-pages error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
