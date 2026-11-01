import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PortalNav } from "@/components/PortalNav";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";
const base = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/share-link`;
const headers = { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string };
const navLink = { color: pearl, opacity: 0.75, textDecoration: "none" };

type Unlocked = { ticket: string; name: string; type: "project" | "video" | "document" };

/** Public, password-protected page for exactly one shared item. No menus or other links. */
export default function SharePage() {
  const { slug = "" } = useParams();
  const [info, setInfo] = useState<{ name: string; personal?: boolean; first_name?: string | null } | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Unlocked | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobType, setBlobType] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  // Signed-in recipients: prefill their email so the link opens with one click.
  useEffect(() => { if (info?.personal && sessionEmail) setPassword((p) => p || sessionEmail); }, [info, sessionEmail]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSignedIn(!!data.session); setSessionEmail(data.session?.user.email ?? ""); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSignedIn(!!s); setSessionEmail(s?.user.email ?? ""); });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetch(`${base}?action=info`, { method: "POST", headers, body: JSON.stringify({ slug }) })
      .then(async (r) => { const b = await r.json(); if (r.ok) setInfo(b); else setError(b.error ?? "This link is not available."); })
      .catch(() => setError("Could not reach the server."));
  }, [slug]);

  const contentUrl = (t: string, dl = false) => `${base}?action=content&t=${encodeURIComponent(t)}${dl ? "&download=1" : ""}`;
  useLiveRefresh(async () => {
    if (!open) return;
    const res = await fetch(`${contentUrl(open.ticket)}&check=1`).catch(() => null);
    if (!res?.ok) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null); setBlobType(""); setOpen(null);
      setError("This link is no longer available. Its access may have changed or expired.");
    }
  }, Boolean(open));

  useEffect(() => {
    if (!open || open.type === "video") return;
    let url: string | null = null;
    let cancelled = false;
    setLoading(true);
    fetch(contentUrl(open.ticket)).then(async (r) => {
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error ?? "Could not open this item."); }
      // The server may relabel HTML as plain text, so trust the item type / file name too.
      const hdr = r.headers.get("Content-Type") ?? "";
      const n = open.name.toLowerCase();
      const type = open.type === "project" || /\.html?$/.test(n) ? "text/html"
        : /\.pdf$/.test(n) ? "application/pdf"
        : /\.(png|jpe?g|gif|webp)$/.test(n) ? `image/${n.split(".").pop()?.replace("jpg", "jpeg") ?? "png"}`
        : hdr;
      const blob = await r.blob();
      if (cancelled) return;
      url = URL.createObjectURL(new Blob([blob], { type: type || blob.type }));
      setBlobType(type);
      setBlobUrl(url);
    }).catch((e) => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [open]);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await fetch(`${base}?action=unlock`, { method: "POST", headers, body: JSON.stringify(info?.personal ? { slug, email: password } : { slug, password }) });
    const b = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(b.error ?? "Could not open this link."); return; }
    setOpen(b);
  };

  // Signed-in recipient of a personal link: open it straight away (the server still checks the email).
  const [autoTried, setAutoTried] = useState(false);
  useEffect(() => {
    if (autoTried || open || !info?.personal || !sessionEmail) return;
    setAutoTried(true);
    setBusy(true);
    fetch(`${base}?action=unlock`, { method: "POST", headers, body: JSON.stringify({ slug, email: sessionEmail }) })
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (r.ok) setOpen(b); })
      .finally(() => setBusy(false));
  }, [autoTried, open, info, sessionEmail, slug]);

  const viewable = blobType.startsWith("text/html") || blobType.includes("pdf") || blobType.startsWith("image/") || blobType.startsWith("text/");

  return (
    <div style={{ minHeight: "100vh", background: teal, color: pearl, fontFamily: "'General Sans', Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 18 }}>
          energyforward<span style={{ color: amber }}>.</span>
        </span>
        <nav style={{ display: "flex", gap: 28, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", alignItems: "center" }}>
          {!signedIn && <a href="/?public=1" style={navLink}>Home</a>}
        </nav>
        {signedIn && <PortalNav current="shared" />}
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
          <form onSubmit={unlock} style={{ width: "100%", maxWidth: 420, border: "1px solid rgba(238,234,226,0.16)", borderRadius: 16, padding: "30px 28px", background: "rgba(238,234,226,0.03)", textAlign: "center" }}>
            {info && (
              <>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: amber, marginBottom: 10 }}>
                  {info.personal ? "Shared personally with you" : "Shared with you"}
                </div>
                <div style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 22, lineHeight: 1.25, color: pearl, marginBottom: 18 }}>{info.name}</div>
              </>
            )}
            {(info || !error) && (
              <>
                {info?.personal && (
                  <p style={{ margin: "0 0 20px", fontSize: 14.5, lineHeight: 1.55, opacity: 0.85 }}>
                    {info.first_name ? `Welcome, ${info.first_name} — this link was made just for you. ` : "This link was made just for you. "}
                    Enter the email address it was sent to, and your material will open right away.
                  </p>
                )}
                <label style={{ display: "block", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.7, marginBottom: 8, textAlign: "left" }} htmlFor="share-pw">{info?.personal ? "Your email address" : "Password"}</label>
                <input id="share-pw" type={info?.personal ? "email" : "password"} autoComplete={info?.personal ? "email" : "off"} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus
                  placeholder={info?.personal ? "you@example.com" : ""}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(238,234,226,0.3)", background: "rgba(0,0,0,0.2)", color: pearl, fontSize: 15 }} />
                <button type="submit" disabled={busy || !info}
                  style={{ marginTop: 16, width: "100%", padding: "12px 14px", borderRadius: 10, border: "none", background: amber, color: teal, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                  {busy ? "Checking…" : info?.personal ? "Open my material" : "Open"}
                </button>
              </>
            )}
            {error && <p style={{ color: "#f4b5a3", marginTop: 14, marginBottom: 0, fontSize: 14 }}>{error}</p>}
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
