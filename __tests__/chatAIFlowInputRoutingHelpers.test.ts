import {
  buildPendingPlanCombinedRequest,
  getNormalizedSendInputs,
  inferStagedTotalBlocksFromPlan,
  isProceedCommand,
  readRequestedBlockIndex,
  resolveEffectiveStagedBlockIndex,
  shouldHoldPendingPlan,
} from "../hooks/chatAIFlowInputRoutingHelpers";

describe("chatAIFlowInputRoutingHelpers", () => {
  it("normalizes raw/ai inputs and preserves attachment-only fallback semantics", () => {
    const withAi = getNormalizedSendInputs("  ", "  attachment context  ");
    expect(withAi.userContent).toBe("");
    expect(withAi.aiContent).toBe("attachment context");
    expect(withAi.candidateInput).toBe("attachment context");
    expect(withAi.hasAnyInput).toBe(true);

    const empty = getNormalizedSendInputs("   ", "   ");
    expect(empty.hasAnyInput).toBe(false);
  });

  it("recognizes proceed commands used for advice-mode handoff", () => {
    expect(isProceedCommand("weiter")).toBe(true);
    expect(isProceedCommand("mach weiter")).toBe(true);
    expect(isProceedCommand("block 1")).toBe(true);
    expect(isProceedCommand("block1")).toBe(true);
    expect(isProceedCommand("block 12")).toBe(true);
    expect(isProceedCommand("block 2 bitte")).toBe(true);
    expect(isProceedCommand("mach block 2")).toBe(true);
    expect(isProceedCommand("weiter mit block 2")).toBe(true);
    expect(isProceedCommand("ok")).toBe(true);
    expect(isProceedCommand("ja")).toBe(true);
    expect(isProceedCommand("go")).toBe(true);
    expect(isProceedCommand("nein")).toBe(false);
  });

  it("parses requested block index from normalized block commands", () => {
    expect(readRequestedBlockIndex("block 1")).toBe(1);
    expect(readRequestedBlockIndex("block1")).toBe(1);
    expect(readRequestedBlockIndex("block 12")).toBe(12);
    expect(readRequestedBlockIndex("block 2 bitte")).toBe(2);
    expect(readRequestedBlockIndex("mach block 2")).toBe(2);
    expect(readRequestedBlockIndex("weiter mit block 2")).toBe(2);
    expect(readRequestedBlockIndex("weiter")).toBeNull();
    expect(readRequestedBlockIndex("block x")).toBeNull();
  });

  it("infers staged block totals and resolves effective next block index", () => {
    expect(inferStagedTotalBlocksFromPlan("Block 1\nBlock 2\nBlock 4")).toBe(4);
    expect(inferStagedTotalBlocksFromPlan("ohne blocks")).toBeNull();

    expect(resolveEffectiveStagedBlockIndex({ requestedBlockIndex: 3, stagedNextBlockIndex: 2 })).toBe(3);
    expect(resolveEffectiveStagedBlockIndex({ requestedBlockIndex: null, stagedNextBlockIndex: 2 })).toBe(2);
    expect(resolveEffectiveStagedBlockIndex({ requestedBlockIndex: null })).toBe(1);
  });

  it("holds pending plan for scout/advice modes when confirmation is missing", () => {
    const scout = shouldHoldPendingPlan({
      mode: "scout",
      wantsDirectBuild: false,
      wantsProceed: false,
    });
    expect(scout.hold).toBe(true);
    expect(scout.message).toContain("Scout-Modus aktiv");

    const advice = shouldHoldPendingPlan({
      mode: "advice",
      wantsDirectBuild: false,
      wantsProceed: false,
    });
    expect(advice.hold).toBe(true);
    expect(advice.message).toContain("Wenn du willst, kann ich das direkt umsetzen");

    const release = shouldHoldPendingPlan({
      mode: "build",
      wantsDirectBuild: true,
      wantsProceed: true,
    });
    expect(release).toEqual({ hold: false, message: null });

    const staged = shouldHoldPendingPlan({
      mode: "staged",
      wantsDirectBuild: false,
      wantsProceed: false,
    });
    expect(staged.hold).toBe(true);
    expect(staged.message).toContain("Stufenmodus aktiv");
  });

  it("builds combined follow-up payload with explicit proceed marker", () => {
    const combinedProceed = buildPendingPlanCombinedRequest({
      currentPlan: {
        originalRequest: "Bitte verbessere den Flow",
        planText: "1) prüfen\n2) bauen",
        mode: "advice",
      },
      sanitizedAiContent: "Zusatzdetails",
      wantsProceed: true,
    });

    expect(combinedProceed).toContain("Planer-Ausgabe");
    expect(combinedProceed).toContain("(User sagt: weiter)");

    const combinedWithDetails = buildPendingPlanCombinedRequest({
      currentPlan: {
        originalRequest: "Bitte verbessere den Flow",
        planText: "1) prüfen\n2) bauen",
        mode: "advice",
      },
      sanitizedAiContent: "Bitte nur Header ändern",
      wantsProceed: false,
    });

    expect(combinedWithDetails).toContain("Bitte nur Header ändern");
    expect(combinedWithDetails).not.toContain("(User sagt: weiter)");
  });

  it("adds explicit block focus section for staged plans when block command is given", () => {
    const combined = buildPendingPlanCombinedRequest({
      currentPlan: {
        originalRequest: "Große Aufgabe",
        planText: "Blockplan",
        mode: "staged",
      },
      sanitizedAiContent: "block 2 bitte",
      wantsProceed: false,
      requestedBlockIndex: 2,
    });

    expect(combined).toContain("Block-Fokus");
    expect(combined).toContain("Nur Block 2 umsetzen");
  });
});
