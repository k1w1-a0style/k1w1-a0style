import { corsHeadersForRequest, handleCors } from "../_shared/cors.ts";
import { requireScopedEdgeAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const gate = requireScopedEdgeAuth(req, {
    scope: "check-lint",
    allowAdmin: true,
    adminSecretEnv: "K1W1_EDGE_ADMIN_KEY",
  });
  if (gate) return gate;

  return new Response(
    JSON.stringify({
      ok: false,
      disabled: true,
      message: "This function is disabled on this deployment.",
    }),
    {
      status: 410,
      headers: corsHeadersForRequest(req),
    },
  );
});
