# Architecture rules

- Keep full investor-portal authorization and video-portal authorization as separate `user_roles` values because administrators must grant either experience independently.
- Stream investor videos only through the authenticated `investor-videos` Edge Function because Google Drive identifiers and files must never be exposed directly.
- Route native video requests through the scoped service worker so browser range requests stay authenticated without exposing session tokens in media URLs.
- Read current video roles and individual grants concurrently for each request without caching authorization; cache only CORS preflight permission to reduce streaming round trips without delaying revocation.
- Derive admin status lights and audit date ranges through pure helpers from recorded logins, invite timestamps, and current access; missing activity must never be presented as a failed password attempt.
- Refresh admin recent-activity lights with read-only session/page-view queries; expire recent activity rather than claiming live presence from historical records.- Serve Project Run HTML pages only through the authenticated `project-pages` Edge Function into a sandboxed iframe because Drive files and folder ids must never reach browsers.
- Document profile grants: an `investor_profile_access` row with no `investor_document_access` rows means the whole folder; any item rows restrict that person to those folders/files, enforced in `investor-drive`, because admins need both whole-folder and per-file sharing.
- Documents and Project 3D Demo files may be preloaded in the browser and cached briefly in their Edge Functions, but authorization is rechecked on every request and no content is sent before checks pass, because speed must never weaken access control.
