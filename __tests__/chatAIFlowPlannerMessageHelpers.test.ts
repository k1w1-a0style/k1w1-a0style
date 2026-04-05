import {
  buildIntentConfirmationMessage,
  buildPlannerPreviewMessage,
} from "../hooks/chatAIFlowPlannerMessageHelpers";

describe("chatAIFlowPlannerMessageHelpers", () => {
  it("builds intent confirmation with rounded confidence and reason", () => {
    const message = buildIntentConfirmationMessage({
      intent: "builder",
      confidence: 0.834,
      reason: "explicit command",
    });

    expect(message).toContain("Kurze Intent-Bestätigung");
    expect(message).toContain("`builder`");
    expect(message).toContain("Confidence 83%");
    expect(message).toContain("explicit command");
    expect(message).toContain("planen");
    expect(message).toContain("direkt build");
  });

  it("builds planner preview with guard hint and explicit proceed instruction", () => {
    const message = buildPlannerPreviewMessage(
      "1) Dateien prüfen\n2) Vorschlag bauen",
      "🛡️ Guard hint",
    );

    expect(message).toContain("Kurz bevor ich Code anfasse");
    expect(message).toContain("🛡️ Guard hint");
    expect(message).toContain("1) Dateien prüfen");
    expect(message).toContain("Hinweis zu Guarded-Pfaden");
    expect(message).toContain('sag „weiter"');
  });
});
