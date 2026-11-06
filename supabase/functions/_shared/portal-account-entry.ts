import { defaultPortalExpiry } from "./portal-expiry.ts";

export const GENERIC_PORTAL_SLUG = "portal";
export const GENERIC_PORTAL_URL = "https://energyforward.com/enter/portal";
export const portalCredentialMode = (value: unknown): "personal" | "password" => value === "personal" ? "personal" : "password";

// Keep copying read-only for an already configured account: expiry edits must survive.
// deno-lint-ignore no-explicit-any
export async function ensurePortalAccountEntry(admin: any, userId: string, mode: "personal" | "password", replace = false) {
  const { error } = await admin.from("portal_account_entries").upsert({
    user_id: userId, mode, enabled: true, expires_at: defaultPortalExpiry(),
  }, { onConflict: "user_id", ignoreDuplicates: !replace });
  if (error) throw new Error("Could not save the account's portal credentials.");
}