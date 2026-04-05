import { buildAiProposalSummary } from "../hooks/chatAIFlowSummaryHelpers";

const buildPathBulletList = (paths: string[]): string =>
  paths.length ? paths.map((p) => `  • ${p}`).join("\n") : "  (keine)";

describe("chatAIFlowSummaryHelpers", () => {
  it("builds manual review summary including skipped and blocked sections", () => {
    const text = buildAiProposalSummary({
      isAutoFix: false,
      sourceSummary: "Builder + Validator",
      explainText: "Kurze Erklärung",
      preflightIntro: "📦 intro",
      created: ["src/new.ts"],
      updated: ["src/existing.ts"],
      skipped: ["README.md"],
      errors: ["guarded path", "manual-only"],
      buildPathBulletList,
    });

    expect(text).toContain("🤖 Die KI möchte folgende Änderungen vornehmen:");
    expect(text).toContain("📦 intro");
    expect(text).toContain("🧾 **Kurz erklärt");
    expect(text).toContain("⏭ **Übersprungen** (1)");
    expect(text).toContain("🚫 **Geblockt/Hinweise** (2)");
    expect(text).toContain("Möchtest du diese Änderungen übernehmen?");
  });

  it("builds auto-fix summary without skipped section and with truncated errors notice", () => {
    const text = buildAiProposalSummary({
      isAutoFix: true,
      sourceSummary: "Builder",
      explainText: "",
      preflightIntro: "📦 intro",
      created: [],
      updated: ["src/a.ts"],
      skipped: ["README.md"],
      errors: ["e1", "e2", "e3", "e4", "e5"],
      buildPathBulletList,
    });

    expect(text).toContain("🤖 **Auto-Fix Vorschlag:**");
    expect(text).not.toContain("⏭ **Übersprungen**");
    expect(text).toContain("... und 1 weitere");
  });
});
