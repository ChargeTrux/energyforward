DROP POLICY "Anyone authenticated can view pages" ON public.pages;

DROP POLICY "Allow public email signup inserts" ON public.email_signups;
CREATE POLICY "Allow public email signup inserts" ON public.email_signups
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(name) BETWEEN 1 AND 200
    AND length(email) BETWEEN 3 AND 320
    AND position('@' IN email) > 1
  );

DROP POLICY "Anyone can submit a contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit a contact form" ON public.contact_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(full_name) BETWEEN 1 AND 200
    AND length(email) BETWEEN 3 AND 320
    AND position('@' IN email) > 1
    AND length(interest) BETWEEN 1 AND 200
  );