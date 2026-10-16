import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { shell } from "../_shared/branded-emails.ts";
import { lookupRequest } from "../_shared/geo.ts";

// Emails ONLY the address an admin set for this person (activity_watchers).
// People without an enabled watcher never trigger any email.
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

    // Record approximate location for the admin activity map (every event, alerts or not).
    const { ip, device, place, isp, lat, lon } = await lookupRequest(req);
    const { data: p } = await db.from("profiles").select("full_name,email").eq("user_id", u.user.id).maybeSingle();
    const who = p?.full_name ? `${p.full_name} (${p.email})` : (p?.email ?? u.user.email ?? "A user");
    await db.from("activity_locations").insert({ user_id: u.user.id, who, kind, item_name: name, ip: ip || null, place, isp, device, lat, lon });

    const { data: w } = await db.from("activity_watchers").select("notify_email,enabled").eq("user_id", u.user.id).maybeSingle();
    if (!w?.enabled || !w.notify_email) return json({ ok: true, sent: false });

    // Once per sign-in session / once per item per day.
    const day = new Date().toISOString().slice(0, 10);
    const key = kind === "login" ? `login:${ref}` : `${kind}:${ref}:${day}`;
    const { error: dup } = await db.from("activity_alerts_sent").insert({ user_id: u.user.id, dedupe_key: key });
    if (dup) return json({ ok: true, sent: false });

    const when = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" }) + " PT";
    const subject = `${who} ${LABEL[kind]}${name ? `: ${name}` : ""}`;
    const mapUrl = lat != null && lon != null ? `https://www.google.com/maps?q=${lat},${lon}` : undefined;
    const row = (k: string, v: string) => `<tr><td style="padding:10px 16px;border-top:1px solid #1f2a44;color:#8a99b3;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;width:120px;vertical-align:top;">${k}</td><td style="padding:10px 16px;border-top:1px solid #1f2a44;color:#f4f1ea;font-size:14px;">${v}</td></tr>`;
    const bodyHtml = `
      <p style="margin:0 0 16px;"><strong style="color:#f4f1ea;">${esc(who)}</strong> ${LABEL[kind]}${name ? `: <strong style="color:#f5a524;">${esc(name)}</strong>` : ""}.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #1f2a44;border-radius:8px;background:#0d1730;font-family:Arial,Helvetica,sans-serif;">
        ${row("Time", esc(when))}
        ${row("Device", esc(device))}
        ${row("IP address", esc(ip || "Unknown"))}
        ${row("Location", esc(place) + (isp ? `<div style="color:#8a99b3;font-size:12px;margin-top:2px;">${esc(isp)}</div>` : ""))}
      </table>
      <p style="margin:14px 0 0;color:#8a99b3;font-size:12px;">Location is estimated from the IP address and may be approximate (VPNs and mobile networks can show a different city).</p>`;
    const html = shell({
      preheader: subject,
      heading: "Activity alert",
      bodyHtml,
      ctaLabel: mapUrl ? "View location on map" : undefined,
      ctaUrl: mapUrl,
      securityNote: "You receive this because an EnergyForward admin turned on activity alerts for this person.",
    });
    const RESEND = Deno.env.get("RESEND_API_KEY");
    if (!RESEND) return json({ error: "Email not configured" }, 500);
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND}` },
      body: JSON.stringify({ from: "Energy Forward Investor Portal <investor@energyforward.com>", to: w.notify_email.split(/[\s,;]+/).filter((x: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)).slice(0, 10), subject, html }),
    });
    if (!r.ok) { const t = await r.text(); console.error("alert email failed", r.status, t); return json({ error: "Email failed", status: r.status, details: t }, 502); }
    return json({ ok: true, sent: true });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unexpected" }, 500);
  }
});
