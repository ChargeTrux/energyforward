CREATE TABLE public.portal_account_entries (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
 mode text NOT NULL DEFAULT 'password', enabled boolean NOT NULL DEFAULT true,
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.portal_account_entries TO authenticated;
GRANT ALL ON public.portal_account_entries TO service_role;
ALTER TABLE public.portal_account_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read portal account entries" ON public.portal_account_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins edit portal account entries" ON public.portal_account_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE FUNCTION public.validate_portal_account_entry() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
 IF NEW.mode NOT IN ('personal', 'password') THEN RAISE EXCEPTION 'Invalid credential mode'; END IF;
 NEW.updated_at = now(); RETURN NEW;
END $$;
CREATE TRIGGER validate_portal_account_entries BEFORE INSERT OR UPDATE ON public.portal_account_entries FOR EACH ROW EXECUTE FUNCTION public.validate_portal_account_entry();
CREATE FUNCTION public.cleanup_deleted_portal_account(_user_id uuid, _email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l record; remaining text[]; ids uuid[]; em text := lower(trim(_email));
BEGIN
 FOR l IN SELECT id, emails FROM public.portal_entry_links ORDER BY id FOR UPDATE LOOP
   SELECT coalesce(array_agg(e), '{}') INTO remaining FROM unnest(l.emails) e WHERE lower(trim(e)) <> em;
   IF cardinality(remaining) <> cardinality(l.emails) THEN
     IF cardinality(remaining) = 0 THEN DELETE FROM public.portal_entry_links WHERE id = l.id;
     ELSE UPDATE public.portal_entry_links SET emails = remaining, updated_at = now() WHERE id = l.id; END IF;
   END IF;
 END LOOP;
 SELECT coalesce(array_agg(id), '{}') INTO ids FROM public.share_links WHERE user_id = _user_id OR lower(trim(recipient_email)) = em;
 DELETE FROM public.activity_locations WHERE user_id = _user_id OR share_link_id = ANY(ids) OR lower(trim(who)) = em;
 DELETE FROM public.share_link_views WHERE link_id = ANY(ids);
 DELETE FROM public.share_links WHERE id = ANY(ids);
 DELETE FROM public.activity_alerts_sent WHERE user_id = _user_id;
 DELETE FROM public.activity_watchers WHERE user_id = _user_id;
 DELETE FROM public.page_views WHERE user_id = _user_id;
 DELETE FROM public.login_sessions WHERE user_id = _user_id;
 DELETE FROM public.content_views WHERE user_id = _user_id;
 DELETE FROM public.investor_video_access WHERE user_id = _user_id;
 DELETE FROM public.project_page_access WHERE user_id = _user_id;
 DELETE FROM public.investor_document_access WHERE user_id = _user_id;
 DELETE FROM public.investor_profile_access WHERE user_id = _user_id;
 DELETE FROM public.page_access WHERE user_id = _user_id;
 DELETE FROM public.user_roles WHERE user_id = _user_id;
 DELETE FROM public.portal_account_entries WHERE user_id = _user_id;
 DELETE FROM public.email_signups WHERE lower(trim(email)) = em;
 DELETE FROM public.contact_submissions WHERE lower(trim(email)) = em;
 UPDATE public.portal_entry_links SET created_by = NULL WHERE created_by = _user_id;
 UPDATE public.share_links SET created_by = NULL WHERE created_by = _user_id;
 UPDATE public.investor_video_descriptions SET updated_by = NULL WHERE updated_by = _user_id;
 UPDATE public.project_page_descriptions SET updated_by = NULL WHERE updated_by = _user_id;
 DELETE FROM public.profiles WHERE user_id = _user_id;
END $$;
REVOKE ALL ON FUNCTION public.cleanup_deleted_portal_account(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_deleted_portal_account(uuid, text) TO service_role;