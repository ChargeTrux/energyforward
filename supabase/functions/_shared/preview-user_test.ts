import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { PreviewError, resolvePreviewUser } from "./preview-user.ts";
const target = "11111111-1111-1111-1111-111111111111";
function db(admin: boolean, active = true, exists = true) {
  return {
    rpc: () => Promise.resolve({ data: admin, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: exists ? { is_active: active } : null, error: null }) }) }) }),
  } as unknown as SupabaseClient;
}
Deno.test("every admin can preview another user without inheriting caller identity", async () => {
  assertEquals(await resolvePreviewUser(db(true), "admin-one", target, "mine", ["mine"]), { id: target, preview: true });
  assertEquals(await resolvePreviewUser(db(true), "admin-two", target, "mine", ["mine"]), { id: target, preview: true });
});
Deno.test("non-admin cannot select a preview target", async () => {
  await assertRejects(() => resolvePreviewUser(db(false), "ordinary-user", target, "mine", ["mine"]), PreviewError, "Admins only");
});
Deno.test("preview denies mutations even for an admin", async () => {
  await assertRejects(() => resolvePreviewUser(db(true), "admin", target, "save-description", ["mine", "view"]), PreviewError, "read-only");
});
Deno.test("suspended users cannot receive preview content", async () => {
  await assertRejects(() => resolvePreviewUser(db(true, false), "admin", target, "mine", ["mine"]), PreviewError, "suspended");
});
Deno.test("normal access keeps the authenticated caller", async () => {
  assertEquals(await resolvePreviewUser(db(false), "caller", null, "mine", ["mine"]), { id: "caller", preview: false });
});