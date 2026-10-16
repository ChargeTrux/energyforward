ALTER TABLE public.share_links ADD COLUMN expires_at timestamptz;
CREATE POLICY "Admins view sent alerts" ON public.activity_alerts_sent FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.activity_alerts_sent TO authenticated;