# Resend SMTP Setup for Supabase Auth Emails

This guide routes all Supabase Auth emails (password reset, magic link, invite, signup confirmation, email change, reauthentication) through **Resend** so they originate from `noreply@energyforward.com`.

> **Project ref:** `scyqmmakqmnzpnhrrnlx`
> **Sender domain:** `energyforward.com` (already verified in Resend)

---

## ⚠️ READ FIRST — Critical Conflict With the Existing Auth Email Hook

Your project currently has a **Send Email Hook** deployed (`supabase/functions/auth-email-hook/index.ts`) that intercepts every auth email, renders the branded React Email template, and **enqueues it to Lovable's managed email pipeline** (pgmq → `process-email-queue` → Lovable Email API).

**When a Send Email Hook is enabled in Supabase Auth, Supabase NEVER calls SMTP.** It hands the email off to your hook and considers its job done. That means:

- If you configure Resend SMTP **and** leave the hook enabled → emails will keep going through Lovable's pipeline, **not** Resend. Your SMTP settings will be ignored.
- If you want emails to go through Resend SMTP → you must **disable the Send Email Hook** in Supabase Auth (Authentication → Hooks → "Send Email hook" → toggle OFF). Supabase will then fall back to its built-in template renderer + your configured SMTP (Resend).

You have two viable paths. Pick one:

| Path | What sends the email | Branded HTML templates | Action required |
|---|---|---|---|
| **A — Resend SMTP (what you asked for)** | Resend, via Supabase native SMTP | Edited in **Supabase Dashboard → Auth → Email Templates** (HTML editor) | Disable the Send Email Hook; complete sections 1–2 below |
| **B — Keep the Lovable hook** | Lovable Email pipeline | Your existing `_shared/email-templates/*.tsx` files | Do nothing; Resend SMTP is not needed |

The rest of this doc assumes **Path A**.

---

## 1. Supabase SMTP Settings (manual — dashboard only)

Open: <https://supabase.com/dashboard/project/scyqmmakqmnzpnhrrnlx/auth/providers>

Scroll to **SMTP Settings** and paste exactly:

- [ ] **Enable Custom SMTP:** ON
- [ ] **Sender email:** `noreply@energyforward.com`
- [ ] **Sender name:** `Energy Forward`
- [ ] **Host:** `smtp.resend.com`
- [ ] **Port number:** `465`
- [ ] **Username:** `resend`
- [ ] **Password:** *paste your Resend API key (starts with `re_…`) — do NOT commit it*
- [ ] **Minimum interval between emails:** `60` seconds

Then go to **Authentication → Hooks** and:

- [ ] **Send Email hook:** OFF (see the conflict warning above)

Click **Save** on each panel.

---

## 2. URL Configuration

Open: <https://supabase.com/dashboard/project/scyqmmakqmnzpnhrrnlx/auth/url-configuration>

- [ ] **Site URL:** `https://moving-energyforward.com`
- [ ] **Additional Redirect URLs** (add each, one per line):
  - `https://moving-energyforward.com/**`
  - `https://moving-energyforward.com/auth/callback`
  - `https://energyforward-launchpad.lovable.app/**`
  - `https://id-preview--57e925ca-12fa-45f9-90f4-f64d9d7a2832.lovable.app/**`

> ❓ Confirm `moving-energyforward.com` is the live production domain. If it's different, swap it in everywhere above before saving.

Click **Save**.

---

## 3. Auth Email Hook — Status & Env Vars

**File inspected:** `supabase/functions/auth-email-hook/index.ts`

- The hook does **NOT** contain any SMTP-sending logic. It does not import `nodemailer`, `smtp`, `Resend`, or any mail SDK directly.
- Env vars it currently reads:
  - `LOVABLE_API_KEY` — used to verify the inbound webhook signature from Supabase Auth.
  - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — used to enqueue rendered emails into the `auth_emails` pgmq queue and write to `email_send_log`.
