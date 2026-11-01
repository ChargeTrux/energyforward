export async function removeSelectedAccess(
  userIds: string[],
  currentUserId: string | undefined,
  revoke: (ids: string[]) => PromiseLike<{ data: number | null; error: { message: string } | null }>,
): Promise<number> {
  const ids = [...new Set(userIds)];
  if (!ids.length) throw new Error("Select at least one user.");
  if (currentUserId && ids.includes(currentUserId)) throw new Error("You cannot remove your own access. Deselect your account first.");
  const { data, error } = await revoke(ids);
  if (error) throw new Error(error.message);
  if (data !== ids.length) throw new Error("Not all selected accounts were updated. Refresh and try again.");
  return data;
}