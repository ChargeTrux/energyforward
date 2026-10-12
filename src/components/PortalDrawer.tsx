import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { PortalSidebar, type SidebarProps } from "@/components/PortalSidebar";

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";

/**
 * Slide-out side menu shared by every portal page. A small gold tab peeks
 * from the left edge; clicking it opens the menu smoothly.
 */
export function PortalDrawer({ defaultOpen = false, ...props }: SidebarProps & { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", left: 0, top: "50%", zIndex: 85, transform: `translate(${open ? "-100%" : "0"}, -50%)`,
          transition: "transform .3s ease", width: 30, height: 128, border: "none", cursor: "pointer", padding: 0,
          background: amber, color: teal, borderRadius: "0 16px 16px 0", boxShadow: "4px 0 18px rgba(0,0,0,0.35)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
        }}
      >
        <span style={{ writingMode: "vertical-rl", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>Menu</span>
        <ChevronRight size={16} />
      </button>

      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 86, background: "rgba(4,20,22,0.45)",
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .3s ease",
        }}
      />
      <aside
        aria-hidden={!open}
        onClick={(e) => { if ((e.target as HTMLElement).closest("[data-drawer-close]")) setOpen(false); }}
        style={{
          position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 87, width: "min(460px, 92vw)",
          background: teal, color: pearl, borderRight: `2px solid ${amber}`, boxShadow: "12px 0 40px rgba(0,0,0,0.45)",
          transform: open ? "translateX(0)" : "translateX(-102%)", transition: "transform .35s cubic-bezier(.22,.8,.25,1)",
          display: "flex", flexDirection: "column", fontFamily: "'General Sans', Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 12px", borderBottom: "1px solid rgba(238,234,226,0.12)" }}>
          <span style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontSize: 18 }}>energyforward<span style={{ color: amber }}>.</span></span>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: pearl, cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          <PortalSidebar {...props} />
        </div>
      </aside>
    </>
  );
}
