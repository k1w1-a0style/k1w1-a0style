import {
  buildGuardPolicyPreHint,
  buildPathBulletList,
  buildPreflightSummaryIntro,
  extractContextBudgetNotice,
} from "../hooks/useChatAIFlow";

describe("useChatAIFlow summary regression", () => {
  it("renders file paths inside bullet points", () => {
    const result = buildPathBulletList(
      ["src/new.ts", "src/changed.ts", "src/skipped.ts"],
      6,
    );

    expect(result).toContain("• src/new.ts");
    expect(result).toContain("• src/changed.ts");
    expect(result).toContain("• src/skipped.ts");
  });

  it("shows overflow hint after preview limit", () => {
    const result = buildPathBulletList(
      ["a.ts", "b.ts", "c.ts", "d.ts"],
      3,
    );

    expect(result).toContain("• a.ts");
    expect(result).toContain("• b.ts");
    expect(result).toContain("• c.ts");
    expect(result).toContain("... und 1 weitere");
  });

  it("returns explicit preflight intro copy", () => {
    const intro = buildPreflightSummaryIntro();
    expect(intro).toContain("Pre-Flight (voraussichtlich)");
    expect(intro).toContain("neu/aktualisiert");
    expect(intro).toContain("manuell bleiben");
  });

  it("returns explicit guard policy pre-hint copy", () => {
    const hint = buildGuardPolicyPreHint();
    expect(hint).toContain("Guard-Policy vor Vorschlag");
    expect(hint).toContain("allowed");
    expect(hint).toContain("guarded");
    expect(hint).toContain("manuell");
  });

  it("extracts context budget note from internal prompt marker", () => {
    const note = extractContextBudgetNotice([
      { role: "system", content: "foo" },
      {
        role: "system",
        content:
          "Kontext – aktueller Projektzustand:\n\n[intern] Kontext gekürzt (ältere History: -2, Snapshot-Dateien: -1).\n\n...",
      },
    ]);
    expect(note).toContain("🏷️ **Kontext gekürzt:**");
    expect(note).toContain("ältere History: -2");
    expect(note).toContain("Snapshot-Dateien: -1");
  });

  it("returns empty when no internal context marker exists", () => {
    const note = extractContextBudgetNotice([
      { role: "assistant", content: "Kein Marker" },
      { role: "system", content: "Kontext – aktueller Projektzustand" },
    ]);
    expect(note).toBe("");
  });
});
