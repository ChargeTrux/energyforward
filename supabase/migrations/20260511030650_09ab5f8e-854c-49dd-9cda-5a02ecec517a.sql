
-- Add 'investor' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'investor';

-- Trigger: when a role is assigned/removed, sync investor page access
CREATE OR REPLACE FUNCTION public.sync_investor_page_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.role = 'investor' THEN
      INSERT INTO public.page_access (user_id, page_slug)
      VALUES (NEW.user_id, 'investor')
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.role = 'investor' THEN
      DELETE FROM public.page_access
      WHERE user_id = OLD.user_id AND page_slug = 'investor';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_investor_access_ins ON public.user_roles;
CREATE TRIGGER trg_sync_investor_access_ins
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_investor_page_access();

DROP TRIGGER IF EXISTS trg_sync_investor_access_del ON public.user_roles;
CREATE TRIGGER trg_sync_investor_access_del
AFTER DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_investor_page_access();
