import { applyPreflightPatch } from "../lib/diagnostics/patchEngine";
import type { ProjectFile } from "../shared/types/project";
import type { PreflightPatch } from "../lib/diagnostics/preflightTypes";

describe("patch engine upsert", () => {
  it("overwrites exact content", async () => {
    const files: ProjectFile[] = [{ path: "file.txt", content: "old" }];
    const patch: PreflightPatch = {
      upsert: [{ path: "file.txt", content: "new-content" }],
    };

    const next = await applyPreflightPatch(files, patch);

    expect(next.find((f) => f.path === "file.txt")?.content).toBe("new-content");
  });
});
