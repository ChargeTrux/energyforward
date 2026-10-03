import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Play, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Video = { id: string; name: string };

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

export default function InvestorVideos() {
  const { user, loading: authLoading } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [active, setActive] = useState<Video | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullPortalAccess, setFullPortalAccess] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlRef = useRef<string | null>(null);

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
      const res = await callFn(`action=stream&file_id=${encodeURIComponent(active.id)}`);
      if (!res.ok) { if (!cancelled) { setError("This video could not be loaded."); setLoadingVideo(false); } return; }
      const blob = await res.blob();
      if (cancelled) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setSrc(urlRef.current);
      setLoadingVideo(false);
    })();
    return () => { cancelled = true; };
  }, [active]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  return (
    <div style={{ minHeight: "100vh", background: teal, color: pearl, fontFamily: "'General Sans', Arial, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)", flexWrap: "wrap", gap: 12 }}>
        <Link to="/" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 18, color: pearl, textDecoration: "none" }}>
          energyforward<span style={{ color: amber }}>.</span>
        </Link>
        <nav style={{ display: "flex", gap: 24, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {fullPortalAccess && <Link to="/investor" style={{ color: pearl, opacity: 0.75, textDecoration: "none" }}>Investor portal</Link>}
          <span style={{ color: amber }}>Videos</span>
        </nav>
      </header>

      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(34px,6vw,72px) clamp(18px,5vw,64px) 80px" }}>
        <section style={{ maxWidth: 760, marginBottom: "clamp(28px,5vw,48px)" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: amber, margin: 0 }}>Confidential · Authorized viewing</p>
          <h1 style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: "clamp(36px,5vw,64px)", margin: "12px 0 18px", lineHeight: 1.02, color: pearl }}>Moving energy forward.</h1>
          <p style={{ fontSize: "clamp(17px,2vw,21px)", lineHeight: 1.6, margin: 0, color: "rgba(238,234,226,0.78)" }}>
            Energy Forward is building the delivery infrastructure for the next era of energy—connecting technology, operations and execution to move critical projects from ambition to reality.
          </p>
        </section>

        {(loading || authLoading) && <p style={{ opacity: 0.7 }}>Loading your videos…</p>}
        {!authLoading && !user && (
          <div>
            <p>Please sign in to view your authorized videos.</p>
            <Link
              to={`${window.location.pathname}${window.location.search ? `${window.location.search}&login=1` : "?login=1"}`}
              style={{ display: "inline-block", marginTop: 8, padding: "12px 20px", borderRadius: 6, background: amber, color: teal, textDecoration: "none", fontWeight: 700 }}
            >
              Sign in
            </Link>
          </div>
        )}
        {error && <p style={{ color: amber }}>{error}</p>}
        {!loading && user && !error && videos.length === 0 && (
          <p style={{ opacity: 0.8 }}>No videos have been shared with you yet. Please reach out through the Contact page to request access.</p>
        )}

        {active && (
          <>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: amber, margin: "0 0 8px" }}>Now playing</p>
            <h2 style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: "clamp(24px,3vw,38px)", margin: "0 0 18px", lineHeight: 1.15 }}>{active.name}</h2>
            <div style={{ position: "relative", width: "min(100%, 820px)", aspectRatio: "16 / 9", background: "#061719", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(238,234,226,0.14)", boxShadow: "0 22px 60px rgba(0,0,0,0.28)" }}>
              {src ? (
                <video
                  key={src}
                  src={src}
                  controls
                  autoPlay
                  playsInline
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture
                  onContextMenu={(e) => e.preventDefault()}
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: 0.7 }}>
                  {loadingVideo ? "Loading video…" : ""}
                </div>
              )}
            </div>
          </>
        )}

        {videos.length > 1 && (
          <section style={{ marginTop: 48, borderTop: "1px solid rgba(238,234,226,0.14)", paddingTop: 28 }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.7, marginBottom: 14 }}>Your authorized videos</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
              {videos.map((v) => {
                const on = v.id === active?.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => { setError(null); setActive(v); setSearchParams({ video: v.id }); window.scrollTo({ top: 280, behavior: "smooth" }); }}
                    style={{ textAlign: "left", cursor: "pointer", padding: 18, borderRadius: 10, background: on ? "rgba(232,177,74,0.12)" : "rgba(238,234,226,0.05)", border: `1px solid ${on ? amber : "rgba(238,234,226,0.14)"}`, color: pearl, display: "flex", gap: 14, alignItems: "center", font: "inherit" }}
                  >
                    <span style={{ flex: "0 0 40px", height: 40, borderRadius: "50%", background: on ? amber : "rgba(238,234,226,0.1)", display: "grid", placeItems: "center", color: on ? teal : pearl }}>
                      <Play size={16} />
                    </span>
                    <span style={{ fontSize: 15, lineHeight: 1.35 }}>{v.name}{on && <span style={{ display: "block", fontSize: 11, color: amber, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>Now playing</span>}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <footer style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(238,234,226,0.12)", color: "rgba(238,234,226,0.55)", fontSize: 12 }}>
          <LockKeyhole size={15} color={amber} /> Access is personal and verified each time a video is requested.
        </footer>
      </main>
    </div>
  );
}
