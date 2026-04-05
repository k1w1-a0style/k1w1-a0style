import {
  buildSendValidationErrorMessage,
  resolvePendingPlanSendDecision,
  resolveSanitizedUserContent,
} from "../hooks/chatAIFlowSendFlowHelpers";
import type { PendingPlan } from "../hooks/chatAIFlowTypes";

const pendingPlan: PendingPlan = {
  originalRequest: "Plan bitte",
  planText: "Plan",
  mode: "advice",
};

describe("chatAIFlowSendFlowHelpers", () => {
  it("builds dedicated long-message validation warning", () => {
    expect(buildSendValidationErrorMessage("Nachricht ist zu lang")).toContain("Bitte kürze");
  });

  it("falls back to generic send validation warning", () => {
    expect(buildSendValidationErrorMessage("Ungültig")).toBe("⚠️ Ungültig");
  });

  it("prefers sanitized user content when available", () => {
    const result = resolveSanitizedUserContent({
      userContent: "  Hallo  ",
      sanitizedAiContent: "AI",
      sanitizeInput: () => ({ sanitized: "Hallo" }),
    });
    expect(result).toBe("Hallo");
  });

  it("falls back to raw user content if sanitization returns empty", () => {
    const result = resolveSanitizedUserContent({
      userContent: "Raw Prompt",
      sanitizedAiContent: "AI",
      sanitizeInput: () => ({ sanitized: "" }),
    });
    expect(result).toBe("Raw Prompt");
  });

  it("returns a hold decision for non-proceed replies", () => {
    const decision = resolvePendingPlanSendDecision({
      currentPlan: pendingPlan,
      sanitizedUserContent: "klingt gut",
      sanitizedAiContent: "klingt gut",
      isDirectBuildCommand: () => false,
    });

    expect(decision).toEqual({
      kind: "hold",
      message: expect.stringContaining("weiter"),
    });
  });

  it("returns a forward decision for proceed commands", () => {
    const decision = resolvePendingPlanSendDecision({
      currentPlan: pendingPlan,
      sanitizedUserContent: "weiter",
      sanitizedAiContent: "weiter",
      isDirectBuildCommand: () => false,
    });

    expect(decision).toEqual({
      kind: "forward",
      request: expect.stringContaining("Nutzer-Antwort/Details:"),
    });
  });

  it("returns a none decision when there is no pending plan", () => {
    const decision = resolvePendingPlanSendDecision({
      currentPlan: null,
      sanitizedUserContent: "irgendwas",
      sanitizedAiContent: "irgendwas",
      isDirectBuildCommand: () => false,
    });

    expect(decision).toEqual({ kind: "none" });
  });
});
