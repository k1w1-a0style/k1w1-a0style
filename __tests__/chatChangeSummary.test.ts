import { buildChangeConfirmationText } from "../hooks/chatChangeSummary";

describe("chat change confirmation summary", () => {
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
    expect(text).toContain("🚫 Geblockt/Hinweise: 0");
    expect(text).toContain("• src/newFile.ts");
    expect(text).toContain("• src/changed.ts");
    expect(text).toContain("• src/skip.ts");
  });

  it("omits details block when there are no files or hints", () => {
    const text = buildChangeConfirmationText({
      files: [],
      summary: "",
      created: [],
      updated: [],
      skipped: [],
      aiResponse: { provider: "system" } as any,
    });

    expect(text).toContain("🆕 Neue Dateien: 0");
    expect(text).toContain("🚫 Geblockt/Hinweise: 0");
    expect(text).not.toContain("📂 Details:");
    expect(text).not.toContain("•");
  });

  it("keeps blocked ownership reasons visible after apply", () => {
    const text = buildChangeConfirmationText({
      files: [],
      summary: "",
      created: [],
      updated: ["App.tsx"],
      skipped: ["package.json"],
      errors: [
        "Pfad ist kritisch und darf nicht blind durch KI überschrieben werden: package.json",
      ],
      aiResponse: {
        ok: true,
        text: "",
        provider: "openai",
        timing: { startMs: 0, endMs: 1200, durationMs: 1200 },
      },
    });

    expect(text).toContain("🚫 Geblockt/Hinweise: 1");
    expect(text).toContain("kritisch und darf nicht blind durch KI überschrieben werden");
  });
});
