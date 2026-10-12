import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  "application/vnd.google-apps.spreadsheet": "application/pdf",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !DRIVE_KEY) {
      return json({ error: "Google Drive is not connected yet." }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Not signed in" }, 401);

    const url = new URL(req.url);
    let action = url.searchParams.get("action") ?? "";
    let profileId = url.searchParams.get("profile_id") ?? "";
    let fileId = url.searchParams.get("file_id") ?? "";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      action = body.action ?? action;
      profileId = body.profile_id ?? profileId;
      fileId = body.file_id ?? fileId;
    }

    // Keep portal names in step with Drive folder names (Drive is the source of truth).
    const syncNames = async (rows: Array<Record<string, unknown>>) => {
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
        .eq("user_id", user.id);
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

    if (!profileId) return json({ error: "Missing profile" }, 400);

    // Authorize: this user must have been granted this profile.
    const { data: grant } = await admin
      .from("investor_profile_access")
      .select("profile_id")
      .eq("user_id", user.id)
      .eq("profile_id", profileId)
      .maybeSingle();
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!grant && !isAdmin) return json({ error: "Not authorized for this profile" }, 403);

    const { data: profile } = await admin
      .from("investor_profiles")
      .select("id, name, drive_url")
      .eq("id", profileId)
      .maybeSingle();
    const rootFolder = folderIdFromUrl(profile?.drive_url ?? null);
    if (!rootFolder) return json({ error: "This profile has no folder yet." }, 404);

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
    if (!isAdmin) {
      const { data: items } = await admin
        .from("investor_document_access")
        .select("item_id")
        .eq("user_id", user.id)
        .eq("profile_id", profileId);
      if (items && items.length) allowed = new Set(items.map((i: { item_id: string }) => i.item_id));
    }
    // Is `id` (or one of its ancestors) in `targets`? Walks up to 8 levels.
    const within = async (id: string, targets: Set<string>) => {
      let frontier = [id];
      for (let d = 0; d < 8 && frontier.length; d++) {
        if (frontier.some((f) => targets.has(f))) return true;
        const next: string[] = [];
        for (const f of frontier) {
          if (f === rootFolder) continue;
          const r = await gateway(`/drive/v3/files/${f}`, { fields: "parents", supportsAllDrives: "true" });
          if (!r.ok) { await r.body?.cancel(); continue; }
          next.push(...((await r.json()).parents ?? []));
        }
        frontier = next;
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
          const r = await gateway(`/drive/v3/files/${id}`, { fields: "id,name,mimeType,size,modifiedTime,trashed", supportsAllDrives: "true" });
          if (!r.ok) { await r.body?.cancel(); return null; }
          const m = await r.json();
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
      return json({ folder, files: orderFiles(parsed.files ?? []) });
    }

    if (action === "file") {
      if (!fileId) return json({ error: "Missing file" }, 400);
      if (allowed && !(await within(fileId, allowed))) return json({ error: "Not authorized for this file" }, 403);
      // Confirm the file lives inside this profile's folder tree.
      const metaRes = await gateway(`/drive/v3/files/${fileId}`, {
        fields: "id,name,mimeType,parents",
        supportsAllDrives: "true",
      });
      const metaText = await metaRes.text();
      if (!metaRes.ok) {
        console.error(`Drive meta failed [${metaRes.status}]: ${metaText}`);
        return json({ error: "File not available", status: metaRes.status, details: metaText }, metaRes.status);
      }
      const meta = JSON.parse(metaText) as { name: string; mimeType: string; parents?: string[] };

      let inTree = false;
      let frontier = meta.parents ?? [];
      for (let depth = 0; depth < 6 && frontier.length && !inTree; depth++) {
        if (frontier.includes(rootFolder)) { inTree = true; break; }
        const next: string[] = [];
        for (const p of frontier) {
          const r = await gateway(`/drive/v3/files/${p}`, { fields: "id,parents", supportsAllDrives: "true" });
          if (!r.ok) continue;
          const pm = await r.json();
          next.push(...(pm.parents ?? []));
        }
        frontier = next;
      }
      if (!inTree) return json({ error: "File is outside your authorized folder" }, 403);

      const exportMime = GOOGLE_EXPORT[meta.mimeType];
      const contentRes = exportMime
        ? await gateway(`/drive/v3/files/${fileId}/export`, { mimeType: exportMime })
        : await gateway(`/drive/v3/files/${fileId}`, { alt: "media", supportsAllDrives: "true" });

      if (!contentRes.ok) {
        const errText = await contentRes.text();
        console.error(`Drive download failed [${contentRes.status}]: ${errText}`);
        return json({ error: "Could not open file", status: contentRes.status, details: errText }, contentRes.status);
      }

      return new Response(contentRes.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": exportMime || meta.mimeType || "application/octet-stream",
          "Content-Disposition": `inline; filename="${meta.name.replace(/"/g, "")}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("investor-drive error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
