import { test, expect } from "bun:test";
import { canPreviewPage, previewRequestAllowed } from "./preview-policy";
test("admin preview includes the admin page only for a target admin", () => {
  expect(canPreviewPage("/admin", true)).toBe(true);
  expect(canPreviewPage("/admin", false)).toBe(false);
});
test("preview never sends invites, emails or database changes", () => {
  for (const method of ["POST", "PATCH", "DELETE", "PUT"]) expect(previewRequestAllowed(new URL("https://example.test/rest/v1/user_roles"), method, "")).toBe(false);
  for (const action of ["send_email", "create", "update", "delete"]) expect(previewRequestAllowed(new URL("https://example.test/functions/v1/share-link"), "POST", action)).toBe(false);
  expect(previewRequestAllowed(new URL("https://example.test/functions/v1/admin-users"), "POST", "invite")).toBe(false);
});
test("admin preview keeps catalog and activity reads available", () => {
  expect(previewRequestAllowed(new URL("https://example.test/rest/v1/activity_locations"), "GET", "")).toBe(true);
  for (const fn of ["investor-videos", "project-pages"]) expect(previewRequestAllowed(new URL(`https://example.test/functions/v1/${fn}`), "GET", "catalog")).toBe(true);
  expect(previewRequestAllowed(new URL("https://example.test/functions/v1/investor-drive"), "POST", "sync_names")).toBe(false);
});