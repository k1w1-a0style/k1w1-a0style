import { buildChangeConfirmationText } from "../hooks/chatChangeSummary";

describe("buildChangeConfirmationText", () => {
  it("includes file paths in details list", () => {
    const text = buildChangeConfirmationText({
      files: [],
      summary: "",
      created: ["src/newFile.ts"],
      updated: ["src/changed.ts"],
      skipped: ["src/skip.ts"],
      aiResponse: {
        provider: "openai",
        keysRotated: 2,
        timing: { durationMs: 1234 },
      } as any,
    });

    expect(text).toContain("🆕 Neue Dateien: 1");
    expect(text).toContain("✏️ Geänderte Dateien: 1");
    expect(text).toContain("⏭️ Übersprungen: 1");

    // Most important: the actual paths must appear (no empty bullets)
    expect(text).toContain("• src/newFile.ts");
    expect(text).toContain("• src/changed.ts");
    expect(text).toContain("• src/skip.ts");
  });

  it("omits details block when there are no files", () => {
    const text = buildChangeConfirmationText({
      files: [],
      summary: "",
      created: [],
      updated: [],
      skipped: [],
      aiResponse: { provider: "system" } as any,
    });

    expect(text).toContain("🆕 Neue Dateien: 0");
    expect(text).not.toContain("📂 Details:");
    expect(text).not.toContain("•");
  });
});
