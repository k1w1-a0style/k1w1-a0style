import { resolveCiLiteShowError } from "../components/CiLiteHeaderButton/hooks/useCiLiteWorkflow";

describe("CI Lite visible error resolution", () => {
  it("surfaces artifact fetch failures before workflow conclusion fallback", () => {
    expect(
      resolveCiLiteShowError({
        artifactError: "Missing SIGNING_ADMIN_KEY for CI-Lite",
        workflowStatus: "completed",
        workflowConclusion: "failure",
      }),
    ).toContain("Missing SIGNING_ADMIN_KEY");
  });

  it("keeps workflow conclusion fallback when no direct error text exists", () => {
    expect(
      resolveCiLiteShowError({
        workflowStatus: "completed",
        workflowConclusion: "failure",
      }),
    ).toContain("Workflow failed (failure)");
  });
});
