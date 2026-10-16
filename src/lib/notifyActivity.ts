import { supabase } from "@/integrations/supabase/client";

/** Asks the server to email this person's alert address, if an admin turned alerts on. Never blocks the page. */
export function notifyActivity(kind: "login" | "video" | "document" | "project", ref: string, name = "") {
  void supabase.functions.invoke("notify-activity", { body: { kind, ref, name } }).catch(() => {});
}
