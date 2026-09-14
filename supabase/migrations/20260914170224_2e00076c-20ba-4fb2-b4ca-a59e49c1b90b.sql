DROP POLICY IF EXISTS "Authenticated can view investor profiles" ON public.investor_profiles;
CREATE POLICY "Admins view investor profiles"
ON public.investor_profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));