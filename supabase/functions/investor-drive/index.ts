import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PreviewError, resolvePreviewUser } from "../_shared/preview-user.ts";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const DRIVE_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
const FOLDER = "application/vnd.google-apps.folder";
// Leading order number like "1 - ", "4-1 ", "2.3_" sets the order and is hidden.
const NUM_RE = /^\s*(\d+(?:[-.]\d+)*)\s*(?:[-_.)\]]\s*|\s+)/;
type Named = { name: string; mimeType?: string };
function orderFiles<T extends Named>(files: T[]): T[] {
  const key = (n: string) => { const m = n.match(NUM_RE); return m ? m[1].split(/[-.]/).map(Number) : null; };
  return files
    .map((f) => ({ f, k: key(f.name) }))
    .sort((a, b) => {
      const fa = a.f.mimeType === FOLDER ? 0 : 1, fb = b.f.mimeType === FOLDER ? 0 : 1;
      if (fa !== fb) return fa - fb;
      if (a.k && b.k) {
        for (let i = 0; i < Math.max(a.k.length, b.k.length); i++) {
          const d = (a.k[i] ?? -1) - (b.k[i] ?? -1);
          if (d) return d;
        }
      } else if (a.k || b.k) return a.k ? -1 : 1;
      return a.f.name.localeCompare(b.f.name, undefined, { numeric: true });
    })
    .map(({ f }) => ({ ...f, name: f.name.replace(NUM_RE, "").trim() || f.name }));
}

const GOOGLE_EXPORT: Record<string, string> = {
  "application/vnd.google-apps.document": "application/pdf",
  "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-apps.presentation": "application/pdf",
  "application/vnd.google-apps.drawing": "application/pdf",
};

function folderIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/folders\/([A-Za-z0-9_-]+)/) || url.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{20,}$/.test(url.trim()) ? url.trim() : null);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function gateway(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return await fetch(`${GATEWAY}${path}${qs ? `?${qs}` : ""}`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": DRIVE_KEY ?? "",
    },
  });
}

// Short-lived encrypted download tickets so the browser's own download manager can
// fetch large spreadsheets directly (no auth header on navigations, no Drive ids in URLs).
const TICKET_TTL_MS = 120_000;
const parentCache = new Map<string, { p: string[]; t: number }>();
async function getParents(id: string): Promise<string[]> {
  const c = parentCache.get(id);
  if (c && Date.now() - c.t < 300_000) return c.p;
  const r = await gateway(`/drive/v3/files/${id}`, { fields: "parents", supportsAllDrives: "true" });
  if (!r.ok) { await r.body?.cancel(); return []; }
  const p = ((await r.json()).parents ?? []) as string[];
  parentCache.set(id, { p, t: Date.now() });
  return p;
}

// Short-lived server copy of small opened files (authorization is still checked on every request).
const CACHE_MAX_FILE = 12 * 1048576;
const CACHE_MAX_TOTAL = 120 * 1048576;
const CACHE_TTL_MS = 10 * 60_000;
type Cached = { buf: Uint8Array<ArrayBuffer>; type: string; name: string; srcMime: string; exp: number };
const contentCache = new Map<string, Cached>();
function rememberContent(id: string, c: Omit<Cached, "exp">) {
  contentCache.delete(id);
  contentCache.set(id, { ...c, exp: Date.now() + CACHE_TTL_MS });
  let total = 0;
  for (const v of contentCache.values()) total += v.buf.byteLength;
  for (const [k, v] of contentCache) {
    if (total <= CACHE_MAX_TOTAL) break;
    contentCache.delete(k);
    total -= v.buf.byteLength;
  }
}

