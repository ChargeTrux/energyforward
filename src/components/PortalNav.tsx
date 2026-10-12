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
    ]).then(([{ data: r }, { data: d }]) => {
      const roles = new Set((r ?? []).map((x) => x.role as string));
      const admin = roles.has("admin");
      setAccess({
        admin,
        investor: admin || roles.has("investor"),
        customer: admin || roles.has("customer"),
        videos: admin || roles.has("video") || roles.has("investor"),
        project: admin || roles.has("project"),
        documents: admin || (d ?? []).length > 0,
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
    <nav style={{ display: "flex", gap: 20, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", alignItems: "center", flexWrap: "wrap" }}>
      <a href="/?public=1" style={link}>Home</a>
      {a.investor && <Link to="/investor" style={link}>Investor portal</Link>}
      {a.investor && a.customer && <Link to="/customer" style={link}>Customer portal</Link>}
      {item("documents", "/investor/documents", "Documents", a.documents)}
      {item("videos", "/investor/videos", "Videos", a.videos)}
      {item("project", "/investor/project", "Project Run", a.project)}
      {a.admin && <Link to="/admin" style={link}>Admin</Link>}
      <Link to="/signout" style={link}>Sign out</Link>
    </nav>
  );
}
