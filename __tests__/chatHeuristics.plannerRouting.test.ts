import {
  classifyChatIntent,
  looksAmbiguousBuilderRequest,
  looksLikeAdviceRequest,
} from "../utils/chatHeuristics";

describe("chatHeuristics planner routing", () => {
  it("keeps broad improvement requests planner-first", () => {
    expect(looksAmbiguousBuilderRequest("Mach die App insgesamt besser.")).toBe(true);
  });

  it("does not route concrete UI implementation requests through the planner", () => {
    expect(
      looksAmbiguousBuilderRequest(
        "Füge im ChatScreen Header einen Retry-Button für fehlgeschlagene Läufe hinzu.",
      ),
    ).toBe(false);
  });

  it("does not treat named component requests as ambiguous", () => {
    expect(
      looksAmbiguousBuilderRequest(
        "Implementiere im PreviewToolbar einen Toggle für den Hot-Reload Status.",
      ),
    ).toBe(false);
  });

  it("does not mark direct scoped UI tweaks as ambiguous just because no location cue is present", () => {
    expect(looksAmbiguousBuilderRequest("Mach den Header grün und füge einen Schatten hinzu.")).toBe(false);
  });

  it("still detects explicit advice requests separately", () => {
    expect(looksLikeAdviceRequest("Gib mir bitte ein Review der aktuellen Chat-Architektur.")).toBe(true);
  });

  it("classifies explicit file tasks as high-confidence builder intent", () => {
    const decision = classifyChatIntent("Ändere bitte screens/ChatScreen.tsx und füge ein Badge hinzu.");
    expect(decision.intent).toBe("builder");
    expect(decision.confidence).toBeGreaterThan(0.8);
    expect(decision.requiresConfirmation).toBe(false);
  });

  it("requests confirmation for low-signal generic commands", () => {
    const decision = classifyChatIntent("Mach mal irgendwas besser.");
    expect(decision.intent).toBe("planner");
    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.confidence).toBeLessThan(0.6);
  });
});
