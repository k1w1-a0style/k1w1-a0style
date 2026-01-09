// supabase/functions/_shared/auth.ts
// ✅ SEC-020: Edge Function Auth + Rate Limit (pragmatisch)
//
// Ziel:
// - Edge Functions NICHT öffentlich offen lassen (Build/Workflow trigger kostet Geld)
// - Trotzdem kompatibel mit Mobile App ohne Supabase Auth Login
//
// Mechanik:
// - Optionaler Shared-Secret Header: `x-k1w1-admin-key`
// - Wird nur erzwungen, wenn `K1W1_EDGE_ADMIN_KEY` (oder `K1W1_ADMIN_KEY`) als Secret gesetzt ist.
//   => Safe rollout: erst Secret setzen, dann Client-Header ausrollen.
//
// Bonus:
// - sehr simples In-Memory Rate Limiting pro IP + Funktion (Best-Effort; kann bei Cold Starts resetten)

import { corsHeaders } from "./cors.ts";

const HEADER_NAME = "x-k1w1-admin-key";

function getExpectedKey(): string | null {
  return (
    Deno.env.get("K1W1_EDGE_ADMIN_KEY") ??
    Deno.env.get("K1W1_ADMIN_KEY") ??
    null
  );
}

function getProvidedKey(req: Request): string | null {
  const v = req.headers.get(HEADER_NAME);
  return v && v.trim().length > 0 ? v.trim() : null;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Returns Response when unauthorized; otherwise null
 */
export function requireAdminKey(req: Request): Response | null {
  const expected = getExpectedKey();
  if (!expected) return null; // rollout-mode: Secret not set => do not enforce

  const provided = getProvidedKey(req);
  if (!provided || provided !== expected) {
    return json(401, {
      ok: false,
      error: "Unauthorized",
      hint: `Missing or invalid header: ${HEADER_NAME}`,
    });
  }

  return null;
}

// ----------------------
// Best-effort rate limit
// ----------------------
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function getClientIp(req: Request): string {
  // Supabase puts client IP into x-forwarded-for (may contain multiple)
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

/**
 * Best-effort rate limiter. Returns Response when limited; otherwise null.
 */
export function rateLimit(
  req: Request,
  namespace: string,
  limit: number = 60,
  windowMs: number = 60_000,
): Response | null {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${namespace}:${ip}`;

  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  cur.count += 1;
  buckets.set(key, cur);

  if (cur.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((cur.resetAt - now) / 1000));
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Rate limited",
        retryAfterSeconds: retryAfter,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  return null;
}
