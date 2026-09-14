import { useCallback, useEffect, useRef, useState } from "react";
import { FolderLock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Profile = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  ready: boolean;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
};

const teal = "#0A2A2E";
const amber = "#E8B14A";
const pearl = "#EEEAE2";
const FOLDER_MIME = "application/vnd.google-apps.folder";

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/investor-drive`;

async function callFn(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return await fetch(`${FN_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
  });
}

export function InvestorDocuments() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; url: string; mime: string } | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
  }, []);

  useEffect(() => {
    if (!user) {
      setProfiles([]);
      return;
    }
    (async () => {
      try {
        const res = await callFn("", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "profiles" }),
        });
        const body = await res.json();
        const list: Profile[] = body.profiles ?? [];
        setProfiles(list);
        setActiveProfile((cur) => cur ?? list[0]?.id ?? null);
      } catch {
        setProfiles([]);
      }
    })();
  }, [user]);

  const loadFolder = useCallback(
    async (profileId: string, folderId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ action: "list", profile_id: profileId });
        if (folderId) qs.set("folder_id", folderId);
        const res = await callFn(`?${qs.toString()}`);
        const body = await res.json();
        if (!res.ok) {
          setFiles([]);
          setError(body.error ?? "Could not load documents.");
          return;
        }
        setFiles(body.files ?? []);
      } catch {
        setError("Could not load documents.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || !activeProfile) return;
    setTrail([]);
    revokePreview();
    loadFolder(activeProfile);
  }, [open, activeProfile, loadFolder, revokePreview]);

  const openEntry = async (f: DriveFile) => {
    if (f.mimeType === FOLDER_MIME) {
      setTrail((t) => [...t, { id: f.id, name: f.name }]);
      if (activeProfile) loadFolder(activeProfile, f.id);
      return;
    }
    if (!activeProfile) return;
    setLoading(true);
    setError(null);
    revokePreview();
    try {
      const qs = new URLSearchParams({ action: "file", profile_id: activeProfile, file_id: f.id });
      const res = await callFn(`?${qs.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Could not open this document.");
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      previewUrlRef.current = objUrl;
      setPreview({ name: f.name, url: objUrl, mime: blob.type || f.mimeType });
    } catch {
      setError("Could not open this document.");
    } finally {
      setLoading(false);
    }
  };

  const goUp = () => {
    const next = trail.slice(0, -1);
    setTrail(next);
    revokePreview();
    if (activeProfile) loadFolder(activeProfile, next[next.length - 1]?.id);
  };

  useEffect(() => () => revokePreview(), [revokePreview]);

  if (!user || profiles.length === 0) return null;

  const label = { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" as const };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          right: 22,
          bottom: 22,
          zIndex: 60,
          minWidth: 172,
          minHeight: 56,
          padding: "10px 20px",
          borderRadius: 999,
          border: `1px solid ${amber}`,
          background: amber,
          color: teal,
          fontFamily: "'General Sans', sans-serif",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          boxShadow: "0 12px 32px rgba(0,0,0,0.38), 0 0 0 4px rgba(232,177,74,0.18)",
        }}
      >
        <FolderLock size={20} aria-hidden="true" />
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, textAlign: "left" }}>
          <span>Documents</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Secure access</span>
        </span>
      </button>

      {open && (
        <div
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(6,24,26,0.97)",
            color: pearl,
            fontFamily: "'General Sans', sans-serif",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "14px 20px",
              borderBottom: "1px solid rgba(238,234,226,0.14)",
              flexWrap: "wrap",
            }}
          >
            <span style={{ ...label, color: amber }}>Secure data room</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveProfile(p.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontSize: 13,
                    border: `1px solid ${activeProfile === p.id ? amber : "rgba(238,234,226,0.25)"}`,
                    background: activeProfile === p.id ? amber : "transparent",
                    color: activeProfile === p.id ? teal : pearl,
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                revokePreview();
                setOpen(false);
              }}
              style={{
                marginLeft: "auto",
                background: "transparent",
                border: "1px solid rgba(238,234,226,0.3)",
                color: pearl,
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>

          <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "row" }}>
            <div
              style={{
                width: "min(320px, 38vw)",
                borderRight: "1px solid rgba(238,234,226,0.14)",
                overflowY: "auto",
                padding: "14px 16px",
              }}
            >
              {trail.length > 0 && (
                <button
                  type="button"
                  onClick={goUp}
                  style={{ background: "none", border: "none", color: amber, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 10 }}
                >
                  ← {trail.length > 1 ? trail[trail.length - 2].name : "All documents"}
                </button>
              )}
              {loading && <div style={{ fontSize: 13, opacity: 0.7 }}>Loading…</div>}
              {error && <div style={{ fontSize: 13, color: "#f4b5a3" }}>{error}</div>}
              {!loading && !error && files.length === 0 && (
                <div style={{ fontSize: 13, opacity: 0.65 }}>No documents have been published here yet.</div>
              )}
              {files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => openEntry(f)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: preview?.name === f.name ? "rgba(232,177,74,0.12)" : "transparent",
                    border: "none",
                    borderTop: "1px solid rgba(238,234,226,0.10)",
                    color: pearl,
                    padding: "10px 4px",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: amber, marginRight: 8 }}>{f.mimeType === FOLDER_MIME ? "▸" : "•"}</span>
                  {f.name}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              {preview ? (
                <>
                  <div style={{ padding: "10px 16px", ...label, color: amber, borderBottom: "1px solid rgba(238,234,226,0.12)" }}>
                    {preview.name}
                  </div>
                  <div style={{ flex: 1, minHeight: 0, background: "#04191b" }}>
                    {preview.mime.startsWith("image/") ? (
                      <img
                        src={preview.url}
                        alt={preview.name}
                        draggable={false}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : preview.mime.startsWith("video/") ? (
                      <video
                        src={preview.url}
                        controls
                        controlsList="nodownload noplaybackrate"
                        disablePictureInPicture
                        style={{ width: "100%", height: "100%", background: "#000" }}
                      />
                    ) : preview.mime.startsWith("audio/") ? (
                      <audio src={preview.url} controls controlsList="nodownload" style={{ width: "100%", marginTop: 24 }} />
                    ) : (
                      <iframe
                        title={preview.name}
                        src={`${preview.url}#toolbar=0&navpanes=0&scrollbar=0`}
                        style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div style={{ margin: "auto", textAlign: "center", maxWidth: 420, padding: 24 }}>
                  <div style={{ ...label, color: amber, marginBottom: 8 }}>View only</div>
                  <div style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.6 }}>
                    Select a document on the left to view it here. Documents are streamed to your session only —
                    they cannot be shared, forwarded or downloaded.
                  </div>
                </div>
              )}
              <div style={{ padding: "10px 16px", fontSize: 11, opacity: 0.6, borderTop: "1px solid rgba(238,234,226,0.12)" }}>
                Confidential — do not share. For additional access, use the Contact Us page.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
