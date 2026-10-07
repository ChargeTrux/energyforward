CREATE TABLE public.content_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_type text NOT NULL,
  item_id text NOT NULL,
  item_name text NOT NULL DEFAULT '',
  viewed_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer
);
GRANT SELECT, INSERT, UPDATE ON public.content_views TO authenticated;
GRANT ALL ON public.content_views TO service_role;
ALTER TABLE public.content_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users record own content views" ON public.content_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND content_type IN ('video','document'));
CREATE POLICY "Users update own content views" ON public.content_views FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view content views" ON public.content_views FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX content_views_user_idx ON public.content_views (user_id, viewed_at DESC);