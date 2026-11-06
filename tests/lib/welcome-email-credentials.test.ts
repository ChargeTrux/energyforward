import { expect, test } from "bun:test";
import { welcomeEmail } from "../../supabase/functions/_shared/branded-emails";

const credentials = {
  name: "Test Investor",
  email: "test@example.com",
  tempPassword: "Secret-test-234",
  loginUrl: "https://energyforward.com/enter/test-personal-link",
};

test("customized-level invitations never expose a generated password and every sign-in link uses personal entry", () => {
  const { html } = welcomeEmail({ ...credentials, emailOnly: true });
  expect(html.includes(credentials.tempPassword)).toBe(false);
  expect(html.includes(credentials.email)).toBe(true);
  const signInLinks = [...html.matchAll(/href="([^"]+)"[^>]*>(?:Sign in|Sign in to EnergyForward)<\/a>/g)].map((match) => match[1]);
  expect(signInLinks).toEqual([credentials.loginUrl, credentials.loginUrl]);
});

test("password credential invitations still include their generated password", () => {
  expect(welcomeEmail(credentials).html.includes(credentials.tempPassword)).toBe(true);
});

test("custom-password invitations still include the admin's chosen password", () => {
  expect(welcomeEmail({ ...credentials, permanentPassword: true }).html.includes(credentials.tempPassword)).toBe(true);
});