export const normalizeAccountEmail = (email: string) => email.trim().toLowerCase();

// Auth accounts may predate profiles; scan every auth page before creating.
export async function findExistingAccount(admin: {
  auth: { admin: { listUsers: (params: { page: number; perPage: number }) => Promise<{ data: { users: Array<{ id: string; email?: string }> }; error?: { message: string } | null }> } };
}, email: string): Promise<string | undefined> {
  const normalized = normalizeAccountEmail(email);
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not check existing accounts: ${error.message}`);
    const found = data.users.find((user) => normalizeAccountEmail(user.email ?? "") === normalized);
    if (found) return found.id;
    if (data.users.length < 1000) return undefined;
  }
}