- There are **no** `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, or `RESEND_API_KEY` references in the hook. Nothing to remove.
- Templates under `supabase/functions/_shared/email-templates/*.tsx` render branded HTML.

**What this means for Path A (Resend SMTP):**
- Once you disable the Send Email Hook in the dashboard, Supabase stops calling this function for auth events. The function code is harmless and can stay deployed (it does nothing unless Supabase invokes it).
- The **branded React Email templates will no longer be used** for auth emails — Supabase will render its built-in templates instead. To keep your branding, copy the HTML you want into Supabase's template editor at: <https://supabase.com/dashboard/project/scyqmmakqmnzpnhrrnlx/auth/templates>
- No code changes required. No files were modified.

---

## 4. Test the Setup

Once SMTP is saved and the hook is disabled, trigger a password recovery email via the public Auth REST endpoint. Replace `TEST_EMAIL` with a real address you can check.

```bash
curl -i -X POST 'https://scyqmmakqmnzpnhrrnlx.supabase.co/auth/v1/recover' \
  -H 'Content-Type: application/json' \
  -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjeXFtbWFrcW1uenBuaHJybmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5OTY2NTMsImV4cCI6MjA3NDU3MjY1M30.pzSqpFJNrJVAn9wx-zSdTN7wibphuN24R2tIQMi85SA' \
  -d '{"email":"TEST_EMAIL@example.com"}'
```

Expected: HTTP `200 {}` and an email arriving from `Energy Forward <noreply@energyforward.com>` within ~30s.

**Where to look if it doesn't arrive:**
- Supabase Auth logs: <https://supabase.com/dashboard/project/scyqmmakqmnzpnhrrnlx/logs/auth-logs>
- Resend activity log: <https://resend.com/emails>
- Recipient spam folder

---

## 5. Troubleshooting — Common SMTP Errors

| Code | Meaning | Fix |
|---|---|---|
| `535 5.7.8` | Authentication failed | Username must be the literal string `resend`. Password must be your full Resend API key including the `re_` prefix. Re-paste — no surrounding quotes, no whitespace. |
| `535 5.7.139` | SMTP AUTH disabled (Office 365 leftover) | Not applicable to Resend. If you see this, you're still pointing at `smtp.office365.com` — change Host to `smtp.resend.com`. |
| `553 5.7.60` / `5.7.60` | Sender address not allowed | The "Sender email" in Supabase must be at a Resend-verified domain. Confirm `energyforward.com` shows **Verified** at <https://resend.com/domains> and the sender is `noreply@energyforward.com`. |
| `550 5.7.1` | Recipient rejected / blocked | Check Resend's suppression list for the recipient. Remove and resend. |
| `550 5.1.1` | Recipient mailbox does not exist | Wrong test address — try a real inbox. |
| `554 5.7.1` | Message rejected for policy reasons | Usually missing/failing SPF or DKIM. Re-check DNS records in Resend dashboard; all three (SPF, DKIM, DMARC) must be green. |
| `421 4.7.0` | Rate limited | Increase "Minimum interval between emails" or upgrade Resend plan. Default Resend free tier = 2 req/s, 100/day. |
| Email never arrives, no error | Send Email Hook still enabled | Supabase bypassed SMTP and called your hook instead. Disable the hook (see Section 1). |
| `Connection refused` / timeout on port 465 | Wrong port or TLS mode | Use port `465` (implicit TLS) with Resend. Port `587` (STARTTLS) also works — pick one and match Supabase's TLS toggle. |

---

## Quick Links

- SMTP & Hooks: <https://supabase.com/dashboard/project/scyqmmakqmnzpnhrrnlx/auth/providers>
- URL Configuration: <https://supabase.com/dashboard/project/scyqmmakqmnzpnhrrnlx/auth/url-configuration>
- Email Templates (built-in): <https://supabase.com/dashboard/project/scyqmmakqmnzpnhrrnlx/auth/templates>
- Auth Logs: <https://supabase.com/dashboard/project/scyqmmakqmnzpnhrrnlx/logs/auth-logs>
- Resend Domains: <https://resend.com/domains>
- Resend Activity: <https://resend.com/emails>
