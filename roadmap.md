# Roadmap

- [ ] Reorder per-person direct-link sharing above existing links and improve admin section/tab readability without changing access.

- [x] Clear the stale blocking newsletter-read finding after live policy verification and a fresh scan confirmed admin-only reads and no error-level findings; no user file, folder, or portal permissions changed.
- [x] Diagnose admin preview rejection on the live website: it still serves the old portal-only page allowlist; redeploy admin-aware preview services and request publication of the pending frontend update (3 policy tests passed).
- [x] Confirm the new admin-preview update reaches energyforward.com after deployment: live bundle index-Bm2CutXs.js includes the Admin page button and server-verified is_admin page gate; real-account checks remain blocked by external authentication.
- [x] Include the complete read-only admin page for a server-validated target admin; 3 policy tests and 5 authorization tests passed, and simulated browser checks confirmed all sections, ordinary-user denial, and no writes/emails. Real-account testing remains blocked by external authentication.
- [x] Check publication blockers and request publication of pending View as user changes for all admins (scheduled for energyforward.com; fresh scan has no critical findings, and newsletter SELECT is confirmed admin-only).
- [x] Confirm energyforward.com serves the published View as user code (live website assets checked after publishing).
- [ ] Exercise View as user with a real admin account (blocked: authenticated checks unavailable for external Supabase).
- [x] Add View as user for every admin with an isolated, read-only preview and Exit preview.
- [x] Enforce target-user material grants on the server and suppress preview activity/emails.
- [x] Run preview authorization tests (5 passed), signed-out denial and Exit preview browser checks (no activity writes; build clean).
- [ ] Verify real signed-in target portal, documents, videos, and 3D preview (blocked: authenticated checks unavailable for external Supabase).

- [x] Restrict newsletter email visibility to admins and verify access rules (SQL checks passed; rescan removed the email-read exposure).
- [x] Request publishing of the admin share-link changes (scheduled for energyforward.com; completion not yet verified).

- [x] Make password and personal share links directly visible to all admins; show loading errors rather than an empty list (both admin role checks and existing link visibility verified; build clean).
- [ ] Verify shared-link controls while signed in as the second admin (blocked: authenticated end-to-end checks unavailable for external Supabase).

- [ ] Use energyforward.com for all outgoing portal, invitation, and reset links; activate only after its domain connection is repaired (blocked: domain currently points elsewhere).

- [x] Reduce protected video startup round trips without changing quality or text or sending emails; mocked range/access tests passed, deployed preflight caching and signed-out rejection verified. Real signed-in playback remains blocked by external authentication (see below).

- [x] Collapse users by default with individual/all controls and persistent status lights; show recent recorded activity in blue without sending emails (status checks passed; build clean).

- [x] Add Today and individual-user audit filters, accurate invite events, user status lights, and visible Access manager scrolling.
- [x] Verify date/status helpers and signed-out protection without sending any emails.
- [ ] Verify the authenticated admin layout with real users (blocked: external sign-in cannot be injected into the preview).

- [x] Refine the active video title and description presentation.
- [x] Add automatic same-name text/Word descriptions with admin manual fallback editing.
- [x] Improve protected video startup and seeking performance.
- [x] Disable autoplay; when a video ends, select the next authorized video without playing it.
- [ ] Verify authenticated admin editing and playback (blocked: this external sign-in cannot be injected into the preview).
- [x] Verify signed-out protection, clean rendering, compilation, and manual-only playback configuration.
- [x] Make invitation selections the exact investor/video portal access granted to the user.
- [x] Route video-only users to the dedicated video page after sign-in and password setup.
- [x] Keep the investor portal primary when both access types are selected, with a visible video link.
- [x] Verify the investor/video routing and access boundaries.

- [x] Invite with admin-chosen password (no forced change)
- [x] Password-protected single-item share links (no sign-in)
- [x] Per-user activity email alerts to admin-chosen address (sign-in once, each material open)
- [x] Share links: optional expiration date

- [ ] Unify share links into Access manager: list personal-link recipients, three-way access type (portal / password link / personal link), convert in place, no emails on access changes, link options in the add-user section (plan approved 2026-10-31).
- [ ] Guarantee no existing access breaks: additive-only DB change (nullable share_links.user_id), no permission/policy changes, existing links keep working.
- [x] Unify share links into Access manager: personal-link recipients listed as "Link access", per-user direct-link block with convert (personal↔password, same URL), invite-to-portal for link recipients, "Share a direct link" tab in Add users, no emails on create/convert (build OK, 7 tests passed).
- [x] Keep existing access intact: additive-only DB change (nullable share_links.user_id), no policy/permission changes.
- [ ] Publish so the unified Access manager reaches energyforward.com.
- [ ] Verify link recipients and convert flow while signed in as admin (blocked: authenticated checks unavailable for external Supabase).
- [x] Remove user now also deletes their direct links (by account or recipient email); deleting a link alone stays link-only; confirm text updated.
- [x] Merged direct-link option into Add users → Invite one person (Portal access / Direct link radio, item picker, personal/password choice); removed the separate link tab.
- [x] Added "Has direct links" filter to the Access manager status filter.
