import { expect, mock, test } from "bun:test";

test("permanent deletion requires complete record cleanup and never reports success on failure", async () => {
  let handler: ((r: Request) => Promise<Response>) | undefined;
  const targetId = "00000000-0000-4000-8000-000000000002";
  let exists = true;
  let cleanupFails = false;
  const events: string[] = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000001" } } }), admin: {
      getUserById: async () => ({ data: { user: exists ? { email: " OLD@EXAMPLE.COM " } : null } }),
      deleteUser: async () => { events.push("auth"); exists = false; return { error: null }; },
    } },
    rpc: async (name: string, args: any) => {
      expect(name).toBe("cleanup_deleted_portal_account");
      expect(args).toEqual({ _user_id: targetId, _email: "old@example.com" });
      events.push("cleanup");
      return { error: cleanupFails ? new Error("Fixture failure") : null };
    },
    from(table: string) {
      const q: any = {}; q.select = q.eq = q.maybeSingle = () => q;
      q.then = (resolve: any) => Promise.resolve({ data: table === "user_roles" ? [{ role: "admin" }] : { email: "old@example.com" }, error: null }).then(resolve);
      return q;
    },
  };
  mock.module("https://esm.sh/@supabase/supabase-js@2.45.0", () => ({ createClient: () => client }));
  const globals = globalThis as any; const old = globals.Deno;
  globals.Deno = { env: { get: () => "fixture" }, serve: (fn: any) => { handler = fn; } };
  try {
    await import("../../supabase/functions/admin-users/index.ts");
    const call = () => {
      if (!handler) throw new Error("Missing handler");
      return handler(new Request("https://fixture.invalid", { method: "POST", headers: { Authorization: "Bearer fixture" }, body: JSON.stringify({ action: "delete_user", user_id: targetId }) }));
    };
    cleanupFails = true;
    expect((await call()).status).toBe(500);
    expect(exists).toBe(true);
    expect(events).toEqual(["cleanup"]);
    events.length = 0; cleanupFails = false;
    const response = await call();
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(events).toEqual(["cleanup", "auth"]);
    expect(exists).toBe(false);
  } finally { globals.Deno = old; mock.restore(); }
});