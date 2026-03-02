import { runPreflightChecksAll } from "../lib/diagnostics/preflightRunner";
import type { PreflightCheck } from "../lib/diagnostics/preflightTypes";

describe("e2e smoke diagnostics resilience", () => {
  it("does not crash when a check throws and continues with remaining checks", () => {
    const checks: PreflightCheck[] = [
      {
        id: "throws-check",
        title: "Throws",
        severity: "critical",
        run: () => {
          throw new Error("simulated crash");
        },
      },
      {
        id: "healthy-check",
        title: "Healthy",
        severity: "normal",
        run: () => ({
          id: "healthy-check",
          title: "Healthy",
          severity: "normal",
          status: "pass",
        }),
      },
    ];

    const results = runPreflightChecksAll([], { mode: "eas", profile: "preview" }, checks);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ id: "throws-check", status: "fail" });
    expect(results[0].message).toContain("simulated crash");
    expect(results[1]).toMatchObject({ id: "healthy-check", status: "pass" });
  });
});
