import {
  getSourceSummaryText,
  getValidatorFallbackWarning,
} from "../hooks/chatAIFlowStageHelpers";

describe("chatAIFlowStageHelpers", () => {
  it("maps validator fallback states to stable user notices", () => {
    expect(getValidatorFallbackWarning("disabled")).toBeNull();
    expect(getValidatorFallbackWarning("validated")).toBeNull();
    expect(getValidatorFallbackWarning("builder-fallback-empty")).toContain(
      "lieferte keine gültige Dateiliste",
    );
    expect(getValidatorFallbackWarning("builder-fallback-error")).toContain(
      "konnte die Builder-Dateien diesmal nicht nachschärfen",
    );
    expect(getValidatorFallbackWarning("builder-fallback-exception")).toContain(
      "Validator war nur advisory und ist fehlgeschlagen",
    );
  });

  it("maps final file source and agent mode to stable source summary", () => {
    expect(getSourceSummaryText("validator", true)).toBe(
      "Finale Dateiliste stammt aus dem Validator-Review (advisory Nachschärfer auf Builder-Basis).",
    );
    expect(getSourceSummaryText("builder", true)).toBe(
      "Finale Dateiliste stammt direkt vom Builder; der Validator war nur advisory und hat diesmal nicht übernommen.",
    );
    expect(getSourceSummaryText("builder", false)).toBe(
      "Finale Dateiliste stammt direkt vom Builder; kein separater Validator aktiv.",
    );
  });
});
