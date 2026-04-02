import { applyJsonMergePatchSafe } from "../lib/diagnostics/smartPatch";

describe("patch engine jsonMerge preserves sibling keys", () => {
  it("keeps existing buildType while adding withoutCredentials", async () => {
    const files = [
      {
        path: "eas.json",
        content:
          '{"build":{"preview":{"android":{"buildType":"apk"}}}}\n',
      },
    ];

    const next = await applyJsonMergePatchSafe(files, [
      {
        path: "eas.json",
        patch: {
          build: {
            preview: {
              android: {
                withoutCredentials: true,
              },
            },
          },
        },
      },
    ]);

    const parsed = JSON.parse(next.find((f) => f.path === "eas.json")?.content ?? "{}");
    expect(parsed.build.preview.android.buildType).toBe("apk");
    expect(parsed.build.preview.android.withoutCredentials).toBe(true);
  });

  it("reports invalid json parse errors with safe fallback", async () => {
    const files = [
      {
        path: "eas.json",
        content: '{invalid',
      },
    ];

    await expect(
      applyJsonMergePatchSafe(files, [
        {
          path: "eas.json",
          patch: { build: { preview: {} } },
        },
      ]),
    ).rejects.toThrow("Invalid JSON:");
  });
});
