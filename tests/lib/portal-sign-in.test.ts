import { expect, test } from "bun:test";
import { emailCodeOptions, PORTAL_SIGN_IN_URL, portalCodeSchema, portalEmailSchema } from "../../src/lib/portal-sign-in";

test("copied portal link is reusable on energyforward.com without recipient or file identifiers", () => {
  expect(PORTAL_SIGN_IN_URL).toBe("https://energyforward.com/?login=1&auth=code");
});
test("email-code sign-in cannot create public accounts", () => {
  expect(emailCodeOptions.shouldCreateUser).toBe(false);
});
test("private portal requires a verification code, not just an email address", () => {
  expect(portalCodeSchema.safeParse("").success).toBe(false);
  expect(portalCodeSchema.safeParse("123456").success).toBe(true);
  expect(portalCodeSchema.safeParse("not-a-code").success).toBe(false);
  expect(portalEmailSchema.parse(" PERSON@example.com ")).toBe("person@example.com");
});