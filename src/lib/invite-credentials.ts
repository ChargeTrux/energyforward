export type InviteCredential = "personal" | "password" | "custom";

export function hasInviteAccess(portalSelections: boolean[], materialSelections: string[][]): boolean {
  return portalSelections.some(Boolean) || materialSelections.some((ids) => ids.length > 0);
}

export function customPasswordFeedback(password: string) {
  const length = password.trim().length;
  return { length, valid: length >= 8 && length <= 72, remaining: Math.max(0, 8 - length) };
}

export function inviteCredentialOptions(credential: InviteCredential, password: string) {
  if (credential === "personal") return { no_password_change: true };
  if (credential === "custom") return { custom_password: password.trim() };
  return {};
}

export function portalCredentialMode(credential: InviteCredential): "personal" | "password" {
  return credential === "personal" ? "personal" : "password";
}