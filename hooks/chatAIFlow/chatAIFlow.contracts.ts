import type { AIConfig } from "../../contexts/AIContext";
import type { OrchestratorResult } from "../../lib/orchestrator";
import type { ChangePreview } from "../../lib/changePreview";
import type { ChatMessage } from "../../shared/types/chat";
import type { ProjectFile } from "../../shared/types/project";

export function extractRawOrchestratorResult(
  res: ExtendedOrchestratorResult,
): unknown {
  if (Array.isArray(res.files)) return res.files;
  if (typeof res.text === "string" && res.text.trim().length > 0) {
    return res.text;
  }
  return res.raw;
}

export type PendingChangeFileSource = "builder" | "validator";
export type PendingChangeValidatorState =
  | "disabled"
  | "validated"
  | "builder-fallback-empty"
  | "builder-fallback-error"
  | "builder-fallback-exception";

export type PendingChange = {
  originProjectId?: string | null;
  files: ProjectFile[];
  proposedFiles?: ProjectFile[];
  proposedDeletePaths?: string[];
  proposedRenames?: Array<{ from: string; to: string }>;
  baseProjectDigest?: string;
  summary: string;
  created: string[];
  updated: string[];
  skipped: string[];
  deleted?: string[];
  renamed?: Array<{ from: string; to: string }>;
  errors?: string[];
  aiResponse: OrchestratorResult;
  agentResponse?: OrchestratorResult;
  changePreviews?: ChangePreview[];
  finalFileSource?: PendingChangeFileSource;
  validatorState?: PendingChangeValidatorState;
  sourceSummary?: string;
};

export type PendingPlan = {
  originProjectId?: string | null;
  originalRequest: string;
  planText: string;
  mode: "advice" | "build" | "scout" | "staged";
};

export type ExtendedOrchestratorResult = OrchestratorResult & {
  files?: unknown[];
  raw?: unknown;
};

export const MAX_AUTOFIX_QUEUE = 5;

export type UseChatAIFlowArgs = {
  config: AIConfig;
  projectId?: string | null;
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
