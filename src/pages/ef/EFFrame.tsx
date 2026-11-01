import { useEffect, useState } from "react";
import { PortalDrawer } from "@/components/PortalDrawer";
import { Link, Navigate } from "react-router-dom";
import { PlayCircle } from "lucide-react";
import { usePortalUser as useAuth } from "@/components/admin/UserPreviewBoundary";
import { isUserPreview } from "@/lib/admin-preview";
import { supabase } from "@/integrations/supabase/client";
import { usePortalAccess } from "@/components/PortalNav";

export function EFFrame({ src, title }: { src: string; title: string }) {
  useEffect(() => {
    document.title = title;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [title]);

  return (
    <iframe
      src={src}
      title={title}
      style={{
        position: "fixed",
        inset: isUserPreview ? "64px 0 0" : 0,
        width: "100vw",
        height: isUserPreview ? "calc(100vh - 64px)" : "100vh",
        border: 0,
        background: "#0A2A2E",
        zIndex: 40,
      }}
    />
  );
}

export const LandingStealth = () => <EFFrame src="/ef-assets/site/index.html" title="energyforward · in stealth" />;
export const CustomerPortal = () => <EFFrame src="/ef-assets/site/customer/index.html" title="energyforward · customer portal" />;
export const InvestorPortal = () => {
  const { user, loading } = useAuth();
  const access = usePortalAccess();
  const [destination, setDestination] = useState<"investor" | "video" | "project" | "home" | null>(null);
  const [hasProject, setHasProject] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { setDestination("home"); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }) => {
        const roles = new Set((data ?? []).map((row) => row.role as string));
        setHasProject(roles.has("admin") || roles.has("project"));
        setDestination(roles.has("admin") || roles.has("investor") ? "investor" : roles.has("video") ? "video" : roles.has("project") ? "project" : "home");
      });
  }, [user, loading]);

  if (loading || destination === null || (user && !access.ready)) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (user && !access.investor) return <Navigate to="/investor/welcome" replace />;
  if (destination !== "investor") return <Navigate to={destination === "video" ? "/investor/videos" : destination === "project" ? "/investor/project" : user ? "/investor/welcome" : "/?login=1"} replace />;

  return <>
    <EFFrame src="/ef-assets/site/investor/index.html" title="energyforward · investor portal" />
    <PortalDrawer />
  </>;
};
export const ContactPage = () => <EFFrame src="/ef-assets/site/contact/index.html" title="energyforward · contact" />;