CREATE TABLE public.investor_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  drive_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.investor_profiles TO authenticated;
GRANT ALL ON public.investor_profiles TO service_role;
ALTER TABLE public.investor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view investor profiles"
ON public.investor_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage investor profiles"
ON public.investor_profiles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER investor_profiles_updated_at
BEFORE UPDATE ON public.investor_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.investor_profile_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.investor_profiles(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, profile_id)
);

GRANT SELECT ON public.investor_profile_access TO authenticated;
GRANT ALL ON public.investor_profile_access TO service_role;
ALTER TABLE public.investor_profile_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own investor access; admins view all"
ON public.investor_profile_access FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage investor access"
ON public.investor_profile_access FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.investor_profiles (key, name, description, sort_order) VALUES
  ('a', 'Profile A', 'Full data room access', 1),
  ('b', 'Profile B', 'Financials and diligence materials', 2),
  ('c', 'Profile C', 'Overview materials only', 3);