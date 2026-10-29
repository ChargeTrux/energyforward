import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAccess } from "@/components/PortalNav";
import { DocsTree, type DocFile } from "@/components/DocsTree";
import { previewUrl } from "@/lib/admin-preview";

type Item = { id: string; name: string };
export type Section = "documents" | "videos" | "project";

const pearl = "#EEEAE2";
const amber = "#E8B14A";
const base = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

async function call(fn: string, qs: string) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(previewUrl(`${base}/${fn}${qs}`), {
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
  });
  return res.ok ? res.json() : {};
}

const sectionLabel = { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: amber };

let itemsCache: Record<"videos" | "project", Item[] | null> = { videos: null, project: null };
/** Last known lists, so a page can show its menu instantly while it reloads. */
export const cachedItems = (k: "videos" | "project") => itemsCache[k];
export const rememberItems = (k: "videos" | "project", list: Item[]) => { itemsCache = { ...itemsCache, [k]: list.map(({ id, name }) => ({ id, name })) }; };
let openCache = new Set<Section>(["project", "videos", "documents"]);

export type SidebarProps = {
  current?: Section;
  /** Replaces the current section's list (e.g. in-page selection). */
  children?: React.ReactNode;
  onOpenDoc?: (profileId: string, f: DocFile) => void;
  activeDocId?: string | null;
};

/** Fixed order: Project 3D Demo, Videos, Documents (Data Room). Sections without access are hidden. */
export function PortalSidebar({ current, children, onOpenDoc, activeDocId }: SidebarProps) {
  const access = usePortalAccess();
  const [items, setItems] = useState<Record<"videos" | "project", Item[] | null>>(itemsCache);
  const [open, setOpen] = useState<Set<Section>>(openCache);
  useEffect(() => { openCache = open; }, [open]);
  const custom = (k: Section) => k === current && children !== undefined;

  useEffect(() => {
    if (access.videos && !custom("videos"))
      call("investor-videos", "?action=mine").then((b) => setItems((s) => (itemsCache = { ...itemsCache, videos: b.videos ?? [] }, { ...s, videos: b.videos ?? [] })));
    if (access.project && !custom("project"))
      call("project-pages", "?action=mine").then((b) => setItems((s) => (itemsCache = { ...itemsCache, project: b.pages ?? [] }, { ...s, project: b.pages ?? [] })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.videos, access.project, current]);

  const sections: { key: Section; label: string; show: boolean; href?: (id: string) => string }[] = [
    { key: "project", label: "Project 3D Demo", show: access.project, href: (id) => `/investor/project?page=${encodeURIComponent(id)}` },
    { key: "videos", label: "Videos", show: access.videos, href: (id) => `/investor/videos?video=${encodeURIComponent(id)}` },
    { key: "documents", label: "Documents (Data Room)", show: access.documents },
  ];

  return (
    <div>
      {sections.filter((s) => s.show).map((s) => {
        const isOpen = open.has(s.key);
        const list = s.key !== "documents" ? items[s.key] : null;
        return (
          <div key={s.key} style={{ marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n; })}
              style={{ ...sectionLabel, background: "none", border: "none", padding: "6px 0", cursor: "pointer", display: "flex", gap: 8, width: "100%" }}
            >
              <span>{isOpen ? "▾" : "▸"}</span>{s.label}
            </button>
            {isOpen && (custom(s.key) ? children : s.key === "documents" ? (
              <DocsTree onOpenFile={onOpenDoc} activeFileId={activeDocId} />
            ) : (
              <div>
                {list === null && <div style={{ fontSize: 12, opacity: 0.6, padding: "4px 0 4px 18px" }}>Loading…</div>}
                {list?.length === 0 && <div style={{ fontSize: 12, opacity: 0.6, padding: "4px 0 4px 18px" }}>Nothing shared yet.</div>}
                {list?.map((it) => (
                  <Link key={it.id} data-drawer-close="" to={s.href!(it.id)} style={{ display: "block", color: pearl, textDecoration: "none", fontSize: 12, padding: "6px 4px 6px 14px", borderTop: "1px solid rgba(238,234,226,0.08)" }}>
                    <span style={{ color: amber, marginRight: 8 }}>•</span>{it.name}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
