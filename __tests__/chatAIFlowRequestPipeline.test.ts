import {
  executeChatRequestPipeline,
  shouldAttemptPlannerStage,
} from "../hooks/chatAIFlowRequestPipeline";
import {
  runBuilderWithRetry,
  tryPlanChatRequest,
} from "../hooks/chatAIFlowRequestOrchestrator";

jest.mock("../hooks/chatAIFlowRequestOrchestrator", () => ({
  tryPlanChatRequest: jest.fn(),
  runBuilderWithRetry: jest.fn(),
  runValidatorIfEnabled: jest.fn(),
  runExplainStage: jest.fn(),
}));

describe("chatAIFlowRequestPipeline", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("keeps planner-stage guard fail-closed for autofix, force-builder and pending-plan", () => {
    expect(shouldAttemptPlannerStage({ isAutoFix: false, forceBuilder: false, hasPendingPlan: false })).toBe(true);
    expect(shouldAttemptPlannerStage({ isAutoFix: true, forceBuilder: false, hasPendingPlan: false })).toBe(false);
    expect(shouldAttemptPlannerStage({ isAutoFix: false, forceBuilder: true, hasPendingPlan: false })).toBe(false);
    expect(shouldAttemptPlannerStage({ isAutoFix: false, forceBuilder: false, hasPendingPlan: true })).toBe(false);
  });

  it("returns confirmation_required from planner stage without entering builder flow", async () => {
    (tryPlanChatRequest as jest.Mock).mockResolvedValue({
      requiresConfirmation: true,
      pendingPlan: null,
      plannerText: null,
    });

    const result = await executeChatRequestPipeline({
      config: {
        version: 1,
        apiKeys: {
          groq: [],
          gemini: [],
          openai: [],
          anthropic: [],
          huggingface: [],
        },
        selectedChatProvider: "openai",
        selectedChatMode: "gpt-4o-mini",
        selectedAgentProvider: "openai",
        selectedAgentMode: "gpt-4o-mini",
        qualityMode: "balanced",
        agentEnabled: true,
      },
      sanitizedRequestContent: "prüfe erst mal",
      isAutoFix: false,
      forceBuilder: false,
      currentMessages: [],
      currentProjectFiles: [],
      currentPendingPlan: null,
      signal: new AbortController().signal,
      runOrchestratorWithTimeout: async () => ({ ok: true, text: "ok" }),
      computeRetryDelayMs: () => 0,
      sleepWithAbort: async () => undefined,
      buildGuardPolicyPreHint: () => "guard hint",
      buildPreflightSummaryIntro: () => "preflight",
      buildPathBulletList: () => "",
      sideEffects: {
        announceContextBudgetNote: () => undefined,
        notifyKeyRotation: () => undefined,
        announceRuntimeNote: () => undefined,
        recordConfirmationPrompt: () => undefined,
        onExplainFailure: () => undefined,
        onValidatorWarning: () => undefined,
      },
    });

    expect(result.kind).toBe("confirmation_required");
    expect(runBuilderWithRetry).not.toHaveBeenCalled();
  });
});
