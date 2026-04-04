import {
  buildAutoFixStartMessage,
  buildBatchRiskPromptMessage,
  buildSelectedFixLimitMessage,
  buildSmartFixLimitMessage,
} from "../screens/DiagnosticScreen/hooks/fixRunnerPromptHelpers";

describe("fixRunnerPromptHelpers", () => {
  test("buildBatchRiskPromptMessage includes paths and soft lines", () => {
    const message = buildBatchRiskPromptMessage({
      hasRisk: true,
      shortPaths: [".github/workflows/a.yml", "app.json"],
      more: "\n(+1 weitere)",
      softLines: ["- app.json (large)"],
    });
    expect(message).toContain("CI/Build/Infra");
    expect(message).toContain(".github/workflows/a.yml");
    expect(message).toContain("Große Fixes");
    expect(message).toContain("Willst du wirklich fortfahren?");
  });

  test("buildSmartFixLimitMessage keeps max/total contract wording", () => {
    expect(buildSmartFixLimitMessage({ max: 50, total: 72 })).toContain("50/72");
  });

  test("buildSelectedFixLimitMessage keeps selected/max wording", () => {
    const message = buildSelectedFixLimitMessage({ max: 50, selectedCount: 70 });
    expect(message).toContain("70");
    expect(message).toContain("50");
    expect(message).toContain("fail-only");
  });

  test("buildAutoFixStartMessage includes scope and warn flag", () => {
    const message = buildAutoFixStartMessage({
      count: 3,
      autoFixScope: "visible",
      autoFixIncludeWarn: true,
    });
    expect(message).toContain("3 Fix(es)");
    expect(message).toContain("Scope: visible");
    expect(message).toContain("Includes warnings: ja");
  });
});
