import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Row = { id: string; who: string; kind: string; item_name: string; ip: string | null; place: string | null; isp: string | null; device: string | null; lat: number | null; lon: number | null; created_at: string };
const KIND: Record<string, string> = { login: "Signed in", video: "Video", document: "Document", project: "Project 3D Demo", share: "Share link" };
const COLOR: Record<string, string> = { login: "#64748b", video: "#2563eb", document: "#16a34a", project: "#d97706", share: "#db2777" };
const RANGES = [{ k: 1, l: "Today" }, { k: 7, l: "7 days" }, { k: 30, l: "30 days" }, { k: 365, l: "1 year" }];

/** Admin-only map of where people opened videos, documents, 3D pages and share links (approximate, from IP). */
export function ActivityMap() {
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState(7);
  const [kind, setKind] = useState("all");
  const [person, setPerson] = useState("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    supabase.from("activity_locations" as never).select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(1000)
      .then(({ data }) => { setRows((data as unknown as Row[]) ?? []); setLoading(false); });
  }, [days]);

  const people = useMemo(() => Array.from(new Set(rows.map((r) => r.who))).sort(), [rows]);
  const shown = useMemo(() => rows.filter((r) => (kind === "all" || r.kind === kind) && (person === "all" || r.who === person)), [rows, kind, person]);
  const short = (w: string) => w.replace(/\s*\(.*\)$/, "");
  const pts = shown.filter((r) => r.lat != null && r.lon != null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center text-sm">
        {RANGES.map((r) => <Button key={r.k} size="sm" variant={days === r.k ? "default" : "outline"} onClick={() => setDays(r.k)}>{r.l}</Button>)}
        <select className="h-9 rounded-md border px-2 bg-background" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">All activity</option>
          {Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="h-9 rounded-md border px-2 bg-background max-w-xs" value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="all">Everyone</option>
          {people.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        <span className="text-muted-foreground">{loading ? "Loading…" : `${shown.length} events · ${pts.length} on map`}</span>
      </div>
      <div className="h-[420px] rounded-md overflow-hidden border relative z-0">
        <MapContainer center={[30, -40]} zoom={2} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {pts.map((r) => (
            <CircleMarker key={r.id} center={[r.lat!, r.lon!]} radius={7} pathOptions={{ color: COLOR[r.kind] ?? "#2563eb", fillOpacity: 0.6 }}>
              <Tooltip permanent direction="top" offset={[0, -6]}>{short(r.who)}</Tooltip>
              <Popup>
                <strong>{r.who}</strong><br />
                {KIND[r.kind] ?? r.kind}{r.item_name ? `: ${r.item_name}` : ""}<br />
                {new Date(r.created_at).toLocaleString()}<br />
                {r.place}{r.isp ? ` · ${r.isp}` : ""}<br />
                IP {r.ip ?? "unknown"} · {r.device}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <div className="max-h-64 overflow-auto text-xs border rounded-md">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted"><tr className="text-left">{["When", "Who", "What", "Location", "IP", "Device"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2"><button className="underline" onClick={() => setPerson(r.who)}>{r.who}</button></td>
                <td className="p-2">{KIND[r.kind] ?? r.kind}{r.item_name ? `: ${r.item_name}` : ""}</td>
                <td className="p-2">{r.place ?? "Unknown"}</td>
                <td className="p-2">{r.ip ?? "—"}</td>
                <td className="p-2">{r.device ?? "—"}</td>
              </tr>
            ))}
            {!shown.length && <tr><td className="p-3 text-muted-foreground" colSpan={6}>No activity recorded yet in this period.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Locations are estimated from the IP address (about city level); VPNs and mobile networks can show a different city.</p>
    </div>
  );
}
