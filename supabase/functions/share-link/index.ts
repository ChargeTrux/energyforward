import { corsHeaders as baseCors } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { lookupRequest } from "../_shared/geo.ts";

// Password-protected links to exactly one item. No account needed.
// Drive ids never reach the browser; access is rechecked on every request.
const corsHeaders = {
  ...baseCors,
  "Access-Control-Allow-Headers": `${(baseCors as Record<string, string>)["Access-Control-Allow-Headers"] ?? "authorization, x-client-info, apikey, content-type"}, range`,
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};
const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const DRIVE_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
const SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_EXPORT: Record<string, string> = {
  "application/vnd.google-apps.document": "application/pdf",
  "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-apps.presentation": "application/pdf",
  "application/vnd.google-apps.drawing": "application/pdf",
};
const TYPES = new Set(["project", "video", "document"]);
const enc = new TextEncoder();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function gateway(path: string, params: Record<string, string>, extra: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetch(`${GATEWAY}${path}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": DRIVE_KEY ?? "", ...extra },
  });
}

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hashPassword(pw: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256));
  return `pbkdf2$${b64u(salt)}$${b64u(bits)}`;
}
async function checkPassword(pw: string, stored: string) {
  const [, salt] = stored.split("$");
  if (!salt) return false;
  const again = await hashPassword(pw, fromB64u(salt));
  if (again.length !== stored.length) return false;
  let d = 0;
  for (let i = 0; i < again.length; i++) d |= again.charCodeAt(i) ^ stored.charCodeAt(i);
  return d === 0;
}
async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(`share-link:${SECRET}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}
async function makeTicket(linkId: string, hashTag: string) {
  const exp = Date.now() + 2 * 60 * 60_000;
  const body = `${linkId}.${exp}.${hashTag}`;
  return `${b64u(enc.encode(body))}.${await hmac(body)}`;
}
async function readTicket(t: string) {
  const [b, sig] = t.split(".");
  if (!b || !sig) return null;
  const body = new TextDecoder().decode(fromB64u(b));
  if ((await hmac(body)) !== sig) return null;
  const [linkId, exp, tag] = body.split(".");
  if (!linkId || Number(exp) < Date.now()) return null;
  return { linkId, tag };
}
// Changing the password invalidates earlier tickets.
const tagOf = (hash: string) => hash.slice(-10);
const slugify = () => b64u(crypto.getRandomValues(new Uint8Array(9)));
const isLive = (l: { active: boolean; expires_at: string | null }) => l.active && (!l.expires_at || new Date(l.expires_at).getTime() > Date.now());

type Link = { id: string; slug: string; item_type: string; item_id: string; item_name: string; password_hash: string; active: boolean; expires_at: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, SECRET);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";

    // ---------- Public: open content with a ticket ----------
    if (action === "content") {
      const t = await readTicket(url.searchParams.get("t") ?? "");
      if (!t) return json({ error: "This link has expired. Please enter the password again." }, 401);
      const { data: link } = await db.from("share_links").select("*").eq("id", t.linkId).maybeSingle<Link>();
      if (!link || !isLive(link) || tagOf(link.password_hash) !== t.tag) return json({ error: "This link is no longer available." }, 403);
      if (!LOVABLE_API_KEY || !DRIVE_KEY) return json({ error: "Files are not available right now." }, 500);
      const metaRes = await gateway(`/drive/v3/files/${encodeURIComponent(link.item_id)}`, { fields: "name,mimeType", supportsAllDrives: "true" });
      if (!metaRes.ok) return json({ error: "File not available", status: metaRes.status }, metaRes.status);
      const meta = await metaRes.json() as { name: string; mimeType: string };
      const exportMime = GOOGLE_EXPORT[meta.mimeType];
      const range = req.headers.get("Range");
      const res = exportMime
        ? await gateway(`/drive/v3/files/${encodeURIComponent(link.item_id)}/export`, { mimeType: exportMime })
        : await gateway(`/drive/v3/files/${encodeURIComponent(link.item_id)}`, { alt: "media", supportsAllDrives: "true" }, range ? { Range: range } : {});
      if (!res.ok && res.status !== 206) return json({ error: "Could not open file", status: res.status, details: await res.text() }, res.status);
      const type = link.item_type === "project" ? "text/html; charset=utf-8" : exportMime || meta.mimeType || "application/octet-stream";
      const headers: Record<string, string> = { ...corsHeaders, "Content-Type": type, "Cache-Control": "private, no-store", "Accept-Ranges": "bytes" };
      for (const k of ["Content-Length", "Content-Range"]) { const v = res.headers.get(k); if (v) headers[k] = v; }
      if (url.searchParams.get("download") === "1") headers["Content-Disposition"] = `attachment; filename="${meta.name.replace(/[^\w.\- ]/g, "_")}${exportMime?.includes("sheet") ? ".xlsx" : ""}"`;
      return new Response(res.body, { status: res.status, headers });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ---------- Public: link info + unlock ----------
    if (action === "info" || action === "unlock") {
      const slug = typeof body.slug === "string" ? body.slug.slice(0, 40) : "";
      const { data: link } = await db.from("share_links").select("*").eq("slug", slug).maybeSingle<Link>();
      if (!link || !isLive(link)) return json({ error: link?.expires_at && new Date(link.expires_at).getTime() <= Date.now() ? "This link has expired." : "This link is not available." }, 404);
      if (action === "info") return json({ name: link.item_name, type: link.item_type });
      const pw = typeof body.password === "string" ? body.password.slice(0, 200) : "";
      if (!(await checkPassword(pw, link.password_hash))) {
        await new Promise((r) => setTimeout(r, 1200)); // slow down guessing
        return json({ error: "Wrong password." }, 403);
      }
      await db.from("share_link_views").insert({ link_id: link.id });
      const g = await lookupRequest(req);
      await db.from("activity_locations").insert({ share_link_id: link.id, who: `Share link /share/${link.slug}`, kind: "share", item_name: link.item_name, ip: g.ip || null, place: g.place, isp: g.isp, device: g.device, lat: g.lat, lon: g.lon });
      return json({ ticket: await makeTicket(link.id, tagOf(link.password_hash)), name: link.item_name, type: link.item_type });
    }

    // ---------- Admin actions ----------
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ error: "Not signed in" }, 401);
    const { data: isAdmin } = await db.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    if (action === "create") {
      const { item_type, item_id, item_name, password, expires_at, profile_id } = body;
      if (!TYPES.has(item_type) || typeof item_id !== "string" || !item_id || item_id.length > 200) return json({ error: "Pick a file, video or page" }, 400);
      if (typeof password !== "string" || password.trim().length < 6 || password.length > 100) return json({ error: "Password must be at least 6 characters" }, 400);
      const exp = expires_at ? new Date(expires_at) : null;
      if (exp && (isNaN(exp.getTime()) || exp.getTime() <= Date.now())) return json({ error: "Expiration must be in the future" }, 400);
      const { data, error } = await db.from("share_links").insert({
        slug: slugify(), item_type, item_id, item_name: String(item_name ?? "").slice(0, 300),
        profile_id: typeof profile_id === "string" ? profile_id : null,
        password_hash: await hashPassword(password.trim()), expires_at: exp?.toISOString() ?? null, created_by: u.user.id,
      }).select("id,slug").single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, ...data });
    }
    if (action === "update") {
      const { id, password, expires_at, active } = body;
      if (typeof id !== "string") return json({ error: "Missing link" }, 400);
      const patch: Record<string, unknown> = {};
      if (typeof password === "string" && password) {
        if (password.trim().length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
        patch.password_hash = await hashPassword(password.trim());
      }
      if (expires_at !== undefined) patch.expires_at = expires_at ? new Date(expires_at).toISOString() : null;
      if (typeof active === "boolean") patch.active = active;
      const { error } = await db.from("share_links").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("share-link error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
