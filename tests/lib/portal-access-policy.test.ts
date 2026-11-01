import { test, expect } from "bun:test";
import { ACCESS_REFRESH_MS, accessRevision, investorRoleChange, materialRoles } from "../../src/lib/portal-access-policy";

test("unticking Investor portal updates only that role and contains no material removal", () => {
  expect(investorRoleChange("person-1", false)).toEqual({ action: "set_investor", user_id: "person-1", make_investor: false });
});
test("material access does not require Investor portal", () => {
  expect(materialRoles([], ["video-1"], ["html-1"])).toEqual(["video", "project"]);
});
test("open portal checks access every five seconds", () => {
  expect(ACCESS_REFRESH_MS).toBe(5000);
});
test("removing one material changes the permission revision even if its section remains", () => {
  expect(accessRevision([[{ file_id: "pdf-1" }, { file_id: "pdf-2" }]])).not.toBe(accessRevision([[{ file_id: "pdf-2" }]]));
});
test("unchanged grants do not reload viewers just because rows arrive in a different order", () => {
  expect(accessRevision([["one", "two"]])).toBe(accessRevision([["two", "one"]]));
});