import { useEffect, useState } from "react";

const amber = "#E8B14A";
const pearl = "#EEEAE2";
const STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

/** Fits content to the available space (100%) with zoom out / in controls. */
export function ZoomFrame({ resetKey, children }: { resetKey?: string; children: React.ReactNode }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => setZoom(1), [resetKey]);
  const step = (dir: number) => {
    const i = STEPS.findIndex((s) => s >= zoom - 0.001);
    setZoom(STEPS[Math.max(0, Math.min(STEPS.length - 1, i + dir))]);
  };
  const btn = {
    background: "transparent", border: "1px solid rgba(238,234,226,0.3)", color: pearl, borderRadius: 999,
    minWidth: 32, height: 28, padding: "0 10px", cursor: "pointer", fontSize: 13,
  };
  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end", padding: "6px 12px", borderBottom: "1px solid rgba(238,234,226,0.12)" }}>
        <button type="button" style={btn} onClick={() => step(-1)} aria-label="Zoom out">−</button>
        <button type="button" style={{ ...btn, borderColor: zoom === 1 ? amber : btn.border.split(" ").slice(2).join(" ") }} onClick={() => setZoom(1)} title="Fit to page">
          Fit · {Math.round(zoom * 100)}%
        </button>
        <button type="button" style={btn} onClick={() => step(1)} aria-label="Zoom in">+</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", position: "relative" }}>
        <div style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: "top left", display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
