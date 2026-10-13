import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PortalAccess = {
  admin: boolean;
  investor: boolean;
  customer: boolean;
  videos: boolean;
  project: boolean;
  documents: boolean;
  ready?: boolean;
};

const NONE: PortalAccess = { admin: false, investor: false, customer: false, videos: false, project: false, documents: false };

/** What sections this person may see. Only sections they were granted are shown. */
export function usePortalAccess() {
  const { user } = useAuth();
  const [access, setAccess] = useState<PortalAccess>(NONE);
  useEffect(() => {
    if (!user) { setAccess(NONE); return; }
    Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("investor_profile_access").select("profile_id").eq("user_id", user.id).limit(1),
      supabase.from("investor_video_access").select("file_id").eq("user_id", user.id).limit(1),
      supabase.from("project_page_access").select("file_id").eq("user_id", user.id).limit(1),
    ]).then(([{ data: r }, { data: d }, { data: v }, { data: pp }]) => {
      const roles = new Set((r ?? []).map((x) => x.role as string));
      const admin = roles.has("admin");
      setAccess({
        admin,
        investor: admin || roles.has("investor"),
        customer: admin || roles.has("customer"),
        videos: admin || roles.has("video") || (v ?? []).length > 0,
        project: admin || roles.has("project") || (pp ?? []).length > 0,
        documents: admin || (d ?? []).length > 0,
        ready: true,
      });
    });
  }, [user]);
  return access;
}

type Current = "videos" | "project" | "documents";
const pearl = "#EEEAE2";
const amber = "#E8B14A";
const link = { color: pearl, opacity: 0.75, textDecoration: "none" };

export function PortalNav({ current }: { current: Current }) {
  const a = usePortalAccess();
  const item = (key: Current, to: string, label: string, show: boolean) =>
    !show ? null : key === current
      ? <span key={key} style={{ color: amber }}>{label}</span>
      : <Link key={key} to={to} style={link}>{label}</Link>;
  return (
    <nav style={{ display: "flex", gap: 28, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", marginLeft: "auto" }}>
      <a href="/?public=1" style={link}>Home</a>
      {a.investor && <Link to="/investor" style={link}>Investor portal</Link>}
      {a.investor && a.customer && <Link to="/customer" style={link}>Customer portal</Link>}
      {item("project", "/investor/project", "Project 3D Demo", a.project)}
      {item("videos", "/investor/videos", "Videos", a.videos)}
      {item("documents", "/investor/documents", "Documents (Data Room)", a.documents)}
      {a.admin && <Link to="/admin" style={link}>Admin</Link>}
      <Link to="/signout" style={link}>Sign out</Link>
    </nav>
  );
}

/** Full-screen notice for signed-in people who lack access to a section. */
export function NoAccessScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "#0A2A2E", color: pearl, fontFamily: "'General Sans', Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)" }}>
        <a href="/?public=1" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 18, color: pearl, textDecoration: "none" }}>energyforward<span style={{ color: amber }}>.</span></a>
        <nav style={{ display: "flex", gap: 28, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" }}>
          <a href="/?public=1" style={link}>Home</a>
          <Link to="/signout" style={link}>Sign out</Link>
        </nav>
      </header>
      <main style={{ flex: 1, display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ maxWidth: 560, textAlign: "center", border: `1px solid ${amber}`, borderRadius: 12, padding: "32px 28px" }}>
          <div style={{ color: amber, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>Access needed</div>
          <p style={{ fontSize: 18, lineHeight: 1.5, margin: 0 }}>
            You're not authorized to access the investor portal or investor materials. Please reach out to the EnergyForward team to update your access.
          </p>
        </div>
      </main>
    </div>
  );
}
