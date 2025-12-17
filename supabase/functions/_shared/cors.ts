// supabase/functions/_shared/cors.ts
// ✅ SEC-009: CORS Hardening

/**
 * Erlaubte Origins für CORS
 * In Produktion: Nur spezifische Domains erlauben
 * In Entwicklung: Localhost und Expo-Dev-Server erlauben
 */
const ALLOWED_ORIGINS = [
  // Produktion
  'https://k1w1.app',
  'https://www.k1w1.app',
  // Entwicklung - Expo Dev Server
  'http://localhost:8081',
  'http://localhost:19000',
  'http://localhost:19001',
  'http://localhost:19002',
  // Expo Go App (spezielle Behandlung)
  'exp://',
];

/**
 * Prüft ob eine Origin erlaubt ist
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Entwicklungsmodus: Erlaube alle localhost und Expo-Origins
  const isDev = Deno.env.get('ENVIRONMENT') !== 'production';
  if (isDev) {
    if (origin.startsWith('http://localhost:')) return true;
    if (origin.startsWith('http://192.168.')) return true; // Lokales Netzwerk für Expo
    if (origin.startsWith('exp://')) return true;
  }
  
  return ALLOWED_ORIGINS.some(allowed => {
    if (allowed.endsWith('//')) {
      // Prefix match (z.B. exp://)
      return origin.startsWith(allowed);
    }
    return origin === allowed;
  });
}

/**
 * Generiert CORS-Header basierend auf der Origin
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Max-Age': '86400', // Cache preflight für 24h
    'Content-Type': 'application/json',
    // Security Headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };
}

/**
 * Legacy: Standard CORS Headers (für Entwicklung)
 * @deprecated Verwende getCorsHeaders(origin) für produktionsreife CORS
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Behandelt CORS Preflight Requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response('ok', { headers: getCorsHeaders(origin) });
  }
  return null;
}

/**
 * Erstellt eine JSON Response mit korrekten CORS-Headern
 */
export function jsonResponse(
  data: unknown,
  req: Request,
  status: number = 200
): Response {
  const origin = req.headers.get('origin');
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: getCorsHeaders(origin),
    }
  );
}

/**
 * Erstellt eine Error Response mit korrekten CORS-Headern
 */
export function errorResponse(
  error: string,
  req: Request,
  status: number = 400,
  details?: unknown
): Response {
  return jsonResponse(
    {
      ok: false,
      error,
      ...(details && { details }),
    },
    req,
    status
  );
}
