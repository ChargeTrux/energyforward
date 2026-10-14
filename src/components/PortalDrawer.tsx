import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { PortalSidebar, type SidebarProps } from "@/components/PortalSidebar";

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";
let pinnedCount = 0;
let lastOpen: boolean | null = null;

/**
 * Slide-out side menu shared by every portal page. A small gold tab peeks
 * from the left edge; clicking it opens the menu smoothly.
 */
/** Set to true to bring the side menu back on every portal page. */
export const SIDE_MENU_ENABLED = false;

export function PortalDrawer(p: SidebarProps & { defaultOpen?: boolean; pinned?: boolean }) {
  if (!SIDE_MENU_ENABLED) return null;
  return <PortalDrawerInner {...p} />;
}

function PortalDrawerInner({ defaultOpen = false, pinned = false, ...props }: SidebarProps & { defaultOpen?: boolean; pinned?: boolean }) {
  const [open, setOpenRaw] = useState(pinned && lastOpen !== null ? lastOpen : defaultOpen || pinned);
  const setOpen = (v: boolean) => { if (pinned) lastOpen = v; setOpenRaw(v); };
  // Pinned: the menu stays beside the page (content shifts right) until closed with X.
  useEffect(() => {
    if (!pinned) return;
    const body = document.body;
    pinnedCount++;
    body.style.transition = "padding-left .35s cubic-bezier(.22,.8,.25,1)";
    body.style.paddingLeft = open ? "min(300px, 85vw)" : "0px";
    return () => {
      pinnedCount--;
      // Moving between portal pages: wait so the next page's menu keeps the space (no flash).
      setTimeout(() => { if (pinnedCount === 0) body.style.paddingLeft = ""; }, 0);
    };
  }, [pinned, open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Open investor materials"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", left: 0, top: "50%", zIndex: 85, transform: `translate(${open ? "-100%" : "0"}, -50%)`,
          transition: "transform .3s ease", width: 30, height: 190, border: "none", cursor: "pointer", padding: 0,
          background: amber, color: teal, borderRadius: "0 16px 16px 0", boxShadow: "4px 0 18px rgba(0,0,0,0.35)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
        }}
      >
        <span style={{ writingMode: "vertical-rl", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>Investor Materials</span>
        <ChevronRight size={16} />
      </button>

      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 86, background: "rgba(4,20,22,0.45)",
          opacity: open && !pinned ? 1 : 0, pointerEvents: open && !pinned ? "auto" : "none", transition: "opacity .3s ease",
        }}
      />
      <aside
        aria-hidden={!open}
        onClick={(e) => { if (!pinned && (e.target as HTMLElement).closest("[data-drawer-close]")) setOpen(false); }}
        style={{
          position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 87, width: pinned ? "min(300px, 85vw)" : "min(340px, 88vw)",
          background: teal, color: pearl, borderRight: `2px solid ${amber}`, boxShadow: pinned ? "none" : "12px 0 40px rgba(0,0,0,0.45)",
          transform: open ? "translateX(0)" : "translateX(-102%)", transition: "transform .35s cubic-bezier(.22,.8,.25,1)",
          display: "flex", flexDirection: "column", fontFamily: "'General Sans', Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 12px", borderBottom: "1px solid rgba(238,234,226,0.12)" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: amber }}>Investor Materials</span>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: pearl, cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          <PortalSidebar {...props} />
        </div>
      </aside>
    </>
  );
}
