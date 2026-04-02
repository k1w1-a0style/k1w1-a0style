// supabase/functions/create_codesandbox/index.ts
// Legacy sunset stub: route is no longer part of the active product/runtime surface.

import { cors, json } from "./helpers.ts";

Deno.serve((req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors(origin) });
  }

  return json(
    { ok: false, error: "legacy_create_codesandbox_disabled" },
    { status: 410, headers: cors(origin) },
  );
});