let ticketKey: Promise<CryptoKey> | null = null;
function getTicketKey() {
  ticketKey ??= crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(`dl-ticket:${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`))
    .then((raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]));
  return ticketKey;
}
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function makeTicket(data: { f: string; n: string; m: string }) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getTicketKey(),
    new TextEncoder().encode(JSON.stringify({ ...data, e: Date.now() + TICKET_TTL_MS }))));
  const out = new Uint8Array(iv.length + ct.length); out.set(iv); out.set(ct, iv.length);
  return b64u(out);
}
async function readTicket(t: string): Promise<{ f: string; n: string; m: string } | null> {
  try {
    const raw = unb64u(t);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, await getTicketKey(), raw.slice(12));
    const d = JSON.parse(new TextDecoder().decode(pt));
    return typeof d.e === "number" && d.e > Date.now() ? d : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !DRIVE_KEY) {
      return json({ error: "Google Drive is not connected yet." }, 500);
    }

    const early = new URL(req.url);
    if (early.searchParams.has("preview_user") && early.searchParams.get("action") === "download") return json({ error: "Use the authorized document viewer" }, 403);
    if (early.searchParams.get("action") === "download") {
      const t = await readTicket(early.searchParams.get("t") ?? "");
      if (!t) return new Response("This download link has expired. Please click the file again.", { status: 410, headers: corsHeaders });
      const r = t.m.startsWith("application/vnd.google-apps.")
        ? await gateway(`/drive/v3/files/${t.f}/export`, { mimeType: GOOGLE_EXPORT[t.m] ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
        : await gateway(`/drive/v3/files/${t.f}`, { alt: "media", supportsAllDrives: "true" });
      if (!r.ok) { await r.body?.cancel(); return new Response("Could not download this file.", { status: 502, headers: corsHeaders }); }
      const name = /\.(xlsx|xlsm|xls|csv)$/i.test(t.n) ? t.n : `${t.n}.xlsx`;
      const len = r.headers.get("Content-Length");
      return new Response(r.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": r.headers.get("Content-Type") ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]|"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
          ...(len ? { "Content-Length": len } : {}),
          "Cache-Control": "private, no-store",
        },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const url = new URL(req.url);
    let action = url.searchParams.get("action") ?? "";
    let profileId = url.searchParams.get("profile_id") ?? "";
    let fileId = url.searchParams.get("file_id") ?? "";
    // Speed: for file opens, start the Drive metadata + content requests while we verify the
    // user. Nothing is returned to the browser until every authorization check has passed.
    const isTicketReq = url.searchParams.get("mode") === "ticket";
    let spec: { metaP: Promise<Response>; contentP: Promise<Response> | null; exportMime: string | undefined } | null = null;
    if (req.method === "GET" && action === "file" && fileId && !contentCache.has(fileId)) {
      const hint = url.searchParams.get("mime") ?? "";
      const exportMime = GOOGLE_EXPORT[hint];
      spec = {
        metaP: gateway(`/drive/v3/files/${fileId}`, { fields: "id,name,mimeType,parents", supportsAllDrives: "true" }),
        contentP: isTicketReq || !hint ? null : (exportMime
          ? gateway(`/drive/v3/files/${fileId}/export`, { mimeType: exportMime })
          : gateway(`/drive/v3/files/${fileId}`, { alt: "media", supportsAllDrives: "true" })),
        exportMime,
      };
    }
    const discardEarly = () => {
      spec?.metaP.then((r) => r.body?.cancel()).catch(() => {});
      spec?.contentP?.then((r) => r.body?.cancel()).catch(() => {});
    };

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) { discardEarly(); return json({ error: "Not signed in" }, 401); }
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      action = body.action ?? action;
      profileId = body.profile_id ?? profileId;
      fileId = body.file_id ?? fileId;
    }
    if (url.searchParams.has("preview_user") && req.method !== "GET" && !(req.method === "POST" && action === "profiles")) { discardEarly(); return json({ error: "User preview is read-only" }, 403); }
    if (url.searchParams.has("preview_user") && isTicketReq) { discardEarly(); return json({ error: "Download tickets are unavailable in user preview" }, 403); }
    let effective;
    try { effective = await resolvePreviewUser(admin, user.id, url.searchParams.get("preview_user"), action, ["profiles", "list", "file"]); }
    catch (e) { discardEarly(); throw e; }

    // Keep portal names in step with Drive folder names (Drive is the source of truth).
    const syncNames = async (rows: Array<Record<string, unknown>>) => {
      if (effective.preview) return;
      await Promise.all(rows.map(async (p) => {
        const fid = folderIdFromUrl(p.drive_url as string | null);
        if (!fid) return;
        const r = await gateway(`/drive/v3/files/${fid}`, { fields: "name", supportsAllDrives: "true" });
        if (!r.ok) { await r.body?.cancel(); return; }
        const { name } = await r.json();
        if (name && name !== p.name) {
          await admin.from("investor_profiles").update({ name }).eq("id", p.id as string);
          p.name = name;
        }
      }));
    };

    if (action === "sync_names") {
      const { data: isAdm } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdm) return json({ error: "Admins only" }, 403);
      const { data: all } = await admin.from("investor_profiles").select("id, name, drive_url");
      await syncNames((all ?? []) as Array<Record<string, unknown>>);
      return json({ ok: true });
    }

    if (action === "profiles") {
      const { data: access } = await admin
        .from("investor_profile_access")
        .select("profile_id")
        .eq("user_id", effective.id);
      const ids = (access ?? []).map((a: { profile_id: string }) => a.profile_id);
      if (!ids.length) return json({ profiles: [] });
      const { data: profiles } = await admin
        .from("investor_profiles")
        .select("id, name, description, sort_order, drive_url")
        .in("id", ids)
        .order("sort_order");
      await syncNames((profiles ?? []) as Array<Record<string, unknown>>);
      return json({
        profiles: (profiles ?? []).map((p: Record<string, unknown>) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          sort_order: p.sort_order,
          ready: !!folderIdFromUrl(p.drive_url as string | null),
        })),
      });
    }

    if (!profileId) { discardEarly(); return json({ error: "Missing profile" }, 400); }

    // Authorize: this user must have been granted this profile. All lookups run at once.
    const [grantResult, roleResult, profileResult, itemResult] = await Promise.all([
      admin.from("investor_profile_access").select("profile_id").eq("user_id", effective.id).eq("profile_id", profileId).maybeSingle(),
      admin.rpc("has_role", { _user_id: effective.id, _role: "admin" }),
      admin.from("investor_profiles").select("id, name, drive_url").eq("id", profileId).maybeSingle(),
      admin.from("investor_document_access").select("item_id").eq("user_id", effective.id).eq("profile_id", profileId),
    ]);
    if (grantResult.error || roleResult.error || profileResult.error || itemResult.error) { discardEarly(); return json({ error: "Could not verify document access" }, 503); }
    const grant = grantResult.data;
    const isAdmin = roleResult.data;
    const profile = profileResult.data;
    const itemRows = itemResult.data;
    if (!grant && !isAdmin) { discardEarly(); return json({ error: "Not authorized for this profile" }, 403); }
    const rootFolder = folderIdFromUrl(profile?.drive_url ?? null);
    if (!rootFolder) { discardEarly(); return json({ error: "This profile has no folder yet." }, 404); }

    if (action === "rename_folder") {
      if (!isAdmin) return json({ error: "Admins only" }, 403);
      const name = String(profile?.name ?? "").trim();
      if (!name) return json({ error: "Missing name" }, 400);
      const r = await fetch(`${GATEWAY}/drive/v3/files/${rootFolder}?supportsAllDrives=true&fields=id,name`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": DRIVE_KEY ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) {
        const details = await r.text();
        console.error(`Drive rename failed [${r.status}]: ${details}`);
        return json({ error: "Could not rename the Drive folder", status: r.status, details }, r.status);
      }
      return json({ ok: true, name });
    }

    // Specific subfolder/file grants. None for this profile = whole folder.
    let allowed: Set<string> | null = null;
    if (!isAdmin && itemRows && itemRows.length) allowed = new Set(itemRows.map((i: { item_id: string }) => i.item_id));
    // Is `id` (or one of its ancestors) in `targets`? Walks up to 8 levels, parents cached briefly.
    const within = async (id: string, targets: Set<string>) => {
      let frontier = [id];
      for (let d = 0; d < 8 && frontier.length; d++) {
        if (frontier.some((f) => targets.has(f))) return true;
        const lists = await Promise.all(frontier.filter((f) => f !== rootFolder).map(getParents));
        frontier = lists.flat();
      }
      return false;
    };

    if (action === "list") {
      const requested = url.searchParams.get("folder_id");
      const folder = requested || rootFolder;
      if (requested && requested !== rootFolder) {
        if (!(await within(requested, new Set([rootFolder])))) return json({ error: "Folder is outside your authorized folder" }, 403);
        if (allowed && !(await within(requested, allowed))) return json({ error: "Not authorized for this folder" }, 403);
      } else if (allowed) {
        // Top level for restricted users = exactly the items they were given.
        const metas = await Promise.all([...allowed].map(async (id) => {
          const r = await gateway(`/drive/v3/files/${id}`, { fields: "id,name,mimeType,size,modifiedTime,trashed,parents", supportsAllDrives: "true" });
          if (!r.ok) { await r.body?.cancel(); return null; }
          const m = await r.json();
          if (m.parents) parentCache.set(id, { p: m.parents, t: Date.now() });
          delete m.parents;
          return m.trashed ? null : m;
        }));
        const files = orderFiles(metas.filter(Boolean));
        return json({ folder: rootFolder, files });
      }
      const res = await gateway("/drive/v3/files", {
        q: `'${folder.replace(/'/g, "")}' in parents and trashed = false`,
        fields: "files(id,name,mimeType,size,modifiedTime,iconLink)",
        pageSize: "200",
        orderBy: "folder,name",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`Drive list failed [${res.status}]: ${text}`);
        return json({ error: "Could not load documents", status: res.status, details: text }, res.status);
      }
      const parsed = JSON.parse(text);
      // Children of a listed folder: remember their parent so later file opens skip Drive lookups.
      const now = Date.now();
      for (const f of (parsed.files ?? []) as { id: string }[]) if (!parentCache.has(f.id)) parentCache.set(f.id, { p: [folder], t: now });
      return json({ folder, files: orderFiles(parsed.files ?? []) });
    }

    if (action === "file") {
      if (!fileId) return json({ error: "Missing file" }, 400);
      const cached = contentCache.get(fileId);
      const fresh = cached && cached.exp > Date.now() ? cached : null;
      let meta: { name: string; mimeType: string; parents?: string[] };
      if (fresh) meta = { name: fresh.name, mimeType: fresh.srcMime };
      else {
        const metaRes = await (spec?.metaP ?? gateway(`/drive/v3/files/${fileId}`, { fields: "id,name,mimeType,parents", supportsAllDrives: "true" }));
        const metaText = await metaRes.text();
        if (!metaRes.ok) {
          discardEarly();
          console.error(`Drive meta failed [${metaRes.status}]: ${metaText}`);
          return json({ error: "File not available", status: metaRes.status, details: metaText }, metaRes.status);
        }
        meta = JSON.parse(metaText);
        parentCache.set(fileId, { p: meta.parents ?? [], t: Date.now() });
      }
      const exportMime = GOOGLE_EXPORT[meta.mimeType];
      let contentP: Promise<Response> | null = null;
      if (!fresh && !isTicketReq) {
        if (spec?.contentP && spec.exportMime === exportMime) contentP = spec.contentP;
        else {
          spec?.contentP?.then((r) => r.body?.cancel()).catch(() => {});
          contentP = exportMime
            ? gateway(`/drive/v3/files/${fileId}/export`, { mimeType: exportMime })
            : gateway(`/drive/v3/files/${fileId}`, { alt: "media", supportsAllDrives: "true" });
        }
      }
      const [inTree, okItem] = await Promise.all([
        within(fileId, new Set([rootFolder])),
        allowed ? within(fileId, allowed) : Promise.resolve(true),
      ]);
      if (!inTree || !okItem) {
        contentP?.then((r) => r.body?.cancel()).catch(() => {});
        return json({ error: !inTree ? "File is outside your authorized folder" : "Not authorized for this file" }, 403);
      }

      if (isTicketReq) {
        const isSheet = /spreadsheet|ms-excel|text\/csv/i.test(meta.mimeType) || /\.(xlsx|xlsm|xls|csv)$/i.test(meta.name);
        if (!isSheet) return json({ error: "Only spreadsheets can be downloaded" }, 403);
        return json({ ticket: await makeTicket({ f: fileId, n: meta.name, m: meta.mimeType }) });
      }

      const headersFor = (type: string, len?: string | null) => ({
        ...corsHeaders,
        "Content-Type": type,
        "Content-Disposition": `inline; filename="${meta.name.replace(/[^\x20-\x7e]|"/g, "_")}"`,
        ...(len ? { "Content-Length": len } : {}),
        "Cache-Control": "private, no-store",
      });
      if (fresh) return new Response(fresh.buf, { headers: headersFor(fresh.type, String(fresh.buf.byteLength)) });

      const contentRes = await contentP!;
      if (!contentRes.ok) {
        const errText = await contentRes.text();
        console.error(`Drive download failed [${contentRes.status}]: ${errText}`);
        return json({ error: "Could not open file", status: contentRes.status, details: errText }, contentRes.status);
      }
      const type = exportMime || meta.mimeType || "application/octet-stream";
      const len = contentRes.headers.get("Content-Length");
      if (len && Number(len) <= CACHE_MAX_FILE) {
        // Small files: keep a short-lived server copy so the next open skips Google Drive entirely.
        const buf = new Uint8Array(await contentRes.arrayBuffer());
        rememberContent(fileId, { buf, type, name: meta.name, srcMime: meta.mimeType });
        return new Response(buf, { headers: headersFor(type, String(buf.byteLength)) });
      }
      return new Response(contentRes.body, { headers: headersFor(type, len) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("investor-drive error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, e instanceof PreviewError ? e.status : 500);
  }
});
