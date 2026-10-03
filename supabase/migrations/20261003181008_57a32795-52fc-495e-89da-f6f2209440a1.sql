CREATE TABLE public.investor_video_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  file_id text not null,
  granted_at timestamptz not null default now(),
  unique (user_id, file_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_video_access TO authenticated;
GRANT ALL ON public.investor_video_access TO service_role;
ALTER TABLE public.investor_video_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage video access" ON public.investor_video_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users view own video access" ON public.investor_video_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));