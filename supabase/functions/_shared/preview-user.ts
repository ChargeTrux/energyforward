import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export class PreviewError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}

export async function resolvePreviewUser(db: SupabaseClient, callerId: string, target: string | null, action: string, reads: string[]) {
  if (!target) return { id: callerId, preview: false };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target)) throw new PreviewError("Invalid preview user", 400);
  const { data: admin, error } = await db.rpc("has_role", { _user_id: callerId, _role: "admin" });
  if (error || !admin) throw new PreviewError("Admins only");
  if (!reads.includes(action)) throw new PreviewError("User preview is read-only");
  const { data: profile, error: profileError } = await db.from("profiles").select("is_active").eq("user_id", target).maybeSingle();
  if (profileError) throw new PreviewError("Could not verify preview user", 503);
  if (!profile) throw new PreviewError("User not found", 404);
  if (!profile.is_active) throw new PreviewError("This account is suspended");
  return { id: target, preview: true };
}