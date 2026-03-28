import fs from "fs";
import path from "path";

import { corsHeadersForRequest, getCorsHeaders, handleCors } from "../supabase/functions/_shared/cors";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Edge request-bound CORS hardening", () => {
  it("reflects an allowed request origin via the shared helper", () => {
    const req = new Request("http://localhost/edge", {
      method: "POST",
      headers: { origin: "http://localhost:19000" },
    });

    expect(corsHeadersForRequest(req)).toEqual(getCorsHeaders("http://localhost:19000"));
    expect(corsHeadersForRequest(req)["Access-Control-Allow-Origin"]).toBe("http://localhost:19000");
  });

  it("keeps preflight handling on the same request-bound shared helper contract", async () => {
    const req = new Request("http://localhost/edge", {
      method: "OPTIONS",
      headers: { origin: "https://k1w1.app" },
    });

    const res = handleCors(req);

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

  it("removes wildcard CORS usage from the remaining legacy edge stubs in scope", () => {
    const disabledLegacyFiles = [
      "supabase/functions/check-lint/index.ts",
      "supabase/functions/trigger-lint/index.ts",
      "supabase/functions/check-native-sync/index.ts",
      "supabase/functions/trigger-native-sync/index.ts",
      "supabase/functions/native-sync-report/index.ts",
      "supabase/functions/native-sync-report-ingest/index.ts",
    ];

    for (const rel of disabledLegacyFiles) {
      const src = read(rel);
      expect(src).not.toContain('"Access-Control-Allow-Origin": "*"');
      expect(src).not.toMatch(/\bcorsHeaders\b/);
      expect(src).toContain("handleCors(req)");
      expect(src).toContain("status: 410");
      expect(src).toContain("corsHeadersForRequest(req)");
    }

    const testStub = read("supabase/functions/test/index.ts");
    expect(testStub).not.toContain('"Access-Control-Allow-Origin": "*"');
    expect(testStub).not.toMatch(/\bcorsHeaders\b/);
    expect(testStub).toContain("handleCors(req)");
    expect(testStub).toContain("requireScopedEdgeAuth(req, {");
    expect(testStub).toContain('adminSecretEnv: "K1W1_EDGE_ADMIN_KEY"');
    expect(testStub).toContain("allowAdmin: true");
    expect(testStub).toContain("allowCiBearer: false");
    expect(testStub).toContain('scope: "test"');
    expect(testStub).toContain("status: 410");
    expect(testStub).toContain("legacy_test_route_disabled");
  });
});
