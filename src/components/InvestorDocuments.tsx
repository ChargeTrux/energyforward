import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PortalNav } from "@/components/PortalNav";
import { PortalDrawer } from "@/components/PortalDrawer";
import { ZoomFrame } from "@/components/ZoomFrame";
import { DocsTree, type DocFile } from "@/components/DocsTree";

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

type SheetResult = {
  sheets: { name: string; html: string; truncated: boolean; totalRows: number; totalCols: number }[];
  maxRows: number;
  maxCols: number;
};

/** Parse spreadsheets off the main thread with a hard timeout so the page never freezes. */
function parseSpreadsheet(buf: ArrayBuffer): Promise<SheetResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("../workers/xlsxPreview.worker.ts", import.meta.url), { type: "module" });
    const t = window.setTimeout(() => {
      w.terminate();
      reject(new Error("This spreadsheet is too large to preview. Please ask us for a PDF version or a smaller extract."));
    }, 90_000);
    w.onmessage = (e) => {
      window.clearTimeout(t);
      w.terminate();
      if (e.data?.ok) resolve(e.data as SheetResult);
      else reject(new Error("This spreadsheet could not be read. Try saving it again as .xlsx."));
    };
    w.onerror = () => {
      window.clearTimeout(t);
      w.terminate();
      reject(new Error("This spreadsheet could not be read. Try saving it again as .xlsx."));
    };
    w.postMessage(buf, [buf]);
  });
}

