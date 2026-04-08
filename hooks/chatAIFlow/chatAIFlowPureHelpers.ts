import { validateChatInput } from "../../lib/validators";
import { runOrchestrator } from "../../lib/orchestrator";
import { parseRetryAfterMs } from "../useChatAIFlowRetryHelpers";
import type { AllAIProviders } from "../../contexts/AIContext";
import type { LlmMessage, OrchestratorResult } from "../../lib/orchestrator";
import type { Quality } from "../../lib/orchestrator/types";

const BUILDER_RETRY_BACKOFF_MS = 700;
const BUILDER_RETRY_MAX_BACKOFF_MS = 3_500;
export const CHAT_AI_REQUEST_TIMEOUT_MS = 45_000;

export const computeBuilderRetryDelayMs = (
  attempt: number,
  errorText: string,
): number => {
  const retryAfterMs = parseRetryAfterMs(errorText);
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(retryAfterMs, BUILDER_RETRY_MAX_BACKOFF_MS);
  }

  const exponential = BUILDER_RETRY_BACKOFF_MS * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = 0.9 + Math.random() * 0.2;
  return Math.min(Math.round(exponential * jitter), BUILDER_RETRY_MAX_BACKOFF_MS);
};

export async function runOrchestratorWithHardTimeout(
  provider: AllAIProviders,
  model: string,
  quality: Quality,
  messages: LlmMessage[],
  signal?: AbortSignal,
  timeoutMs = CHAT_AI_REQUEST_TIMEOUT_MS,
): Promise<OrchestratorResult> {
  if (signal?.aborted) {
    return { ok: false, error: "Request abgebrochen" };
  }

  const requestController = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, timeoutMs);

  const onAbort = () => requestController.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const result = await runOrchestrator(
      provider,
      model,
      quality,
      messages,
      requestController.signal,
    );

    if (timedOut && !result.ok) {
      return {
        ...result,
        error: `Request timeout nach ${timeoutMs}ms`,
      };
    }

    return result;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
  }
}

export const prepareValidatedChatInput = (
  input: string,
): { valid: boolean; error?: string; sanitized: string; hadXSS: boolean } => {
  const validation = validateChatInput(input);
  if (!validation.valid) {
    return {
      valid: false,
      error: validation.error,
      sanitized: "",
      hadXSS: Boolean(validation.hadXSS),
    };
  }

  const sanitized = String(validation.sanitized ?? input).trim();
  return {
    valid: sanitized.length > 0,
    error: sanitized.length > 0 ? undefined : "Nachricht ist leer",
    sanitized,
    hadXSS: Boolean(validation.hadXSS),
  };
};

export const buildPathBulletList = (paths: string[], previewLimit: number): string => {
  if (!paths.length) return "  (keine)";

  const preview = paths
    .slice(0, previewLimit)
    .map((filePath: string) => `  • ${filePath}`)
    .join("\n");

  if (paths.length > previewLimit) {
    return `${preview}\n  ... und ${paths.length - previewLimit} weitere`;
  }

  return preview;
};

export const buildPreflightSummaryIntro = (): string =>
  "📦 **Pre-Flight (voraussichtlich):**\n" +
  "Ich zeige gleich strukturiert, welche Dateien neu/aktualisiert werden und welche Pfade manuell bleiben.";

export const buildGuardPolicyPreHint = (): string =>
  "🛡️ **Guard-Policy vor Vorschlag:**\n" +
  "🟢 `allowed` = kann ich direkt als Patch vorschlagen\n" +
  "🔴 `guarded` = kritische/manual-only Pfade, bleiben manuell";

export const isDirectBuildCommand = (input: string): boolean => {
  const lower = String(input ?? "").trim().toLowerCase();
  return lower === "direkt build" || lower === "build" || lower === "jetzt builden";
};
