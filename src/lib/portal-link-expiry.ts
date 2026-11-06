export const portalLinkExpired = (expiresAt: string, now = Date.now()) => {
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= now;
};

export function portalLinkStatus(expiresAt: string, enabled: boolean, now = Date.now()) {
  if (!enabled) return { label: "Link turned off", warning: true };
  if (portalLinkExpired(expiresAt, now)) return { label: "Link expired", warning: true };
  const days = Math.ceil((Date.parse(expiresAt) - now) / 86400000);
  return { label: `Link expires in ${days} ${days === 1 ? "day" : "days"}`, warning: days <= 2 };
}

export const localDateTime = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};