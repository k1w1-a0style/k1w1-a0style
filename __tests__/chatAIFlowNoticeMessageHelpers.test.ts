import {
  getBuilderFlowErrorNoticeText,
  getEmptyMessageNoticeText,
  getExplainFallbackNoticeText,
  getXssSanitizationNoticeText,
} from "../hooks/chatAIFlowNoticeMessageHelpers";

describe("chatAIFlowNoticeMessageHelpers", () => {
  it("returns deterministic explain fallback and xss sanitization texts", () => {
    expect(getExplainFallbackNoticeText()).toContain("Kurz-Erklärung");
    expect(getExplainFallbackNoticeText()).toContain("Dateien können trotzdem übernommen werden");

    expect(getXssSanitizationNoticeText()).toContain("Script-/XSS-Muster");
    expect(getXssSanitizationNoticeText()).toContain("bereinigt");
  });

  it("builds builder flow error with warning prefix and fallback", () => {
    expect(getBuilderFlowErrorNoticeText("spezifischer Fehler")).toBe("⚠️ spezifischer Fehler");
    expect(getBuilderFlowErrorNoticeText(""))
      .toBe("⚠️ Es ist ein Fehler im Builder-Flow aufgetreten.");
  });

  it("returns stable empty message warning", () => {
    expect(getEmptyMessageNoticeText()).toBe("⚠️ Nachricht ist leer.");
  });
});
