import { useState } from "react";
import { Copy, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isUserPreview } from "@/lib/admin-preview";
import { localDateTime, portalLinkStatus } from "@/lib/portal-link-expiry";

export type PortalEntryLink = { id: string; slug: string; emails: string[]; enabled: boolean; expires_at: string; mode: string };

export function UserPortalLinks({ links, onChanged }: { links: PortalEntryLink[]; onChanged: () => Promise<void> }) {
  const { toast } = useToast();
  const [dates, setDates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const save = async (link: PortalEntryLink) => {
    if (isUserPreview) return;
    const value = dates[link.id];
    const expiry = value ? new Date(value) : null;
    if (!expiry || !Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) {
      toast({ title: "Choose a future expiry date", variant: "destructive" }); return;
    }
    setSaving(link.id);
    try {
      const { data, error } = await supabase.from("portal_entry_links").update({ expires_at: expiry.toISOString(), updated_at: new Date().toISOString() }).eq("id", link.id).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "The link could not be updated.");
      await onChanged();
      toast({ title: "Expiry updated — same link, no email sent" });
    } catch (error) { toast({ title: "Could not update expiry", description: (error as Error).message, variant: "destructive" }); }
    finally { setSaving(null); }
  };
  return <section className="ef-user-section ef-section--share">
    <h3 className="ef-subsection-title">Portal sign-in links</h3>
    {links.length === 0 && <p className="text-sm text-muted-foreground">No personal portal links saved for this person.</p>}
    {links.map((link) => {
      const status = portalLinkStatus(link.expires_at, link.enabled);
      const url = `https://energyforward.com/enter/${link.slug}`;
      return <div key={link.id} className="border-b py-3 space-y-2">
        <p className={`text-sm font-semibold ${status.warning ? "text-destructive" : "text-foreground"}`}>{status.label} · {link.mode === "personal" ? "Email only, no password" : "Email and password"}</p>
        <p className="text-xs text-muted-foreground">Expires {new Date(link.expires_at).toLocaleString()}{link.emails.length > 1 ? ` · Shared with ${link.emails.length} people; date changes apply to everyone on this link.` : ""}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label htmlFor={`expiry-${link.id}`}>Expiration date</Label><Input id={`expiry-${link.id}`} type="datetime-local" value={dates[link.id] ?? localDateTime(link.expires_at)} onChange={(e) => setDates((current) => ({ ...current, [link.id]: e.target.value }))} disabled={isUserPreview || saving === link.id} /></div>
          <Button size="sm" disabled={isUserPreview || saving === link.id || !dates[link.id]} onClick={() => void save(link)}><Save className="mr-2 h-4 w-4" />{saving === link.id ? "Saving…" : "Update expiration"}</Button>
          <Button size="sm" className="ef-copy-link" onClick={async () => { try { await navigator.clipboard.writeText(url); toast({ title: "Link copied" }); } catch { toast({ title: "Copy this link", description: url }); } }}><Copy className="mr-2 h-4 w-4" />Copy the link</Button>
        </div>
        <p className="text-xs break-all">{url}</p>
      </div>;
    })}
  </section>;
}