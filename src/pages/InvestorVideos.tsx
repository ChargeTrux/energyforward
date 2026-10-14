import { useCallback, useEffect, useRef, useState } from "react";
import { PortalNav, NoAccessScreen, usePortalAccess } from "@/components/PortalNav";
import { PortalDrawer } from "@/components/PortalDrawer";
import { cachedItems, rememberItems } from "@/components/PortalSidebar";
import { Link, useSearchParams } from "react-router-dom";
import { LockKeyhole, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Video = { id: string; name: string; description: string };

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";
const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/investor-videos`;

async function callFn(qs: string) {
  const { data } = await supabase.auth.getSession();
  return fetch(`${FN_URL}?${qs}`, {
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
  });
}

let authReplyInstalled = false;

async function prepareVideoStream() {
  if (!("serviceWorker" in navigator)) return false;
  if (!authReplyInstalled) {
    authReplyInstalled = true;
    navigator.serviceWorker.addEventListener("message", async (event) => {
      if (event.data?.type !== "ENERGY_FORWARD_VIDEO_AUTH_REQUEST") return;
      const { data } = await supabase.auth.getSession();
      event.ports[0]?.postMessage({
        token: data.session?.access_token ?? null,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      });
    });
  }
  const registration = await navigator.serviceWorker.register("/video-stream-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  // On first visit the page isn't controlled yet, so video requests would bypass the worker.
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 3000);
      navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
  const { data } = await supabase.auth.getSession();
  const worker = navigator.serviceWorker.controller ?? registration.active;
  if (!worker || !data.session?.access_token) return false;
  worker.postMessage({
    type: "ENERGY_FORWARD_VIDEO_AUTH",
    token: data.session.access_token,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
  });
  return Boolean(navigator.serviceWorker.controller);
}

export default function InvestorVideos() {
  const { user } = useAuth();
  const access = usePortalAccess();
  if (user && access.ready && !access.videos) return <NoAccessScreen />;
  return <InvestorVideosInner />;
}

function InvestorVideosInner() {
  const { user, loading: authLoading } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [active, setActive] = useState<Video | null>(null);
  const [streamOk, setStreamOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullPortalAccess, setFullPortalAccess] = useState(false);
  const [roles, setRoles] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) { setRoles(new Set()); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }) => setRoles(new Set((data ?? []).map((r) => r.role as string))));
  }, [user]);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => {
    document.title = "energyforward · investor videos";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    (async () => {
      // Prepare authenticated media requests while the video list loads, not afterward.
      const streamReady = prepareVideoStream().catch(() => false);
      const res = await callFn("action=mine");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? "Could not load videos");
      else {
        const available = (body.videos ?? []) as Video[];
        setVideos(available);
        rememberItems("videos", available);
        setFullPortalAccess(Boolean(body.fullPortalAccess));
        const ok = await streamReady;
        if (ok) setStreamOk(true); else setError("The secure player could not start. Please reload the page.");
      }
      setLoading(false);
    })();
  }, [user, authLoading]);

  const videoEls = useRef(new Map<string, HTMLVideoElement>());
  const watches = useRef(new Map<string, { id: string | null; max: number }>());
  const [maxedId, setMaxedId] = useState<string | null>(null);
  const playVideo = useCallback((video: Video) => {
    setActive(video);
    setSearchParams({ video: video.id }, { replace: true });
    document.getElementById(`video-${video.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    videoEls.current.get(video.id)?.play().catch(() => {});
  }, [setSearchParams]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMaxedId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Jump to a requested video once everything is on screen.
  useEffect(() => {
    if (!streamOk || !videos.length) return;
    const want = searchParamsRef.current.get("video");
    if (want && want !== videos[0].id) setTimeout(() => document.getElementById(`video-${want}`)?.scrollIntoView({ block: "start" }), 50);
  }, [streamOk, videos]);

  return (
    <div style={{ minHeight: "100vh", background: teal, color: pearl, fontFamily: "'General Sans', Arial, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)", flexWrap: "wrap", gap: 12 }}>
        <Link to="/" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 18, color: pearl, textDecoration: "none" }}>
          energyforward<span style={{ color: amber }}>.</span>
        </Link>
        <PortalNav current="videos" />
      </header>
      {user && <PortalDrawer current="videos" pinned>
        <div>
          {(loading ? !cachedItems("videos")?.length : videos.length === 0) && <div style={{ fontSize: 12, opacity: 0.6, padding: "4px 0 4px 18px" }}>{loading ? "Loading…" : "Nothing shared yet."}</div>}
          {(loading ? (cachedItems("videos") ?? []) as Video[] : videos).map((v) => (
            <button key={v.id} type="button" data-drawer-close="" onClick={() => !loading && playVideo(v)} style={{
              display: "block", width: "100%", textAlign: "left", border: "none", borderTop: "1px solid rgba(238,234,226,0.08)", fontFamily: "inherit",
              background: active?.id === v.id ? "rgba(232,177,74,0.14)" : "transparent", color: pearl, padding: "6px 4px 6px 14px", cursor: "pointer", fontSize: 12,
            }}>
              <span style={{ color: amber, marginRight: 8 }}>•</span>{v.name}
            </button>
          ))}
        </div>
      </PortalDrawer>}

      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(24px,4vw,44px) clamp(18px,5vw,64px) 80px" }}>

        {(loading || authLoading) && <p style={{ opacity: 0.7 }}>Loading your videos…</p>}
        {!authLoading && !user && (
          <div>
            <p>Please sign in to view your authorized videos.</p>
            <Link to={`${window.location.pathname}${window.location.search ? `${window.location.search}&login=1` : "?login=1"}`} style={{ display: "inline-block", marginTop: 8, padding: "12px 20px", borderRadius: 6, background: amber, color: teal, textDecoration: "none", fontWeight: 700 }}>Sign in</Link>
          </div>
        )}
        {error && <p style={{ color: amber }}>{error}</p>}
        {!loading && user && !error && videos.length === 0 && <p style={{ opacity: 0.8 }}>No videos have been shared with you yet. Please reach out through the Contact page to request access.</p>}

        {streamOk && videos.map((v, idx) => {
          const vsrc = `${FN_URL}?action=stream&file_id=${encodeURIComponent(v.id)}`;
          const isMax = maxedId === v.id;
          return (
          <section key={v.id} id={`video-${v.id}`} style={{ scrollMarginTop: 24, maxWidth: 860, margin: "0 auto 56px", textAlign: "center" }}>
            <h2 style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: "clamp(18px,2vw,26px)", margin: "0 0 10px", lineHeight: 1.22, color: "rgba(238,234,226,0.94)" }}><span style={{ color: amber, marginRight: 10 }}>{idx + 1}.</span>{v.name}</h2>
            {v.description && <p style={{ maxWidth: 720, margin: "0 auto 20px", fontSize: "clamp(14px,1.5vw,17px)", lineHeight: 1.65, color: "rgba(238,234,226,0.68)", whiteSpace: "pre-line", textAlign: "center" }}>{v.description}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button type="button" onClick={() => setMaxedId(v.id)} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", background: amber, color: teal, border: "none", borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontWeight: 700 }}>Maximize</button>
            </div>
            <div style={isMax
              ? { position: "fixed", inset: 0, zIndex: 300, background: "#000" }
              : { position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#061719", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(238,234,226,0.14)", boxShadow: "0 18px 48px rgba(0,0,0,0.24)" }}>
              {isMax && <button type="button" onClick={() => setMaxedId(null)} style={{ position: "absolute", top: 16, right: 16, zIndex: 301, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", background: amber, color: teal, border: "none", borderRadius: 999, padding: "10px 18px", cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 18px rgba(0,0,0,0.35)" }}>Exit ✕</button>}
              <video ref={(el) => { if (el) videoEls.current.set(v.id, el); else videoEls.current.delete(v.id); }} src={vsrc} controls preload={idx === 0 ? "auto" : "metadata"} playsInline controlsList="nodownload noremoteplayback" disablePictureInPicture
                onPlay={() => {
                  setActive(v);
                  videoEls.current.forEach((el, id) => { if (id !== v.id && !el.paused) el.pause(); });
                  if (!user) return;
                  const entry = { id: null as string | null, max: 0 };
                  watches.current.set(v.id, entry);
                  void supabase.from("content_views").insert({ user_id: user.id, content_type: "video", item_id: v.id, item_name: v.name }).select("id").single()
                    .then(({ data }) => { entry.id = data?.id ?? null; });
                }}
                onTimeUpdate={(e) => { const w = watches.current.get(v.id); if (w) w.max = Math.max(w.max, e.currentTarget.currentTime); }}
                onPause={() => { const w = watches.current.get(v.id); if (w?.id) void supabase.from("content_views").update({ duration_seconds: Math.round(w.max) }).eq("id", w.id); }}
                onEnded={() => { const next = videos[idx + 1]; if (next) playVideo(next); }}
                onContextMenu={(event) => event.preventDefault()} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", margin: "0 auto" }} />
            </div>
          </section>
          );
        })}
      </main>
    </div>
  );
}