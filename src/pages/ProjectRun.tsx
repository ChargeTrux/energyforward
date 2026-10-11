import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Page = { id: string; name: string };

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";
const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/project-pages`;

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
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [pages, setPages] = useState<Page[]>([]);
  const [active, setActive] = useState<Page | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load pages.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const open = async (p: Page) => {
    setActive(p);
    setHtml(null);
    setError(null);
    const id = ++reqRef.current;
    if (user) void supabase.from("content_views").insert({ user_id: user.id, content_type: "project", item_id: p.id, item_name: p.name });
    const res = await callFn(`action=view&file_id=${encodeURIComponent(p.id)}`);
    if (id !== reqRef.current) return;
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "Could not open this page.");
      return;
    }
    setHtml(await res.text());
  };

  useEffect(() => {
    if (pages.length && !active) void open(pages[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  if (authLoading) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!user) return <Navigate to="/?login=1" replace />;

  return (
    <div onContextMenu={(e) => e.preventDefault()} style={{ minHeight: "100vh", background: teal, color: pearl, fontFamily: "'General Sans', Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)", flexWrap: "wrap", gap: 12 }}>
        <Link to="/" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 18, color: pearl, textDecoration: "none" }}>
          energyforward<span style={{ color: amber }}>.</span>
        </Link>
        <nav style={{ display: "flex", gap: 20, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", alignItems: "center", flexWrap: "wrap" }}>
          <a href="/?public=1" style={navLink}>Home</a>
          {(roles.has("investor") || roles.has("admin")) && <Link to="/investor" style={navLink}>Investor portal</Link>}
          {(roles.has("video") || roles.has("investor") || roles.has("admin")) && <Link to="/investor/videos" style={navLink}>Videos</Link>}
          {roles.has("admin") && <Link to="/admin" style={navLink}>Admin</Link>}
          <span style={{ color: amber }}>Project Run</span>
          <Link to="/signout" style={navLink}>Sign out</Link>
        </nav>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
        <div
          onMouseEnter={() => setSideOpen(true)}
          onMouseLeave={() => setSideOpen(false)}
          style={{ position: "absolute", top: 0, left: 0, bottom: 0, zIndex: 20, display: "flex", pointerEvents: "none" }}
        >
          <aside style={{
            width: "min(300px, 85vw)", background: teal, borderRight: "1px solid rgba(238,234,226,0.18)", padding: "18px 16px",
            boxShadow: sideOpen ? "8px 0 24px rgba(0,0,0,0.35)" : "none", overflowY: "auto",
            transform: sideOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform .25s ease",
            pointerEvents: sideOpen ? "auto" : "none",
          }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: amber, margin: "0 0 10px" }}>Project Run</p>
          {loading && <div style={{ fontSize: 13, opacity: 0.7 }}>Loading…</div>}
          {!loading && pages.length === 0 && !error && <div style={{ fontSize: 13, opacity: 0.7 }}>No pages have been shared with you yet.</div>}
          {pages.map((p) => (
            <button key={p.id} type="button" onClick={() => { open(p); setSideOpen(false); }} style={{
              display: "block", width: "100%", textAlign: "left", border: "none", borderTop: "1px solid rgba(238,234,226,0.10)",
              background: active?.id === p.id ? "rgba(232,177,74,0.14)" : "transparent", color: pearl, padding: "10px 6px", cursor: "pointer", fontSize: 14,
            }}>
              <span style={{ color: amber, marginRight: 8 }}>•</span>{p.name}
            </button>
          ))}
          </aside>
          <button
            type="button"
            aria-label={sideOpen ? "Hide pages list" : "Show pages list"}
            onClick={() => setSideOpen((v) => !v)}
            style={{
              pointerEvents: "auto", alignSelf: "flex-start", marginTop: 24, marginLeft: sideOpen ? 0 : "calc(-1 * min(300px, 85vw))",
              transition: "margin-left .25s ease", background: amber, color: teal, border: "none", borderRadius: "0 10px 10px 0",
              padding: "14px 8px", cursor: "pointer", writingMode: "vertical-rl", fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", boxShadow: "4px 0 14px rgba(0,0,0,0.3)",
            }}
          >
            {sideOpen ? "◀ Hide" : `Pages (${pages.length}) ▶`}
          </button>
        </div>
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "70vh" }}>
          {error && <div style={{ padding: 16, color: "#f4b5a3", fontSize: 14 }}>{error}</div>}
          {html !== null ? (
            <iframe title={active?.name ?? "Project Run"} srcDoc={html} sandbox="allow-scripts" style={{ flex: 1, width: "100%", border: "none", background: "#fff" }} />
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
