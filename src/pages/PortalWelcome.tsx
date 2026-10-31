import { Link, Navigate } from "react-router-dom";
import { PortalNav, NoAccessScreen, usePortalAccess } from "@/components/PortalNav";
import { usePortalUser as useAuth } from "@/components/admin/UserPreviewBoundary";

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";

const SECTIONS = [
  {
    key: "project" as const, to: "/investor/project", title: "Project 3D Demo",
    text: "A 3D animated simulation of one 24-hour period of the EnergyForward loop, following energy from the solar project through the EnergyHub and EnergyPort to the customer's vehicles. A guided tour walks you through the full day in a few minutes, so you can see how the whole system fits together before reading anything else.",
  },
  {
    key: "videos" as const, to: "/investor/videos", title: "Videos",
    text: "Short video overviews of the EnergyForward business, from the introduction of the company through each part of the model. These are built to bring a new reader, whether an investor or a member of an investor's team, up to speed on EnergyForward quickly. They make the written materials in the data room easier to work through.",
  },
  {
    key: "documents" as const, to: "/investor/documents", title: "Documents (Data Room)",
    text: "The data room holds narrative documents, memos, financial models and other due diligence materials.",
  },
];

export default function PortalWelcome() {
  const { user, loading } = useAuth();
  const access = usePortalAccess();
  if (loading) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (!user) return <Navigate to="/?login=1" replace />;
  if (!access.ready) return <div className="min-h-screen grid place-items-center">Loading…</div>;
  if (access.customer && !access.investor && !(access.project || access.videos || access.documents)) return <Navigate to="/customer" replace />;
  const shown = SECTIONS.filter((s) => access[s.key]);
  const links = access.links;
  if (!shown.length && !links.length) return <NoAccessScreen />;
  const typeLabel = (t: string) => t === "project" ? "Project 3D Demo" : t === "video" ? "Video" : "Document";
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : null;

  return (
    <div style={{ height: "100vh", overflow: "hidden", background: teal, color: pearl, fontFamily: "'General Sans', Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)", flexWrap: "wrap", gap: 12 }}>
        <Link to="/investor/welcome" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 18, color: pearl, textDecoration: "none" }}>
          energyforward<span style={{ color: amber }}>.</span>
        </Link>
        <PortalNav current="home" />
      </header>
      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
        <main style={{ flex: 1, minWidth: 0, padding: "clamp(12px,3vh,40px) clamp(16px,4vw,56px)", display: "flex", justifyContent: "center", alignItems: "center", overflowY: "auto" }}>
          <div style={{ maxWidth: 900, width: "100%" }}>
            <h1 style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: "clamp(24px,4.5vh,42px)", lineHeight: 1.15, margin: "0 0 1.2vh", color: pearl, textAlign: "center" }}>
              Welcome to EnergyForward<span style={{ color: amber }}>.</span>
            </h1>
            <p style={{ fontSize: "clamp(14px,2vh,18px)", lineHeight: 1.5, color: pearl, margin: "0 auto 1.2vh", textAlign: "center", maxWidth: 640 }}>
              Energy Forward is building the delivery infrastructure for the next era of energy—connecting technology, operations and execution to move critical projects from ambition to reality.
            </p>
            <p style={{ fontSize: "clamp(13px,1.8vh,16px)", lineHeight: 1.5, color: pearl, opacity: 0.9, margin: "0 auto 2.5vh", textAlign: "center", maxWidth: 680 }}>
              Your access request has been reviewed and approved. You are now authorized to access the following through the EnergyForward investor portal.
            </p>
            <div style={{ display: "grid", gap: "1.5vh" }}>
              {shown.map((s, i) => (
                <Link key={s.key} to={s.to} style={{ display: "block", textDecoration: "none", color: pearl, border: "1px solid rgba(238,234,226,0.16)", borderRadius: 12, padding: "clamp(10px,2vh,20px) 22px", background: "rgba(238,234,226,0.03)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = amber)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(238,234,226,0.16)")}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
                    <span style={{ fontSize: "clamp(15px,2.2vh,19px)", fontWeight: 600 }}><span style={{ color: amber, marginRight: 10 }}>{i + 1}.</span>{s.title}</span>
                    <span style={{ color: amber, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Open →</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "clamp(12px,1.65vh,15px)", lineHeight: 1.45, opacity: 0.8 }}>{s.text}</p>
                </Link>
              ))}
            </div>
            {links.length > 0 && (
              <div id="shared" style={{ marginTop: shown.length ? "2.5vh" : 0 }}>
                <div style={{ color: amber, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "1.2vh" }}>Shared directly with you</div>
                <div style={{ display: "grid", gap: "1.2vh" }}>
                  {links.map((l) => (
                    <Link key={l.slug} to={`/share/${l.slug}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, textDecoration: "none", color: pearl, border: "1px solid rgba(232,177,74,0.35)", borderRadius: 12, padding: "clamp(10px,1.8vh,16px) 22px", background: "rgba(232,177,74,0.05)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = amber)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(232,177,74,0.35)")}>
                      <span>
                        <span style={{ display: "block", fontSize: "clamp(15px,2.1vh,18px)", fontWeight: 600 }}>{l.item_name}</span>
                        <span style={{ fontSize: 12, opacity: 0.7 }}>{typeLabel(l.item_type)}{fmt(l.expires_at) ? ` · available until ${fmt(l.expires_at)}` : ""}</span>
                      </span>
                      <span style={{ color: amber, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Open →</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {shown.length > 1 && (
              <p style={{ fontSize: "clamp(12px,1.6vh,14px)", lineHeight: 1.5, opacity: 0.7, marginTop: "2vh", marginBottom: 0 }}>
                <strong style={{ color: amber, fontWeight: 600 }}>Suggested viewing order:</strong> we suggest working through your materials in the order listed above. Each item builds on the one before it.
              </p>
            )}
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: "1.5vh" }}>Confidential — do not share.</div>
          </div>
        </main>
      </div>
    </div>
  );
}
