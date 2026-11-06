import { useEffect, useState } from "react";
import { PortalNav } from "@/components/PortalNav";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";
const base = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/portal-entry`;

/** Personal portal link: the person types their email (no password) and is signed in to their own portal. */
export default function PortalEntryPage() {
  const { slug = "" } = useParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [mode, setMode] = useState<"personal" | "password">("personal");
  const [password, setPassword] = useState("");
  useEffect(() => {
    fetch(base, { method: "POST", headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string }, body: JSON.stringify({ action: "info", slug }) })
      .then((r) => r.json().then((b) => ({ ok: r.ok, b })))
      .then(({ ok, b }) => { if (!ok) setError(b.error ?? "This link is not available."); else if (b.mode === "password") setMode("password"); })
      .catch(() => {});
  }, [slug]);
  const navigate = useNavigate();
  useEffect(() => { if (signedIn) navigate("/investor/welcome", { replace: true }); }, [signedIn, navigate]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => data.subscription.unsubscribe();
  }, []);

  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "password") {
        const { error: pErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (pErr) setError("Email or password is not correct.");
        else navigate("/investor/welcome", { replace: true });
        return;
      }
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        body: JSON.stringify({ action: "enter", slug, email }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok || !b.token_hash) { setError(b.error ?? "This link is not available."); return; }
      const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: b.token_hash, type: "magiclink" });
      if (vErr) setError("Could not sign you in. Please try again.");
      else navigate("/investor/welcome", { replace: true });
    } finally { setBusy(false); }
  };

  const mono = "'JetBrains Mono', monospace";
  const display = "'Cabinet Grotesk', Arial, sans-serif";
  return (
    <div style={{ minHeight: "100vh", background: teal, color: pearl, fontFamily: "'General Sans', Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: display, fontWeight: 500, fontSize: 18 }}>energyforward<span style={{ color: amber }}>.</span></span>
        {signedIn ? <PortalNav current="shared" /> : <a href="/?public=1" style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: pearl, textDecoration: "none" }}>Home</a>}
      </header>
      <section style={{ textAlign: "center", padding: "28px clamp(16px,4vw,56px) 18px", maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontFamily: display, fontWeight: 500, fontSize: "clamp(24px,4vh,38px)", margin: "0 0 10px" }}>
          Welcome to EnergyForward<span style={{ color: amber }}>.</span>
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.5, margin: 0 }}>
          Energy Forward is building the delivery infrastructure for the next era of energy—connecting technology, operations and execution to move critical projects from ambition to reality.
        </p>
      </section>
      <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 clamp(12px,3vw,40px) 24px" }}>
        <form onSubmit={enter} style={{ width: "100%", maxWidth: 420, alignSelf: "flex-start", border: "1px solid rgba(238,234,226,0.16)", borderRadius: 16, padding: "30px 28px", background: "rgba(238,234,226,0.03)", textAlign: "center" }}>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: amber, marginBottom: 10 }}>Shared personally with you</div>
          <div style={{ fontFamily: display, fontWeight: 500, fontSize: 22, lineHeight: 1.25, marginBottom: 18 }}>Your EnergyForward portal</div>
          <p style={{ margin: "0 0 20px", fontSize: 14.5, lineHeight: 1.55, opacity: 0.85 }}>
            This link was made just for you. Enter the email address it was sent to, and your portal will open with the sections you have been given.
          </p>
          <label htmlFor="entry-email" style={{ display: "block", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.7, marginBottom: 8, textAlign: "left" }}>Your email address</label>
          <input id="entry-email" type="email" required autoFocus autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(238,234,226,0.3)", background: "rgba(0,0,0,0.2)", color: pearl, fontSize: 15 }} />
          {mode === "password" && (<>
            <label htmlFor="entry-password" style={{ display: "block", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.7, margin: "14px 0 8px", textAlign: "left" }}>Your password</label>
            <input id="entry-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(238,234,226,0.3)", background: "rgba(0,0,0,0.2)", color: pearl, fontSize: 15 }} />
          </>)}
          <button type="submit" disabled={busy}
            style={{ marginTop: 16, width: "100%", padding: "12px 14px", borderRadius: 10, border: "none", background: amber, color: teal, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            {busy ? "Opening…" : "Open my portal"}
          </button>
          {error && <p role="alert" style={{ color: "#f4b5a3", marginTop: 14, marginBottom: 0, fontSize: 14 }}>{error}</p>}
        </form>
      </main>
    </div>
  );
}
