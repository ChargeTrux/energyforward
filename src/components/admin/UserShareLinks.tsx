import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DocsTree } from "@/components/DocsTree";
import { callShareLink, KIND_LABEL, linkUrl, type Kind, type LinkRow } from "@/components/admin/ShareLinksPanel";

type Item = { id: string; name: string };

/**
 * Per-person direct links inside the Access manager / Add users.
 * Shows the person's existing links and creates new ones. Creating or
 * converting a link never sends an email — only "Send email" does.
 */
export function UserShareLinks({
  videos,
  pages,
  links,
  userId,
  firstName = "",
  lastName = "",
  email = "",
  onChanged,
}: {
  videos: Item[];
  pages: Item[];
  links: LinkRow[];
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  onChanged: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(true);
  const [kind, setKind] = useState<Kind>("video");
  const [item, setItem] = useState<(Item & { profileId?: string }) | null>(null);
  const [personal, setPersonal] = useState(true);
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [addr, setAddr] = useState(email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const copy = (slug: string) => { void navigator.clipboard.writeText(linkUrl(slug)); toast({ title: "Link copied", description: linkUrl(slug) }); };
  const status = (l: LinkRow) => !l.active ? "Turned off" : l.expires_at && new Date(l.expires_at) <= new Date() ? "Expired" : "Active";

  const create = async (send: boolean) => {
    if (!item) { toast({ title: "Pick an item first", variant: "destructive" }); return; }
    if (personal) {
      if (!first.trim()) { toast({ title: "Enter a first name", variant: "destructive" }); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.trim())) { toast({ title: "Enter a valid email address", variant: "destructive" }); return; }
    } else if (password.trim().length < 6) { toast({ title: "Password needs at least 6 characters", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const r = await callShareLink("create", personal
        ? { item_type: kind, item_id: item.id, item_name: item.name, profile_id: item.profileId, no_password: true, first_name: first.trim(), last_name: last.trim(), email: addr.trim(), user_id: userId }
        : { item_type: kind, item_id: item.id, item_name: item.name, profile_id: item.profileId, password: password.trim(), user_id: userId });
      copy(r.slug);
      if (send && personal) {
        try { await callShareLink("send_email", { id: r.id }); toast({ title: "Email sent", description: `Sent to ${addr.trim()}` }); }
        catch (e) { toast({ title: "Link created, but the email failed", description: (e as Error).message, variant: "destructive" }); }
      } else {
        toast({ title: "Link created — no email sent", description: "Copy it into your own email, or use Send email later." });
      }
      setItem(null); setPassword(""); setShowForm(false);
      await onChanged();
    } catch (e) { toast({ title: "Could not create link", description: (e as Error).message, variant: "destructive" }); }
    setBusy(false);
  };

  const convert = async (l: LinkRow) => {
    if (l.no_password) {
      const p = window.prompt(`Turn this into a password link for "${l.item_name}".\nNew password (at least 6 characters). The link address stays the same; the email check is removed. No email is sent.`);
      if (!p) return;
      if (p.trim().length < 6) { toast({ title: "Password needs at least 6 characters", variant: "destructive" }); return; }
      try { await callShareLink("convert", { id: l.id, mode: "password", password: p.trim() }); await onChanged(); toast({ title: "Now a password link", description: "Same link, now asks for the password." }); }
      catch (e) { toast({ title: "Could not convert", description: (e as Error).message, variant: "destructive" }); }
    } else {
      const fn = window.prompt(`Turn this into a personal link (no password) for "${l.item_name}".\nFirst name of the person:`, first || "");
      if (fn === null) return;
      const ln = window.prompt("Last name (optional):", last || "");
      if (ln === null) return;
      const em = window.prompt("Their email address — they must type it to open the link:", addr || "");
      if (em === null) return;
      if (!fn.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.trim())) { toast({ title: "Need a first name and a valid email", variant: "destructive" }); return; }
      try { await callShareLink("convert", { id: l.id, mode: "personal", first_name: fn.trim(), last_name: ln.trim(), email: em.trim() }); await onChanged(); toast({ title: "Now a personal link", description: "Same link, no password — they type their email. No email was sent." }); }
      catch (e) { toast({ title: "Could not convert", description: (e as Error).message, variant: "destructive" }); }
    }
  };

  const list = kind === "video" ? videos : kind === "project" ? pages : [];

  return (
    <div className="ef-user-links space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-base">Share a direct link</strong>
        <Button size="sm" variant="outline" aria-expanded={showForm} onClick={() => setShowForm((s) => !s)}>{showForm ? "Hide sharing options" : "Show sharing options"}</Button>
      </div>
      {showForm && (
        <div className="ef-share-create space-y-3">
          <div className="flex flex-wrap gap-4">
            {(["project", "video", "document"] as Kind[]).map((k) => (
              <label key={k} className="flex items-center gap-2 font-semibold">
                <input type="radio" name={`usk-${userId ?? email}`} checked={kind === k} onChange={() => { setKind(k); setItem(null); }} />
                {KIND_LABEL[k]}
              </label>
            ))}
          </div>
          {kind === "document" ? (
            <div className="ef-document-picker rounded p-2 max-h-72 overflow-y-auto">
              <DocsTree onOpenFile={(profileId, f) => setItem({ id: f.id, name: f.name, profileId })} activeFileId={item?.id ?? null} />
            </div>
          ) : (
            <div className="rounded border p-2 max-h-56 overflow-y-auto">
              {list.length === 0 && <span className="text-muted-foreground">Nothing to pick yet.</span>}
              {list.map((it) => (
                <label key={it.id} className="flex items-center gap-2 py-0.5">
                  <input type="radio" name={`usi-${userId ?? email}`} checked={item?.id === it.id} onChange={() => setItem(it)} />
                  {it.name.replace(/\.[^.]+$/, "")}
                </label>
              ))}
            </div>
          )}
          <p>Selected: <strong>{item ? item.name : "nothing yet"}</strong></p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 font-semibold"><input type="radio" name={`usm-${userId ?? email}`} checked={personal} onChange={() => setPersonal(true)} />Personal link (no password, expires in 2 weeks)</label>
            <label className="flex items-center gap-2 font-semibold"><input type="radio" name={`usm-${userId ?? email}`} checked={!personal} onChange={() => setPersonal(false)} />Link with password</label>
          </div>
          {personal ? (
            <div className="flex flex-wrap items-end gap-3">
              <div><Label>First name</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} maxLength={100} /></div>
              <div><Label>Last name</Label><Input value={last} onChange={(e) => setLast(e.target.value)} maxLength={100} /></div>
              <div><Label>Email</Label><Input type="email" value={addr} onChange={(e) => setAddr(e.target.value)} maxLength={255} /></div>
              <Button type="button" variant="outline" onClick={() => create(false)} disabled={busy}>{busy ? "Working…" : "Create link (no email)"}</Button>
              <Button type="button" onClick={() => create(true)} disabled={busy}>{busy ? "Working…" : "Create link & send email"}</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div><Label>Password</Label><Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="off" /></div>
              <Button type="button" onClick={() => create(false)} disabled={busy}>{busy ? "Working…" : "Create link (no email)"}</Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">No email is sent unless you click "Create link & send email" or "Send email".</p>
        </div>
      )}
      <section className="ef-existing-links space-y-3" aria-label="Existing shared links">
        <h4 className="text-base font-semibold">Existing shared links ({links.length})</h4>
        {links.length === 0 && <p className="text-muted-foreground">No direct links for this person yet.</p>}
      {links.map((l) => (
        <div key={l.id} className="ef-shared-item rounded border p-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="min-w-0">
            <div className="font-semibold break-words">{KIND_LABEL[l.item_type]}: {l.item_name}</div>
            <div className="text-xs text-muted-foreground break-all">
              {l.no_password ? `Personal link for ${[l.recipient_first_name, l.recipient_last_name].filter(Boolean).join(" ")} (${l.recipient_email})` : "Password link"} · {status(l)} · {l.expires_at ? `expires ${new Date(l.expires_at).toLocaleString()}` : "no expiry"}{l.no_password ? ` · ${l.email_sent_at ? `email sent ${new Date(l.email_sent_at).toLocaleString()}` : "email not sent"}` : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(l.slug)}>Copy link</Button>
            {l.no_password && (
              <Button size="sm" variant="outline" onClick={async () => {
                if (!window.confirm(`Send the email with this link to ${l.recipient_email}?`)) return;
                try { await callShareLink("send_email", { id: l.id }); await onChanged(); toast({ title: "Email sent", description: `Sent to ${l.recipient_email}` }); }
                catch (e) { toast({ title: "Could not send", description: (e as Error).message, variant: "destructive" }); }
              }}>{l.email_sent_at ? "Resend email" : "Send email"}</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => void convert(l)}>{l.no_password ? "Change to password link" : "Change to personal link"}</Button>
            <Button size="sm" variant={l.active ? "destructive" : "default"} onClick={async () => {
              try { await callShareLink("update", { id: l.id, active: !l.active }); await onChanged(); }
              catch (e) { toast({ title: "Could not update", description: (e as Error).message, variant: "destructive" }); }
            }}>{l.active ? "Turn off" : "Turn on"}</Button>
            <Button size="sm" variant="destructive" onClick={async () => {
              if (!window.confirm(`Delete this link to "${l.item_name}"? Anyone using it will no longer be able to open it. This can't be undone.`)) return;
              try { await callShareLink("delete", { id: l.id }); await onChanged(); toast({ title: "Link deleted" }); }
              catch (e) { toast({ title: "Could not delete", description: (e as Error).message, variant: "destructive" }); }
            }}>Delete</Button>
          </div>
        </div>
      ))}
      </section>
    </div>
  );
}
