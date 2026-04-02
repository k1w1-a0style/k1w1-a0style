import { applyPreflightPatch } from "../lib/diagnostics/patchEngine";
import type { ProjectFile } from "../shared/types/project";
import type { PreflightPatch } from "../lib/diagnostics/preflightTypes";

describe("patch engine idempotency", () => {
  it("keeps the same file set when the same patch is applied twice", async () => {
    const files: ProjectFile[] = [
      { path: "app.json", content: JSON.stringify({ expo: { name: "demo" } }) },
      { path: "README.md", content: "initial" },
    ];

    const patch: PreflightPatch = {
      delete: ["README.md"],
      upsert: [{ path: "README.md", content: "updated" }],
      jsonMerge: [
        {
          path: "app.json",
          patch: { expo: { slug: "demo-slug", extra: { channel: "preview" } } },
          createIfMissing: false,
        },
      ],
    };

    const once = await applyPreflightPatch(files, patch);
    const twice = await applyPreflightPatch(once, patch);

    const normalize = (list: Array<{ path: string; content: string }>) =>
      [...list].sort((a, b) => a.path.localeCompare(b.path));

    expect(normalize(twice)).toEqual(normalize(once));
  });
});
