# Architecture rules

- Keep full investor-portal authorization and video-portal authorization as separate `user_roles` values because administrators must grant either experience independently.
- Stream investor videos only through the authenticated `investor-videos` Edge Function because Google Drive identifiers and files must never be exposed directly.
- Route native video requests through the scoped service worker so browser range requests stay authenticated without exposing session tokens in media URLs.
- Derive admin status lights and audit date ranges through pure helpers from recorded logins, invite timestamps, and current access; missing activity must never be presented as a failed password attempt.