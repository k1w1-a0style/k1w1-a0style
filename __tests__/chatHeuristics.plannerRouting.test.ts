import {
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
});
