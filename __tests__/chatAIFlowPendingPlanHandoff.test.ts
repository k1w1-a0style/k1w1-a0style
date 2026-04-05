import {
  resolvePendingPlanHandoff,
  resolvePendingPlanSendDecision,
} from "../hooks/chatAIFlowPendingPlanHandoff";

describe("chatAIFlowPendingPlanHandoff", () => {
  const advicePlan = {
    originalRequest: "hilfe",
    planText: "plan",
    mode: "advice" as const,
  };

  const scoutPlan = {
    originalRequest: "analysiere",
    planText: "scout plan",
    mode: "scout" as const,
  };

  it("holds advice plans without proceed command", () => {
    const result = resolvePendingPlanHandoff({
      currentPlan: advicePlan,
      sanitizedUserContent: "danke",
      sanitizedAiContent: "danke",
      isDirectBuildCommand: () => false,
    });

    expect(result.kind).toBe("hold");
    if (result.kind === "hold") {
      expect(result.message).toContain("weiter");
    }
  });

  it("requires explicit direct-build intent in scout mode", () => {
    const holdResult = resolvePendingPlanHandoff({
      currentPlan: scoutPlan,
      sanitizedUserContent: "weiter",
      sanitizedAiContent: "weiter",
      isDirectBuildCommand: () => false,
    });
    expect(holdResult.kind).toBe("hold");

    const forwardResult = resolvePendingPlanHandoff({
      currentPlan: scoutPlan,
      sanitizedUserContent: "direkt build",
      sanitizedAiContent: "dateien bauen",
      isDirectBuildCommand: (input) => input === "direkt build",
    });

    expect(forwardResult.kind).toBe("forward");
    if (forwardResult.kind === "forward") {
      expect(forwardResult.combinedRequest).toContain("Planer-Ausgabe");
      expect(forwardResult.combinedRequest).toContain("dateien bauen");
      expect(forwardResult.combinedRequest).toContain("scout plan");
    }
  });

  describe("resolvePendingPlanSendDecision", () => {
    it("returns none when no pending plan exists", () => {
      expect(
        resolvePendingPlanSendDecision({
          currentPlan: null,
          sanitizedUserContent: "ok",
          sanitizedAiContent: "ok",
          isDirectBuildCommand: () => false,
        }),
      ).toEqual({ kind: "none" });
    });

    it("returns hold decision with the same guard message", () => {
      expect(
        resolvePendingPlanSendDecision({
          currentPlan: advicePlan,
          sanitizedUserContent: "danke",
          sanitizedAiContent: "danke",
          isDirectBuildCommand: () => false,
        }),
      ).toEqual({
        kind: "hold",
        message: expect.stringContaining("weiter"),
      });
    });

    it("returns forward decision with combined request payload", () => {
      expect(
        resolvePendingPlanSendDecision({
          currentPlan: advicePlan,
          sanitizedUserContent: "weiter",
          sanitizedAiContent: "bitte bauen",
          isDirectBuildCommand: () => false,
        }),
      ).toEqual({
        kind: "forward",
        request: expect.stringContaining("Nutzer-Antwort/Details:"),
      });
    });
  });
});
