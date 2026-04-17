
-- PERFORMANCE: edge_rate_limit_events hat zwei permissive Policies für SELECT (anon+authenticated).
-- "Deny read" und "Deny write" feuern beide bei SELECT → unnötig doppelt.
-- Fix: SELECT-Deny in die ALL-Policy integrieren, separate SELECT-Policy entfernen.
DROP POLICY IF EXISTS "Deny read edge_rate_limit_events" ON public.edge_rate_limit_events;
-- "Deny write" mit cmd=ALL deckt bereits SELECT ab → eine Policy reicht.

