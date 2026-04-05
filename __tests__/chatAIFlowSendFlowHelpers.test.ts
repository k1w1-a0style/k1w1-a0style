import {
  buildSendValidationErrorMessage,
  handlePendingPlanDecision,
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

  it("holds pending plan and reports assistant notice for non-proceed replies", async () => {
    const addAssistantMessage = jest.fn();
    const clearPendingPlan = jest.fn();
    const processRequest = jest.fn();

    const handled = await handlePendingPlanDecision({
      currentPlan: pendingPlan,
      sanitizedUserContent: "klingt gut",
      sanitizedAiContent: "klingt gut",
      isDirectBuildCommand: () => false,
      clearPendingPlan,
      addAssistantMessage,
      processRequest,
    });

    expect(handled).toBe(true);
    expect(addAssistantMessage).toHaveBeenCalledWith(expect.stringContaining("weiter"));
    expect(clearPendingPlan).not.toHaveBeenCalled();
    expect(processRequest).not.toHaveBeenCalled();
  });

  it("forwards request and clears pending plan for proceed commands", async () => {
    const addAssistantMessage = jest.fn();
    const clearPendingPlan = jest.fn();
    const processRequest = jest.fn().mockResolvedValue(undefined);

    const handled = await handlePendingPlanDecision({
      currentPlan: pendingPlan,
      sanitizedUserContent: "weiter",
      sanitizedAiContent: "weiter",
      isDirectBuildCommand: () => false,
      clearPendingPlan,
      addAssistantMessage,
      processRequest,
    });

    expect(handled).toBe(true);
    expect(clearPendingPlan).toHaveBeenCalledTimes(1);
    expect(processRequest).toHaveBeenCalledWith(expect.stringContaining("Nutzer-Antwort/Details:"));
    expect(addAssistantMessage).not.toHaveBeenCalled();
  });

  it("returns false when there is no pending plan", async () => {
    const handled = await handlePendingPlanDecision({
      currentPlan: null,
      sanitizedUserContent: "irgendwas",
      sanitizedAiContent: "irgendwas",
      isDirectBuildCommand: () => false,
      clearPendingPlan: jest.fn(),
      addAssistantMessage: jest.fn(),
      processRequest: jest.fn(),
    });

    expect(handled).toBe(false);
  });
});
