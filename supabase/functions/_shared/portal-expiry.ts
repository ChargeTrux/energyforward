export const PORTAL_LINK_LIFETIME_DAYS = 14;
export const portalLinkExpired = (expiresAt: string, now = Date.now()) => {
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= now;
};
export const defaultPortalExpiry = (now = Date.now()) => new Date(now + PORTAL_LINK_LIFETIME_DAYS * 86400000).toISOString();