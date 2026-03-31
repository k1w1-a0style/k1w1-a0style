import fs from "fs";
import path from "path";
import { normalizePreflightPatch } from "../components/ciLite/ciLiteUtils";

describe("CI-Lite flow-near typing/parsing guards", () => {
  it("keeps artifact JSON parsing wired via dedicated helper", () => {
    const hookSrc = fs.readFileSync(path.join(process.cwd(), "components/CiLiteHeaderButton/hooks/useCiLiteWorkflow.ts"), "utf8");
    const helperSrc = fs.readFileSync(path.join(process.cwd(), "components/CiLiteHeaderButton/hooks/useCiLiteWorkflowHelpers.ts"), "utf8");

    expect(hookSrc).toContain("parseCiLiteArtifactJson");
    expect(hookSrc).toContain("const artifactJson = parseCiLiteArtifactJson(jsonCandidate);");
    expect(helperSrc).toContain("export const parseCiLiteArtifactJson = (payload: unknown)");
  });

  it("still normalizes plain preflight patch JSON payloads", () => {
    const patch = normalizePreflightPatch({
      upsert: [{ path: "README.md", content: "ok" }],
      explanation: "test",
    });

    expect(patch.upsert).toHaveLength(1);
    expect(patch.explanation).toBe("test");
  });

  it("unwraps { patch: ... } but fails safely on invalid shapes", () => {
    const wrapped = normalizePreflightPatch({
      patch: {
        delete: ["README.md"],
      },
    });
    expect(wrapped.delete).toEqual(["README.md"]);

    expect(() => normalizePreflightPatch(null)).toThrow("Patch JSON ist leer oder ungültig.");
    expect(() => normalizePreflightPatch({ explanation: "only text" })).toThrow(
      "Patch hat keine Operationen (upsert/delete/jsonMerge).",
    );
  });

  it("keeps legacy top-level patch semantics when wrapped patch field is invalid", () => {
    const fromTopLevel = normalizePreflightPatch({
      patch: "not-an-object",
      upsert: [{ path: "README.md", content: "fallback-works" }],
    });
    expect(fromTopLevel.upsert).toEqual([{ path: "README.md", content: "fallback-works" }]);

    expect(() =>
      normalizePreflightPatch({
        patch: {
          upsert: "bad-shape",
        },
      }),
    ).toThrow("Patch hat keine Operationen (upsert/delete/jsonMerge).");
  });
});
