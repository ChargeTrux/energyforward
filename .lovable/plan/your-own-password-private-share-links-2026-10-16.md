# Your own password + private share links

## 1. Type your own password when inviting
- New checkbox in Add users (Invite one) and in each person's row in the Access manager: **Use my own password**.
- When ticked, a password box appears. The welcome email shows that password instead of a temporary one.
- They are not forced to change it on first sign-in (they can change it later with "Forgot password").
- Unticked = works exactly as today.

## 2. Private share link for one item
- Next to every Project 3D Demo page, video, and Documents file in Material config: a **Share link** button.
- You set a password (or let it make one), click **Create link**. You get a link to copy, like `energyforward.com/share/abc123`. No email is sent; you send the link and password yourself.
- The person opens the link, types the password, and sees a simple page: EnergyForward header, short "about Energy Forward" message, and that one item opening below. No menus, tabs, sections, or other links.
- No account or sign-in needed. Each link shows exactly one item.
- In a new **Share links** list you can see every link, copy it again, change its password, or turn it off instantly.
- Each opening is recorded (link, date/time) so you can see it in activity.

## 3. Activity alerts for one person
- In each person's row in the Access manager: a **Notify me** checkbox with an email box next to it.
- When ticked, that email address (and only that one) gets a short email when this person:
  - signs in (once per sign-in),
  - opens a video, a Documents file, or a Project 3D Demo page (once per item opened).
- Nobody else is emailed: not admins, not other people. People without the box ticked never trigger any email.
- Untick it to stop the alerts right away.

## 4. Safety
- Existing users, access, invites and links stay exactly as they are.
- The Drive address is never shown; the password is checked on the server on every open, and wrong passwords are slowed down.
- No emails sent while building or checking.

## Technical details
- `admin-users`: optional `custom_password` on invite/resend; sets `must_change_password=false`, email template uses it.
- Migration: `share_links (id, slug, item_type project|video|document, item_id, item_name, profile_id, password_hash, active, created_by, created_at)` admin-only RLS; `share_link_views (link_id, viewed_at)`.
- New edge function `share-link`: `unlock` (slug+password -> short-lived signed ticket), `content` (ticket -> HTML/PDF/file, video with Range support). Admin create/list/update via the same function.
- New public route `/share/:slug` with password form and single-item viewer (iframe for HTML, PDF viewer, video player).
- Migration: `activity_watchers (user_id unique, notify_email, enabled)` admin-only RLS. Database triggers on `login_sessions` and `content_views` inserts call a `notify-activity` edge function (via pg_net) only when an enabled watcher row exists for that user; the function emails only `notify_email` via Resend, with dedupe per session/item.
