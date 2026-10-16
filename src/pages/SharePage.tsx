import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";
const base = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/share-link`;
const headers = { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string };

type Unlocked = { ticket: string; name: string; type: "project" | "video" | "document" };

/** Public, password-protected page for exactly one shared item. No menus or other links. */
export default function SharePage() {
  const { slug = "" } = useParams();
  const [info, setInfo] = useState<{ name: string } | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Unlocked | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobType, setBlobType] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${base}?action=info`, { method: "POST", headers, body: JSON.stringify({ slug }) })
      .then(async (r) => { const b = await r.json(); if (r.ok) setInfo(b); else setError(b.error ?? "This link is not available."); })
      .catch(() => setError("Could not reach the server."));
  }, [slug]);

  const contentUrl = (t: string, dl = false) => `${base}?action=content&t=${encodeURIComponent(t)}${dl ? "&download=1" : ""}`;

  useEffect(() => {
    if (!open || open.type === "video") return;
    let url: string | null = null;
    setLoading(true);
    fetch(contentUrl(open.ticket)).then(async (r) => {
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error ?? "Could not open this item."); }
      // The server may relabel HTML as plain text, so trust the item type / file name too.
      const hdr = r.headers.get("Content-Type") ?? "";
      const n = open.name.toLowerCase();
      const type = open.type === "project" || /\.html?$/.test(n) ? "text/html"
        : /\.pdf$/.test(n) ? "application/pdf"
        : /\.(png|jpe?g|gif|webp)$/.test(n) ? `image/${n.split(".").pop()!.replace("jpg", "jpeg")}`
        : hdr;
      const blob = await r.blob();
      url = URL.createObjectURL(new Blob([blob], { type: type || blob.type }));
      setBlobType(type);
      setBlobUrl(url);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [open]);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await fetch(`${base}?action=unlock`, { method: "POST", headers, body: JSON.stringify({ slug, password }) });
    const b = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(b.error ?? "Could not open this link."); return; }
    setOpen(b);
  };

  const viewable = blobType.startsWith("text/html") || blobType.includes("pdf") || blobType.startsWith("image/") || blobType.startsWith("text/");

  return (
    <div style={{ minHeight: "100vh", background: teal, color: pearl, fontFamily: "'General Sans', Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)" }}>
        <span style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 18 }}>
          energyforward<span style={{ color: amber }}>.</span>
        </span>
      </header>
      <section style={{ textAlign: "center", padding: "28px clamp(16px,4vw,56px) 18px", maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: "clamp(24px,4vh,38px)", margin: "0 0 10px", color: pearl }}>
          Welcome to EnergyForward<span style={{ color: amber }}>.</span>
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.5, margin: 0, color: pearl }}>
          Energy Forward is building the delivery infrastructure for the next era of energy—connecting technology, operations and execution to move critical projects from ambition to reality.
        </p>
      </section>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 clamp(12px,3vw,40px) 24px" }}>
        {!open ? (
          <form onSubmit={unlock} style={{ width: "100%", maxWidth: 380, border: "1px solid rgba(238,234,226,0.16)", borderRadius: 12, padding: 22, background: "rgba(238,234,226,0.03)" }}>
            {info && <p style={{ margin: "0 0 12px", fontSize: 15 }}>Shared with you: <strong style={{ color: amber }}>{info.name}</strong></p>}
            {(info || !error) && (
              <>
                <label style={{ display: "block", fontSize: 13, marginBottom: 6 }} htmlFor="share-pw">Password</label>
                <input id="share-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(238,234,226,0.3)", background: "rgba(0,0,0,0.2)", color: pearl, fontSize: 15 }} />
                <button type="submit" disabled={busy || !info}
                  style={{ marginTop: 14, width: "100%", padding: "10px 12px", borderRadius: 8, border: "none", background: amber, color: teal, fontWeight: 700, cursor: "pointer" }}>
                  {busy ? "Checking…" : "Open"}
                </button>
              </>
            )}
            {error && <p style={{ color: "#f4b5a3", marginTop: 12, fontSize: 14 }}>{error}</p>}
          </form>
        ) : (
          <div style={{ width: "100%", maxWidth: 1400, flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 style={{ fontSize: 18, margin: 0, textAlign: "center", color: amber }}>{open.name}</h2>
            {error && <p style={{ color: "#f4b5a3", textAlign: "center" }}>{error}</p>}
            {open.type === "video" ? (
              <video src={contentUrl(open.ticket)} controls autoPlay playsInline controlsList="nodownload"
                style={{ width: "100%", maxHeight: "75vh", background: "#000", borderRadius: 10 }} />
            ) : loading ? (
              <p style={{ textAlign: "center", opacity: 0.8 }}>Loading…</p>
            ) : blobUrl && viewable ? (
              <iframe title={open.name} src={blobUrl} sandbox={blobType.startsWith("text/html") ? "allow-scripts allow-pointer-lock" : undefined}
                style={{ width: "100%", flex: 1, minHeight: "75vh", border: "none", borderRadius: 10, background: "#fff" }} />
            ) : blobUrl ? (
              <p style={{ textAlign: "center" }}>
                <a href={blobUrl} download={open.name} style={{ color: amber, fontWeight: 700 }}>Download {open.name}</a>
              </p>
            ) : null}
            <div style={{ fontSize: 11, opacity: 0.6, textAlign: "center" }}>Confidential — do not share.</div>
          </div>
        )}
      </main>
    </div>
  );
}
