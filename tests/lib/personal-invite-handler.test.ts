import { expect, mock, test } from "bun:test";

test("single and bulk account invitation requests send personal entry emails without returning a password", async () => {
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const links: Array<Record<string, unknown>> = [];
  const messages: Array<{ html: string; to: string[] }> = [];
  const profiles: Array<Record<string, unknown>> = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: "test-admin" } } }),
      admin: { listUsers: async () => ({ data: { users: [] } }), createUser: async () => ({ data: { user: { id: "test-user" } } }) },
    },
    from: (table: string) => {
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "order", "delete", "not", "maybeSingle"]) {
        query[method] = () => query;
      }
      query.insert = (value: Record<string, unknown>) => { if (table === "portal_entry_links") links.push(value); return query; };
      query.upsert = (value: Record<string, unknown>) => { if (table === "profiles") profiles.push(value); return query; };
      query.update = () => query;
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "user_roles" ? [{ role: "admin" }] : [], error: null }).then(resolve);
      return query;
    },
  };
  mock.module("https://esm.sh/@supabase/supabase-js@2.45.0", () => ({ createClient: () => client }));
  const globals = globalThis as unknown as { Deno?: unknown };
  const originalDeno = globals.Deno;
  const originalFetch = globalThis.fetch;
  globals.Deno = { env: { get: () => "test-placeholder" }, serve: (fn: typeof handler) => { handler = fn; } };
  globalThis.fetch = (async (_input, init) => {
    messages.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id: "test-message" }), { status: 200 });
  }) as typeof fetch;
  try {
    await import("../../supabase/functions/admin-users/index.ts");
    if (!handler) throw new Error("Invitation handler was not registered");
    // Bulk creation calls this same invitation action once per person.
    for (const email of ["one@example.com", "two@example.com"]) {
      const response = await handler(new Request("https://test.invalid", {
        method: "POST",
        headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", email, roles: ["investor"], send_email: true, no_password_change: true }),
      }));
      expect(response.status).toBe(200);
      expect((await response.json()).temp_password).toBeUndefined();
    }
    expect(links.map((link) => link.emails)).toEqual([["one@example.com"], ["two@example.com"]]);
    expect(links.map((link) => link.mode)).toEqual(["personal", "personal"]);
    expect(profiles.map((profile) => profile.must_change_password)).toEqual([false, false]);
    expect(messages).toHaveLength(2);
    messages.forEach((message, index) => {
      expect(message.html.includes(`https://energyforward.com/enter/${links[index].slug}`)).toBe(true);
      expect(message.html.includes("Temporary Password")).toBe(false);
    });
  } finally {
    globalThis.fetch = originalFetch;
    globals.Deno = originalDeno;
    mock.restore();
  }
});