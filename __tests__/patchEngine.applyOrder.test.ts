import { applyPreflightPatch } from "../lib/diagnostics/patchEngine";
import type { ProjectFile } from "../shared/types/project";
import type { PreflightPatch } from "../lib/diagnostics/preflightTypes";

describe("patch engine apply order", () => {
  it("applies delete -> upsert -> jsonMerge", async () => {
    const files: ProjectFile[] = [
      { path: "foo.txt", content: "old" },
      { path: "bar.json", content: JSON.stringify({ keep: true }) },
    ];

    const patch: PreflightPatch = {
      delete: ["foo.txt"],
      upsert: [{ path: "foo.txt", content: "new" }],
      jsonMerge: [{ path: "bar.json", patch: { a: 1 }, createIfMissing: false }],
    };

    const next = await applyPreflightPatch(files, patch);

    const m = new Map(next.map((f) => [f.path, f.content] as const));
    expect(m.get("foo.txt")).toBe("new");
    expect(JSON.parse(m.get("bar.json") as string)).toEqual({ keep: true, a: 1 });
  });
});
