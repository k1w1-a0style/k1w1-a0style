
-- PERFORMANCE: Doppelte identische Indexes entfernen.
-- diagnostic_uploads: device_client_uniq ist der ältere, request_uidx der neuere — letzteren behalten.
DROP INDEX IF EXISTS public.diagnostic_uploads_device_client_uniq;

-- previews: previews_secret_ux ist der ältere, previews_secret_uidx der neuere — letzteren behalten.
DROP INDEX IF EXISTS public.previews_secret_ux;

