import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Emails ONLY the address an admin set for this person (activity_watchers).
// People without an enabled watcher never trigger any email.
const GATEWAY = "https://connector-gateway.lovable.dev/resend";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const LABEL: Record<string, string> = { login: "signed in", video: "opened a video", document: "opened a document", project: "opened a Project 3D Demo page" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ error: "Not signed in" }, 401);
    const b = await req.json().catch(() => ({}));
    const kind = typeof b.kind === "string" && LABEL[b.kind] ? b.kind : null;
    if (!kind) return json({ error: "Bad kind" }, 400);
    const ref = String(b.ref ?? "").slice(0, 200);
    const name = String(b.name ?? "").slice(0, 300);

    const { data: w } = await db.from("activity_watchers").select("notify_email,enabled").eq("user_id", u.user.id).maybeSingle();
    if (!w?.enabled || !w.notify_email) return json({ ok: true, sent: false });

    // Once per sign-in session / once per item per day.
    const day = new Date().toISOString().slice(0, 10);
    const key = kind === "login" ? `login:${ref}` : `${kind}:${ref}:${day}`;
    const { error: dup } = await db.from("activity_alerts_sent").insert({ user_id: u.user.id, dedupe_key: key });
    if (dup) return json({ ok: true, sent: false });

    const { data: p } = await db.from("profiles").select("full_name,email").eq("user_id", u.user.id).maybeSingle();
    const who = p?.full_name ? `${p.full_name} (${p.email})` : (p?.email ?? u.user.email ?? "A user");
    const when = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" }) + " PT";
    const subject = `${who} ${LABEL[kind]}${name ? `: ${name}` : ""}`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1e3a8a">
      <p><strong>${esc(who)}</strong> ${LABEL[kind]}${name ? `: <strong>${esc(name)}</strong>` : ""}.</p>
      <p>Time: ${esc(when)}</p>
      <p style="color:#64748b;font-size:12px">You receive this because an EnergyForward admin turned on activity alerts for this person.</p></div>`;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY"), RESEND = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY || !RESEND) return json({ error: "Email not configured" }, 500);
    const r = await fetch(`${GATEWAY}/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND },
      body: JSON.stringify({ from: "Energy Forward Investor Portal <investor@energyforward.com>", to: [w.notify_email], subject, html }),
    });
    if (!r.ok) { const t = await r.text(); console.error("alert email failed", r.status, t); return json({ error: "Email failed", status: r.status, details: t }, 502); }
    return json({ ok: true, sent: true });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unexpected" }, 500);
  }
});
