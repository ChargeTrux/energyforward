CREATE TABLE public.share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  item_type text NOT NULL,
  item_id text NOT NULL,
  item_name text NOT NULL DEFAULT '',
  profile_id uuid,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.share_links TO authenticated;
GRANT ALL ON public.share_links TO service_role;
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view share links" ON public.share_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update share links" ON public.share_links FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete share links" ON public.share_links FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER share_links_updated_at BEFORE UPDATE ON public.share_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.share_link_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.share_links(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.share_link_views TO authenticated;
GRANT ALL ON public.share_link_views TO service_role;
ALTER TABLE public.share_link_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view share link opens" ON public.share_link_views FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.activity_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  notify_email text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_watchers TO authenticated;
GRANT ALL ON public.activity_watchers TO service_role;
ALTER TABLE public.activity_watchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage activity alerts" ON public.activity_watchers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER activity_watchers_updated_at BEFORE UPDATE ON public.activity_watchers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.activity_alerts_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dedupe_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
GRANT ALL ON public.activity_alerts_sent TO service_role;
ALTER TABLE public.activity_alerts_sent ENABLE ROW LEVEL SECURITY;