import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PortalNav } from "@/components/PortalNav";
import { PortalDrawer } from "@/components/PortalDrawer";
import { ZoomFrame } from "@/components/ZoomFrame";
import type { DocFile } from "@/components/DocsTree";

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";
const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/investor-drive`;

async function callFn(path: string) {
  const { data } = await supabase.auth.getSession();
  return fetch(`${FN_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
  });
}

/** Documents (Data Room) page: viewer full width, folders in the shared slide-out menu. */
export function InvestorDocuments() {
  const { user } = useAuth();
  const [preview, setPreview] = useState<{ name: string; url: string; mime: string } | null>(null);
  const [htmlDoc, setHtmlDoc] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const initial = useRef(new URLSearchParams(window.location.search));

  const revoke = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  const openFile = useCallback(async (profileId: string, f: DocFile) => {
    setActiveFileId(f.id);
    setHtmlDoc(null);
    setPreview(null);
    setError(null);
    revoke();
    if (user) void supabase.from("content_views").insert({ user_id: user.id, content_type: "document", item_id: f.id, item_name: f.name });
    setLoading(true);
    try {
      const qs = new URLSearchParams({ action: "file", profile_id: profileId, file_id: f.id });
      const res = await callFn(`?${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not open this document.");
        return;
      }
      const blob = await res.blob();
      const mime = blob.type || f.mimeType;
      if (mime.startsWith("text/html") || /\.html?$/i.test(f.name)) {
        setHtmlDoc(await blob.text());
        setPreview({ name: f.name, url: "", mime: "text/html" });
        return;
      }
      const u = URL.createObjectURL(blob);
      urlRef.current = u;
      setPreview({ name: f.name, url: u, mime });
    } catch {
      setError("Could not open this document.");
    } finally {
      setLoading(false);
    }
  }, [user, revoke]);

  useEffect(() => {
    const p = initial.current;
    const profile = p.get("profile"), file = p.get("file");
    if (profile && file) void openFile(profile, { id: file, name: p.get("name") ?? "Document", mimeType: p.get("mime") ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => revoke(), [revoke]);

  const label = { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" as const };

  return (
    <div onContextMenu={(e) => e.preventDefault()} style={{ height: "100vh", background: teal, color: pearl, fontFamily: "'General Sans', Arial, sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)", flexWrap: "wrap", gap: 12 }}>
        <Link to="/" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 18, color: pearl, textDecoration: "none" }}>
          energyforward<span style={{ color: amber }}>.</span>
        </Link>
        <PortalNav current="documents" />
      </header>

      <PortalDrawer current="documents" pinned onOpenDoc={openFile} activeDocId={activeFileId} />

      <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", paddingLeft: 0 }}>
        {error && <div style={{ padding: 16, fontSize: 13, color: "#f4b5a3" }}>{error}</div>}
        {preview ? (
          <>
            <div style={{ padding: "10px 16px", ...label, color: amber, borderBottom: "1px solid rgba(238,234,226,0.12)" }}>{preview.name}</div>
            <div style={{ flex: 1, minHeight: 0, background: "#04191b", display: "flex", flexDirection: "column" }}>
              <ZoomFrame resetKey={preview.name}>
                {preview.mime === "text/html" && htmlDoc !== null ? (
                  <iframe title={preview.name} srcDoc={htmlDoc} sandbox="allow-scripts" style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
                ) : preview.mime.startsWith("image/") ? (
                  <img src={preview.url} alt={preview.name} draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : preview.mime.startsWith("video/") ? (
                  <video src={preview.url} controls controlsList="nodownload noplaybackrate" disablePictureInPicture style={{ width: "100%", height: "100%", background: "#000" }} />
                ) : preview.mime.startsWith("audio/") ? (
                  <audio src={preview.url} controls controlsList="nodownload" style={{ width: "100%", marginTop: 24 }} />
                ) : (
                  <iframe title={preview.name} src={`${preview.url}#toolbar=0&navpanes=0&view=FitH`} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
                )}
              </ZoomFrame>
            </div>
          </>
        ) : (
          <div style={{ margin: "auto", textAlign: "center", maxWidth: 440, padding: 24 }}>
            <div style={{ ...label, color: amber, marginBottom: 8 }}>{loading ? "Opening…" : "View only"}</div>
            <div style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.6 }}>
              Open the gold Investor Materials tab on the left and choose a document to view it here. Documents are streamed to your session only —
              they cannot be shared, forwarded or downloaded.
            </div>
          </div>
        )}
        <div style={{ padding: "10px 16px", fontSize: 11, opacity: 0.6, borderTop: "1px solid rgba(238,234,226,0.12)" }}>
          Confidential — do not share. For additional access, use the Contact Us page.
        </div>
      </main>
    </div>
  );
}
