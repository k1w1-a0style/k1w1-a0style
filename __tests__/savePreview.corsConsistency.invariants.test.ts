import { getCorsHeaders } from "../supabase/functions/_shared/cors";
import { corsHeaders as savePreviewCorsHeaders } from "../supabase/functions/save_preview/helpers";

describe("save_preview CORS/security header consistency", () => {
  it("uses the shared CORS/security header shape for explicit origins", () => {
    const origin = "http://localhost:19000";

    const shared = getCorsHeaders(origin);
    const local = savePreviewCorsHeaders(origin);

    expect(local).toEqual(shared);
  });

  it("uses the shared fallback behavior for missing origin", () => {
    const shared = getCorsHeaders(null);
    const local = savePreviewCorsHeaders(null);

    expect(local).toEqual(shared);
    expect(local["Access-Control-Allow-Origin"]).toBeTruthy();
  });

  it("keeps core security headers in save_preview responses", () => {
    const headers = savePreviewCorsHeaders("http://localhost:8081");

    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
  });
});
