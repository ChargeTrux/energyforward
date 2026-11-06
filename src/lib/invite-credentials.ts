export type InviteCredential = "personal" | "password" | "custom";

export function inviteCredentialOptions(credential: InviteCredential, password: string) {
  if (credential === "personal") return { no_password_change: true };
  if (credential === "custom") return { custom_password: password.trim() };
  return {};
}

export function portalCredentialMode(credential: InviteCredential): "personal" | "password" {
  return credential === "personal" ? "personal" : "password";
}