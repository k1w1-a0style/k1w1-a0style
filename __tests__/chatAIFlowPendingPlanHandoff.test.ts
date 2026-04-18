import { resolvePendingPlanHandoff } from "../hooks/chatAIFlowPendingPlanHandoff";

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

  const stagedPlan = {
    originalRequest: "großes refactoring",
    planText: "staged plan",
    mode: "staged" as const,
    stagedNextBlockIndex: 1,
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

  it("holds staged plans until block-1/proceed command is present", () => {
    const holdResult = resolvePendingPlanHandoff({
      currentPlan: stagedPlan,
      sanitizedUserContent: "später",
      sanitizedAiContent: "später",
      isDirectBuildCommand: () => false,
    });
    expect(holdResult.kind).toBe("hold");

    const forwardResult = resolvePendingPlanHandoff({
      currentPlan: stagedPlan,
      sanitizedUserContent: "block 1",
      sanitizedAiContent: "los gehts",
      isDirectBuildCommand: () => false,
    });

    expect(forwardResult.kind).toBe("forward");
    if (forwardResult.kind === "forward") {
      expect(forwardResult.combinedRequest).toContain("staged plan");
      expect(forwardResult.combinedRequest).toContain("(User sagt: weiter)");
      expect(forwardResult.forwardedBlockIndex).toBe(1);
    }
  });

  it("forwards staged plans with explicit block focus when user requests block 2", () => {
    const forwardResult = resolvePendingPlanHandoff({
      currentPlan: stagedPlan,
      sanitizedUserContent: "block 2",
      sanitizedAiContent: "setz block 2 um",
      isDirectBuildCommand: () => false,
    });

    expect(forwardResult.kind).toBe("forward");
    if (forwardResult.kind === "forward") {
      expect(forwardResult.combinedRequest).toContain("Block-Fokus");
      expect(forwardResult.combinedRequest).toContain("Nur Block 2 umsetzen");
      expect(forwardResult.forwardedBlockIndex).toBe(2);
    }
  });

  it("uses staged next-block cursor when user only says weiter", () => {
    const forwardResult = resolvePendingPlanHandoff({
      currentPlan: {
        ...stagedPlan,
        stagedNextBlockIndex: 3,
      },
      sanitizedUserContent: "weiter",
      sanitizedAiContent: "weiter",
      isDirectBuildCommand: () => false,
    });

    expect(forwardResult.kind).toBe("forward");
    if (forwardResult.kind === "forward") {
      expect(forwardResult.combinedRequest).toContain("Nur Block 3 umsetzen");
      expect(forwardResult.forwardedBlockIndex).toBe(3);
    }
  });

});
