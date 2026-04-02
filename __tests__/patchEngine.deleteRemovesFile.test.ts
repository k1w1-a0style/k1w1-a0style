import { applyPreflightPatch } from "../lib/diagnostics/patchEngine";
import type { ProjectFile } from "../shared/types/project";
import type { PreflightPatch } from "../lib/diagnostics/preflightTypes";

describe("patch engine delete", () => {
  it("removes file reliably", async () => {
    const files: ProjectFile[] = [
      { path: "yarn.lock", content: "old-lock" },
      { path: "package.json", content: "{}" },
    ];
    const patch: PreflightPatch = { delete: ["yarn.lock"] };

    const next = await applyPreflightPatch(files, patch);

    expect(next.some((f) => f.path === "yarn.lock")).toBe(false);
  });
});
