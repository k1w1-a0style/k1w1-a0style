import fs from "fs";
import path from "path";

describe("workflow branch hardallowlist regression guard", () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

  it("keeps EAS build live/shared templates free of ALLOWED_REF_REGEX", () => {
    const live = read(".github/workflows/eas-build.yml");
    const shared = read("shared/workflows/easBuildReleaseWorkflowTemplates.ts");

    expect(live).not.toContain("ALLOWED_REF_REGEX");
    expect(shared).not.toContain("ALLOWED_REF_REGEX");
    expect(shared).not.toContain("${ALLOWED_REF_REGEX}");
    expect(shared).not.toContain("\\${ALLOWED_REF_REGEX}");
  });

  it("keeps EAS link live/shared templates free of legacy branch regex", () => {
    const live = read(".github/workflows/eas-link.yml");
    const shared = read("shared/workflows/easLinkWorkflowTemplate.ts");

    expect(live).not.toContain("work|codex|dev|develop");
    expect(shared).not.toContain("work|codex|dev|develop");
    expect(shared).not.toContain("${ALLOWED_REF_REGEX}");
    expect(shared).not.toContain("\\${ALLOWED_REF_REGEX}");
  });

  it("keeps CI Lite live/shared templates free of hardcoded allowed_refs_csv", () => {
    const ciLiteLive = read(".github/workflows/k1w1-ci-lite.yml");
    const ciLiteAutofixLive = read(".github/workflows/k1w1-ci-lite-autofix.yml");
    const ciLiteShared = read("shared/workflows/templates/ciLiteTemplate.ts");
    const ciLiteAutofixShared = read("shared/workflows/templates/ciLiteAutofixTemplate.ts");

    for (const src of [ciLiteLive, ciLiteAutofixLive, ciLiteShared, ciLiteAutofixShared]) {
      expect(src).not.toContain("allowed_refs_csv: work,codex,dev,develop");
    }
  });
});
