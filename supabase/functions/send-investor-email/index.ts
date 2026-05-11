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
const APP_ORIGIN = "https://energyforward.com";

const getResetRedirectUrl = () => `${APP_ORIGIN}/reset-password`;

const forceEnergyForwardResetUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("redirect_to", getResetRedirectUrl());
    return parsed.toString();
  } catch {
    return url;
  }
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

  if (!email || !EMAIL_RE.test(email) || email.length > 255) {
    return json({ error: "Invalid email" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

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
    });
    const result = await sendBrandedEmail(RESEND_API_KEY, {
      to: email,
      subject: tpl.subject,
      html: tpl.html,
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