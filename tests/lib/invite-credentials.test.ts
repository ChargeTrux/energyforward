import { expect, test } from "bun:test";
import { customPasswordFeedback, hasInviteAccess, inviteCredentialOptions, portalCredentialMode } from "../../src/lib/invite-credentials";

test("customized email-only level does not require a password change", () => {
  expect(inviteCredentialOptions("personal", "old-password")).toEqual({ no_password_change: true });
  expect(portalCredentialMode("personal")).toBe("personal");
});
test("email and password credentials keep the normal password setup", () => {
  expect(inviteCredentialOptions("password", "old-password")).toEqual({});
  expect(portalCredentialMode("password")).toBe("password");
});
test("a customized password is used only for the custom credential choice", () => {
  expect(inviteCredentialOptions("custom", " chosen-password ")).toEqual({ custom_password: "chosen-password" });
  expect(portalCredentialMode("custom")).toBe("password");
});

test("no access selection blocks credentials and invitation creation", () => {
  expect(hasInviteAccess([false, false, false], [[], [], []])).toBe(false);
});
test("any Section 1 portal choice enables credentials", () => {
  for (let index = 0; index < 5; index++) expect(hasInviteAccess(Array.from({ length: 5 }, (_, i) => i === index), [[], [], []])).toBe(true);
});
test("any Section 1 material choice enables credentials", () => {
  for (let index = 0; index < 3; index++) expect(hasInviteAccess([false], Array.from({ length: 3 }, (_, i) => i === index ? ["selected"] : []))).toBe(true);
});
test("custom password requires at least 8 characters with exact shortfall", () => {
  expect(customPasswordFeedback("short")).toEqual({ length: 5, valid: false, remaining: 3 });
  expect(customPasswordFeedback("abcdefgh").valid).toBe(true);
});
test("custom password accepts memorable words without symbol rules and at most 72 characters", () => {
  expect(customPasswordFeedback("orchard river lantern").valid).toBe(true);
  expect(customPasswordFeedback("a".repeat(72)).valid).toBe(true);
  expect(customPasswordFeedback("a".repeat(73)).valid).toBe(false);
});