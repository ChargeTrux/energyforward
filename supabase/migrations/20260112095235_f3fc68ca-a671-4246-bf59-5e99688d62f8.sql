-- Add service_type column to email_signups table
ALTER TABLE public.email_signups 
ADD COLUMN service_type text;