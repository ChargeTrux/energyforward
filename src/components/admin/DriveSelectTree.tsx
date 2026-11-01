import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { niceName } from "@/lib/nice-name";

export const FOLDER_MIME = "application/vnd.google-apps.folder";
const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/investor-drive`;

export type DriveItem = { id: string; name: string; mimeType: string };
export type Picked = { name: string; isFolder: boolean };
export type Selection = Map<string, Picked>;

async function listFolder(profileId: string, folderId?: string): Promise<DriveItem[]> {
  const { data } = await supabase.auth.getSession();
  const qs = new URLSearchParams({ action: "list", profile_id: profileId });
  if (folderId) qs.set("folder_id", folderId);
  const res = await fetch(`${FN_URL}?${qs}`, {
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Could not load folder");
  return body.files ?? [];
}

/**
 * Pure selection rules. A ticked folder covers everything inside it.
 * - Ticking a folder removes now-redundant ticks below it.
 * - Unticking something covered by a ticked folder replaces that folder
 *   with ticks on every sibling along the path, so only the unticked item is excluded.
 */
export function toggleItem(
  sel: Selection,
  tree: Record<string, DriveItem[]>,
  path: DriveItem[], // ancestors from root, excluding item
  item: DriveItem,
  on: boolean,
): Selection {
  const next = new Map(sel);
  const pick = (it: DriveItem) => next.set(it.id, { name: it.name, isFolder: it.mimeType === FOLDER_MIME });
  const dropDescendants = (id: string) => {
    for (const c of tree[id] ?? []) { next.delete(c.id); dropDescendants(c.id); }
  };
  if (on) {
    pick(item);
    dropDescendants(item.id);
    return next;
  }
  if (next.has(item.id)) { next.delete(item.id); return next; }
  const chain = [...path, item];
  const idx = chain.findIndex((a) => next.has(a.id));
  if (idx < 0 || idx === chain.length - 1) return next;
  next.delete(chain[idx].id);
  for (let i = idx; i < chain.length - 1; i++) {
    for (const c of tree[chain[i].id] ?? []) if (c.id !== chain[i + 1].id) pick(c);
  }
  return next;
}

export function DriveSelectTree({
  profileId, selection, onChange, disabled, disabledHint, allCovered, filesOnly,
}: {
  /** Whole folder shared (no item picks): show everything ticked. */
  allCovered?: boolean;
  profileId: string;
  selection: Selection;
  onChange: (next: Selection) => void;
  disabled?: boolean;
  disabledHint?: string;
  /** Folders only expand/collapse (no checkbox) — for pickers that link single files. */
  filesOnly?: boolean;
}) {
  const [tree, setTree] = useState<Record<string, DriveItem[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (folderId?: string) => {
    const key = folderId ?? "root";
    setLoadingIds((s) => new Set(s).add(key));
    try {
      const items = await listFolder(profileId, folderId);
      setTree((t) => ({ ...t, [key]: items }));
      setError(null);
      return items;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load folder");
      return [];
    } finally {
      setLoadingIds((s) => { const n = new Set(s); n.delete(key); return n; });
    }
  }, [profileId]);

  // Load the top level only — every folder starts collapsed and loads when opened.
  useEffect(() => { void load(); }, [load]);

  const render = (key: string, depth: number, path: DriveItem[], covered: boolean): React.ReactNode =>
    (tree[key] ?? []).map((it) => {
      const isFolder = it.mimeType === FOLDER_MIME;
      const isOpen = expanded.has(it.id);
      const checked = covered || selection.has(it.id);
      const toggleOpen = () => {
        setExpanded((s) => { const n = new Set(s); if (n.has(it.id)) n.delete(it.id); else n.add(it.id); return n; });
        if (!tree[it.id]) void load(it.id);
      };
      return (
        <div key={it.id}>
          <div
            className={`flex items-center gap-1.5 rounded ${isFolder ? "bg-muted/60 border border-border/60 my-0.5 py-0.5 pr-2" : "py-0.5"}`}
            style={{ paddingLeft: depth * 16 + 2 }}
          >
            {isFolder ? (
              <button
                type="button"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-primary/40 bg-card text-sm font-bold text-primary hover:bg-primary/10"
                onClick={toggleOpen}
                aria-label={isOpen ? "Collapse folder" : "Expand folder"}
                aria-expanded={isOpen}
              >
                {isOpen ? "▾" : "▸"}
              </button>
            ) : <span className="w-6 shrink-0" />}
            {isFolder && filesOnly ? (
              <button type="button" className="flex items-center gap-2 min-w-0 font-semibold text-left" onClick={toggleOpen}>
                <span className="break-words"><span aria-hidden="true">📁 </span>{niceName(it.name)}</span>
              </button>
            ) : (
            <label className={`flex items-center gap-2 min-w-0 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`} title={disabled ? disabledHint : undefined}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={!disabled && checked}
                onChange={(e) => {
                  // Whole-folder access: start from "every top-level item ticked" so unticking one leaves the rest.
                  const base = allCovered && selection.size === 0
                    ? new Map((tree.root ?? []).map((r) => [r.id, { name: r.name, isFolder: r.mimeType === FOLDER_MIME }] as const))
                    : selection;
                  onChange(toggleItem(base, tree, path, it, e.target.checked));
                }}
              />
              <span className={`break-words ${isFolder ? "font-semibold" : "text-foreground/80"}`}>
                <span aria-hidden="true">{isFolder ? "📁 " : "📄 "}</span>
                {niceName(it.name)}
                {isFolder && <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">folder</span>}
              </span>
            </label>
            )}
          </div>
          {isFolder && isOpen && (
            <div className="ml-3 border-l-2 border-border/70 pl-1">
              {loadingIds.has(it.id) && <div className="text-xs text-muted-foreground" style={{ paddingLeft: depth * 16 + 24 }}>Loading…</div>}
              {render(it.id, depth + 1, [...path, it], checked)}
            </div>
          )}
        </div>
      );
    });

  return (
    <div>
      {error && <div className="text-xs text-destructive">{error}</div>}
      {loadingIds.has("root") && <div className="text-xs text-muted-foreground">Loading…</div>}
      {render("root", 0, [], Boolean(allCovered) && selection.size === 0)}
    </div>
  );
}
