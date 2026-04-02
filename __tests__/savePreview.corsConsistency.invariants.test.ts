import { getCorsHeaders } from "../supabase/functions/_shared/cors";
import { corsHeaders as savePreviewCorsHeaders } from "../supabase/functions/save_preview/helpers";

function withEnv<T>(patch: Record<string, string | undefined>, run: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return run();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("save_preview CORS/security header consistency", () => {
  it("uses the shared CORS/security header shape for explicit origins", () => {
    const origin = "http://localhost:19000";

    const shared = withEnv({ ENVIRONMENT: "development" }, () => getCorsHeaders(origin));
    const local = withEnv({ ENVIRONMENT: "development" }, () => savePreviewCorsHeaders(origin));

    expect(local).toEqual(shared);
  });

  it("uses the shared fallback behavior for missing origin", () => {
    const shared = getCorsHeaders(null);
    const local = savePreviewCorsHeaders(null);

    expect(local).toEqual(shared);
    expect(local["Access-Control-Allow-Origin"]).toBeTruthy();
  });

  it("keeps core security headers in save_preview responses", () => {
    const headers = withEnv({ ENVIRONMENT: "development" }, () => savePreviewCorsHeaders("http://localhost:8081"));

    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
  });
});
