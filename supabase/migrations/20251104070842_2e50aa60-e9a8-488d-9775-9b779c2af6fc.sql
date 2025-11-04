-- Create email_signups table for newsletter signups
CREATE TABLE IF NOT EXISTS public.email_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 100),
  email text NOT NULL CHECK (length(trim(email)) > 0 AND length(email) <= 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_signups_email_unique UNIQUE (email)
);

-- Enable Row Level Security
ALTER TABLE public.email_signups ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert their email signup (public feature)
CREATE POLICY "Allow public email signup inserts"
ON public.email_signups
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only authenticated users can view signups (for admin purposes)
CREATE POLICY "Allow authenticated users to view signups"
ON public.email_signups
FOR SELECT
TO authenticated
USING (true);

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_email_signups_email ON public.email_signups(email);

-- Add index for created_at for sorting
CREATE INDEX IF NOT EXISTS idx_email_signups_created_at ON public.email_signups(created_at DESC);