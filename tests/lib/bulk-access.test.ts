import { test, expect } from "bun:test";
import { removeSelectedAccess } from "../../src/lib/bulk-access";

test("Remove access applies to both selected users without any material selections", async () => {
  const calls: string[][] = [];
  const count = await removeSelectedAccess(["person-1", "person-2"], "admin", async (ids) => {
    calls.push(ids);
    return { data: 2, error: null };
  });
  expect(calls).toEqual([["person-1", "person-2"]]);
  expect(count).toBe(2);
});

test("failed removal never reports success", async () => {
  await expect(removeSelectedAccess(["person-1", "person-2"], "admin", async () => ({ data: null, error: { message: "Access update failed" } }))).rejects.toThrow("Access update failed");
});

test("an admin cannot accidentally revoke their own authority", async () => {
  let called = false;
  await expect(removeSelectedAccess(["admin", "person-2"], "admin", async () => {
    called = true;
    return { data: 2, error: null };
  })).rejects.toThrow("You cannot remove your own access");
  expect(called).toBe(false);
});