# Unify share links into the Access manager

## What you'll get

**1. Share-link people appear in the Access manager**
- Everyone you created a personal link for (first name, last name, email) shows up in the Access manager list, marked as "Link access" instead of a portal status — even though they have no account.
- Password links stay item-based (they have no person attached), but each user row will show a "Has links" note when that person's email matches a personal link, so you can see existing links at a glance.

**2. Three access options per person, convertible at any time**
Each person in the Access manager gets an "Access type" control with three choices:
- **Portal access** — the current roles (Investor portal, Videos, Documents, Project 3D Demo, Customer, Full admin).
- **Link with password** — creates a password share link for a file/video/3D page you pick.
- **Personal link (no password)** — creates a personal link tied to their name and email, expiring in two weeks.

Converting works both ways:
- Portal user → either link type: pick the item (and password for password links); their portal roles stay untouched unless you also remove them.
- Link recipient → portal user: uses the existing invite flow (they get an account; the link can stay or be deleted).
- Personal link ↔ password link: the same link is updated in place (password added/removed, recipient kept or cleared) so the URL doesn't change.

**3. No emails on access changes**
- Converting or updating access never sends an email. Emails only go out when you explicitly click "Send email" / "Resend email" on a link, or "Send invite" for a portal user. (This matches the existing rule: access changes send no emails.)

**4. Invite / add-user section gets the same options**
- When adding a person, you can now choose: portal access (with the existing role checkboxes including Full admin and Customer), **or** a direct shared link (password or personal, with item picker) — instead of going to the separate Share links section.
- The existing Share links section stays as-is for managing all links in one place.

## Technical notes

- Small database change: add an optional `user_id` column to `share_links` so a link can be tied to a portal user (needed to show "has links" on user rows and to convert cleanly). No permissions change; existing links keep working.
- The `share-link` edge function gains admin actions: `convert` (personal ↔ password), and create-link-for-user. All admin actions re-check the admin role server-side, same as today.
- Access manager list merges portal users and personal-link recipients; link recipients are read-only except for link actions (no roles, no activity status — they have no account).
- View-as-user, activity map, and alert emails are untouched.

## Not included (tell me if you want these)
- Tracking opens of password links per person (password links are anonymous by design).
- Turning a link recipient into a portal user automatically without an invite email.
