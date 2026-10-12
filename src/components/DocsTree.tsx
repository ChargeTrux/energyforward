import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { niceName } from "@/lib/nice-name";

export type DocFile = { id: string; name: string; mimeType: string };
type Node = DocFile & { profileId: string; key: string };

const pearl = "#EEEAE2";
const amber = "#E8B14A";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/investor-drive`;

async function callFn(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  return fetch(`${FN_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
  });
}

async function listFolder(profileId: string, folderId?: string): Promise<Node[]> {
  const qs = new URLSearchParams({ action: "list", profile_id: profileId });
  if (folderId) qs.set("folder_id", folderId);
  const res = await callFn(`?${qs}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return ((body.files ?? []) as DocFile[]).map((f) => ({ ...f, profileId, key: `${profileId}:${f.id}` }));
}

/**
 * Data-room tree without the profile level: the contents of every granted
 * profile folder are shown directly, folders expandable, files openable.
 */
export function DocsTree({ onOpenFile, activeFileId }: { onOpenFile?: (profileId: string, f: DocFile) => void; activeFileId?: string | null }) {
  const navigate = useNavigate();
  const [tree, setTree] = useState<Record<string, Node[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [busyAll, setBusyAll] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await callFn("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "profiles" }) });
      const body = await res.json().catch(() => ({}));
      const profiles: { id: string }[] = body.profiles ?? [];
      const lists = await Promise.all(profiles.map((p) => listFolder(p.id)));
      const known: Record<string, Node[]> = { root: lists.flat() };
      setTree(known);
      setReady(true);
      // Expand every folder automatically, level by level.
      const all = new Set<string>();
      let queue = known.root.filter((n) => n.mimeType === FOLDER_MIME);
      while (queue.length) {
        queue.forEach((n) => all.add(n.key));
        setExpanded(new Set(all));
        const kids = await Promise.all(queue.map(async (n) => (known[n.key] = await listFolder(n.profileId, n.id))));
        setTree({ ...known });
        queue = kids.flat().filter((n) => n.mimeType === FOLDER_MIME);
      }
    })();
  }, []);

  const load = useCallback(async (n: Node) => {
    setLoadingKeys((s) => new Set(s).add(n.key));
    const kids = await listFolder(n.profileId, n.id);
    setTree((t) => ({ ...t, [n.key]: kids }));
    setLoadingKeys((s) => { const x = new Set(s); x.delete(n.key); return x; });
    return kids;
  }, []);

  const toggle = (n: Node) => {
    setExpanded((s) => {
      const x = new Set(s);
      if (x.has(n.key)) x.delete(n.key);
      else { x.add(n.key); if (!tree[n.key]) void load(n); }
      return x;
    });
  };

  const expandAll = async () => {
    setBusyAll(true);
    const all = new Set<string>();
    const known: Record<string, Node[]> = { ...tree };
    let queue = (known.root ?? []).filter((n) => n.mimeType === FOLDER_MIME);
    while (queue.length) {
      queue.forEach((n) => all.add(n.key));
      const kids = await Promise.all(queue.map(async (n) => known[n.key] ?? (known[n.key] = await listFolder(n.profileId, n.id))));
      queue = kids.flat().filter((n) => n.mimeType === FOLDER_MIME);
    }
    setTree(known);
    setExpanded(all);
    setBusyAll(false);
  };

  const open = (n: Node) => {
    if (onOpenFile) onOpenFile(n.profileId, n);
    else navigate(`/investor/documents?${new URLSearchParams({ profile: n.profileId, file: n.id, name: n.name, mime: n.mimeType })}`);
  };

  const render = (key: string, depth: number): React.ReactNode =>
    (tree[key] ?? []).map((n) => {
      const isFolder = n.mimeType === FOLDER_MIME;
      const isOpen = expanded.has(n.key);
      return (
        <div key={n.key}>
          <button
            type="button"
            {...(!isFolder ? { "data-drawer-close": "" } : {})}
            onClick={() => (isFolder ? toggle(n) : open(n))}
            style={{
              display: "flex", alignItems: "flex-start", gap: 8, width: "100%", textAlign: "left", border: "none",
              borderTop: "1px solid rgba(238,234,226,0.08)", color: pearl, cursor: "pointer", fontSize: 13,
              background: activeFileId === n.id ? "rgba(232,177,74,0.14)" : "transparent",
              padding: `8px 4px 8px ${6 + depth * 18}px`, fontWeight: isFolder ? 600 : 400, fontFamily: "inherit",
            }}
          >
            <span style={{ width: 14, color: amber, flexShrink: 0, paddingTop: 2 }}>
              {isFolder ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
            </span>
            <span style={{ color: isFolder ? amber : "rgba(238,234,226,0.7)", flexShrink: 0, paddingTop: 1 }}>
              {isFolder ? (isOpen ? <FolderOpen size={16} /> : <Folder size={16} />) : <FileText size={16} />}
            </span>
            <span style={{ overflowWrap: "anywhere", lineHeight: 1.35 }}>{niceName(n.name)}</span>
          </button>
          {isFolder && isOpen && (
            <div>
              {loadingKeys.has(n.key) && <div style={{ fontSize: 12, opacity: 0.6, paddingLeft: 44 + depth * 18 }}>Loading…</div>}
              {!loadingKeys.has(n.key) && (tree[n.key]?.length ?? 0) === 0 && <div style={{ fontSize: 12, opacity: 0.55, padding: `4px 0 4px ${44 + depth * 18}px` }}>Empty folder</div>}
              {render(n.key, depth + 1)}
            </div>
          )}
        </div>
      );
    });

  const small = { background: "transparent", border: "1px solid rgba(238,234,226,0.25)", color: pearl, borderRadius: 999, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" };

  if (!ready) return <div style={{ fontSize: 12, opacity: 0.6, padding: "4px 0 4px 18px" }}>Loading…</div>;
  if ((tree.root ?? []).length === 0) return <div style={{ fontSize: 12, opacity: 0.6, padding: "4px 0 4px 18px" }}>No documents shared yet.</div>;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, padding: "4px 0 8px 6px" }}>
        <button type="button" style={small} onClick={expandAll} disabled={busyAll}>{busyAll ? "Expanding…" : "Expand all"}</button>
        <button type="button" style={small} onClick={() => setExpanded(new Set())}>Collapse all</button>
      </div>
      {render("root", 0)}
    </div>
  );
}
