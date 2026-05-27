import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export function EFFrame({ src, title }: { src: string; title: string }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
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
    <>
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
      {isAdmin && (
        <div
          style={{
            position: "fixed",
            top: 12,
            right: 12,
            zIndex: 60,
            display: "flex",
            gap: 8,
            background: "rgba(10,42,46,0.92)",
            border: "1px solid rgba(232,177,74,0.5)",
            borderRadius: 999,
            padding: "6px 10px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: "#EEEAE2",
          }}
        >
          <span style={{ color: "#E8B14A", alignSelf: "center" }}>admin</span>
          <button onClick={() => navigate("/admin")} style={adminLinkStyle}>dashboard</button>
          <button onClick={() => navigate("/customer")} style={adminLinkStyle}>customer</button>
          <button onClick={() => navigate("/investor")} style={adminLinkStyle}>investor</button>
          <button onClick={() => navigate("/")} style={adminLinkStyle}>home</button>
        </div>
      )}
    </>
  );
}

const adminLinkStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(238,234,226,0.25)",
  color: "#EEEAE2",
  padding: "4px 10px",
  borderRadius: 999,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
};

export const LandingStealth = () => <EFFrame src="/ef-assets/site/index.html" title="energyforward · in stealth" />;
export const CustomerPortal = () => <EFFrame src="/ef-assets/site/customer/index.html" title="energyforward · customer portal" />;
export const InvestorPortal = () => <EFFrame src="/ef-assets/site/investor/index.html" title="energyforward · investor portal" />;
export const ContactPage = () => <EFFrame src="/ef-assets/site/contact/index.html" title="energyforward · contact" />;