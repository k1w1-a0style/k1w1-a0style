import { checkWorkflowYamlNameColonQuoting } from "../lib/diagnostics/checks/workflowSecurity";
import { makeProjectFile } from "./helpers/preflightTestHelpers";

describe("preflight workflow name colon quoting", () => {
  it("fails and proposes upsert patch with quoted workflow name", () => {
    const result = checkWorkflowYamlNameColonQuoting.run([
      makeProjectFile(
        ".github/workflows/build.yml",
        "name: Foo: Bar\non: workflow_dispatch\njobs: {}\n",
      ),
    ], { mode: "eas", profile: "preview" });

    expect(result.status).toBe("fail");
    expect(result.fix?.patch?.upsert?.length).toBeGreaterThan(0);

    const upsert = result.fix?.patch?.upsert?.find((u) => u.path === ".github/workflows/build.yml");
    expect(upsert).toBeTruthy();
    expect(upsert?.content).toContain('name: "Foo: Bar"');
  });
});
