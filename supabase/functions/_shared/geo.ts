// Device + approximate (city-level) IP location shared by activity alerts and the admin map.
export function describeDevice(ua: string): string {
  if (!ua) return "Unknown";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet")
    : /Windows/.test(ua) ? "Windows computer" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux computer" : "Unknown device";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Unknown browser";
  return `${os} · ${br}`;
}

export type Geo = { ip: string; device: string; place: string; isp: string; lat: number | null; lon: number | null };

export async function lookupRequest(req: Request): Promise<Geo> {
  const device = describeDevice(req.headers.get("user-agent") ?? "");
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") ?? "").split(",")[0]).trim();
  const out: Geo = { ip, device, place: "Unknown", isp: "", lat: null, lon: null };
  if (!ip) return out;
  try {
    const g = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(2500) }).then((r) => r.json());
    if (g?.success) {
      out.place = [g.city, g.region, g.country].filter(Boolean).join(", ") || "Unknown";
      out.lat = typeof g.latitude === "number" ? g.latitude : null;
      out.lon = typeof g.longitude === "number" ? g.longitude : null;
      out.isp = g.connection?.isp ?? "";
    }
  } catch { /* location optional */ }
  return out;
}
