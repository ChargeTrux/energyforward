-- Restrict email_signups SELECT to admins only (was: any authenticated user)
DROP POLICY IF EXISTS "Allow authenticated users to view signups" ON public.email_signups;

CREATE POLICY "Admins view email signups"
ON public.email_signups
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
