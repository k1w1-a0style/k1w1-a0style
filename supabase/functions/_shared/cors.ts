// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Erlaube Anfragen von überall (für Entwicklung)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', // Standard Supabase Header + content-type
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS', // Erlaube GET, POST, PATCH (für Aufruf) und OPTIONS (für Preflight)
  'Content-Type': 'application/json',
};

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

