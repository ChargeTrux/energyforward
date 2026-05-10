import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function usePageTracking() {
  const location = useLocation();
  const { user, sessionId } = useAuth();
  const currentRef = useRef<{ id: string; enteredAt: number } | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const closePrev = async () => {
      if (currentRef.current) {
        const duration = Math.floor((Date.now() - currentRef.current.enteredAt) / 1000);
        await supabase
          .from("page_views")
          .update({ duration_seconds: duration })
          .eq("id", currentRef.current.id);
        currentRef.current = null;
      }
    };

    (async () => {
      await closePrev();
      const { data } = await supabase
        .from("page_views")
        .insert({
          user_id: user.id,
          session_id: sessionId,
          path: location.pathname,
        })
        .select("id")
        .single();
      if (!cancelled && data) {
        currentRef.current = { id: data.id, enteredAt: Date.now() };
      }
    })();

    const handleUnload = () => {
      if (currentRef.current) {
        const duration = Math.floor((Date.now() - currentRef.current.enteredAt) / 1000);
        navigator.sendBeacon?.(
          `https://scyqmmakqmnzpnhrrnlx.supabase.co/rest/v1/page_views?id=eq.${currentRef.current.id}`,
        );
        // best-effort fallback via fetch
        fetch(
          `https://scyqmmakqmnzpnhrrnlx.supabase.co/rest/v1/page_views?id=eq.${currentRef.current.id}`,
          {
            method: "PATCH",
            keepalive: true,
            headers: {
              "Content-Type": "application/json",
              apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjeXFtbWFrcW1uenBuaHJybmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5OTY2NTMsImV4cCI6MjA3NDU3MjY1M30.pzSqpFJNrJVAn9wx-zSdTN7wibphuN24R2tIQMi85SA",
              Authorization: `Bearer ${supabase.auth.getSession ? "" : ""}`,
            },
            body: JSON.stringify({ duration_seconds: duration }),
          },
        ).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", handleUnload);
      closePrev();
    };
  }, [location.pathname, user, sessionId]);
}