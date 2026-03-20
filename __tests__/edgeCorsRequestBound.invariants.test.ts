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
    const files = [
      "supabase/functions/k1w1-handler/index.ts",
      "supabase/functions/github-workflow-runs/index.ts",
      "supabase/functions/github-workflow-logs/index.ts",
      "supabase/functions/github-workflow-logs/helpers.ts",
    ];

    for (const rel of files) {
      const src = read(rel);
      expect(src).not.toContain('"Access-Control-Allow-Origin": "*"');
      expect(src).not.toMatch(/\bcorsHeaders\b/);
    }

    expect(read("supabase/functions/k1w1-handler/index.ts")).toContain("corsHeadersForRequest(req)");
    expect(read("supabase/functions/github-workflow-runs/index.ts")).toContain("corsHeadersForRequest(req)");
    expect(read("supabase/functions/github-workflow-logs/helpers.ts")).toContain("jsonResponse(body, req, status)");
    expect(read("supabase/functions/github-workflow-logs/helpers.ts")).toContain("errorResponse(error, req, status, details)");
  });
});
