
CREATE OR REPLACE FUNCTION public.resolve_contact_on_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contact_submissions cs
  SET status = 'resolved', updated_at = now()
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id
    AND lower(cs.email) = lower(p.email)
    AND cs.status <> 'resolved';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_contact_on_login ON public.login_sessions;
CREATE TRIGGER trg_resolve_contact_on_login
AFTER INSERT ON public.login_sessions
FOR EACH ROW EXECUTE FUNCTION public.resolve_contact_on_login();
