import fs from "node:fs";
import path from "node:path";

describe("useChatAIFlow validator/explain communication invariants", () => {
  const file = path.join(process.cwd(), "hooks/useChatAIFlow.ts");
  const src = fs.readFileSync(file, "utf8");

  it("surfaces validator fallback warnings instead of only logging", () => {
    expect(src).toContain("const addValidatorWarning = (content: string) => {");
    expect(src).toContain("Validator-Prüfung war nicht erfolgreich");
    expect(src).toContain("Validator-Prüfung konnte nicht abgeschlossen werden");
    expect(src).toContain('meta: { validatorWarning: true }');
  });

  it("keeps explain fallback user-visible when explain call fails", () => {
    expect(src).toContain('meta: { explainWarning: true }');
    expect(src).toContain("Konnte die Kurz-Erklärung für die Änderungen nicht erzeugen");
  });
});
