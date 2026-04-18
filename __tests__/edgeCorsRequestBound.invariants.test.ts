import fs from "fs";
import path from "path";

import { corsHeadersForRequest, getCorsHeaders, handleCors } from "../supabase/functions/_shared/cors";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

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

describe("Edge request-bound CORS hardening", () => {
  it("reflects an allowed request origin via the shared helper", () => {
    const req = new Request("http://localhost/edge", {
      method: "POST",
      headers: { origin: "http://localhost:19000" },
    });

    const headers = withEnv({ ENVIRONMENT: "development" }, () => corsHeadersForRequest(req));
    expect(headers).toEqual(withEnv({ ENVIRONMENT: "development" }, () => getCorsHeaders("http://localhost:19000")));
    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:19000");
  });

  it("keeps preflight handling on the same request-bound shared helper contract", async () => {
    const req = new Request("http://localhost/edge", {
      method: "OPTIONS",
      headers: { origin: "https://k1w1.app" },
    });

    const res = withEnv({ ENVIRONMENT: "production" }, () => handleCors(req));

    expect(res).toBeTruthy();
    expect(res?.headers.get("access-control-allow-origin")).toBe("https://k1w1.app");
    expect(res?.headers.get("access-control-max-age")).toBe("86400");
    await expect(res?.text()).resolves.toBe("ok");
  });

  it("removes wildcard CORS usage from protected workflow/AI edge functions in scope", () => {
    const hardenedFiles = [
      "supabase/functions/k1w1-handler/index.ts",
      "supabase/functions/github-workflow-runs/index.ts",
      "supabase/functions/github-workflow-logs/index.ts",
      "supabase/functions/github-workflow-logs/helpers.ts",
    ];

    for (const rel of hardenedFiles) {
      const src = read(rel);
      expect(src).not.toContain('"Access-Control-Allow-Origin": "*"');
      expect(src).not.toMatch(/\bcorsHeaders\b/);
    }

    expect(read("supabase/functions/k1w1-handler/index.ts")).toContain("corsHeadersForRequest(req)");
    expect(read("supabase/functions/github-workflow-runs/index.ts")).toContain("corsHeadersForRequest(req)");
    expect(read("supabase/functions/github-workflow-logs/helpers.ts")).toContain("jsonResponse(body, req, status)");
    expect(read("supabase/functions/github-workflow-logs/helpers.ts")).toContain("errorResponse(error, req, status, details)");
  });

  it("fails closed to the production origin when ENVIRONMENT is missing", () => {
    const headers = withEnv({ ENVIRONMENT: undefined }, () => getCorsHeaders("http://localhost:19000"));
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://k1w1.app");
  });

});
