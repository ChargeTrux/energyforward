CREATE TABLE public.investor_video_descriptions (
  file_id text PRIMARY KEY,
  description text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_video_descriptions TO authenticated;
GRANT ALL ON public.investor_video_descriptions TO service_role;

ALTER TABLE public.investor_video_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view video descriptions"
ON public.investor_video_descriptions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins add video descriptions"
ON public.investor_video_descriptions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins edit video descriptions"
ON public.investor_video_descriptions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete video descriptions"
ON public.investor_video_descriptions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER investor_video_descriptions_updated_at
BEFORE UPDATE ON public.investor_video_descriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();