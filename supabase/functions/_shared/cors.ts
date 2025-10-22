// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Erlaube Anfragen von überall (für Entwicklung)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', // Standard Supabase Header + content-type
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Erlaube POST (für Aufruf) und OPTIONS (für Preflight)
};

