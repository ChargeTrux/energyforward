import { expect, test } from "bun:test";
import { defaultPortalExpiry, portalLinkExpired } from "../../supabase/functions/_shared/portal-expiry";
import { portalLinkStatus } from "../../src/lib/portal-link-expiry";

const now = Date.parse("2026-11-06T18:47:00Z");
test("personal portal links expire after exactly two weeks", () => {
  expect(defaultPortalExpiry(now)).toBe("2026-11-20T18:47:00.000Z");
  expect(portalLinkExpired(defaultPortalExpiry(now), now + 14 * 86400000 - 1)).toBe(false);
  expect(portalLinkExpired(defaultPortalExpiry(now), now + 14 * 86400000)).toBe(true);
});
test("two days remaining is an expiry warning", () => {
  expect(portalLinkStatus("2026-11-08T18:47:00Z", true, now)).toEqual({ label: "Link expires in 2 days", warning: true });
  expect(portalLinkStatus("2026-11-09T18:47:00Z", true, now).warning).toBe(false);
});
test("extending expiry restores the same expired link's eligibility", () => {
  expect(portalLinkExpired("2026-11-05T18:47:00Z", now)).toBe(true);
  expect(portalLinkExpired("2026-11-20T18:47:00Z", now)).toBe(false);
});