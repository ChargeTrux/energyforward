import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DocsTree } from "@/components/DocsTree";

type Item = { id: string; name: string };
type Kind = "project" | "video" | "document";
type LinkRow = { id: string; slug: string; item_type: Kind; item_name: string; active: boolean; expires_at: string | null; created_at: string; no_password: boolean; recipient_first_name: string | null; recipient_last_name: string | null; recipient_email: string | null; email_sent_at: string | null };

const FN = "share-link";
const SITE = "https://energyforward.com";
const KIND_LABEL: Record<Kind, string> = { project: "Project 3D Demo", video: "Video", document: "Document" };
const linkUrl = (slug: string) => `${SITE}/share/${slug}`;

async function call(action: string, body: object) {
  const { data, error } = await supabase.functions.invoke(`${FN}?action=${action}`, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx ? (await ctx.json().catch(() => ({}))).error : null;
    throw new Error(msg ?? error.message);
  }
  return data;
}

/** Create password-protected public links to exactly one item, with optional expiry. */
export function ShareLinksPanel({ videos, pages }: { videos: Item[]; pages: Item[] }) {
  const { toast } = useToast();
  const [kind, setKind] = useState<Kind>("video");
  const [item, setItem] = useState<(Item & { profileId?: string }) | null>(null);
  const [password, setPassword] = useState("");
  const [personal, setPersonal] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [opens, setOpens] = useState<Map<string, { count: number; last: string }>>(new Map());

  const load = useCallback(async () => {
    setLoadingLinks(true);
    setLoadError(null);
    try {
    const [{ data: l, error: linkError }, { data: v, error: viewError }] = await Promise.all([
      supabase.from("share_links").select("id,slug,item_type,item_name,active,expires_at,created_at,no_password,recipient_first_name,recipient_last_name,recipient_email,email_sent_at").order("created_at", { ascending: false }),
      supabase.from("share_link_views").select("link_id,viewed_at").order("viewed_at", { ascending: false }).limit(1000),
    ]);
    if (linkError) throw linkError;
    setLinks((l ?? []) as LinkRow[]);
    if (viewError) throw viewError;
    const m = new Map<string, { count: number; last: string }>();
    for (const r of v ?? []) { const e = m.get(r.link_id); if (e) e.count++; else m.set(r.link_id, { count: 1, last: r.viewed_at }); }
    setOpens(m);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : (e as { message?: string }).message ?? "Could not load share links.");
    } finally {
      setLoadingLinks(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const copy = (slug: string) => { void navigator.clipboard.writeText(linkUrl(slug)); toast({ title: "Link copied", description: linkUrl(slug) }); };

  const create = async (send = false) => {
    if (!item) { toast({ title: "Pick an item first", variant: "destructive" }); return; }
    if (personal) {
      if (!first.trim()) { toast({ title: "Enter a first name", variant: "destructive" }); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast({ title: "Enter a valid email address", variant: "destructive" }); return; }
    } else if (password.trim().length < 6) { toast({ title: "Password needs at least 6 characters", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const r = await call("create", personal
        ? { item_type: kind, item_id: item.id, item_name: item.name, profile_id: item.profileId, no_password: true, first_name: first.trim(), last_name: last.trim(), email: email.trim() }
        : { item_type: kind, item_id: item.id, item_name: item.name, profile_id: item.profileId, password: password.trim(), expires_at: expires ? new Date(expires).toISOString() : null });
      copy(r.slug);
      if (send) {
        try { await call("send_email", { id: r.id }); toast({ title: "Email sent", description: `Sent to ${email.trim()}` }); }
        catch (e) { toast({ title: "Link created, but the email failed", description: (e as Error).message, variant: "destructive" }); }
      }
      setPassword(""); setExpires(""); setItem(null); setFirst(""); setLast(""); setEmail("");
      await load();
    } catch (e) { toast({ title: "Could not create link", description: (e as Error).message, variant: "destructive" }); }
    setBusy(false);
  };

  const sendEmail = async (l: LinkRow) => {
    if (!window.confirm(`Send the email with this link to ${l.recipient_email}?`)) return;
    try { await call("send_email", { id: l.id }); await load(); toast({ title: "Email sent", description: `Sent to ${l.recipient_email}` }); }
    catch (e) { toast({ title: "Could not send", description: (e as Error).message, variant: "destructive" }); }
  };

  const update = async (id: string, patch: object) => {
    try { await call("update", { id, ...patch }); await load(); toast({ title: "Link updated" }); }
    catch (e) { toast({ title: "Could not update", description: (e as Error).message, variant: "destructive" }); }
  };

  const list = kind === "video" ? videos : kind === "project" ? pages : [];
  const status = (l: LinkRow) => !l.active ? "Turned off" : l.expires_at && new Date(l.expires_at) <= new Date() ? "Expired" : "Active";

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Make a link to one video, document or 3D page. Anyone with the link and password can open it without an account — you send both yourself. No email is sent. Or make a personal link for one person (no password, expires in 2 weeks) and email it to them.
      </p>
      <div className="flex flex-wrap gap-4">
        {(["project", "video", "document"] as Kind[]).map((k) => (
          <label key={k} className="flex items-center gap-2 font-semibold">
            <input type="radio" name="share-kind" checked={kind === k} onChange={() => { setKind(k); setItem(null); }} />
            {KIND_LABEL[k]}
          </label>
        ))}
      </div>
      {kind === "document" ? (
        <div className="rounded p-2 max-h-72 overflow-y-auto" style={{ background: "#0A2A2E" }}>
          <DocsTree onOpenFile={(profileId, f) => setItem({ id: f.id, name: f.name, profileId })} activeFileId={item?.id ?? null} />
        </div>
      ) : (
        <div className="rounded border p-2 max-h-56 overflow-y-auto">
          {list.length === 0 && <span className="text-muted-foreground">Nothing to pick yet.</span>}
          {list.map((it) => (
            <label key={it.id} className="flex items-center gap-2 py-0.5">
              <input type="radio" name="share-item" checked={item?.id === it.id} onChange={() => setItem(it)} />
              {it.name.replace(/\.[^.]+$/, "")}
            </label>
          ))}
        </div>
      )}
      <p>Selected: <strong>{item ? item.name : "nothing yet"}</strong></p>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 font-semibold"><input type="radio" name="share-mode" checked={!personal} onChange={() => setPersonal(false)} />With password</label>
        <label className="flex items-center gap-2 font-semibold"><input type="radio" name="share-mode" checked={personal} onChange={() => setPersonal(true)} />For a person (no password, expires in 2 weeks)</label>
      </div>
      {personal ? (
        <div className="flex flex-wrap items-end gap-3">
          <div><Label htmlFor="share-first">First name</Label><Input id="share-first" value={first} onChange={(e) => setFirst(e.target.value)} maxLength={100} /></div>
          <div><Label htmlFor="share-last">Last name</Label><Input id="share-last" value={last} onChange={(e) => setLast(e.target.value)} maxLength={100} /></div>
          <div><Label htmlFor="share-email">Email</Label><Input id="share-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} /></div>
          <Button type="button" variant="outline" onClick={() => create(false)} disabled={busy}>{busy ? "Working…" : "Create link"}</Button>
          <Button type="button" onClick={() => create(true)} disabled={busy}>{busy ? "Working…" : "Create link & send email"}</Button>
        </div>
      ) : (
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="share-pw">Password</Label>
          <Input id="share-pw" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="off" />
        </div>
        <div>
          <Label htmlFor="share-exp">Expires (optional)</Label>
          <Input id="share-exp" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
        <Button type="button" onClick={() => create(false)} disabled={busy}>{busy ? "Creating…" : "Create link"}</Button>
      </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="font-semibold">Share links</h4>
          <Button size="sm" variant="outline" disabled={loadingLinks} onClick={() => void load()}>Refresh</Button>
        </div>
        {loadingLinks && <p className="text-muted-foreground" role="status">Loading links…</p>}
        {loadError && <p className="text-destructive" role="alert">Could not load share links: {loadError}</p>}
        {!loadingLinks && !loadError && links.length === 0 && <p className="text-muted-foreground">No links yet.</p>}
        <div className="space-y-2">
          {links.map((l) => {
            const o = opens.get(l.id);
            return (
              <div key={l.id} className="rounded border p-2 flex flex-wrap items-center gap-2 justify-between">
                <div className="min-w-0">
                  <div className="font-semibold break-words">{KIND_LABEL[l.item_type]}: {l.item_name}</div>
                  {l.no_password && <div className="text-xs break-all">For <strong>{[l.recipient_first_name, l.recipient_last_name].filter(Boolean).join(" ")}</strong> ({l.recipient_email}) · no password · {l.email_sent_at ? `email sent ${new Date(l.email_sent_at).toLocaleString()}` : "email not sent"}</div>}
                  <div className="text-xs text-muted-foreground break-all">
                    {linkUrl(l.slug)} · {status(l)} · {l.expires_at ? `expires ${new Date(l.expires_at).toLocaleString()}` : "no expiry"} · opened {o?.count ?? 0}×{o ? ` (last ${new Date(o.last).toLocaleString()})` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copy(l.slug)}>Copy link</Button>
                  {l.no_password && <Button size="sm" variant="outline" onClick={() => sendEmail(l)}>{l.email_sent_at ? "Resend email" : "Send email"}</Button>}
                  {!l.no_password && <Button size="sm" variant="outline" onClick={() => { const p = window.prompt("New password (at least 6 characters)"); if (p) void update(l.id, { password: p }); }}>Change password</Button>}
                  <Button size="sm" variant="outline" onClick={() => {
                    const v = window.prompt("New expiration (YYYY-MM-DD HH:MM), or leave empty for no expiry", l.expires_at ? new Date(l.expires_at).toISOString().slice(0, 16).replace("T", " ") : "");
                    if (v === null) return;
                    const d = v.trim() ? new Date(v.trim().replace(" ", "T")) : null;
                    if (d && isNaN(d.getTime())) { toast({ title: "Couldn't read that date", variant: "destructive" }); return; }
                    void update(l.id, { expires_at: d ? d.toISOString() : null });
                  }}>Change expiry</Button>
                  <Button size="sm" variant={l.active ? "destructive" : "default"} onClick={() => update(l.id, { active: !l.active })}>{l.active ? "Turn off" : "Turn on"}</Button>
                  <Button size="sm" variant="destructive" onClick={async () => {
                    if (!window.confirm(`Delete this link to "${l.item_name}"? Anyone using it will no longer be able to open it. This can't be undone.`)) return;
                    try { await call("delete", { id: l.id }); await load(); toast({ title: "Link deleted" }); }
                    catch (e) { toast({ title: "Could not delete", description: (e as Error).message, variant: "destructive" }); }
                  }}>Delete</Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Per-person activity alert: emails only the address typed here. */
export function ActivityAlertToggle({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    supabase.from("activity_watchers").select("notify_email,enabled").eq("user_id", userId).maybeSingle()
      .then(({ data }) => { if (data) { setEnabled(data.enabled); setEmail(data.notify_email); setSaved(data.notify_email); } });
  }, [userId]);

  const save = async (on: boolean, addr: string) => {
    const list = Array.from(new Set(addr.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)));
    const bad = list.find((x) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
    if (on && (list.length === 0 || bad)) { toast({ title: bad ? `Not a valid email: ${bad}` : "Type a valid email first", variant: "destructive" }); return; }
    if (list.length > 10) { toast({ title: "Up to 10 emails", variant: "destructive" }); return; }
    const a = list.join(", ");
    const { error } = on || a
      ? await supabase.from("activity_watchers").upsert({ user_id: userId, notify_email: a || saved, enabled: on }, { onConflict: "user_id" })
      : { error: null };
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    setEnabled(on); setSaved(a); setEmail(a);
    toast({ title: on ? `Alerts on — emails go only to ${a}` : "Alerts off" });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={enabled} onChange={(e) => {
          if (e.target.checked && !email.trim()) { setEnabled(true); toast({ title: "Now type the email address(es) to notify" }); return; }
          if (!e.target.checked && !saved) { setEnabled(false); return; }
          void save(e.target.checked, email);
        }} />
        Email notification
      </label>
      <div onClick={() => { if (!enabled) toast({ title: "Enable Email notification first", description: "Tick the Email notification box, then type the emails." }); }}>
        <Input className="h-8 min-w-[16rem] max-w-md disabled:pointer-events-none" type="text" placeholder="a@x.com, b@y.com" value={email} disabled={!enabled}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => { if (enabled && email.trim() && email.trim().toLowerCase() !== saved) void save(true, email); }} />
      </div>
      <span className="text-xs text-muted-foreground">Sign-ins and each video, document or 3D page they open.</span>
    </div>
  );
}
