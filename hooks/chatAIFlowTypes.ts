// hooks/chatAIFlowTypes.ts
// Extracted from useChatAIFlow.ts: shared types + helpers.

import type { AIConfig } from "../contexts/AIContext";
import type { OrchestratorResult } from "../lib/orchestrator";
import type { ChatMessage } from "../shared/types/chat";
import type { ProjectFile } from "../shared/types/project";

export function extractRawOrchestratorResult(
  res: ExtendedOrchestratorResult,
): unknown {
  if (Array.isArray(res.files)) return res.files;
  if (typeof res.text === "string" && res.text.trim().length > 0) {
    return res.text;
  }
  return res.raw;
}

export type PendingChange = {
  files: ProjectFile[];
  proposedFiles?: ProjectFile[];
  baseProjectDigest?: string;
  summary: string;
  created: string[];
  updated: string[];
  skipped: string[];
  aiResponse: OrchestratorResult;
  agentResponse?: OrchestratorResult;
};

export type PendingPlan = {
  originalRequest: string;
  planText: string;
  mode: "advice" | "build";
};

/** Extended orchestrator result that may include file arrays or raw data */
export type ExtendedOrchestratorResult = OrchestratorResult & {
  files?: unknown[];
  raw?: unknown;
};

/** Max queued AutoFix requests to prevent infinite loops */
export const MAX_AUTOFIX_QUEUE = 5;

export type UseChatAIFlowArgs = {
  config: AIConfig;
  messages: ChatMessage[];
  projectFiles: ProjectFile[];
  addChatMessage: (m: ChatMessage) => void;
  updateProjectFiles: (files: ProjectFile[]) => Promise<void>;
  autoFixRequest: { message: string } | null;
  clearAutoFixRequest: () => void;

  hardScrollToBottom: (animated: boolean) => void;

  setIsStreaming: (v: boolean) => void;
  setStreamingMessage: React.Dispatch<React.SetStateAction<string>>;
  setIsAiLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setShowConfirmModal: (v: boolean) => void;
};
