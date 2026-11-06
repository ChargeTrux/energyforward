import { expect, mock, test } from "bun:test";

test("one generic URL reuses per-account expiry and enforces each credential mode", async () => {
  let handler: ((r: Request) => Promise<Response>) | undefined;
  const entries = new Map<string, { user_id: string; mode: string; enabled: boolean; expires_at: string }>();
  let linkInserts = 0;
  let generated = 0;
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: "admin" } } }),
      admin: { generateLink: async () => { generated++; return { data: { properties: { hashed_token: "fixture" } } }; } },
      signInWithPassword: async ({ password }: { password: string }) => password === "correct-password" ? { data: { session: { access_token: "fixture-access", refresh_token: "fixture-refresh" } } } : { data: {}, error: new Error("Wrong password") },
    },
    from(table: string) {
      let key = "";
      const q: any = {};
      q.select = q.maybeSingle = () => q;
      q.eq = (_: string, value: string) => { key = value; return q; };
      q.update = () => q;
      q.insert = () => { linkInserts++; return q; };
      q.upsert = (value: any, opts: any) => { if (!entries.has(value.user_id) || !opts.ignoreDuplicates) entries.set(value.user_id, value); return q; };
      q.then = (resolve: any) => Promise.resolve({ data: table === "user_roles" ? [{ role: "admin" }] : table === "profiles" ? (key === "missing@example.com" ? null : { user_id: key, is_active: key !== "inactive@example.com" }) : entries.get(key), error: null }).then(resolve);
      return q;
    },
  };
  mock.module("https://esm.sh/@supabase/supabase-js@2.45.0", () => ({ createClient: () => client }));
  const globals = globalThis as any;
  const old = globals.Deno;
  globals.Deno = { env: { get: () => "fixture" }, serve: (fn: any) => { handler = fn; } };
  try {
    await import("../../supabase/functions/portal-entry/index.ts");
    const call = async (body: any) => {
      if (!handler) throw new Error("Missing handler");
      const r = await handler(new Request("https://fixture.invalid", { method: "POST", headers: { Authorization: "Bearer fixture" }, body: JSON.stringify(body) }));
      return { status: r.status, data: await r.json() };
    };
    expect((await call({ action: "create", emails: ["one@example.com"], mode: "personal" })).data.slug).toBe("portal");
    const entry = entries.get("one@example.com");
    if (!entry) throw new Error("Missing account entry");
    entry.expires_at = "2099-01-01T00:00:00.000Z";
    expect((await call({ action: "create", emails: ["one@example.com"], mode: "password" })).data.slug).toBe("portal");
    expect(entries.size).toBe(1);
    expect(entry.expires_at).toBe("2099-01-01T00:00:00.000Z");
    expect(entry.mode).toBe("personal");
    expect(linkInserts).toBe(0);
    expect((await call({ action: "enter", slug: "portal", email: "one@example.com" })).data.token_hash).toBe("fixture");
    entry.expires_at = "2000-01-01T00:00:00.000Z";
    expect((await call({ action: "enter", slug: "portal", email: "one@example.com" })).status).toBe(410);
    expect(generated).toBe(1);
    expect((await call({ action: "enter", slug: "portal", email: "missing@example.com" })).status).toBe(403);
    await call({ action: "create", emails: ["two@example.com"], mode: "password" });
    expect((await call({ action: "credential", slug: "portal", email: "two@example.com" })).data.mode).toBe("password");
    expect((await call({ action: "enter", slug: "portal", email: "two@example.com", password: "wrong" })).status).toBe(403);
    expect((await call({ action: "enter", slug: "portal", email: "two@example.com", password: "correct-password" })).data.session.access_token).toBe("fixture-access");
    expect(generated).toBe(1);
  } finally { globals.Deno = old; mock.restore(); }
});