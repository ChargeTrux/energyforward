export type ActivityPreset = "today" | "all" | "7" | "10" | "custom";

export function activityInRange(timestamp: string | null | undefined, preset: ActivityPreset, from: string, to: string, now = new Date()): boolean {
  if (preset === "all") return true;
  if (!timestamp) return false;
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = preset === "today" ? startOfToday.getTime()
    : preset === "7" || preset === "10" ? now.getTime() - Number(preset) * 86400000
    : from ? new Date(`${from}T00:00:00`).getTime() : null;
  const end = preset === "today" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
    : preset === "custom" && to ? new Date(`${to}T00:00:00`).getTime() + 86400000 : null;
  return (start === null || time >= start) && (end === null || time < end);
}

export function userAccessStatus(user: { is_active: boolean; invite_sent_at?: string | null; is_admin?: boolean; is_investor?: boolean; is_video?: boolean; is_customer?: boolean }, lastLogin?: string) {
  const hasPortal = user.is_admin || user.is_investor || user.is_video || user.is_customer;
  if (!user.is_active) return { tone: "issue", label: "Sign-in blocked — suspended" };
  if (user.invite_sent_at && !hasPortal) return { tone: "issue", label: "Access needed — no portal selected" };
  if (lastLogin && (!user.invite_sent_at || new Date(lastLogin).getTime() >= new Date(user.invite_sent_at).getTime())) {
    return { tone: "success", label: "Signed in successfully" };
  }
  if (user.invite_sent_at) return { tone: "pending", label: "Invite sent — awaiting sign-in" };
  return { tone: "neutral", label: "Not invited yet" };
}