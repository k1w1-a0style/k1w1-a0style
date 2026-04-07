import { resolveEasProjectIdImportDecision } from "../screens/AppInfoScreen/hooks/easProjectIdImportHelpers";

describe("easProjectId import guard", () => {
  it("clears persisted EAS project id for empty backup values", () => {
    expect(resolveEasProjectIdImportDecision("")).toEqual({ mode: "clear" });
    expect(resolveEasProjectIdImportDecision("   ")).toEqual({ mode: "clear" });
  });

  it("accepts valid UUID EAS project ids", () => {
    expect(resolveEasProjectIdImportDecision(" 2f53a910-9d8e-4ff2-8f5b-12af19f2dca6 ")).toEqual({
      mode: "set",
      value: "2f53a910-9d8e-4ff2-8f5b-12af19f2dca6",
    });
  });

  it("ignores non-empty invalid EAS project ids", () => {
    expect(resolveEasProjectIdImportDecision("not-a-uuid")).toEqual({
      mode: "skip-invalid",
      value: "not-a-uuid",
    });
  });
});
