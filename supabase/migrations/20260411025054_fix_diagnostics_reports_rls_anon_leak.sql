
-- BUG: "Public read diagnostics_reports" gewinnt über "Deny read" (OR-Semantik).
-- Fix: Public-read Policy entfernen — anon soll NICHTS lesen können.
DROP POLICY IF EXISTS "Public read diagnostics_reports" ON public.diagnostics_reports;

