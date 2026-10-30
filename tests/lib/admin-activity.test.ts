import { test, expect } from "bun:test";
import { userAccessStatus } from "../../src/lib/admin-activity";

const now = new Date("2026-10-30T01:21:00Z");
const noPortal = {
  is_active: true,
  is_admin: false,
  is_investor: false,
  is_video: false,
  is_customer: false,
  invite_sent_at: "2026-10-29T12:00:00Z",
};

test("successful sign-in remains green without portal access", () => {
  expect(userAccessStatus(noPortal, "2026-10-29T13:00:00Z", undefined, now).tone).toBe("success");
});

test("recent recorded activity remains blue without portal access", () => {
  expect(userAccessStatus(noPortal, "2026-10-29T13:00:00Z", "2026-10-30T01:20:00Z", now).tone).toBe("active");
});

test("missing portal access alone is not a sign-in problem", () => {
  expect(userAccessStatus(noPortal, undefined, undefined, now).tone).toBe("pending");
  expect(userAccessStatus({ ...noPortal, invite_sent_at: null }, undefined, undefined, now).tone).toBe("neutral");
});

test("suspension still blocks sign-in regardless of recorded activity", () => {
  expect(userAccessStatus({ ...noPortal, is_active: false }, "2026-10-29T13:00:00Z", "2026-10-30T01:20:00Z", now).tone).toBe("issue");
});