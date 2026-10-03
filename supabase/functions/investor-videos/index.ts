import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const DRIVE_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
// "Investor Video" folder in the connected Google Drive.
const VIDEO_FOLDER = "161lKDMLN9DVsiphFBxBrhczpP9K2xrYY";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function gateway(path: string, params: Record<string, string>, headers: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return await fetch(`${GATEWAY}${path}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": DRIVE_KEY ?? "", ...headers },
  });
}

type Video = { id: string; name: string; mimeType: string; size?: string };

async function listFolder(): Promise<Video[]> {
  const res = await gateway("/drive/v3/files", {
    q: `'${VIDEO_FOLDER}' in parents and trashed = false and mimeType contains 'video/'`,
    fields: "files(id,name,mimeType,size)",
    pageSize: "200",
    orderBy: "name",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${res.status}]: ${text}`);
  return JSON.parse(text).files ?? [];
}

const pretty = (n: string) => n.replace(/\.[a-z0-9]+$/i, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY || !DRIVE_KEY) return json({ error: "Google Drive is not connected." }, 500);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await admin.auth.getUser(token);
    const user = u?.user;
    if (!user) return json({ error: "Not signed in" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "mine";
    const fileId = url.searchParams.get("file_id") ?? "";

    if (action === "catalog") {
      if (!isAdmin) return json({ error: "Admins only" }, 403);
      const files = await listFolder();
      return json({ videos: files.map((f) => ({ id: f.id, name: pretty(f.name), size: f.size })) });
    }

    const { data: grants } = await admin.from("investor_video_access").select("file_id").eq("user_id", user.id);
    const allowed = new Set((grants ?? []).map((g: { file_id: string }) => g.file_id));

    if (action === "mine") {
      const files = await listFolder();
      return json({
        videos: files.filter((f) => allowed.has(f.id)).map((f) => ({ id: f.id, name: pretty(f.name), size: f.size })),
      });
    }

    if (action === "stream") {
      if (!fileId) return json({ error: "Missing video" }, 400);
      if (!allowed.has(fileId) && !isAdmin) return json({ error: "Not authorized for this video" }, 403);
      const files = await listFolder();
      const meta = files.find((f) => f.id === fileId);
      if (!meta) return json({ error: "Video not found" }, 404);
      const range = req.headers.get("Range");
      const res = await gateway(`/drive/v3/files/${fileId}`, { alt: "media", supportsAllDrives: "true" }, range ? { Range: range } : {});
      if (!res.ok && res.status !== 206) {
        const t = await res.text();
        console.error(`stream failed [${res.status}]: ${t}`);
        return json({ error: "Could not load video", status: res.status, details: t }, res.status);
      }
      const h: Record<string, string> = {
        ...corsHeaders,
        "Content-Type": meta.mimeType || "video/mp4",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "Accept-Ranges": "bytes",
      };
      for (const k of ["Content-Length", "Content-Range"]) {
        const v = res.headers.get(k);
        if (v) h[k] = v;
      }
      return new Response(res.body, { status: res.status, headers: h });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("investor-videos error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
