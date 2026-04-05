import type { OrchestratorResult } from "../lib/orchestrator";
import type { AIConfig } from "../contexts/AIContext";
import {
  runBuilderWithRetry,
  runExplainStage,
  runValidatorIfEnabled,
  tryPlanChatRequest,
} from "../hooks/chatAIFlowRequestOrchestrator";

const makeConfig = (overrides: Partial<AIConfig> = {}): AIConfig => ({
  version: 1,
  selectedChatProvider: "openai",
  selectedChatMode: "gpt-5.4-mini",
  selectedAgentProvider: "openai",
  selectedAgentMode: "gpt-5.4-mini",
  qualityMode: "speed",
  agentEnabled: false,
  apiKeys: {
    groq: [],
    gemini: [],
    openai: [],
    anthropic: [],
    huggingface: [],
  },
  ...overrides,
});

const okResult = (overrides: Partial<OrchestratorResult> = {}): OrchestratorResult => ({
  ok: true,
  provider: "openai",
  ...overrides,
});

describe("chatAIFlowRequestOrchestrator", () => {
  it("returns pending plan when planner responds with actionable text", async () => {
    const promptRecorded = jest.fn();
    const run = jest.fn().mockResolvedValue(
      okResult({
        text: "Plan: 1) Datei A ändern 2) Datei B ergänzen",
      }),
    );

    const result = await tryPlanChatRequest({
      config: makeConfig(),
      currentMessages: [],
      currentProjectFiles: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
      requestContent: "Scout-only: bitte nur analysieren und planen",
      runOrchestratorWithTimeout: run,
      sideEffects: {
        announceContextBudgetNote: jest.fn(),
        notifyKeyRotation: jest.fn(),
        announceRuntimeNote: jest.fn(),
      },
      recordConfirmationPrompt: promptRecorded,
    });

    expect(result.requiresConfirmation).toBe(false);
    expect(result.pendingPlan).not.toBeNull();
    expect(result.plannerText).toContain("Plan:");
    expect(run).toHaveBeenCalledTimes(1);
    expect(promptRecorded).not.toHaveBeenCalled();
  });

  it("retries builder once and returns normalized files after success", async () => {
    const run = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "429 Too Many Requests" } as OrchestratorResult)
      .mockResolvedValueOnce(
        okResult({
          text: JSON.stringify([{ path: "components/Button.tsx", content: "export const Button = () => null;" }]),
        }),
      );

    const sleepWithAbort = jest.fn().mockResolvedValue(undefined);

    const result = await runBuilderWithRetry({
      config: makeConfig(),
      requestContent: "Bitte Button anpassen",
      currentMessages: [],
      currentProjectFiles: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
      runOrchestratorWithTimeout: run,
      computeRetryDelayMs: () => 123,
      sleepWithAbort,
      sideEffects: {
        announceContextBudgetNote: jest.fn(),
        notifyKeyRotation: jest.fn(),
        announceRuntimeNote: jest.fn(),
      },
    });

    expect(run).toHaveBeenCalledTimes(2);
    expect(sleepWithAbort).toHaveBeenCalledWith(123, undefined);
    expect(result.ai.ok).toBe(true);
    expect(result.normalizedFiles).toEqual([
      { path: "components/Button.tsx", content: "export const Button = () => null;" },
    ]);
  });

  it("keeps builder files and surfaces warning when validator returns empty files", async () => {
    const addValidatorWarning = jest.fn();

    const result = await runValidatorIfEnabled({
      config: makeConfig({ agentEnabled: true }),
      requestContent: "Bitte prüfen",
      normalizedFiles: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
      currentProjectFiles: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
      runOrchestratorWithTimeout: jest.fn().mockResolvedValue(okResult({ text: "{}" })),
      sideEffects: {
        notifyKeyRotation: jest.fn(),
        addValidatorWarning,
      },
    });

    expect(result.finalFileSource).toBe("builder");
    expect(result.validatorState).toBe("builder-fallback-empty");
    expect(addValidatorWarning).toHaveBeenCalledWith("builder-fallback-empty");
  });

  it("skips explain call when no changes are present", async () => {
    const run = jest.fn();

    const explain = await runExplainStage({
      config: makeConfig(),
      requestContent: "Bitte erklären",
      currentProjectFiles: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
      mergedFiles: [{ path: "App.tsx", content: "export default function App() { return null; }" }],
      created: [],
      updated: [],
      runOrchestratorWithTimeout: run,
      notifyKeyRotation: jest.fn(),
    });

    expect(explain).toBe("");
    expect(run).not.toHaveBeenCalled();
  });
});
