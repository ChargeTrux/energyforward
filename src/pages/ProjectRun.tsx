import { notifyActivity } from "@/lib/notifyActivity";
import { ZoomFrame } from "@/components/ZoomFrame";
import { PortalDrawer } from "@/components/PortalDrawer";
import { cachedItems, rememberItems } from "@/components/PortalSidebar";
import { useEffect, useRef, useState } from "react";
import { PortalNav, NoAccessScreen, usePortalAccess } from "@/components/PortalNav";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortalUser as useAuth } from "@/components/admin/UserPreviewBoundary";
import { isUserPreview, previewUrl } from "@/lib/admin-preview";

type Page = { id: string; name: string; description?: string };

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";
const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/project-pages`;
const htmlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
/** One shared download per page, reused by background preloading and clicks. */
function fetchPage(id: string): Promise<string> {
  const hit = htmlCache.get(id);
  if (hit) return Promise.resolve(hit);
  const running = inflight.get(id);
  if (running) return running;
  const p = (async () => {
    const res = await callFn(`action=view&file_id=${encodeURIComponent(id)}`);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error ?? "Could not open this page.");
    }
    const text = await res.text();
    htmlCache.set(id, text);
    return text;
  })().finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

async function callFn(qs: string) {
  const { data } = await supabase.auth.getSession();
  return fetch(previewUrl(`${FN_URL}?${qs}`), {
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
  });
}

const navLink = { color: pearl, opacity: 0.75, textDecoration: "none" };

function ProjectSection({ page, idx, userId }: { page: Page; idx: number; userId: string }) {
  const [html, setHtml] = useState<string | null>(htmlCache.get(page.id) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [maxed, setMaxed] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (html) return;
    fetchPage(page.id).then(setHtml).catch((e) => setError(e instanceof Error ? e.message : "Could not open this page."));
  }, [page.id, html]);
  // Record a view once the section is actually on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || isUserPreview) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        obs.disconnect();
        notifyActivity("project", page.id, page.name);
        void supabase.from("content_views").insert({ user_id: userId, content_type: "project", item_id: page.id, item_name: page.name });
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [page.id, page.name, userId]);
  useEffect(() => {
    if (!maxed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMaxed(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maxed]);
  const btn = { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" as const, background: amber, color: teal, border: "none", borderRadius: 999, cursor: "pointer", fontWeight: 700 };
  return (
    <section ref={ref} id={`project-${page.id}`} style={{ scrollMarginTop: 24, maxWidth: 1100, margin: "0 auto 56px", textAlign: "center" }}>
      <h2 style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: "clamp(18px,2vw,26px)", margin: "0 0 10px", lineHeight: 1.22, color: "rgba(238,234,226,0.94)" }}><span style={{ color: amber, marginRight: 10 }}>{idx + 1}.</span>{page.name}</h2>
      {page.description && <p style={{ maxWidth: 760, margin: "0 auto 20px", fontSize: "clamp(14px,1.5vw,17px)", lineHeight: 1.65, color: "rgba(238,234,226,0.68)", whiteSpace: "pre-line" }}>{page.description}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button type="button" onClick={() => setMaxed(true)} style={{ ...btn, padding: "6px 14px" }}>Maximize</button>
      </div>
      <div style={maxed
        ? { position: "fixed", inset: 0, zIndex: 300, background: "#000", display: "flex", flexDirection: "column" }
        : { position: "relative", width: "100%", height: "min(78vh, 760px)", background: "#061719", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(238,234,226,0.14)", boxShadow: "0 18px 48px rgba(0,0,0,0.24)", display: "flex", flexDirection: "column" }}>
        {maxed && <button type="button" onClick={() => setMaxed(false)} style={{ ...btn, position: "absolute", top: 16, right: 16, zIndex: 301, padding: "10px 18px" }}>Exit ✕</button>}
        {error ? <div style={{ margin: "auto", color: "#f4b5a3", fontSize: 14 }}>{error}</div>
          : html !== null ? <ZoomFrame resetKey={page.id}><iframe title={page.name} srcDoc={html} sandbox="allow-scripts" style={{ flex: 1, width: "100%", height: "100%", border: "none", background: "#fff" }} /></ZoomFrame>
          : <div style={{ margin: "auto", opacity: 0.7, fontSize: 14 }}>Loading {page.name}…</div>}
      </div>
    </section>
  );
}

export default function ProjectRun() {
  const { user, loading: authLoading } = useAuth();
  const access = usePortalAccess();
  const [pages, setPages] = useState<Page[]>(() => (cachedItems("project") ?? []) as Page[]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { document.title = "energyforward · project 3D demo"; }, []);

  useEffect(() => {
    if (!user) return;
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

  // Jump to a requested page (?page=id) once the list is on screen.
  useEffect(() => {
    if (!pages.length) return;
    const want = new URLSearchParams(window.location.search).get("page");
    if (want && want !== pages[0].id) setTimeout(() => document.getElementById(`project-${want}`)?.scrollIntoView({ block: "start" }), 80);
  }, [pages]);

  if (authLoading) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!user) return <Navigate to="/?login=1" replace />;
  if (!access.ready) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!access.project) return <NoAccessScreen />;

  return (
    <div onContextMenu={(e) => e.preventDefault()} style={{ minHeight: "100vh", background: teal, color: pearl, fontFamily: "'General Sans', Arial, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)", flexWrap: "wrap", gap: 12 }}>
        <Link to="/" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 18, color: pearl, textDecoration: "none" }}>
          energyforward<span style={{ color: amber }}>.</span>
        </Link>
        <PortalNav current="project" />
      </header>
      <PortalDrawer current="project" pinned><div /></PortalDrawer>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(24px,4vw,44px) clamp(18px,5vw,64px) 80px" }}>
        <div style={{ textAlign: "center", maxWidth: 820, margin: "0 auto 44px" }}>
          <h1 style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: "clamp(26px,3.4vw,40px)", margin: "0 0 14px", color: pearl }}>Project 3D Demo</h1>
          <p style={{ fontSize: "clamp(14px,1.5vw,17px)", lineHeight: 1.65, color: "rgba(238,234,226,0.75)", margin: 0 }}>
            A 3D animated simulation of one 24-hour period of the EnergyForward loop, following energy from the solar project through the EnergyHub and EnergyPort to the customer's vehicles. A guided tour walks you through the full day in a few minutes, so you can see how the whole system fits together before reading anything else.
          </p>
        </div>
        {loading && !pages.length && <p style={{ opacity: 0.7, textAlign: "center" }}>Loading your 3D demos…</p>}
        {error && <p style={{ color: amber, textAlign: "center" }}>{error}</p>}
        {!loading && !error && pages.length === 0 && <p style={{ opacity: 0.8, textAlign: "center" }}>No 3D demos have been shared with you yet.</p>}
        {pages.map((p, idx) => <ProjectSection key={p.id} page={p} idx={idx} userId={user.id} />)}
        <div style={{ paddingTop: 10, fontSize: 11, opacity: 0.6, textAlign: "center" }}>Confidential — do not share.</div>
      </main>
    </div>
  );
}