/** Documents (Data Room) page: viewer full width, folders in the shared slide-out menu. */
export function InvestorDocuments() {
  const { user } = useAuth();
  const [preview, setPreview] = useState<{ name: string; url: string; mime: string } | null>(null);
  const [htmlDoc, setHtmlDoc] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [max, setMax] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMax(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dlName, setDlName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetResult | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const openSeq = useRef(0);
  const urlRef = useRef<string | null>(null);
  const initial = useRef(new URLSearchParams(window.location.search));

  const revoke = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  const openFile = useCallback(async (profileId: string, f: DocFile) => {
    const run = ++openSeq.current;
    setActiveFileId(f.id);
    setHtmlDoc(null);
    setPreview(null);
    setSheets(null);
    setError(null);
    setProgress(null);
    setNotice(null);
    revoke();
    if (user) void supabase.from("content_views").insert({ user_id: user.id, content_type: "document", item_id: f.id, item_name: f.name });
    setLoading(true);
    try {
      const qs = new URLSearchParams({ action: "file", profile_id: profileId, file_id: f.id });
      // Excel: hand off to the browser's own downloader immediately (shows its native progress).
      if (/spreadsheet|ms-excel|text\/csv/i.test(f.mimeType) || /\.(xlsx|xlsm|xls|csv)$/i.test(f.name)) {
        qs.set("mode", "ticket");
        const tr = await callFn(`?${qs}`);
        const tb = await tr.json().catch(() => ({}));
        if (run !== openSeq.current) return;
        if (!tr.ok || !tb.ticket) { setError(tb.error ?? "Could not download this file."); return; }
        const a = document.createElement("a");
        a.href = `${FN_URL}?${new URLSearchParams({ action: "download", t: tb.ticket })}`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setNotice(`${f.name} is downloading — check your browser's downloads.`);
        setDlName(f.name);
        window.setTimeout(() => setDlName((n) => (n === f.name ? null : n)), 7000);
        return;
      }
      const res = await callFn(`?${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (run === openSeq.current) setError(body.error ?? "Could not open this document.");
        return;
      }
      // Read with a live MB counter so large files show progress instead of a silent wait.
      const type = res.headers.get("Content-Type") ?? "";
      const chunks: Uint8Array[] = [];
      let got = 0;
      const reader = res.body?.getReader();
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (run !== openSeq.current) { void reader.cancel(); return; }
          chunks.push(value);
          got += value.length;
          setProgress(`Downloading… ${(got / 1048576).toFixed(1)} MB`);
        }
      }
      const blob = reader ? new Blob(chunks as BlobPart[], { type }) : await res.blob();
      if (run !== openSeq.current) return;
      const mime = blob.type || f.mimeType;
      if (mime.startsWith("text/html") || /\.html?$/i.test(f.name)) {
        setHtmlDoc(await blob.text());
        setPreview({ name: f.name, url: "", mime: "text/html" });
        return;
      }
      if (/spreadsheet|ms-excel|text\/csv/i.test(mime + " " + f.mimeType) || /\.(xlsx|xlsm|xls|csv)$/i.test(f.name)) {
        // Excel files download instead of opening in the viewer.
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = /\.(xlsx|xlsm|xls|csv)$/i.test(f.name) ? f.name : `${f.name}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(u), 60_000);
        setNotice(`${f.name} downloaded.`);
        return;
      }
      const u = URL.createObjectURL(blob);
      urlRef.current = u;
      setPreview({ name: f.name, url: u, mime });
    } catch (e) {
      if (run === openSeq.current) setError(e instanceof Error && e.message ? e.message : "Could not open this document.");
    } finally {
      if (run === openSeq.current) { setLoading(false); setProgress(null); }
    }
  }, [user, revoke]);

  useEffect(() => {
    if (!sheets) return;
    const s = sheets.sheets[sheetIdx];
    if (!s) return;
    const note = s.truncated
      ? `<p class="note">Showing the first ${Math.min(s.totalRows, sheets.maxRows).toLocaleString()} of ${s.totalRows.toLocaleString()} rows${s.totalCols > sheets.maxCols ? ` and ${sheets.maxCols} of ${s.totalCols} columns` : ""}. Contact us for the complete file.</p>`
      : "";
    setHtmlDoc(`<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;margin:16px;color:#111}.note{font-size:12px;color:#7a5a12;background:#fff6dd;padding:6px 10px;border-radius:6px;display:inline-block}
      table{border-collapse:collapse;font-size:12px}td,th{border:1px solid #ccc;padding:4px 8px;white-space:nowrap}
      tr:first-child td{background:#f3f3f3;font-weight:bold}</style></head><body>${note}${s.html}</body></html>`);
  }, [sheets, sheetIdx]);

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

      {dlName && (
        <div role="status" aria-live="polite" onClick={() => setDlName(null)} style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(4,25,27,0.55)" }}>
          <div style={{ background: teal, border: `1px solid ${amber}`, borderRadius: 16, padding: "28px 32px", maxWidth: 420, textAlign: "center", boxShadow: "0 12px 40px rgba(0,0,0,0.45)" }}>
            <div style={{ width: 36, height: 36, margin: "0 auto 14px", border: `3px solid rgba(232,177,74,0.25)`, borderTopColor: amber, borderRadius: "50%", animation: "efspin 0.9s linear infinite" }} />
            <style>{"@keyframes efspin{to{transform:rotate(360deg)}}"}</style>
            <div style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Downloading Excel file</div>
            <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.5, wordBreak: "break-word" }}>
              <strong style={{ color: amber }}>{dlName}</strong> is being downloaded to your computer. Check your browser's downloads to open it.
            </div>
            <button type="button" onClick={() => setDlName(null)} style={{ marginTop: 18, background: amber, color: teal, border: "none", borderRadius: 999, padding: "8px 20px", fontWeight: 700, cursor: "pointer" }}>OK</button>
          </div>
        </div>
      )}

      <PortalDrawer current="documents" onOpenDoc={openFile} activeDocId={activeFileId} />

      <div style={{ padding: "16px clamp(16px,4vw,56px)", borderBottom: "1px solid rgba(238,234,226,0.12)" }}>
        <h1 style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", fontWeight: 500, fontSize: 22, margin: "0 0 4px", color: pearl }}>Documents (Data Room)</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: pearl, opacity: 0.8 }}>The data room holds narrative documents, memos, financial models and other due diligence materials.</p>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      <aside style={{ width: "30%", minWidth: 220, borderRight: "1px solid rgba(238,234,226,0.12)", overflowY: "auto", padding: "12px 10px" }}>
        <div style={{ ...label, color: amber, fontSize: 10, padding: "0 0 8px 6px" }}>Document repository</div>
        <DocsTree onOpenFile={openFile} activeFileId={activeFileId} />
      </aside>
      <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {error && <div style={{ padding: 16, fontSize: 13, color: "#f4b5a3" }}>{error}</div>}
        {preview ? (
          <>
            <div style={{ padding: "8px 16px", ...label, color: amber, borderBottom: "1px solid rgba(238,234,226,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
                <span>{preview.name}</span>
                {sheets && sheets.sheets.length > 1 && sheets.sheets.map((s, i) => (
                  <button key={s.name + i} type="button" onClick={() => setSheetIdx(i)}
                    style={{ ...label, fontSize: 10, background: i === sheetIdx ? amber : "transparent", color: i === sheetIdx ? teal : pearl, border: `1px solid ${amber}`, borderRadius: 999, padding: "3px 10px", cursor: "pointer" }}>
                    {s.name}
                  </button>
                ))}
              </span>
              {preview.mime === "text/html" && (
                <button type="button" onClick={() => setMax(true)} style={{ ...label, background: amber, color: teal, border: "none", borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontWeight: 700 }}>Maximize</button>
              )}
            </div>
            {max && preview.mime === "text/html" && htmlDoc !== null && (
              <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#fff" }}>
                <iframe title={preview.name} srcDoc={htmlDoc} sandbox="allow-scripts" style={{ width: "100%", height: "100%", border: "none" }} />
                <button type="button" onClick={() => setMax(false)} style={{ ...label, position: "fixed", top: 16, right: 16, zIndex: 201, background: amber, color: teal, border: "none", borderRadius: 999, padding: "10px 18px", cursor: "pointer", fontWeight: 700, boxShadow: "0 4px 18px rgba(0,0,0,0.35)" }}>Exit ✕</button>
              </div>
            )}
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
            <div style={{ ...label, color: amber, marginBottom: 8 }}>{loading ? (progress ?? "Opening…") : notice ?? "View only"}</div>
            <div style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.6 }}>
              Choose a document from the folders on the left to view it here. Documents are streamed to your session only —
              they cannot be shared, forwarded or downloaded.
            </div>
          </div>
        )}
        <div style={{ padding: "10px 16px", fontSize: 11, opacity: 0.6, borderTop: "1px solid rgba(238,234,226,0.12)" }}>
          Confidential — do not share. For additional access, use the Contact Us page.
        </div>
      </main>
      </div>
    </div>
  );
}
