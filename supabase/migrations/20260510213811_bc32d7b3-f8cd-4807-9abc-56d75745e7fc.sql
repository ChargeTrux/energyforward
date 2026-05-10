-- Pages catalog and per-user access
CREATE TABLE public.pages (
  slug text PRIMARY KEY,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view pages"
ON public.pages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage pages"
ON public.pages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.pages (slug, title) VALUES
  ('investor', 'Investor'),
  ('partners', 'Partners'),
  ('documents', 'Documents');

CREATE TABLE public.page_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_slug text NOT NULL REFERENCES public.pages(slug) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_slug)
);

ALTER TABLE public.page_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own access; admins view all"
ON public.page_access FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage access"
ON public.page_access FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_page_access_user ON public.page_access(user_id);

-- Default-grant trigger: when a new profile is created, give access to all pages
CREATE OR REPLACE FUNCTION public.grant_default_page_access()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.page_access (user_id, page_slug)
  SELECT NEW.user_id, slug FROM public.pages
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER profiles_grant_default_access
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_default_page_access();

-- Backfill existing users with access to all pages
INSERT INTO public.page_access (user_id, page_slug)
SELECT p.user_id, pg.slug FROM public.profiles p CROSS JOIN public.pages pg
ON CONFLICT DO NOTHING;