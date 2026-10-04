import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, FolderLock, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { InvestorDocuments } from "@/components/InvestorDocuments";

type Video = { id: string; name: string; description: string };

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";
const VIDEOS_FN = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/investor-videos`;
const navLink = { color: pearl, opacity: 0.75, textDecoration: "none" };

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: "1px solid rgba(238,234,226,0.16)", borderRadius: 14, marginBottom: 16, background: "rgba(238,234,226,0.03)" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "20px 22px", background: "none", border: 0, color: pearl, cursor: "pointer", textAlign: "left" }}>
        <span style={{ color: amber }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontSize: 20, fontWeight: 500 }}>{title}</span>
          <span style={{ display: "block", fontSize: 14, opacity: 0.7, marginTop: 2 }}>{subtitle}</span>
        </span>
        <ChevronDown size={20} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && <div style={{ padding: "0 22px 22px" }}>{children}</div>}
    </div>
  );
}

export default function InvestorMaterials() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [folderCount, setFolderCount] = useState<number | null>(null);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [openSignal, setOpenSignal] = useState(0);

  useEffect(() => { document.title = "energyforward · investor materials"; }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }) => setRoles(new Set((data ?? []).map((r) => r.role as string))));
    (async () => {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`${VIDEOS_FN}?action=mine`, {
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
      });
      const body = await res.json().catch(() => ({}));
      setVideos(res.ok ? (body.videos ?? []) : []);
    })();
  }, [user]);

  const fullPortal = roles.has("investor") || roles.has("admin");
  const ready = folderCount !== null && videos !== null;
  const hasFolders = (folderCount ?? 0) > 0;
  const hasVideos = (videos?.length ?? 0) > 0;

  return (
    <div style={{ minHeight: "100vh", background: teal, color: pearl, fontFamily: "'General Sans', Arial, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)", flexWrap: "wrap", gap: 12 }}>
        <Link to="/" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 18, color: pearl, textDecoration: "none" }}>
          energyforward<span style={{ color: amber }}>.</span>
        </Link>
        <nav style={{ display: "flex", gap: 20, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", alignItems: "center", flexWrap: "wrap" }}>
          <a href="/?public=1" style={navLink}>Home</a>
          {fullPortal && <Link to="/investor" style={navLink}>Investor portal</Link>}
          <span style={{ color: amber }}>Materials</span>
          {roles.has("admin") && <Link to="/admin" style={navLink}>Admin</Link>}
          {user && <Link to="/signout" style={navLink}>Sign out</Link>}
        </nav>
      </header>

      <main style={{ maxWidth: 820, margin: "0 auto", padding: "clamp(28px,5vw,56px) clamp(18px,5vw,48px) 80px" }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: amber, margin: 0, textAlign: "center" }}>Confidential · Authorized access</p>
        <h1 style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: "clamp(28px,4vw,40px)", margin: "10px 0 32px", textAlign: "center" }}>Investor materials</h1>

        {!authLoading && !user && <p style={{ textAlign: "center" }}><a href="/?login=1" style={{ color: amber }}>Sign in</a> to see your materials.</p>}

        {user && <InvestorDocuments hideLauncher openSignal={openSignal} onProfilesLoaded={setFolderCount} />}

        {user && !ready && <p style={{ textAlign: "center", opacity: 0.7 }}>Loading your materials…</p>}

        {user && ready && hasFolders && (
          <Section icon={<FolderLock size={24} />} title="Documents" subtitle="Your secure document folders">
            <button type="button" onClick={() => setOpenSignal((n) => n + 1)}
              style={{ background: amber, color: teal, border: 0, borderRadius: 999, padding: "12px 22px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Open secure folders
            </button>
          </Section>
        )}

        {user && ready && hasVideos && (
          <Section icon={<PlayCircle size={24} />} title="Videos" subtitle={`${videos!.length} video${videos!.length === 1 ? "" : "s"} available to you`}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {videos!.map((v) => (
                <li key={v.id}>
                  <Link to={`/investor/videos?video=${encodeURIComponent(v.id)}`}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(238,234,226,0.06)", color: pearl, textDecoration: "none", fontSize: 16 }}>
                    <PlayCircle size={18} style={{ color: amber, flexShrink: 0 }} /> {v.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {user && ready && !hasFolders && !hasVideos && (
          <p style={{ textAlign: "center", opacity: 0.8 }}>No materials have been shared with you yet. <Link to="/contact" style={{ color: amber }}>Contact us</Link> to request access.</p>
        )}
      </main>
    </div>
  );
}
