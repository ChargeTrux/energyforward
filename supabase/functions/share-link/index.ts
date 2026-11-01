import { corsHeaders as baseCors } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { lookupRequest } from "../_shared/geo.ts";
import { shell } from "../_shared/branded-emails.ts";
const esc = (x: string) => x.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KIND_LABEL: Record<string, string> = { project: "Project 3D Demo", video: "Video", document: "Document" };

// Password-protected links to exactly one item. No account needed.
// Drive ids never reach the browser; access is rechecked on every request.
const corsHeaders = {
  ...baseCors,
  "Access-Control-Allow-Headers": `${(baseCors as Record<string, string>)["Access-Control-Allow-Headers"] ?? "authorization, x-client-info, apikey, content-type"}, range`,
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
};
const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const DRIVE_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
const SECRET = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_EXPORT: Record<string, string> = {
  "application/vnd.google-apps.document": "application/pdf",
  "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-apps.presentation": "application/pdf",
  "application/vnd.google-apps.drawing": "application/pdf",
};
const TYPES = new Set(["project", "video", "document"]);
const enc = new TextEncoder();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function gateway(path: string, params: Record<string, string>, extra: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetch(`${GATEWAY}${path}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": DRIVE_KEY ?? "", ...extra },
  });
}

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hashPassword(pw: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256));
  return `pbkdf2$${b64u(salt)}$${b64u(bits)}`;
}
async function checkPassword(pw: string, stored: string) {
  const [, salt] = stored.split("$");
  if (!salt) return false;
  const again = await hashPassword(pw, fromB64u(salt));
  if (again.length !== stored.length) return false;
  let d = 0;
  for (let i = 0; i < again.length; i++) d |= again.charCodeAt(i) ^ stored.charCodeAt(i);
  return d === 0;
}
async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(`share-link:${SECRET}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}
async function makeTicket(linkId: string, hashTag: string) {
  const exp = Date.now() + 2 * 60 * 60_000;
  const body = `${linkId}.${exp}.${hashTag}`;
  return `${b64u(enc.encode(body))}.${await hmac(body)}`;
}
async function readTicket(t: string) {
  const [b, sig] = t.split(".");
  if (!b || !sig) return null;
  const body = new TextDecoder().decode(fromB64u(b));
  if ((await hmac(body)) !== sig) return null;
  const [linkId, exp, tag] = body.split(".");
  if (!linkId || Number(exp) < Date.now()) return null;
  return { linkId, tag };
}
// Changing the password invalidates earlier tickets.
const tagOf = (hash: string) => hash.slice(-10);
const slugify = () => b64u(crypto.getRandomValues(new Uint8Array(9)));
const isLive = (l: { active: boolean; expires_at: string | null }) => l.active && (!l.expires_at || new Date(l.expires_at).getTime() > Date.now());

type Link = { id: string; slug: string; item_type: string; item_id: string; item_name: string; password_hash: string; active: boolean; expires_at: string | null; no_password?: boolean; recipient_first_name?: string | null; recipient_last_name?: string | null; recipient_email?: string | null; user_id?: string | null };

// Alert the admin who created a personal link when it is opened from a new IP.
// deno-lint-ignore no-explicit-any
async function alertNewIp(db: any, link: Link & { created_by?: string | null }, who: string, g: { ip: string; place: string | null; isp: string | null; device: string | null }, ipCount: number, earlierPlaces: string[]) {
  const RESEND = Deno.env.get("RESEND_API_KEY");
  if (!RESEND || !link.created_by) return;
  const { data: p } = await db.from("profiles").select("email").eq("user_id", link.created_by).maybeSingle();
  if (!p?.email) return;
  const earlier = [...new Set(earlierPlaces)].slice(0, 5).map(esc).join(", ") || "unknown";
  const bodyHtml = `
    <p style="margin:0 0 14px;">The personal link for <strong>${esc(link.item_name)}</strong> was just opened from a <strong>new IP address</strong>. It has now been opened from ${ipCount} different IPs.</p>
    <p style="margin:0 0 6px;"><strong>Person:</strong> ${esc(who)}</p>
    <p style="margin:0 0 6px;"><strong>New IP:</strong> ${esc(g.ip)}${g.place ? ` — ${esc(g.place)}` : ""}</p>
    ${g.isp ? `<p style="margin:0 0 6px;"><strong>Network:</strong> ${esc(g.isp)}</p>` : ""}
    ${g.device ? `<p style="margin:0 0 6px;"><strong>Device:</strong> ${esc(g.device)}</p>` : ""}
    <p style="margin:0 0 14px;"><strong>Earlier locations:</strong> ${earlier}</p>
    <p style="margin:0;color:#8a99b3;font-size:12px;">A phone network or VPN can also show a new IP. If this looks wrong, turn the link off in the admin page.</p>`;
  const html = shell({ preheader: `New IP opened ${link.item_name}`, heading: "Link opened from a new IP", bodyHtml, securityNote: "Sent only to the admin who created this link." });
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND}` },
    body: JSON.stringify({ from: "Energy Forward Investor Portal <investor@energyforward.com>", to: [p.email], subject: `Alert: ${link.item_name} opened from a new IP`, html }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, SECRET);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";

    // ---------- Public: open content with a ticket ----------
    if (action === "content") {
      const t = await readTicket(url.searchParams.get("t") ?? "");
      if (!t) return json({ error: "This link has expired. Please enter the password again." }, 401);
      const { data: link } = await db.from("share_links").select("*").eq("id", t.linkId).maybeSingle<Link>();
      if (!link || !isLive(link) || tagOf(link.password_hash) !== t.tag) return json({ error: "This link is no longer available." }, 403);
      if (!LOVABLE_API_KEY || !DRIVE_KEY) return json({ error: "Files are not available right now." }, 500);
      const metaRes = await gateway(`/drive/v3/files/${encodeURIComponent(link.item_id)}`, { fields: "name,mimeType", supportsAllDrives: "true" });
      if (!metaRes.ok) return json({ error: "File not available", status: metaRes.status }, metaRes.status);
      const meta = await metaRes.json() as { name: string; mimeType: string };
      const exportMime = GOOGLE_EXPORT[meta.mimeType];
      const range = req.headers.get("Range");
      const res = exportMime
        ? await gateway(`/drive/v3/files/${encodeURIComponent(link.item_id)}/export`, { mimeType: exportMime })
        : await gateway(`/drive/v3/files/${encodeURIComponent(link.item_id)}`, { alt: "media", supportsAllDrives: "true" }, range ? { Range: range } : {});
      if (!res.ok && res.status !== 206) return json({ error: "Could not open file", status: res.status, details: await res.text() }, res.status);
      const type = link.item_type === "project" ? "text/html; charset=utf-8" : exportMime || meta.mimeType || "application/octet-stream";
      const headers: Record<string, string> = { ...corsHeaders, "Content-Type": type, "Cache-Control": "private, no-store", "Accept-Ranges": "bytes" };
      for (const k of ["Content-Length", "Content-Range"]) { const v = res.headers.get(k); if (v) headers[k] = v; }
      if (url.searchParams.get("download") === "1") headers["Content-Disposition"] = `attachment; filename="${meta.name.replace(/[^\w.\- ]/g, "_")}${exportMime?.includes("sheet") ? ".xlsx" : ""}"`;
      return new Response(res.body, { status: res.status, headers });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ---------- Public: link info + unlock ----------
    if (action === "info" || action === "unlock") {
      const slug = typeof body.slug === "string" ? body.slug.slice(0, 40) : "";
      const { data: link } = await db.from("share_links").select("*").eq("slug", slug).maybeSingle<Link>();
      if (!link || !isLive(link)) return json({ error: link?.expires_at && new Date(link.expires_at).getTime() <= Date.now() ? "This link has expired." : "This link is not available." }, 404);
      if (action === "info") return json({ name: link.item_name, type: link.item_type, personal: !!link.no_password, first_name: link.no_password ? link.recipient_first_name ?? null : null });
      if (link.no_password) {
        // Personal link: the recipient must type the email it was created for.
        const typed = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
        if (!typed || typed !== (link.recipient_email ?? "").toLowerCase()) {
          await new Promise((r) => setTimeout(r, 1200));
          return json({ error: "That email doesn't match this link. Use the email this link was sent to." }, 403);
        }
        await db.from("share_link_views").insert({ link_id: link.id });
        const g = await lookupRequest(req);
        const nm = [link.recipient_first_name, link.recipient_last_name].filter(Boolean).join(" ");
        const who = nm ? `${nm}${link.recipient_email ? ` (${link.recipient_email})` : ""} via link` : `Share link /share/${link.slug}`;
        const { data: prior } = await db.from("activity_locations").select("ip, place").eq("share_link_id", link.id).not("ip", "is", null);
        await db.from("activity_locations").insert({ share_link_id: link.id, who, kind: "share", item_name: link.item_name, ip: g.ip || null, place: g.place, isp: g.isp, device: g.device, lat: g.lat, lon: g.lon });
        const priorIps = new Set((prior ?? []).map((p) => p.ip as string));
        if (g.ip && priorIps.size > 0 && !priorIps.has(g.ip)) {
          try { await alertNewIp(db, link, who, g, [...priorIps].length + 1, (prior ?? []).map((p) => p.place).filter(Boolean) as string[]); }
          catch (e) { console.error("new-ip alert failed", e); }
        }
        return json({ ticket: await makeTicket(link.id, tagOf(link.password_hash)), name: link.item_name, type: link.item_type, open: true, first_name: link.recipient_first_name ?? null });
      }
      const pw = typeof body.password === "string" ? body.password.slice(0, 200) : "";
      if (!(await checkPassword(pw, link.password_hash))) {
        await new Promise((r) => setTimeout(r, 1200)); // slow down guessing
        return json({ error: "Wrong password." }, 403);
      }
      await db.from("share_link_views").insert({ link_id: link.id });
      const g = await lookupRequest(req);
      await db.from("activity_locations").insert({ share_link_id: link.id, who: `Share link /share/${link.slug}`, kind: "share", item_name: link.item_name, ip: g.ip || null, place: g.place, isp: g.isp, device: g.device, lat: g.lat, lon: g.lon });
      return json({ ticket: await makeTicket(link.id, tagOf(link.password_hash)), name: link.item_name, type: link.item_type });
    }

    // ---------- Admin actions ----------
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ error: "Not signed in" }, 401);
    const { data: isAdmin } = await db.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    if (action === "create") {
      const { item_type, item_id, item_name, password, expires_at, profile_id, no_password, first_name, last_name, email, user_id } = body;
      if (!TYPES.has(item_type) || typeof item_id !== "string" || !item_id || item_id.length > 200) return json({ error: "Pick a file, video or page" }, 400);
      const personal = no_password === true;
      if (personal) {
        if (typeof first_name !== "string" || !first_name.trim() || first_name.length > 100) return json({ error: "Enter a first name" }, 400);
        if (typeof last_name !== "string" || last_name.length > 100) return json({ error: "Last name is too long" }, 400);
        if (typeof email !== "string" || !EMAIL_RE.test(email.trim()) || email.length > 255) return json({ error: "Enter a valid email address" }, 400);
      } else if (typeof password !== "string" || password.trim().length < 6 || password.length > 100) return json({ error: "Password must be at least 6 characters" }, 400);
      const exp = expires_at ? new Date(expires_at) : null;
      if (exp && (isNaN(exp.getTime()) || exp.getTime() <= Date.now())) return json({ error: "Expiration must be in the future" }, 400);
      const linkUserId = typeof user_id === "string" && /^[0-9a-f-]{36}$/i.test(user_id) ? user_id : null;
      const { data, error } = await db.from("share_links").insert({
        slug: slugify(), item_type, item_id, item_name: String(item_name ?? "").slice(0, 300),
        profile_id: typeof profile_id === "string" ? profile_id : null,
        password_hash: personal ? `nopw$${b64u(crypto.getRandomValues(new Uint8Array(16)))}` : await hashPassword(password.trim()),
        expires_at: personal ? (exp ?? new Date(Date.now() + 14 * 86400_000)).toISOString() : exp?.toISOString() ?? null, created_by: u.user.id,
        no_password: personal,
        recipient_first_name: personal ? first_name.trim() : null,
        recipient_last_name: personal ? last_name.trim() || null : null,
        recipient_email: personal ? email.trim().toLowerCase() : null,
        user_id: linkUserId,
      }).select("id,slug").single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, ...data });
    }
    // Convert a link between personal (no password) and password modes in place —
    // the URL stays the same. Recipient details are kept both ways so the link
    // can still be emailed after conversion; the frontend sends the email.
    if (action === "convert") {
      const { id, mode, password, first_name, last_name, email } = body;
      if (typeof id !== "string") return json({ error: "Missing link" }, 400);
      const { data: link } = await db.from("share_links").select("*").eq("id", id).maybeSingle<Link>();
      if (!link) return json({ error: "Link not found" }, 404);
      if (mode === "personal") {
        if (typeof first_name !== "string" || !first_name.trim() || first_name.length > 100) return json({ error: "Enter a first name" }, 400);
        if (typeof email !== "string" || !EMAIL_RE.test(email.trim()) || email.length > 255) return json({ error: "Enter a valid email address" }, 400);
        const exp = link.expires_at && new Date(link.expires_at).getTime() > Date.now() ? link.expires_at : new Date(Date.now() + 14 * 86400_000).toISOString();
        const { error } = await db.from("share_links").update({
          no_password: true,
          password_hash: `nopw$${b64u(crypto.getRandomValues(new Uint8Array(16)))}`,
          recipient_first_name: first_name.trim(),
          recipient_last_name: typeof last_name === "string" && last_name.trim() ? last_name.trim() : null,
          recipient_email: email.trim().toLowerCase(),
          expires_at: exp,
        }).eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      if (mode === "password") {
        if (typeof password !== "string" || password.trim().length < 6 || password.length > 100) return json({ error: "Password must be at least 6 characters" }, 400);
        const { error } = await db.from("share_links").update({
          no_password: false,
          password_hash: await hashPassword(password.trim()),
        }).eq("id", id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
      return json({ error: "Unknown mode" }, 400);
    }
    if (action === "update") {
      const { id, password, expires_at, active } = body;
      if (typeof id !== "string") return json({ error: "Missing link" }, 400);
      const patch: Record<string, unknown> = {};
      if (typeof password === "string" && password) {
        if (password.trim().length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
        patch.password_hash = await hashPassword(password.trim());
      }
      if (expires_at !== undefined) patch.expires_at = expires_at ? new Date(expires_at).toISOString() : null;
      if (typeof active === "boolean") patch.active = active;
      const { error } = await db.from("share_links").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (action === "send_email") {
      const { id } = body;
      if (typeof id !== "string") return json({ error: "Missing link" }, 400);
      const { data: link } = await db.from("share_links").select("*").eq("id", id).maybeSingle<Link>();
      if (!link?.no_password || !link.recipient_email) return json({ error: "This link has no recipient" }, 400);
      if (!isLive(link)) return json({ error: "This link is off or expired" }, 400);
      const RESEND = Deno.env.get("RESEND_API_KEY");
      if (!RESEND) return json({ error: "Email not configured" }, 500);
      const url = `https://energyforward.com/share/${link.slug}`;
      const until = new Date(link.expires_at!).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "long" });
      const kindLabel = KIND_LABEL[link.item_type] ?? "Item";
      const bodyHtml = `
        <p style="margin:0 0 14px;">Dear ${esc(link.recipient_first_name ?? "")},</p>
        <p style="margin:0 0 14px;">Welcome to EnergyForward. Energy Forward is building the delivery infrastructure for the next era of energy—connecting technology, operations and execution to move critical projects from ambition to reality.</p>
        <p style="margin:0 0 14px;">We have shared the following with you:</p>
        <p style="margin:0 0 18px;padding:12px 16px;border:1px solid #1f2a44;border-radius:8px;background:#0d1730;"><span style="color:#8a99b3;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">${esc(kindLabel)}</span><br/><strong style="color:#f5a524;font-size:16px;">${esc(link.item_name)}</strong></p>
        <p style="margin:0 0 18px;text-align:center;"><a href="${url}" style="display:inline-block;background:#f5a524;color:#0a1428;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:6px;">Open ${esc(kindLabel)}</a></p>
        <p style="margin:0 0 6px;color:#8a99b3;font-size:12px;">Or copy this link: <a href="${url}" style="color:#f5a524;">${url}</a></p>
        <p style="margin:14px 0 0;padding:10px 14px;border-left:3px solid #f5a524;color:#f4f1ea;font-size:13px;"><strong>This link expires in two weeks (on ${esc(until)}).</strong> It is personal to you — please do not share it with anyone.</p>`;
      const html = shell({ preheader: `EnergyForward shared ${link.item_name} with you`, heading: "Shared with you", bodyHtml, securityNote: "Confidential — Do Not Share. This link was created for you only." });
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND}` },
        body: JSON.stringify({ from: "Energy Forward Investor Portal <investor@energyforward.com>", to: [link.recipient_email], subject: `EnergyForward: ${link.item_name}`, html }),
      });
      if (!r.ok) { const t = await r.text(); console.error("share email failed", r.status, t); return json({ error: "Email failed", status: r.status, details: t }, 502); }
      await db.from("share_links").update({ email_sent_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true });
    }
    if (action === "delete") {
      const { id } = body;
      if (typeof id !== "string") return json({ error: "Missing link" }, 400);
      // Keep map history but detach it; remove open counts; then the link itself.
      await db.from("activity_locations").update({ share_link_id: null }).eq("share_link_id", id);
      await db.from("share_link_views").delete().eq("link_id", id);
      const { error } = await db.from("share_links").delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("share-link error", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
