CREATE OR REPLACE FUNCTION public.my_direct_links(_target uuid DEFAULT NULL)
RETURNS TABLE(slug text, item_type text, item_name text, expires_at timestamptz, no_password boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH who AS (
    SELECT CASE
      WHEN _target IS NULL OR _target = auth.uid() THEN auth.uid()
      WHEN public.has_role(auth.uid(), 'admin') THEN _target
      ELSE NULL
    END AS uid
  ), em AS (
    SELECT w.uid, lower(u.email) AS email FROM who w LEFT JOIN auth.users u ON u.id = w.uid
  )
  SELECT s.slug, s.item_type, s.item_name, s.expires_at, s.no_password
  FROM public.share_links s, em
  WHERE em.uid IS NOT NULL
    AND s.active
    AND (s.expires_at IS NULL OR s.expires_at > now())
    AND (s.user_id = em.uid OR (em.email IS NOT NULL AND lower(s.recipient_email) = em.email))
  ORDER BY s.created_at;
$$;
REVOKE ALL ON FUNCTION public.my_direct_links(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_direct_links(uuid) TO authenticated;