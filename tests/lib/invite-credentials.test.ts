import { expect, test } from "bun:test";
import { inviteCredentialOptions, portalCredentialMode } from "../../src/lib/invite-credentials";

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