CREATE TABLE public.project_page_descriptions (
  file_id text PRIMARY KEY,
  description text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_page_descriptions TO authenticated;
GRANT ALL ON public.project_page_descriptions TO service_role;
ALTER TABLE public.project_page_descriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage project descriptions" ON public.project_page_descriptions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER project_page_descriptions_updated_at BEFORE UPDATE ON public.project_page_descriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();