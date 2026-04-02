import { applyPreflightPatch } from "../lib/diagnostics/patchEngine";
import type { ProjectFile } from "../shared/types/project";
import type { PreflightPatch } from "../lib/diagnostics/preflightTypes";

describe("patch engine jsonMerge preserves siblings (variant)", () => {
  it("keeps existing sibling keys while setting withoutCredentials", async () => {
    const files: ProjectFile[] = [
      {
        path: "bar.json",
        content: JSON.stringify({ android: { buildType: "apk", other: "x" } }),
      },
    ];
    const patch: PreflightPatch = {
      jsonMerge: [{ path: "bar.json", patch: { android: { withoutCredentials: true } } }],
    };

    const next = await applyPreflightPatch(files, patch);

    const parsed = JSON.parse(next.find((f) => f.path === "bar.json")?.content ?? "{}");
    expect(parsed.android.buildType).toBe("apk");
    expect(parsed.android.other).toBe("x");
    expect(parsed.android.withoutCredentials).toBe(true);
  });
});
