// supabase/functions/create_codesandbox/helpers.ts
// Minimal helper surface for the disabled legacy stub.

import { getCorsHeaders } from "../_shared/cors.ts";

export function cors(origin: string | null) {
  return getCorsHeaders(origin);
}

export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });
}
