CREATE TABLE public.portal_entry_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  emails text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.portal_entry_links TO authenticated;
GRANT ALL ON public.portal_entry_links TO service_role;
ALTER TABLE public.portal_entry_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read portal entry links" ON public.portal_entry_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update portal entry links" ON public.portal_entry_links FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete portal entry links" ON public.portal_entry_links FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));