import { ZoomFrame } from "@/components/ZoomFrame";
import { PortalDrawer } from "@/components/PortalDrawer";
import { cachedItems, rememberItems } from "@/components/PortalSidebar";
import { useEffect, useRef, useState } from "react";
import { PortalNav, NoAccessScreen, usePortalAccess } from "@/components/PortalNav";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Page = { id: string; name: string };

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";
const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/project-pages`;
const htmlCache = new Map<string, string>();

async function callFn(qs: string) {
  const { data } = await supabase.auth.getSession();
  return fetch(`${FN_URL}?${qs}`, {
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
  });
}

const navLink = { color: pearl, opacity: 0.75, textDecoration: "none" };

export default function ProjectRun() {
  const { user, loading: authLoading } = useAuth();
  const access = usePortalAccess();
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [pages, setPages] = useState<Page[]>([]);
  const [active, setActive] = useState<Page | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }) => setRoles(new Set((data ?? []).map((r) => r.role as string))));
    (async () => {
      setLoading(true);
      try {
        const res = await callFn("action=mine");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load pages.");
        setPages(body.pages ?? []);
        rememberItems("project", body.pages ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load pages.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const open = async (p: Page) => {
    setActive(p);
    setError(null);
    const id = ++reqRef.current;
    if (user) void supabase.from("content_views").insert({ user_id: user.id, content_type: "project", item_id: p.id, item_name: p.name });
    const hit = htmlCache.get(p.id);
    if (hit) { setHtml(hit); return; }
    setHtml(null);
    const res = await callFn(`action=view&file_id=${encodeURIComponent(p.id)}`);
    if (id !== reqRef.current) return;
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "Could not open this page.");
      return;
    }
    const text = await res.text();
    htmlCache.set(p.id, text);
    if (id === reqRef.current) setHtml(text);
  };

  // Start opening the last-known first page right away instead of waiting for the list.
  useEffect(() => {
    if (!user || active) return;
    const want = new URLSearchParams(window.location.search).get("page");
    const known = (cachedItems("project") ?? []) as Page[];
    const target = known.find((p) => p.id === want) ?? (want ? { id: want, name: "Project 3D Demo" } : known[0]);
    if (target) void open(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!pages.length) return;
    const want = new URLSearchParams(window.location.search).get("page");
    const target = pages.find((p) => p.id === want) ?? (!active ? pages[0] : null);
    if (target && target.id !== active?.id) void open(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  if (authLoading) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!user) return <Navigate to="/?login=1" replace />;
  if (!access.ready) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!access.project) return <NoAccessScreen />;

  return (
    <div onContextMenu={(e) => e.preventDefault()} style={{ minHeight: "100vh", background: teal, color: pearl, fontFamily: "'General Sans', Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link to="/" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 18, color: pearl, textDecoration: "none" }}>
            energyforward<span style={{ color: amber }}>.</span>
          </Link>
        </div>
        <PortalNav current="project" />
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
        <PortalDrawer current="project" pinned>
          <div>
          {loading && !cachedItems("project")?.length && <div style={{ fontSize: 13, opacity: 0.7 }}>Loading…</div>}
          {!loading && pages.length === 0 && !error && <div style={{ fontSize: 13, opacity: 0.7 }}>No pages have been shared with you yet.</div>}
          {(loading ? (cachedItems("project") ?? []) as Page[] : pages).map((p) => (
            <button key={p.id} type="button" data-drawer-close="" onClick={() => !loading && open(p)} style={{
              display: "block", width: "100%", textAlign: "left", border: "none", borderTop: "1px solid rgba(238,234,226,0.10)",
              background: active?.id === p.id ? "rgba(232,177,74,0.14)" : "transparent", color: pearl, padding: "6px 4px 6px 14px", cursor: "pointer", fontSize: 12, fontFamily: "inherit",
            }}>
              <span style={{ color: amber, marginRight: 8 }}>•</span>{p.name}
            </button>
          ))}
          </div>
        </PortalDrawer>
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "70vh" }}>
          {error && <div style={{ padding: 16, color: "#f4b5a3", fontSize: 14 }}>{error}</div>}
          {html !== null ? (
            <ZoomFrame resetKey={active?.id}><iframe title={active?.name ?? "Project 3D Demo"} srcDoc={html} sandbox="allow-scripts" style={{ flex: 1, width: "100%", height: "100%", border: "none", background: "#fff" }} /></ZoomFrame>
          ) : active && !error ? (
            <div style={{ margin: "auto", opacity: 0.7, fontSize: 14 }}>Loading {active.name}…</div>
          ) : null}
          <div style={{ padding: "10px 16px", fontSize: 11, opacity: 0.6, borderTop: "1px solid rgba(238,234,226,0.12)" }}>
            Confidential — do not share.
          </div>
        </main>
      </div>
    </div>
  );
}
