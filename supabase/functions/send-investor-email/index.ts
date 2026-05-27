import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  accessRequestEmail,
  resetEmail,
  sendBrandedEmail,
} from "../_shared/branded-emails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_APP_ORIGIN = "https://moving-energyforward.com";
const ALLOWED_ORIGINS = [
  "https://moving-energyforward.com",
  "https://www.moving-energyforward.com",
  "https://energyforward-launchpad.lovable.app",
];

const resolveAppOrigin = (req: Request, bodyOrigin?: string | null): string => {
  const candidates = [bodyOrigin, req.headers.get("origin"), req.headers.get("referer")];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const u = new URL(raw);
      const origin = `${u.protocol}//${u.host}`;
      // Prefer custom/published domains; skip lovable preview subdomains.
      if (origin.includes(".lovable.app") && !ALLOWED_ORIGINS.includes(origin)) continue;
      return origin;
    } catch {
      continue;
    }
  }
  return DEFAULT_APP_ORIGIN;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!RESEND_API_KEY) return json({ error: "Email provider not configured" }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const type = String(body.type ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const portalParam = typeof body.portal === "string"
    ? body.portal.trim().toLowerCase()
    : "";

  if (!email || !EMAIL_RE.test(email) || email.length > 255) {
    return json({ error: "Invalid email" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Helper: does this user have the given portal role?
  const userHasPortalRole = async (
    userId: string,
    portal: string,
  ): Promise<boolean> => {
    if (!portal) return true; // no portal scoping requested
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const set = new Set((roles ?? []).map((r) => String(r.role)));
    // admins can reset on any portal
    if (set.has("admin")) return true;
    return set.has(portal);
  };

  if (type === "check_account") {
    const { data: prof } = await admin
      .from("profiles")
      .select("user_id, is_active")
      .eq("email", email)
      .maybeSingle();
    if (!prof) return json({ exists: false, isActive: false, hasAccess: false });
    const isActive = prof.is_active !== false;
    const hasAccess = portalParam
      ? await userHasPortalRole(prof.user_id as string, portalParam)
      : true;
    // For UX, treat "no access to this portal" the same as "account does not exist"
    // so the gate shows a single clear message without leaking role info.
    return json({
      exists: hasAccess,
      isActive,
      hasAccess,
    });
  }

  if (type === "access_request") {
    // Anti-abuse: only send if a recent signup exists in the DB for this email.
    const { data: signup } = await admin
      .from("email_signups")
      .select("id, name, created_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!signup) return json({ error: "No matching signup" }, 404);
    const ageMs = Date.now() - new Date(signup.created_at as string).getTime();
    if (ageMs > 5 * 60 * 1000) return json({ error: "Signup window expired" }, 400);

    const tpl = accessRequestEmail({
      name: name || (signup.name as string) || "Investor",
      requestDate: new Date(signup.created_at as string).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/New_York",
      }),
    });
    const result = await sendBrandedEmail(RESEND_API_KEY, {
      to: email,
      subject: tpl.subject,
      html: tpl.html,
    });
    if (!result.ok) return json({ error: result.error }, 502);
    return json({ ok: true, id: result.id });
  }

  if (type === "reset") {
    const redirectTo = getResetRedirectUrl();

    // Enforce portal scoping: only send a reset link if the user actually has
    // access to the portal they are resetting from. Always return ok to avoid
    // leaking account existence / role information.
    if (portalParam) {
      const { data: prof } = await admin
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();
      if (!prof) return json({ ok: true });
      const allowed = await userHasPortalRole(prof.user_id as string, portalParam);
      if (!allowed) return json({ ok: true });
    }

    // generateLink returns a recovery action_link WITHOUT sending the default Supabase email.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (error) {
      // Do not leak whether the email exists.
      console.error("generateLink error:", error.message);
      return json({ ok: true });
    }
    const actionLink =
      (data?.properties as { action_link?: string } | undefined)?.action_link;
    if (!actionLink) return json({ ok: true });

    // Look up profile name for personalization (best-effort).
    let displayName = name;
    if (!displayName) {
      const { data: prof } = await admin
        .from("profiles")
        .select("full_name")
        .eq("email", email)
        .maybeSingle();
      displayName = (prof?.full_name as string | null) ?? "";
    }

    const tpl = resetEmail({
      name: displayName || "Investor",
      resetUrl: forceEnergyForwardResetUrl(actionLink),
      expirationMinutes: 60,
      portals: portalParam ? [portalParam] : undefined,
    });
    const result = await sendBrandedEmail(RESEND_API_KEY, {
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      from: tpl.from,
      replyTo: tpl.replyTo,
    });
    if (!result.ok) {
      console.error("Resend error:", result.error);
      // Still return ok to avoid email enumeration.
      return json({ ok: true });
    }
    return json({ ok: true, id: result.id });
  }

  return json({ error: "Unknown type" }, 400);
});