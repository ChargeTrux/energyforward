// Builds a small PNG map (OpenStreetMap tiles) with a pin, for embedding inline in emails.
// Loaded lazily (pure WASM build) so a map failure can never block the alert email.

const W = 520, H = 220, Z = 11, T = 256;

export async function staticMapPng(lat: number, lon: number): Promise<Uint8Array | null> {
  try {
    const { Image } = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
    const n = 2 ** Z;
    const px = ((lon + 180) / 360) * n * T;
    const r = (lat * Math.PI) / 180;
    const py = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * T;
    const left = px - W / 2, top = py - H / 2;
    const tx0 = Math.floor(left / T), ty0 = Math.floor(top / T);
    const tx1 = Math.floor((left + W) / T), ty1 = Math.floor((top + H) / T);
    const img = new Image(W, H);
    img.fill(0xe5e7ebff);
    const jobs: Promise<void>[] = [];
    for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
      jobs.push((async () => {
        const res = await fetch(`https://tile.openstreetmap.org/${Z}/${((tx % n) + n) % n}/${ty}.png`, {
          headers: { "User-Agent": "EnergyForward-ActivityAlerts/1.0 (investor@energyforward.com)" },
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return;
        const tile = await Image.decode(new Uint8Array(await res.arrayBuffer()));
        img.composite(tile, Math.round(tx * T - left), Math.round(ty * T - top));
      })());
    }
    await Promise.all(jobs);
    // Approximate-area ring + pin
    const cx = W / 2, cy = H / 2;
    for (let x = -40; x <= 40; x++) for (let y = -40; y <= 40; y++) {
      const d = Math.hypot(x, y);
      const X = Math.round(cx + x), Y = Math.round(cy + y);
      if (X < 1 || Y < 1 || X > W || Y > H) continue;
      if (d <= 9) img.setPixelAt(X, Y, d <= 6 ? 0xdc2626ff : 0xffffffff);
      else if (d >= 38 && d <= 40) img.setPixelAt(X, Y, 0xdc262699);
    }
    return await img.encode(1);
  } catch (e) {
    console.error("static map failed", e);
    return null;
  }
}

export function toBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
