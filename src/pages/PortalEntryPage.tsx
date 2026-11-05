import { useState } from "react";
import { useParams } from "react-router-dom";
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

  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        body: JSON.stringify({ action: "enter", slug, email }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok || !b.token_hash) { setError(b.error ?? "This link is not available."); return; }
      const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: b.token_hash, type: "magiclink" });
      if (vErr) setError("Could not sign you in. Please try again.");
      // On success the app sends them to their portal.
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: teal, color: pearl, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <form onSubmit={enter} style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>EnergyForward portal</h1>
        <p style={{ opacity: 0.85, marginBottom: 20 }}>Shared personally with you. Type the email address this link was sent to.</p>
        <label htmlFor="entry-email" style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Your email</label>
        <input id="entry-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: `1px solid ${amber}`, background: "#fff", color: teal, marginBottom: 14 }} />
        {error && <p role="alert" style={{ color: amber, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ width: "100%", padding: "11px 12px", borderRadius: 6, border: 0, background: amber, color: teal, fontWeight: 700, cursor: "pointer" }}>
          {busy ? "Opening…" : "Open my portal"}
        </button>
      </form>
    </div>
  );
}
