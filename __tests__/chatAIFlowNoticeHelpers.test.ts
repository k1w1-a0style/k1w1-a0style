import {
  getBuilderFailureDetails,
  getBuilderFailureMessage,
  getInputValidationMessage,
} from "../hooks/chatAIFlowNoticeHelpers";

describe("chatAIFlowNoticeHelpers", () => {
  it("prefers primary error text from orchestrator result", () => {
    expect(
      getBuilderFailureDetails({ ok: false, error: "Rate limit", errors: ["Secondary detail"] }),
    ).toBe("Rate limit");
  });

  it("falls back to joined errors when no primary error exists", () => {
    expect(
      getBuilderFailureDetails({ ok: false, errors: ["Timeout", "Retry after 1s"] }),
    ).toBe("Timeout\nRetry after 1s");
  });

  it("uses stable unknown fallback when result has no details", () => {
    expect(getBuilderFailureMessage({ ok: false })).toBe(
      "KI-Request fehlgeschlagen: Kein ok=true (unbekannter Fehler).",
    );
    expect(getBuilderFailureMessage(null)).toBe(
      "KI-Request fehlgeschlagen: Kein ok=true (unbekannter Fehler).",
    );
  });

  describe("getInputValidationMessage", () => {
    it("uses the dedicated long-input advisory text", () => {
      expect(getInputValidationMessage("Nachricht ist zu lang")).toBe(
        "⚠️ Deine Nachricht ist zu lang. Bitte kürze den Prompt oder teile ihn in kleinere Schritte auf.",
      );
    });

    it("keeps generic validation fallback mapping stable", () => {
      expect(getInputValidationMessage("Nachricht ist leer")).toBe("⚠️ Nachricht ist leer");
      expect(getInputValidationMessage(undefined)).toBe(
        "⚠️ Nachricht konnte nicht verarbeitet werden.",
      );
    });
  });
});
