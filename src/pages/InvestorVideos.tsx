import { useCallback, useEffect, useRef, useState } from "react";
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
  const { user, loading: authLoading } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [active, setActive] = useState<Video | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullPortalAccess, setFullPortalAccess] = useState(false);
  const [roles, setRoles] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) { setRoles(new Set()); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }) => setRoles(new Set((data ?? []).map((r) => r.role as string))));
  }, [user]);
  const [searchParams, setSearchParams] = useSearchParams();
  const playerRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const pendingPlayRef = useRef(false);

  useEffect(() => {
    document.title = "energyforward · investor videos";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    (async () => {
      const res = await callFn("action=mine");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? "Could not load videos");
      else {
        const available = (body.videos ?? []) as Video[];
        setVideos(available);
        setFullPortalAccess(Boolean(body.fullPortalAccess));
        const requested = searchParams.get("video");
        setActive(available.find((video) => video.id === requested) ?? available[0] ?? null);
      }
      setLoading(false);
    })();
  }, [user, authLoading, searchParams]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoadingVideo(true);
    setSrc(null);
    (async () => {
      try {
        const ready = await prepareVideoStream();
        if (!ready || cancelled) throw new Error("The secure player could not start.");
        setSrc(`${FN_URL}?action=stream&file_id=${encodeURIComponent(active.id)}`);
      } catch (streamError) {
        if (!cancelled) setError(streamError instanceof Error ? streamError.message : "This video could not be loaded.");
      } finally {
        if (!cancelled) setLoadingVideo(false);
      }
    })();
    return () => { cancelled = true; };
  }, [active]);

  const selectVideo = useCallback((video: Video, scroll = true, autoplay = false) => {
    setError(null);
    pendingPlayRef.current = autoplay;
    setActive(video);
    setSearchParams({ video: video.id });
    if (scroll) playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [setSearchParams]);

  const handleVideoReady = () => {
    if (!pendingPlayRef.current) return;
    pendingPlayRef.current = false;
    videoElRef.current?.play().catch(() => {
      // Browser blocked playback — the viewer can press play manually.
    });
  };

  const selectNextVideo = () => {
    const currentIndex = videos.findIndex((video) => video.id === active?.id);
    const next = videos[currentIndex + 1];
    if (next) selectVideo(next, false);
  };

  return (
    <div style={{ minHeight: "100vh", background: teal, color: pearl, fontFamily: "'General Sans', Arial, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)", flexWrap: "wrap", gap: 12 }}>
        <Link to="/" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 18, color: pearl, textDecoration: "none" }}>
          energyforward<span style={{ color: amber }}>.</span>
        </Link>
        <nav style={{ display: "flex", gap: 20, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", alignItems: "center", flexWrap: "wrap" }}>
          <a href="/?public=1" style={{ color: pearl, opacity: 0.75, textDecoration: "none" }}>Home</a>
          {(fullPortalAccess || roles.has("investor") || roles.has("admin")) && <Link to="/investor" style={{ color: pearl, opacity: 0.75, textDecoration: "none" }}>Investor portal</Link>}
          {(fullPortalAccess || roles.has("investor") || roles.has("admin")) && (roles.has("customer") || roles.has("admin")) && <Link to="/customer" style={{ color: pearl, opacity: 0.75, textDecoration: "none" }}>Customer portal</Link>}
          {roles.has("admin") && <Link to="/admin" style={{ color: pearl, opacity: 0.75, textDecoration: "none" }}>Admin</Link>}
          <span style={{ color: amber }}>Videos</span>
          {user && <Link to="/signout" style={{ color: pearl, opacity: 0.75, textDecoration: "none" }}>Sign out</Link>}
        </nav>
      </header>

      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(24px,4vw,44px) clamp(18px,5vw,64px) 80px" }}>
        <section style={{ maxWidth: 680, margin: "0 auto", marginBottom: "clamp(24px,4vw,36px)", textAlign: "center" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: amber, margin: 0 }}>Confidential · Authorized viewing</p>
          <h1 style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: "clamp(26px,3.4vw,40px)", margin: "10px 0 12px", lineHeight: 1.05, color: pearl }}>Moving energy forward.</h1>
          <p style={{ fontSize: "clamp(14px,1.5vw,17px)", lineHeight: 1.55, margin: 0, color: "rgba(238,234,226,0.78)" }}>
            Energy Forward is building the delivery infrastructure for the next era of energy—connecting technology, operations and execution to move critical projects from ambition to reality.
          </p>
        </section>

        {(loading || authLoading) && <p style={{ opacity: 0.7 }}>Loading your videos…</p>}
        {!authLoading && !user && (
          <div>
            <p>Please sign in to view your authorized videos.</p>
            <Link to={`${window.location.pathname}${window.location.search ? `${window.location.search}&login=1` : "?login=1"}`} style={{ display: "inline-block", marginTop: 8, padding: "12px 20px", borderRadius: 6, background: amber, color: teal, textDecoration: "none", fontWeight: 700 }}>Sign in</Link>
          </div>
        )}
        {error && <p style={{ color: amber }}>{error}</p>}
        {!loading && user && !error && videos.length === 0 && <p style={{ opacity: 0.8 }}>No videos have been shared with you yet. Please reach out through the Contact page to request access.</p>}

        {active && (
          <section ref={playerRef} style={{ scrollMarginTop: 24, maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: amber, margin: "0 0 9px" }}>Now viewing</p>
            <h2 style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: "clamp(18px,2vw,26px)", margin: "0 0 10px", lineHeight: 1.22, color: "rgba(238,234,226,0.94)" }}>{active.name}</h2>
            {active.description && <p style={{ maxWidth: 720, margin: "0 auto 20px", fontSize: "clamp(14px,1.5vw,17px)", lineHeight: 1.65, color: "rgba(238,234,226,0.68)", whiteSpace: "pre-line", textAlign: "center" }}>{active.description}</p>}
            <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#061719", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(238,234,226,0.14)", boxShadow: "0 18px 48px rgba(0,0,0,0.24)" }}>
              {src ? (
                <video ref={videoElRef} key={src} src={src} controls preload="auto" playsInline controlsList="nodownload noremoteplayback" disablePictureInPicture onLoadedData={handleVideoReady} onEnded={selectNextVideo} onContextMenu={(event) => event.preventDefault()} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center center", display: "block", margin: "0 auto" }} />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: 0.7 }}>{loadingVideo ? "Preparing video…" : ""}</div>
              )}
            </div>
          </section>
        )}

        {videos.length > 1 && (
          <section style={{ marginTop: 48, borderTop: "1px solid rgba(238,234,226,0.14)", paddingTop: 28 }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.7, marginBottom: 14 }}>Your authorized videos</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
              {videos.map((video) => {
                const selected = video.id === active?.id;
                return (
                  <button key={video.id} onClick={() => selectVideo(video, true, true)} style={{ textAlign: "left", cursor: "pointer", padding: 18, borderRadius: 8, background: selected ? "rgba(232,177,74,0.12)" : "rgba(238,234,226,0.05)", border: `1px solid ${selected ? amber : "rgba(238,234,226,0.14)"}`, color: pearl, display: "flex", gap: 14, alignItems: "flex-start", font: "inherit" }}>
                    <span style={{ flex: "0 0 40px", height: 40, borderRadius: "50%", background: selected ? amber : "rgba(238,234,226,0.1)", display: "grid", placeItems: "center", color: selected ? teal : pearl }}><Play size={16} /></span>
                    <span><span style={{ display: "block", fontSize: 15, lineHeight: 1.35 }}>{video.name}</span>{video.description && <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 6, fontSize: 12, lineHeight: 1.45, color: "rgba(238,234,226,0.58)" }}>{video.description}</span>}{selected && <span style={{ display: "block", fontSize: 10, color: amber, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 7 }}>Selected</span>}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <footer style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(238,234,226,0.12)", color: "rgba(238,234,226,0.55)", fontSize: 12 }}><LockKeyhole size={15} color={amber} /> Access is personal and verified each time a video is requested.</footer>
      </main>
    </div>
  );
}