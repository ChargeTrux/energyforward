-- Add customer role and page access syncing
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';

INSERT INTO public.pages(slug, title) VALUES ('customer','Customer Portal') ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_customer_page_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.role = 'customer' THEN
      INSERT INTO public.page_access (user_id, page_slug)
      VALUES (NEW.user_id, 'customer')
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.role = 'customer' THEN
      DELETE FROM public.page_access
      WHERE user_id = OLD.user_id AND page_slug = 'customer';
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_customer_page_access_trg ON public.user_roles;
CREATE TRIGGER sync_customer_page_access_trg
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_page_access();