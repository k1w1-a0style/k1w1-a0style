import {
  requireScopedEdgeAuth,
  rateLimit,
} from "../supabase/functions/_shared/auth";
import { corsHeaders as savePreviewCorsHeaders } from "../supabase/functions/save_preview/helpers";

const ORIGIN = "http://localhost:19000";

function withEnv<T>(patch: Record<string, string | undefined>, run: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  try {
    return run();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }
}

describe("save_preview auth/error header consistency + auth runtime env fallback", () => {
  it("returns auth failure headers compatible with save_preview success/local-error headers", async () => {
    const req = new Request("http://localhost/save-preview", {
      method: "POST",
      headers: { origin: ORIGIN },
    });

    const authRes = withEnv(
      {
        K1W1_EDGE_ADMIN_KEY: undefined,
        SIGNING_ADMIN_KEY: undefined,
      },
      () =>
        requireScopedEdgeAuth(req, {
          scope: "save_preview",
          allowAdmin: true,
          allowCiBearer: false,
          adminSecretEnv: "K1W1_EDGE_ADMIN_KEY",
        }),
    );

    expect(authRes).toBeTruthy();
    const savePreviewHeaders = savePreviewCorsHeaders(ORIGIN);
    expect(authRes?.headers.get("access-control-allow-origin")).toBe(
      savePreviewHeaders["Access-Control-Allow-Origin"],
    );
    expect(authRes?.headers.get("x-content-type-options")).toBe(
      savePreviewHeaders["X-Content-Type-Options"],
    );
  });

  it("returns rate-limit failure headers compatible with save_preview headers", () => {
    const req = new Request("http://localhost/save-preview", {
      method: "POST",
      headers: { origin: ORIGIN, "x-forwarded-for": "1.2.3.4" },
    });

    const bucket = `save_preview_invariant_${Date.now()}`;
    expect(rateLimit(req, bucket, 1, 10_000)).toBeNull();
    const res = rateLimit(req, bucket, 1, 10_000);
    expect(res).toBeTruthy();

    const savePreviewHeaders = savePreviewCorsHeaders(ORIGIN);
    expect(res?.headers.get("access-control-allow-origin")).toBe(
      savePreviewHeaders["Access-Control-Allow-Origin"],
    );
    expect(res?.headers.get("x-frame-options")).toBe(
      savePreviewHeaders["X-Frame-Options"],
    );
  });

  it("auth guard reads Node process env even when Deno is not present", () => {
    const oldDeno = (globalThis as any).Deno;
    delete (globalThis as any).Deno;

    try {
      const req = new Request("http://localhost/save-preview", {
        method: "POST",
        headers: {
          origin: ORIGIN,
          "x-k1w1-admin-key": "node-env-secret",
        },
      });

      const result = withEnv(
        {
          K1W1_EDGE_ADMIN_KEY: "node-env-secret",
          SIGNING_ADMIN_KEY: undefined,
        },
        () =>
          requireScopedEdgeAuth(req, {
            scope: "save_preview",
            allowAdmin: true,
            allowCiBearer: false,
            adminSecretEnv: "K1W1_EDGE_ADMIN_KEY",
          }),
      );

      expect(result).toBeNull();
    } finally {
      (globalThis as any).Deno = oldDeno;
    }
  });
});
  it("does not accept SIGNING_ADMIN_KEY as fallback for generic save_preview auth", () => {
    const req = new Request("http://localhost/save-preview", {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "x-k1w1-admin-key": "signing-only-secret",
      },
    });

    const result = withEnv(
      {
        K1W1_EDGE_ADMIN_KEY: undefined,
        SIGNING_ADMIN_KEY: "signing-only-secret",
      },
      () =>
        requireScopedEdgeAuth(req, {
          scope: "save_preview",
          allowAdmin: true,
          allowCiBearer: false,
          adminSecretEnv: "K1W1_EDGE_ADMIN_KEY",
        }),
    );

    expect(result?.status).toBe(500);
    expect(result?.headers.get("content-type")).toContain("application/json");
  });
