import { useEffect, useState } from "react";
import { InvestorDocuments } from "@/components/InvestorDocuments";
import { Link, Navigate } from "react-router-dom";
import { PlayCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
        inset: 0,
        width: "100vw",
        height: "100vh",
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
  const [destination, setDestination] = useState<"investor" | "video" | "home" | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { setDestination("home"); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }) => {
        const roles = new Set((data ?? []).map((row) => row.role as string));
        setDestination(roles.has("admin") || roles.has("investor") ? "investor" : roles.has("video") ? "video" : "home");
      });
  }, [user, loading]);

  if (loading || destination === null) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (destination !== "investor") return <Navigate to={destination === "video" ? "/investor/videos" : "/?login=1"} replace />;

  return <>
    <EFFrame src="/ef-assets/site/investor/index.html" title="energyforward · investor portal" />
    <InvestorDocuments />
    <Link
      to="/investor/videos"
      style={{
        position: "fixed", left: 22, bottom: 22, zIndex: 60, display: "flex", alignItems: "center", gap: 10,
        padding: "14px 22px", borderRadius: 999, background: "#E8B14A", color: "#0A2A2E",
        fontFamily: "'General Sans', Arial, sans-serif", fontWeight: 600, fontSize: 15, textDecoration: "none",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      }}
    >
      <PlayCircle size={20} /> Videos
    </Link>
  </>;
};
export const ContactPage = () => <EFFrame src="/ef-assets/site/contact/index.html" title="energyforward · contact" />;