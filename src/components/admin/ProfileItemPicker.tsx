import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/investor-drive`;

type Item = { id: string; name: string; mimeType: string };

async function listFolder(profileId: string, folderId?: string): Promise<Item[]> {
  const { data } = await supabase.auth.getSession();
  const qs = new URLSearchParams({ action: "list", profile_id: profileId });
  if (folderId) qs.set("folder_id", folderId);
  const res = await fetch(`${FN_URL}?${qs}`, {
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Could not load folder");
  return body.files ?? [];
}

/**
 * Pick specific subfolders/files inside a profile for one person.
 * Nothing ticked = the whole profile folder is shared.
 */
export function ProfileItemPicker({
  userId,
  profileId,
  hasProfile,
  onProfileGranted,
}: {
  userId: string;
  profileId: string;
  hasProfile: boolean;
  onProfileGranted: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<Record<string, Item[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadGrants = useCallback(async () => {
    const { data } = await supabase
      .from("investor_document_access")
      .select("item_id")
      .eq("user_id", userId)
      .eq("profile_id", profileId);
    setGranted(new Set((data ?? []).map((r) => r.item_id)));
  }, [userId, profileId]);

  useEffect(() => { void loadGrants(); }, [loadGrants]);

  const load = useCallback(async (folderId?: string) => {
    const key = folderId ?? "root";
    setLoadingIds((s) => new Set(s).add(key));
    try {
      const items = await listFolder(profileId, folderId);
      setTree((t) => ({ ...t, [key]: items }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load folder");
    } finally {
      setLoadingIds((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  }, [profileId]);

  useEffect(() => { if (open && !tree.root) void load(); }, [open, tree.root, load]);

  const toggle = async (item: Item, on: boolean) => {
    if (on) {
      if (!hasProfile) {
        await supabase.from("investor_profile_access").upsert({ user_id: userId, profile_id: profileId }, { onConflict: "user_id,profile_id" });
      }
      await supabase.from("investor_document_access").upsert(
        { user_id: userId, profile_id: profileId, item_id: item.id, item_name: item.name, is_folder: item.mimeType === FOLDER_MIME },
        { onConflict: "user_id,profile_id,item_id" },
      );
    } else {
      await supabase.from("investor_document_access").delete().eq("user_id", userId).eq("profile_id", profileId).eq("item_id", item.id);
    }
    await loadGrants();
    if (on && !hasProfile) await onProfileGranted();
  };

  const render = (key: string, depth: number): React.ReactNode =>
    (tree[key] ?? []).map((it) => {
      const isFolder = it.mimeType === FOLDER_MIME;
      const isOpen = expanded.has(it.id);
      return (
        <div key={it.id}>
          <div className="flex items-center gap-1" style={{ paddingLeft: depth * 14 }}>
            {isFolder ? (
              <button
                type="button"
                className="w-4 text-xs text-muted-foreground"
                onClick={() => {
                  setExpanded((s) => { const n = new Set(s); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; });
                  if (!tree[it.id]) void load(it.id);
                }}
                aria-label={isOpen ? "Collapse folder" : "Expand folder"}
              >
                {isOpen ? "▾" : "▸"}
              </button>
            ) : <span className="w-4" />}
            <label className="flex items-center gap-2 min-w-0">
              <input type="checkbox" checked={granted.has(it.id)} onChange={(e) => toggle(it, e.target.checked)} />
              <span className={`break-words ${isFolder ? "font-medium" : ""}`}>{isFolder ? "📁 " : ""}{it.name}</span>
            </label>
          </div>
          {isFolder && isOpen && (
            <div>
              {loadingIds.has(it.id) && <div className="text-xs text-muted-foreground" style={{ paddingLeft: depth * 14 + 20 }}>Loading…</div>}
              {render(it.id, depth + 1)}
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="ml-5 mb-1 text-sm">
      <button type="button" className="text-xs underline text-muted-foreground" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide contents" : granted.size ? `Choose contents (${granted.size} picked)` : "Choose contents (whole folder)"}
      </button>
      {open && (
        <div className="mt-1 rounded border p-2 max-h-72 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-1">
            Tick folders or files to share only those. Nothing ticked = the whole folder.
          </p>
          {error && <div className="text-xs text-destructive">{error}</div>}
          {loadingIds.has("root") && <div className="text-xs text-muted-foreground">Loading…</div>}
          {render("root", 0)}
        </div>
      )}
    </div>
  );
}
