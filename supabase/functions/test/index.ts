import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireAdminKey, rateLimit } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const gate = await requireAdminKey(req);
  if (gate) return gate;

  const rl = rateLimit(req, "test", 30, 60_000);
  if (rl) return rl;

  return jsonResponse({ ok: true }, req);
});
