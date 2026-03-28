import { normalizeResultFiles, readBuilderFilesOrThrow } from "../hooks/chatAIFlowResultHelpers";

describe("chatAIFlowResultHelpers", () => {
  it("normalisiert gültige Dateilisten aus Raw-Payload", () => {
    const result = normalizeResultFiles({
      text: JSON.stringify({ files: [{ path: "src/App.tsx", content: "export default 1;" }] }),
    });

    expect(result.files).toEqual([{ path: "src/App.tsx", content: "export default 1;" }]);
    expect(result.parseError).toBe("");
    expect(result.responseText).toBe("");
  });

  it("wirft bei fehlender Dateiliste mit parseHint + gekürzter Antwort", () => {
    const longText = "x".repeat(1000);
    const result = normalizeResultFiles({
      output_text: longText,
    });

    expect(() => readBuilderFilesOrThrow(result, "")).toThrow(
      /Builder hat keine gültige JSON-Dateiliste geliefert\./,
    );

    try {
      readBuilderFilesOrThrow(result, "");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/\[Normalizer: [^\]]+\]/);
      expect(message).toContain("KI-Antwort (gekürzt):");
      expect(message).toContain("x".repeat(900));
      expect(message).not.toContain("x".repeat(901));
    }
  });

  it("wirft den bisherigen generischen Fehler, wenn weder Dateien noch Text vorliegen", () => {
    const result = normalizeResultFiles({ files: [] });

    expect(() => readBuilderFilesOrThrow(result, "")).toThrow(
      "Builder/Normalizer konnte keine verwertbare Dateiliste erzeugen.",
    );
  });
});
