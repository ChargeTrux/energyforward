export const ACCESS_REFRESH_MS = 5000;

/** Changing Investor portal changes only that role, never material grants. */
export function investorRoleChange(userId: string, enabled: boolean) {
  return { action: "set_investor", user_id: userId, make_investor: enabled };
}

export function materialRoles(roles: string[], videoIds: string[], projectIds: string[]) {
  const next = new Set(roles);
  if (videoIds.length) next.add("video");
  if (projectIds.length) next.add("project");
  return [...next];
}

/** Stable regardless of database row order; changes for every grant change. */
export function accessRevision(groups: unknown[][]) {
  return JSON.stringify(groups.map((rows) => rows.map((row) => JSON.stringify(row)).sort()));
}