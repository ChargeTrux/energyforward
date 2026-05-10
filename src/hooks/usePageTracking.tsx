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

    return () => {
      cancelled = true;
      closePrev();
    };
  }, [location.pathname, user, sessionId]);
}