import { useEffect, useRef } from "react";
import { ACCESS_REFRESH_MS } from "@/lib/portal-access-policy";

/** Read-only revalidation, with no overlapping requests or email/activity writes. */
export function useLiveRefresh(refresh: () => Promise<void>, enabled = true) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    let busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try { await latest.current(); } catch { /* Callers own their unavailable state. */ }
      finally { busy = false; }
    };
    const visible = () => { if (document.visibilityState === "visible") void run(); };
    const timer = window.setInterval(run, ACCESS_REFRESH_MS);
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled]);
}