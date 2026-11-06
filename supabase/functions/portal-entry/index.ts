import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { defaultPortalExpiry, portalLinkExpired } from "../_shared/portal-expiry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : "");
const makeSlug = () => {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const DENIED = "This email can't open this link. Check the spelling or ask EnergyForward for access.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const URL_ = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!URL_ || !key) return json({ error: "Service unavailable" }, 500);
    const admin = createClient(URL_, key);
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "create") {
      const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
      if (!token) return json({ error: "Missing auth" }, 401);
      const { data: u } = await admin.auth.getUser(token);
      if (!u?.user) return json({ error: "Unauthorized" }, 401);
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
      if (!roles?.some((r: { role: string }) => r.role === "admin")) return json({ error: "Forbidden" }, 403);
      if (!Array.isArray(body.emails) || body.emails.length < 1 || body.emails.length > 500) return json({ error: "Give 1–500 emails" }, 400);
      const emails = [...new Set(body.emails.map(norm))].filter((e) => EMAIL_RE.test(e) && e.length <= 255);
      if (!emails.length) return json({ error: "No valid emails" }, 400);
      const slug = makeSlug();
      const { error } = await admin.from("portal_entry_links").insert({ slug, emails, expires_at: defaultPortalExpiry(), created_by: u.user.id, mode: body.mode === "password" ? "password" : "personal" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, slug });
    }

    if (action === "info") {
      const slug = typeof body.slug === "string" ? body.slug.slice(0, 64) : "";
      const { data: link } = await admin.from("portal_entry_links").select("enabled, expires_at, mode").eq("slug", slug).maybeSingle();
      if (!link || !link.enabled) return json({ error: "This link is no longer active." }, 410);
      if (portalLinkExpired(link.expires_at)) return json({ error: "This link has expired. Ask EnergyForward to extend it." }, 410);
      return json({ ok: true, mode: link.mode ?? "personal" });
    }

    if (action === "enter") {
      const slug = typeof body.slug === "string" ? body.slug.slice(0, 64) : "";
      const email = norm(body.email);
      if (!slug || !EMAIL_RE.test(email)) return json({ error: DENIED }, 400);
      const { data: link } = await admin.from("portal_entry_links").select("emails, enabled, expires_at, mode").eq("slug", slug).maybeSingle();
      if (!link || !link.enabled) return json({ error: "This link is no longer active." }, 410);
      if (portalLinkExpired(link.expires_at)) return json({ error: "This link has expired. Ask EnergyForward to extend it." }, 410);
      if (link.mode === "password") return json({ error: "This link needs your password." }, 400);
      if (!(link.emails as string[]).includes(email)) return json({ error: DENIED }, 403);
      const { data: prof } = await admin.from("profiles").select("user_id, is_active").ilike("email", email).maybeSingle();
      if (!prof || prof.is_active === false) return json({ error: DENIED }, 403);
      // Personal (no-password) people must never be asked to set a password.
      await admin.from("profiles").update({ must_change_password: false }).eq("user_id", prof.user_id);
      const { data: gen, error: genErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      const hashed = gen?.properties?.hashed_token;
      if (genErr || !hashed) return json({ error: "Could not sign you in. Please try again." }, 500);
      return json({ ok: true, token_hash: hashed });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
