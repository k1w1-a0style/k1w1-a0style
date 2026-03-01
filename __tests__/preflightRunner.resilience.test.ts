import type { PreflightCheck } from "../lib/diagnostics/preflightTypes";
import { runPreflightChecksAll } from "../lib/diagnostics/preflightRunner";

describe("runPreflightChecksAll resilience", () => {
  test("keeps running when one check throws", () => {
    const checks: PreflightCheck[] = [
      {
        id: "throws",
        title: "Throws",
        severity: "high",
        run: () => {
          throw new Error("boom");
        },
      },
      {
        id: "ok",
        title: "OK",
        severity: "normal",
        run: () => ({ id: "ok", title: "OK", severity: "normal", status: "pass" }),
      },
    ];

    const results = runPreflightChecksAll([], { mode: "expoGo" }, checks);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ id: "throws", status: "fail" });
    expect(results[0].message).toContain("Check crashed: boom");
    expect(results[1]).toMatchObject({ id: "ok", status: "pass" });
  });
});
