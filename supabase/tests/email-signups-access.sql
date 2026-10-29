-- Fail if newsletter reads are not restricted to admins, or public signup stops working.
SELECT 1 / CASE WHEN
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.email_signups'::regclass)
  AND (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_signups' AND cmd IN ('SELECT', 'ALL')) = 1
  AND EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_signups'
      AND cmd = 'SELECT' AND roles = ARRAY['authenticated']::name[]
      AND qual = 'has_role(auth.uid(), ''admin''::app_role)'
  )
THEN 1 ELSE 0 END AS admin_only_newsletter_reads;

SELECT 1 / CASE WHEN EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_signups'
    AND cmd = 'INSERT' AND 'anon'::name = ANY(roles) AND with_check = 'true'
) AND has_table_privilege('anon', 'public.email_signups', 'INSERT')
THEN 1 ELSE 0 END AS public_newsletter_signup_preserved;