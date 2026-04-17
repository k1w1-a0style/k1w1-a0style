
-- PERFORMANCE: signing_audit_log hat dasselbe Muster — SELECT + ALL Policy für anon/authenticated.
-- "Deny write" mit cmd=ALL deckt bereits SELECT ab.
DROP POLICY IF EXISTS "Deny read signing_audit_log" ON public.signing_audit_log;

