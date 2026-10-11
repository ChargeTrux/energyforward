ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project';

CREATE TABLE public.project_page_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_id text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, file_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_page_access TO authenticated;
GRANT ALL ON public.project_page_access TO service_role;
ALTER TABLE public.project_page_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage project access" ON public.project_page_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own project access" ON public.project_page_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users record own content views" ON public.content_views;
CREATE POLICY "Users record own content views" ON public.content_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND content_type = ANY (ARRAY['video','document','project']));