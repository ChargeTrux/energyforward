import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { PreviewError, resolvePreviewUser } from "../_shared/preview-user.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return json({ error: "Not signed in" }, 401);
    const body = await req.json();
    if (typeof body.user_id !== "string" || !body.user_id) return json({ error: "Missing user" }, 400);
    const target = await resolvePreviewUser(db, data.user.id, body.user_id, "info", ["info"]);
    const { data: profile, error: profileError } = await db.from("profiles").select("user_id,full_name,email,is_active").eq("user_id", target.id).single();
    if (profileError) return json({ error: "Could not load user" }, 503);
    return json({ profile });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not start preview" }, e instanceof PreviewError ? e.status : 500);
  }
});