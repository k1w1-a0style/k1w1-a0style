import { checkWorkflowYamlNameColonQuoting } from "../lib/diagnostics/checks/workflowSecurity";

describe("preflight workflow name colon quoting", () => {
  it("fails and proposes upsert patch with quoted workflow name", () => {
    const result = checkWorkflowYamlNameColonQuoting.run([
      {
        path: ".github/workflows/build.yml",
        content: "name: Foo: Bar\non: workflow_dispatch\njobs: {}\n",
        updatedAt: Date.now(),
      } as any,
    ], { mode: "eas", profile: "preview" });

    expect(result.status).toBe("fail");
    expect(result.fix?.patch?.upsert?.length).toBeGreaterThan(0);

    const upsert = result.fix?.patch?.upsert?.find((u) => u.path === ".github/workflows/build.yml");
    expect(upsert).toBeTruthy();
    expect(upsert?.content).toContain('name: "Foo: Bar"');
  });
});
