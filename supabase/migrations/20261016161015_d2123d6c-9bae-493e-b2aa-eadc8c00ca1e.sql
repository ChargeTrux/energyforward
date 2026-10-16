CREATE TABLE public.activity_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  share_link_id uuid REFERENCES public.share_links(id) ON DELETE CASCADE,
  who text NOT NULL DEFAULT '',
  kind text NOT NULL,
  item_name text NOT NULL DEFAULT '',
  ip text,
  place text,
  isp text,
  device text,
  lat double precision,
  lon double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_locations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.activity_locations TO authenticated;
GRANT ALL ON public.activity_locations TO service_role;
CREATE POLICY "Admins view activity locations" ON public.activity_locations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX activity_locations_created_idx ON public.activity_locations (created_at DESC);