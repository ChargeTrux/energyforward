## 1. Favicon — match the new EnergyForward brand

The EF stealth site uses a wordmark: `energyforward` in Cabinet Grotesk with an **amber dot** (`.`). There's no graphic logo, so the favicon will be generated to match:

- A 512×512 PNG with a dark navy background (`#0b1220`) and an **amber dot** (`#f5a524`) centered, with a soft glow — mirroring the `.amber-dot` brand element used in the nav.
- Replace `public/favicon.png` and delete `public/favicon.ico` so browsers stop falling back to the old one.
- Update `<title>` in `index.html` to `EnergyForward` and add `<meta name="theme-color" content="#0b1220">`.

## 2. Admin dashboard — restyle to EF stealth aesthetic

Currently `/admin` uses the generic shadcn light/blue theme. The new design will match the landing page:

- **Palette**: navy `#0b1220` base, pearl `#f4f1ea` text, teal `#5fb4a2` for primary actions, amber `#f5a524` for highlights/pulses, muted slate for borders.
- **Type**: Cabinet Grotesk for headings, General Sans for body, JetBrains Mono for emails/IDs. Use the same Fontshare CDN already wired into `index.html`.
- Scoped to `/admin` only — won't touch global tokens or the `/p/investor` GatedPage theme. Implemented via a wrapper class (`.ef-admin`) with local CSS variables so the rest of the app stays unchanged.
- Header: `energyforward` wordmark + amber dot, "OPERATING IN STEALTH" pulse badge, "Sign out" link — same visual language as the landing nav.
- Cards become flat, bordered panels with subtle teal accents; tables get the dark treatment with mono email columns.

## 3. Per-user portal access management

Today the admin dashboard exposes two roles: **Admin** and **Investor**. The user now wants to grant **Customer** portal access independently (one, the other, or both).

**Schema change** (migration):
- Add `'customer'` to the `app_role` enum.
- Add a `sync_customer_page_access` trigger mirroring the existing `sync_investor_page_access` trigger — so granting the `customer` role auto-grants `page_access('customer')`.
- Insert a `pages` row for slug `customer` if missing.

**Edge function** (`admin-users`):
- Add a `set_customer` action symmetrical to `set_investor`.

**Admin UI**:
- Replace the single Role dropdown in the Invite form with **two checkboxes**: ☐ Customer portal · ☐ Investor portal (Admin stays a separate confirm-gated action).
- On invite, assign both roles as selected; the welcome email lists which portals were granted.
- In the user table, the Role column shows badges for each granted portal (Admin / Investor / Customer). The row dropdown gets "Grant/Revoke Customer Access" and "Grant/Revoke Investor Access" as independent toggles.

**Enforcement** — kept minimal and consistent with the current pattern:
- `/p/investor` (GatedPage) already checks `page_access`. A new `/p/customer` route will gate the customer portal the same way.
- The static `/customer` and `/investor` iframe portals keep their shared-password gate for now (they're the public stealth entry points). The **per-user** experience runs through `/p/customer` and `/p/investor` after sign-in — same as today's investor flow.

## 4. Email rebrand

`supabase/functions/_shared/branded-emails.ts` currently uses the old navy/blue investor palette. Update to:

- Background `#0b1220`, surface `#111a2e`, pearl text `#f4f1ea`, teal CTA `#5fb4a2`, amber accent `#f5a524`.
- Header switches from "INVESTOR PORTAL" tag to "ENERGYFORWARD" wordmark + amber dot (rendered as HTML, no image needed).
- Welcome email lists which portals (Customer / Investor) the user can now access.
- Reset and access-request templates get the same shell.
- `EF_FROM` / `EF_REPLY_TO` already point at `energyforward.com` — kept.

## 5. Out of scope (explicit)

- Not changing the public stealth landing or the static `/customer` / `/investor` iframes' visual design.
- Not removing the shared-password gate on the static portals.
- Not migrating existing investors — they keep their current access.

## Technical details

**Files touched**
- `public/favicon.png` (regenerated), `public/favicon.ico` (deleted), `index.html` (title + theme-color)
- `src/pages/AdminDashboard.tsx` (theme wrapper, checkboxes, customer toggles)
- `src/pages/AdminDashboard.css` (new — scoped EF tokens)
- `src/App.tsx` (add `/p/customer` route)
- `src/pages/GatedPage.tsx` (verify slug-agnostic; likely no change)
- `supabase/functions/admin-users/index.ts` (`set_customer` action; pass `roles[]` to invite)
- `supabase/functions/_shared/branded-emails.ts` (full restyle + portal-list block)
- New migration: enum value, `pages` row, trigger, grants.

**Migration sketch**
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';
INSERT INTO public.pages(slug, title) VALUES ('customer','Customer Portal') ON CONFLICT DO NOTHING;
-- trigger mirroring sync_investor_page_access for 'customer'
```

**Risk notes**
- Adding an enum value runs outside a transaction in Postgres — the migration uses `ADD VALUE IF NOT EXISTS` so it's idempotent.
- The trigger uses `SECURITY DEFINER` matching the existing pattern.
- No existing user data is modified; only new grants take effect.
