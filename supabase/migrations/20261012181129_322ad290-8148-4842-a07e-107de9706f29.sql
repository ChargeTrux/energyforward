CREATE TABLE public.investor_document_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.investor_profiles(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  item_name text NOT NULL DEFAULT '',
  is_folder boolean NOT NULL DEFAULT false,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, profile_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_document_access TO authenticated;
GRANT ALL ON public.investor_document_access TO service_role;
ALTER TABLE public.investor_document_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage document access" ON public.investor_document_access FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own document access" ON public.investor_document_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));