import {
  getRuntimeEnv,
  requireVerifiedJwt,
  rateLimit,
} from "../supabase/functions/_shared/auth";
import { corsHeaders as savePreviewCorsHeaders } from "../supabase/functions/save_preview/helpers";

const ORIGIN = "http://localhost:19000";

type RuntimeGlobal = typeof globalThis & { Deno?: unknown };
const runtimeGlobal = globalThis as RuntimeGlobal;

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

function withDenoRemoved<T>(run: () => T): T {
  const hadDeno = Object.prototype.hasOwnProperty.call(runtimeGlobal, "Deno");
  const previousDeno = runtimeGlobal.Deno;
  delete runtimeGlobal.Deno;

  try {
    return run();
  } finally {
    if (hadDeno) {
      runtimeGlobal.Deno = previousDeno;
    } else {
      delete runtimeGlobal.Deno;
    }
  }
}

describe("save_preview auth/error header consistency + auth runtime env fallback", () => {
  it("returns auth failure headers compatible with save_preview success/local-error headers", async () => {
    const req = new Request("http://localhost/save-preview", {
      method: "POST",
      headers: { origin: ORIGIN },
    });

    const authRes = await withEnv(
      { ENVIRONMENT: "development" },
      () => requireVerifiedJwt(req, "save_preview"),
    );

    expect(authRes).toBeTruthy();
    const savePreviewHeaders = withEnv({ ENVIRONMENT: "development" }, () => savePreviewCorsHeaders(ORIGIN));
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
      headers: {
        origin: ORIGIN,
        "cf-ray": "abc123",
        "cf-connecting-ip": "203.0.113.9",
      },
    });

    const bucket = `save_preview_invariant_${Date.now()}`;
    expect(withEnv({ ENVIRONMENT: "development", K1W1_TRUST_CF_CONNECTING_IP: "1" }, () => rateLimit(req, bucket, 1, 10_000))).toBeNull();
    const res = withEnv({ ENVIRONMENT: "development", K1W1_TRUST_CF_CONNECTING_IP: "1" }, () => rateLimit(req, bucket, 1, 10_000));
    expect(res).toBeTruthy();

    const savePreviewHeaders = withEnv({ ENVIRONMENT: "development" }, () => savePreviewCorsHeaders(ORIGIN));
    expect(res?.headers.get("access-control-allow-origin")).toBe(
      savePreviewHeaders["Access-Control-Allow-Origin"],
    );
    expect(res?.headers.get("x-frame-options")).toBe(
      savePreviewHeaders["X-Frame-Options"],
    );
  });

  it("auth guard reads Node process env even when Deno is not present", () => {
    withDenoRemoved(() => {
      const result = withEnv(
        {
          EXPO_PUBLIC_SUPABASE_URL: "https://preview.example.com",
        },
        () => getRuntimeEnv("EXPO_PUBLIC_SUPABASE_URL"),
      );

      expect(result).toBe("https://preview.example.com");
    });
  });

  it("fails closed without a bearer token for save_preview", async () => {
    const req = new Request("http://localhost/save-preview", {
      method: "POST",
      headers: { origin: ORIGIN },
    });

    const result = await withEnv({}, () => requireVerifiedJwt(req, "save_preview"));

    expect(result?.status).toBe(401);
    expect(result?.headers.get("content-type")).toContain("application/json");
  });
});
