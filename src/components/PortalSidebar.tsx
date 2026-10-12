import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAccess } from "@/components/PortalNav";

type Item = { id: string; name: string };
type Section = "documents" | "videos" | "project";

const pearl = "#EEEAE2";
const amber = "#E8B14A";
const base = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

async function call(fn: string, qs: string, body?: unknown) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${base}/${fn}${qs}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.ok ? res.json() : {};
}

const sectionLabel = { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: amber };

/**
 * Side menu with one section per area the person was granted
 * (Documents, Videos, Project Run). Sections without access are hidden.
 * The current page's section can be replaced with its own content via `children`.
 */
export function PortalSidebar({ current, children }: { current: Section; children?: React.ReactNode }) {
  const access = usePortalAccess();
  const [items, setItems] = useState<Record<Section, Item[]>>({ documents: [], videos: [], project: [] });
  // All sections start expanded so granted content is visible right after sign-in.
  const [open, setOpen] = useState<Set<Section>>(new Set<Section>(["project", "videos", "documents"]));

  useEffect(() => {
    if (access.documents && current !== "documents")
      call("investor-drive", "", { action: "profiles" }).then((b) => setItems((s) => ({ ...s, documents: b.profiles ?? [] })));
    if (access.videos && current !== "videos")
      call("investor-videos", "?action=mine").then((b) => setItems((s) => ({ ...s, videos: b.videos ?? [] })));
    if (access.project && current !== "project")
      call("project-pages", "?action=mine").then((b) => setItems((s) => ({ ...s, project: b.pages ?? [] })));
  }, [access.documents, access.videos, access.project, current]);

  // Fixed order — never changes: Project 3D Demo, Videos, Documents (Data Room).
  const sections: { key: Section; label: string; show: boolean; href: (id: string) => string }[] = [
    { key: "project", label: "Project 3D Demo", show: access.project, href: (id) => `/investor/project?page=${encodeURIComponent(id)}` },
    { key: "videos", label: "Videos", show: access.videos, href: (id) => `/investor/videos?video=${encodeURIComponent(id)}` },
    { key: "documents", label: "Documents (Data Room)", show: access.documents, href: (id) => `/investor/documents?profile=${encodeURIComponent(id)}` },
  ];

  return (
    <div>
      {sections.filter((s) => s.show || s.key === current).map((s) => {
        const isOpen = open.has(s.key);
        return (
          <div key={s.key} style={{ marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n; })}
              style={{ ...sectionLabel, background: "none", border: "none", padding: "4px 0", cursor: "pointer", display: "flex", gap: 8, width: "100%" }}
            >
              <span>{isOpen ? "▾" : "▸"}</span>{s.label}
            </button>
            {isOpen && (s.key === current ? children : (
              <div>
                {items[s.key].length === 0 && <div style={{ fontSize: 12, opacity: 0.6, padding: "4px 0 4px 18px" }}>Loading…</div>}
                {items[s.key].map((it) => (
                  <Link key={it.id} to={s.href(it.id)} style={{ display: "block", color: pearl, textDecoration: "none", fontSize: 14, padding: "8px 4px 8px 18px", borderTop: "1px solid rgba(238,234,226,0.08)" }}>
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
