import { expect, test } from "bun:test";
import { findExistingAccount } from "../../supabase/functions/_shared/account-lookup";

test("existing emails match case and whitespace without creating an account", async () => {
  const admin = { auth: { admin: { listUsers: async () => ({ data: { users: [{ id: "existing", email: "Person@Example.com" }] } }) } } };
  expect(await findExistingAccount(admin, " person@example.com ")).toBe("existing");
  expect(await findExistingAccount(admin, "new@example.com")).toBeUndefined();
});
test("existence checks continue beyond the first thousand users", async () => {
  const pages: number[] = [];
  const admin = { auth: { admin: { listUsers: async ({ page }: { page: number }) => {
    pages.push(page);
    return { data: { users: page === 1 ? Array.from({ length: 1000 }, (_, index) => ({ id: String(index), email: `person${index}@example.com` })) : [{ id: "later", email: "later@example.com" }] } };
  } } } };
  expect(await findExistingAccount(admin, "later@example.com")).toBe("later");
  expect(pages).toEqual([1, 2]);
});
test("a failed account check cannot be treated as a new account", async () => {
  const admin = { auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: { message: "offline" } }) } } };
  expect(findExistingAccount(admin, "person@example.com")).rejects.toThrow("Could not check existing accounts");
});