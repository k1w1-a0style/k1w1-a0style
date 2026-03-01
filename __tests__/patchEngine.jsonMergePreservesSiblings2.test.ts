import { applyPreflightPatch } from "../lib/diagnostics/patchEngine";

describe("patch engine jsonMerge preserves siblings (variant)", () => {
  it("keeps existing sibling keys while setting withoutCredentials", async () => {
    const next = await applyPreflightPatch([
      {
        path: "bar.json",
        content: JSON.stringify({ android: { buildType: "apk", other: "x" } }),
      },
    ] as any, {
      jsonMerge: [{ path: "bar.json", patch: { android: { withoutCredentials: true } } }],
    });

    const parsed = JSON.parse(next.find((f) => f.path === "bar.json")?.content ?? "{}");
    expect(parsed.android.buildType).toBe("apk");
    expect(parsed.android.other).toBe("x");
    expect(parsed.android.withoutCredentials).toBe(true);
  });
});
