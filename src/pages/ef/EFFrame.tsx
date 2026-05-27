import { useEffect } from "react";

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
export const InvestorPortal = () => <EFFrame src="/ef-assets/site/investor/index.html" title="energyforward · investor portal" />;