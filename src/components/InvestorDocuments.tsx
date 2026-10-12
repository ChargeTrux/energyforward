import { useCallback, useEffect, useRef, useState } from "react";
import { FolderLock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PortalNav } from "@/components/PortalNav";
import { PortalSidebar } from "@/components/PortalSidebar";

const navLink = {
  background: "none",
  border: "none",
  color: "rgba(238,234,226,0.75)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  padding: 0,
  textDecoration: "none",
};

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

export function InvestorDocuments({ standalone = false }: { standalone?: boolean } = {}) {
  const { user, isAdmin } = useAuth();
  const [roles, setRoles] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) { setRoles(new Set()); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id)
      .then(({ data }) => setRoles(new Set((data ?? []).map((r) => r.role as string))));
  }, [user]);
  const [open, setOpen] = useState(standalone);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; url: string; mime: string } | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; right: number; bottom: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [launcherPosition, setLauncherPosition] = useState({ right: 22, bottom: 22 });

  const moveLauncher = useCallback((clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const nextRight = Math.max(10, Math.min(window.innerWidth - 182, drag.right - (clientX - drag.startX)));
    const nextBottom = Math.max(10, Math.min(window.innerHeight - 66, drag.bottom - (clientY - drag.startY)));
    if (Math.abs(clientX - drag.startX) > 4 || Math.abs(clientY - drag.startY) > 4) drag.moved = true;
    setLauncherPosition({ right: nextRight, bottom: nextBottom });
  }, []);

  const endLauncherDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    suppressClickRef.current = Boolean(dragRef.current?.moved);
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const startLauncherDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      right: launcherPosition.right,
      bottom: launcherPosition.bottom,
      moved: false,
    };
  };

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
        const want = new URLSearchParams(window.location.search).get("profile");
        setActiveProfile((cur) => list.find((p) => p.id === want)?.id ?? cur ?? list[0]?.id ?? null);
      } catch {
        setProfiles([]);
      }
    })();
  }, [user]);

  const [tree, setTree] = useState<Record<string, DriveFile[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [htmlDoc, setHtmlDoc] = useState<string | null>(null);

  const loadFolder = useCallback(
    async (profileId: string, folderId?: string) => {
      const key = folderId ?? "root";
      if (!folderId) setLoading(true);
      setLoadingIds((s) => new Set(s).add(key));
      setError(null);
      try {
        const qs = new URLSearchParams({ action: "list", profile_id: profileId });
        if (folderId) qs.set("folder_id", folderId);
        const res = await callFn(`?${qs.toString()}`);
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? "Could not load documents.");
          return;
        }
        const list: DriveFile[] = body.files ?? [];
        setTree((t) => ({ ...t, [key]: list }));
        if (!folderId) setFiles(list);
      } catch {
        setError("Could not load documents.");
      } finally {
        if (!folderId) setLoading(false);
        setLoadingIds((s) => { const n = new Set(s); n.delete(key); return n; });
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || !activeProfile) return;
    setTrail([]);
    setTree({});
    setExpanded(new Set());
    setActiveFileId(null);
    setHtmlDoc(null);
    revokePreview();
    loadFolder(activeProfile);
  }, [open, activeProfile, loadFolder, revokePreview]);

  const toggleFolder = (f: DriveFile) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(f.id)) n.delete(f.id);
      else {
        n.add(f.id);
        if (!tree[f.id] && activeProfile) loadFolder(activeProfile, f.id);
      }
      return n;
    });
  };

  const openEntry = async (f: DriveFile) => {
    if (f.mimeType === FOLDER_MIME) { toggleFolder(f); return; }
    if (!activeProfile) return;
    setActiveFileId(f.id);
    setHtmlDoc(null);
    if (user) void supabase.from("content_views").insert({ user_id: user.id, content_type: "document", item_id: f.id, item_name: f.name });
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
      const mime = blob.type || f.mimeType;
      if (mime.startsWith("text/html") || /\.html?$/i.test(f.name)) {
        setHtmlDoc(await blob.text());
        setPreview({ name: f.name, url: "", mime: "text/html" });
        return;
      }
      const objUrl = URL.createObjectURL(blob);
      previewUrlRef.current = objUrl;
      setPreview({ name: f.name, url: objUrl, mime });
    } catch {
      setError("Could not open this document.");
    } finally {
      setLoading(false);
    }
  };

  const goUp = () => {};

  const renderTree = (key: string, depth: number): React.ReactNode =>
    (tree[key] ?? []).map((f) => {
      const isFolder = f.mimeType === FOLDER_MIME;
      const isOpen = expanded.has(f.id);
      return (
        <div key={f.id}>
          <button
            type="button"
            onClick={() => openEntry(f)}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
              background: activeFileId === f.id ? "rgba(232,177,74,0.14)" : "transparent",
              border: "none", borderTop: "1px solid rgba(238,234,226,0.08)", color: pearl,
              padding: `8px 4px 8px ${4 + depth * 16}px`, cursor: "pointer", fontSize: 14,
              fontWeight: isFolder ? 600 : 400,
            }}
          >
            <span style={{ color: amber, width: 12, display: "inline-block" }}>{isFolder ? (isOpen ? "▾" : "▸") : "•"}</span>
            <span style={{ overflowWrap: "anywhere", lineHeight: 1.35 }}>{f.name}</span>
          </button>
          {isFolder && isOpen && (
            <div>
              {loadingIds.has(f.id) && <div style={{ fontSize: 12, opacity: 0.6, paddingLeft: 20 + depth * 16 }}>Loading…</div>}
              {!loadingIds.has(f.id) && (tree[f.id]?.length ?? 0) === 0 && (
                <div style={{ fontSize: 12, opacity: 0.55, padding: `4px 0 4px ${20 + depth * 16}px` }}>Empty folder</div>
              )}
              {renderTree(f.id, depth + 1)}
            </div>
          )}
        </div>
      );
    });

  useEffect(() => () => revokePreview(), [revokePreview]);

  if (!user) return null;
  if (profiles.length === 0 && !standalone) return null;

  const label = { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" as const };

  return (
    <>
      {!standalone && <button
        type="button"
        aria-label="Open secure documents. Drag to move this button."
        title="Drag to move · Click to open"
        onPointerDown={startLauncherDrag}
        onPointerMove={(event) => moveLauncher(event.clientX, event.clientY)}
        onPointerUp={endLauncherDrag}
        onPointerCancel={endLauncherDrag}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          setOpen(true);
        }}
        style={{
          position: "fixed",
          right: launcherPosition.right,
          bottom: launcherPosition.bottom,
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
          cursor: "grab",
          touchAction: "none",
          userSelect: "none",
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
      </button>}

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
            {!standalone && <button
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
            </button>}
          </div>

          <div
            style={{
              display: "flex",
              gap: 20,
              alignItems: "center",
              flexWrap: "wrap",
              padding: "10px 20px",
              borderBottom: "1px solid rgba(238,234,226,0.14)",
            }}
          >
            {standalone ? <PortalNav current="documents" /> : <>
            <a href="/?public=1" style={navLink}>Home</a>
            <button
              type="button"
              onClick={() => {
                revokePreview();
                setOpen(false);
              }}
              style={navLink}
            >
              Investor portal
            </button>
            {(roles.has("customer") || roles.has("admin")) && (
              <a href="/customer" style={navLink}>Customer portal</a>
            )}
            {isAdmin && <a href="/admin" style={navLink}>Admin</a>}
            <span style={{ ...navLink, color: amber, cursor: "default" }}>Documents</span>
            {user && <a href="/signout" style={{ ...navLink, marginLeft: "auto" }}>Sign out</a>}
            </>}
          </div>

          <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "row" }}>
            <div
              style={{
                width: "clamp(300px, 32vw, 460px)", resize: "horizontal", minWidth: 260, maxWidth: "70vw",
                borderRight: "1px solid rgba(238,234,226,0.14)",
                overflowY: "auto",
                padding: "14px 16px",
              }}
            >
              {(() => {
                const body = <>
                  {loading && <div style={{ fontSize: 13, opacity: 0.7 }}>Loading…</div>}
                  {error && <div style={{ fontSize: 13, color: "#f4b5a3" }}>{error}</div>}
                  {!loading && !error && files.length === 0 && (
                    <div style={{ fontSize: 13, opacity: 0.65 }}>{profiles.length === 0 ? "No document folders have been shared with you yet." : "No documents have been published here yet."}</div>
                  )}
                  {renderTree("root", 0)}
                </>;
                return standalone ? <PortalSidebar current="documents">{body}</PortalSidebar> : body;
              })()}
            </div>

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              {preview ? (
                <>
                  <div style={{ padding: "10px 16px", ...label, color: amber, borderBottom: "1px solid rgba(238,234,226,0.12)" }}>
                    {preview.name}
                  </div>
                  <div style={{ flex: 1, minHeight: 0, background: "#04191b" }}>
                    {preview.mime === "text/html" && htmlDoc !== null ? (
                      <iframe title={preview.name} srcDoc={htmlDoc} sandbox="allow-scripts" style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
                    ) : preview.mime.startsWith("image/") ? (
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
