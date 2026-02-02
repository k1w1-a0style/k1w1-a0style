// Shared auth helpers for Supabase Edge Functions (Deno)
//
// Strategy:
// - Public access may be allowed (verify_jwt can be disabled per-function).
// - Sensitive operations are protected by a single admin key header.
//
// NOTE: The app uses SIGNING_ADMIN_KEY, so we support that env name first.

export function requireAdminKey(req: Request) {
  const headerKey =
    req.headers.get("x-k1w1-admin-key") ??
    req.headers.get("x-k1w1-admin") ??
    req.headers.get("x-admin-key") ??
    req.headers.get("x-admin");

  const adminKey =
    Deno.env.get("SIGNING_ADMIN_KEY") ??
    Deno.env.get("K1W1_EDGE_ADMIN_KEY") ??
    Deno.env.get("K1W1_ADMIN_KEY");

  if (!adminKey) {
    // If no admin key is configured server-side, we hard-fail to avoid accidental public exposure.
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Server admin key not configured (SIGNING_ADMIN_KEY).",
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  if (!headerKey || headerKey !== adminKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized (admin key)." }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  return null;
}
