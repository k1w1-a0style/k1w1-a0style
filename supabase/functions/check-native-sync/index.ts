import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireAdminKey } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const gate = await requireAdminKey(req);
  if (gate) return gate;

  return jsonResponse(
    {
      ok: false,
      disabled: true,
      message: "This function is disabled on this deployment.",
    },
    req,
    410,
  );
});
