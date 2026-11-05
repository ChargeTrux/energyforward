import { z } from "zod";

export const PORTAL_SIGN_IN_URL = "https://energyforward.com/?login=1&auth=code";
export const portalEmailSchema = z.string().trim().email("Enter a valid email address.").max(255).transform((email) => email.toLowerCase());
export const portalCodeSchema = z.string().trim().regex(/^\d{6,10}$/, "Enter the verification code from your email.");
export const emailCodeOptions = {
  shouldCreateUser: false,
  emailRedirectTo: PORTAL_SIGN_IN_URL,
};