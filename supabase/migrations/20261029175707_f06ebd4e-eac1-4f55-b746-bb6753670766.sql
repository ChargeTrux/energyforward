ALTER TABLE public.share_links
  ADD COLUMN IF NOT EXISTS no_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recipient_first_name text,
  ADD COLUMN IF NOT EXISTS recipient_last_name text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;