# Admin page cleanup + new "Project Run" portal

## 1. Admin page layout
- Every section (Access manager included) becomes an expand/collapse panel, plus "Expand all / Collapse all" at the top.
- Access manager: users listed in a compact list (more people per screen, active users first), scrolling with the normal page scroll instead of a small box you scroll from its corner.
- "Invite New User" and "Import Users" merged into one panel, **Add users**, with two tabs: Invite one / Import list.
- "Investor Materials" renamed **Material config**, with a third part, Project Run.
- "People & Inquiries" and "Login Activity" stay as they are, inside collapsible panels.

## 2. Project Run portal
- New access box, **Project Run**, separate from Investor / Video / Customer. Only people you tick get it.
- Admins pick individual HTML pages from the Drive folder (13tAkcF...), the same way you pick videos, in Invite, Import follow-up, and the Access manager.
- People with access see a **Project Run** tab next to Videos, on their investor portal or video page. Someone with only Video + Project Run sees both tabs.
- Clicking a page opens it in a locked viewer inside the portal. The Drive address is never shown.
- Page openings are recorded, so they show up in Login Activity and the CSV export.
- Welcome emails list Project Run when it's granted.

## 3. Safety
- No emails sent while building or checking.
- Existing access, videos and folders stay as they are.

## Technical details
- Migration: add `project` to the app_role enum; new `project_page_access (user_id, file_id)` table, same RLS as investor_video_access; allow `content_type = 'project'` in content_views.
- New edge function `project-pages`: actions catalog (admin), mine, view (checks role + grant, checks the file's parent is the Project Run folder, returns HTML served with a sandboxed CSP, no-store).
- New route `/investor/project` (page with sandboxed iframe from a blob URL); tab links in EFFrame, InvestorVideos and InvestorDocuments nav.
- admin-users: accept `project_files` in invite/set access, include in emails; App.tsx/ResetPassword routing treats project-only users like video-only users.
- AdminDashboard.tsx restructure: shared collapsible panel, tabs, compact access rows.
