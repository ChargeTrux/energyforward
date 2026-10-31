import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePortalUser as useAuth } from "@/components/admin/UserPreviewBoundary";
import { exitUserPreview, isUserPreview } from "@/lib/admin-preview";

export type DirectLink = { slug: string; item_type: string; item_name: string; expires_at: string | null };

export type PortalAccess = {
  admin: boolean;
  investor: boolean;
  customer: boolean;
  videos: boolean;
  project: boolean;
  documents: boolean;
  links: DirectLink[];
  ready?: boolean;
};

const NONE: PortalAccess = { admin: false, investor: false, customer: false, videos: false, project: false, documents: false, links: [] };

/** Active direct (share) links granted to this person; read-only lookup, safe in admin preview. */
export async function fetchDirectLinks(userId: string | null): Promise<DirectLink[]> {
  // Omit _target for the signed-in person: a GET request would send the text "null", which is not a valid id.
  const args = userId ? { _target: userId } : {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("my_direct_links", args, { get: true });
  if (error) throw error;
  return ((data ?? []) as DirectLink[]).map((l) => ({ ...l, item_name: niceLinkName(l.item_name) }));
}

/** Where a section tab should go when the person only has direct links of that kind. */
export function sectionLinkTarget(links: DirectLink[], kind: "project" | "video" | "document"): string | null {
  const mine = links.filter((l) => l.item_type === kind);
  if (!mine.length) return null;
  return mine.length === 1 ? `/share/${mine[0].slug}` : `/investor/welcome#shared`;
}

export function niceLinkName(name: string) {
  return name.replace(/^\s*\d+[\s._-]*/, "").replace(/\.(html?|pdf|mp4|mov|xlsx?|docx?)$/i, "").trim() || name;
}

/** What sections this person may see. Only sections they were granted are shown. */
let accessCache: { uid: string; a: PortalAccess } | null = null;

export function usePortalAccess() {
  const { user } = useAuth();
  const [access, setAccessRaw] = useState<PortalAccess>(user && accessCache?.uid === user.id ? accessCache.a : NONE);
  useEffect(() => {
    if (!user) { setAccessRaw(NONE); return; }
    const setAccess = (a: PortalAccess) => { accessCache = { uid: user.id, a }; setAccessRaw(a); };
    Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("investor_profile_access").select("profile_id").eq("user_id", user.id).limit(1),
      supabase.from("investor_video_access").select("file_id").eq("user_id", user.id).limit(1),
      supabase.from("project_page_access").select("file_id").eq("user_id", user.id).limit(1),
      fetchDirectLinks(isUserPreview ? user.id : null).catch(() => [] as DirectLink[]),
    ]).then(([{ data: r }, { data: d }, { data: v }, { data: pp }, links]) => {
      const roles = new Set((r ?? []).map((x) => x.role as string));
      const admin = roles.has("admin");
      setAccess({
        admin,
        investor: admin || roles.has("investor"),
        customer: admin || roles.has("customer"),
        videos: admin || roles.has("video") || (v ?? []).length > 0,
        project: admin || roles.has("project") || (pp ?? []).length > 0,
        documents: admin || (d ?? []).length > 0,
        links,
        ready: true,
      });
    });
  }, [user]);
  return access;
}

type Current = "home" | "videos" | "project" | "documents" | "shared";
const pearl = "#EEEAE2";
const amber = "#E8B14A";
const link = { color: pearl, opacity: 0.75, textDecoration: "none" };

export function PortalNav({ current }: { current: Current }) {
  const a = usePortalAccess();
  // A section tab shows when the section is granted, or when a direct link of that kind exists.
  const item = (key: Current, to: string, label: string, show: boolean, kind: "project" | "video" | "document") => {
    const target = show ? to : sectionLinkTarget(a.links, kind);
    if (!target) return null;
    return key === current
      ? <span key={key} style={{ color: amber }}>{label}</span>
      : <Link key={key} to={target} style={link}>{label}</Link>;
  };
  return (
    <nav style={{ display: "flex", gap: 28, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", marginLeft: "auto" }}>
      {a.investor || !(a.project || a.videos || a.documents || a.links.length)
        ? <a href="/?public=1" style={link}>Home</a>
        : current === "home" ? <span style={{ color: amber }}>Home</span> : <Link to="/investor/welcome" style={link}>Home</Link>}
      {a.investor && <Link to="/investor" style={link}>Investor portal</Link>}
      {a.investor && a.customer && <Link to="/customer" style={link}>Customer portal</Link>}
      {item("project", "/investor/project", "Project 3D Demo", a.project, "project")}
      {item("videos", "/investor/videos", "Videos", a.videos, "video")}
      {item("documents", "/investor/documents", "Documents (Data Room)", a.documents, "document")}
      {a.admin && <Link to="/admin" style={link}>Admin</Link>}
      {isUserPreview ? <a href="/admin" style={link} onClick={(e) => { e.preventDefault(); exitUserPreview(); }}>Exit preview</a> : <Link to="/signout" style={link}>Sign out</Link>}
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
