import { corsHeaders as baseCors } from "npm:@supabase/supabase-js@2/cors";
const corsHeaders: Record<string, string> = {
  ...baseCors,
  "Access-Control-Allow-Headers": `${(baseCors as Record<string, string>)["Access-Control-Allow-Headers"] ?? "authorization, x-client-info, apikey, content-type"}, range`,
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
};
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const DRIVE_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
const VIDEO_FOLDER = "161lKDMLN9DVsiphFBxBrhczpP9K2xrYY";
const DESCRIPTION_MIMES = new Set([
  "text/plain",
  "application/vnd.google-apps.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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

type DriveFile = { id: string; name: string; mimeType: string; size?: string };
type DescriptionRow = { file_id: string; description: string };

async function listFolder(): Promise<DriveFile[]> {
  const res = await gateway("/drive/v3/files", {
    q: `'${VIDEO_FOLDER}' in parents and trashed = false`,
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

const baseName = (name: string) => name.replace(/\.[a-z0-9]+$/i, "").trim().toLocaleLowerCase();
const pretty = (name: string) => name.replace(/\.[a-z0-9]+$/i, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim();
const cleanText = (value: string) => value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 12000);

async function readDescriptionFile(file: DriveFile): Promise<string> {
  const isGoogleDoc = file.mimeType === "application/vnd.google-apps.document";
  const res = isGoogleDoc
    ? await gateway(`/drive/v3/files/${file.id}/export`, { mimeType: "text/plain" })
    : await gateway(`/drive/v3/files/${file.id}`, { alt: "media", supportsAllDrives: "true" });
  if (!res.ok) {
    console.error(`Description file failed [${res.status}]: ${await res.text()}`);
    return "";
  }
  if (file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) return "";
    return cleanText(
      xml
        .replace(/<w:tab\/?[^>]*>/g, "\t")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"),
    );
  }
  if (file.mimeType === "application/msword") {
    const bytes = new Uint8Array(await res.arrayBuffer());
    const printable = Array.from(bytes, (byte) => byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : " ").join("");
    return cleanText(printable.replace(/\s{2,}/g, " "));
  }
  return cleanText(await res.text());
}

async function enrichVideos(files: DriveFile[], manualRows: DescriptionRow[]) {
  const videos = files.filter((file) => file.mimeType.startsWith("video/"));
  const documents = files.filter((file) => DESCRIPTION_MIMES.has(file.mimeType));
  const manual = new Map(manualRows.map((row) => [row.file_id, row.description]));
  return await Promise.all(videos.map(async (video) => {
    const match = documents.find((doc) => baseName(doc.name) === baseName(video.name));
    const automatic = match ? await readDescriptionFile(match) : "";
    return {
      id: video.id,
      name: pretty(video.name),
      size: video.size,
      description: automatic || manual.get(video.id) || "",
      descriptionSource: automatic ? "document" : manual.get(video.id) ? "manual" : "none",
    };
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY || !DRIVE_KEY) return json({ error: "Google Drive is not connected." }, 500);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Not signed in" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const roles = new Set((roleRows ?? []).map((row: { role: string }) => row.role));
    const canOpenVideos = Boolean(isAdmin) || roles.has("investor") || roles.has("video");
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "mine";
    const fileId = url.searchParams.get("file_id") ?? "";

    if (action === "save-description") {
      if (!isAdmin) return json({ error: "Admins only" }, 403);
      const body = await req.json().catch(() => ({}));
      const description = typeof body.description === "string" ? cleanText(body.description) : "";
      if (!fileId || description.length > 12000) return json({ error: "Invalid description" }, 400);
      const { error } = await admin.from("investor_video_descriptions").upsert(
        { file_id: fileId, description, updated_by: user.id },
        { onConflict: "file_id" },
      );
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    const files = await listFolder();
    const videos = files.filter((file) => file.mimeType.startsWith("video/"));

    if (action === "catalog") {
      if (!isAdmin) return json({ error: "Admins only" }, 403);
      const { data: manualRows } = await admin.from("investor_video_descriptions").select("file_id, description");
      return json({ videos: await enrichVideos(files, (manualRows ?? []) as DescriptionRow[]) });
    }

    if (!canOpenVideos) return json({ error: "You do not have access to the video portal" }, 403);
    const { data: grants } = await admin.from("investor_video_access").select("file_id").eq("user_id", user.id);
    const allowed = new Set((grants ?? []).map((grant: { file_id: string }) => grant.file_id));

    if (action === "mine") {
      const { data: manualRows } = await admin.from("investor_video_descriptions").select("file_id, description");
      const enriched = await enrichVideos(files, (manualRows ?? []) as DescriptionRow[]);
      return json({
        fullPortalAccess: Boolean(isAdmin) || roles.has("investor"),
        videos: enriched.filter((video) => allowed.has(video.id) || Boolean(isAdmin)),
      });
    }

    if (action === "stream") {
      if (!fileId) return json({ error: "Missing video" }, 400);
      if (!allowed.has(fileId) && !isAdmin) return json({ error: "Not authorized for this video" }, 403);
      const meta = videos.find((video) => video.id === fileId);
      if (!meta) return json({ error: "Video not found" }, 404);
      const range = req.headers.get("Range");
      const res = await gateway(`/drive/v3/files/${fileId}`, { alt: "media", supportsAllDrives: "true" }, range ? { Range: range } : {});
      if (!res.ok && res.status !== 206) {
        const details = await res.text();
        console.error(`stream failed [${res.status}]: ${details}`);
        return json({ error: "Could not load video", status: res.status, details }, res.status);
      }
      const headers: Record<string, string> = {
        ...corsHeaders,
        "Content-Type": meta.mimeType || "video/mp4",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=300",
        "Accept-Ranges": "bytes",
      };
      for (const key of ["Content-Length", "Content-Range"]) {
        const value = res.headers.get(key);
        if (value) headers[key] = value;
      }
      return new Response(res.body, { status: res.status, headers });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("investor-videos error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});