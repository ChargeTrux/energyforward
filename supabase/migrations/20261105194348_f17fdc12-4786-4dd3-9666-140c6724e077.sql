CREATE OR REPLACE FUNCTION public.remove_selected_user_access(_user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed integer;
  link_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF coalesce(cardinality(_user_ids), 0) = 0 OR array_position(_user_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Select at least one user';
  END IF;
  IF auth.uid() = ANY(_user_ids) THEN
    RAISE EXCEPTION 'You cannot remove your own access. Deselect your account first.';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(_user_ids) AS selected(uid) WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = selected.uid)) THEN
    RAISE EXCEPTION 'A selected account no longer exists. Refresh the user list.';
  END IF;
  SELECT coalesce(array_agg(l.id), '{}') INTO link_ids FROM public.share_links l
    WHERE l.user_id = ANY(_user_ids)
       OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = ANY(_user_ids) AND lower(trim(p.email)) = lower(trim(l.recipient_email)));
  UPDATE public.activity_locations SET share_link_id = NULL WHERE share_link_id = ANY(link_ids);
  DELETE FROM public.share_link_views WHERE link_id = ANY(link_ids);
  DELETE FROM public.share_links WHERE id = ANY(link_ids);
  DELETE FROM public.user_roles WHERE user_id = ANY(_user_ids) AND role IN ('admin', 'investor', 'customer', 'video', 'project');
  DELETE FROM public.investor_document_access WHERE user_id = ANY(_user_ids);
  DELETE FROM public.investor_profile_access WHERE user_id = ANY(_user_ids);
  DELETE FROM public.investor_video_access WHERE user_id = ANY(_user_ids);
  DELETE FROM public.project_page_access WHERE user_id = ANY(_user_ids);
  DELETE FROM public.page_access WHERE user_id = ANY(_user_ids);
  SELECT count(DISTINCT uid) INTO changed FROM unnest(_user_ids) AS selected(uid);
  RETURN changed;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_selected_user_access(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_selected_user_access(uuid[]) TO authenticated;