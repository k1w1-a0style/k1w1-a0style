import { corsHeadersForRequest, handleCors } from "../_shared/cors.ts";
import { requireScopedEdgeAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const auth = requireScopedEdgeAuth(req, {
    scope: "test",
    adminSecretEnv: "K1W1_EDGE_ADMIN_KEY",
    allowAdmin: true,
    allowCiBearer: false,
  });
  if (auth) return auth;

  return new Response(
    JSON.stringify({
      ok: false,
      code: "legacy_test_route_disabled",
      error:
        "Legacy test edge route is intentionally disabled. Use scoped workflow/keystore routes instead.",
    }),
    {
      status: 410,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...corsHeadersForRequest(req),
      },
    },
  );
});
