import type { ProjectFile } from "../shared/types/project";
import { makeProjectFile } from "./helpers/diagnosticTestHelpers";
import { applyJsonMergePatchSafe } from "../lib/diagnostics/smartPatch";

describe("canonical eas json merge", () => {
  it("preserves custom sibling keys while adding preview profile", async () => {
    const files: ProjectFile[] = [
      makeProjectFile(
        "eas.json",
        JSON.stringify({
          build: {
            development: { custom: { keep: true }, android: { buildType: "apk" } },
            production: { android: { buildType: "apk" } },
          },
          submit: { production: { android: { track: "internal" } } },
        }),
      ),
    ];

    const out = await applyJsonMergePatchSafe(files, [
      {
        path: "eas.json",
        patch: {
          build: {
            preview: {
              distribution: "internal",
              android: { buildType: "apk", withoutCredentials: true },
            },
          },
        },
        createIfMissing: true,
      },
    ]);

    const merged = JSON.parse(out[0].content);
    expect(merged.build.development.custom.keep).toBe(true);
    expect(merged.submit.production.android.track).toBe("internal");
    expect(merged.build.preview.android.buildType).toBe("apk");
  });
});
