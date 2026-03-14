// hooks/chatAIFlowTypes.ts
// Extracted from useChatAIFlow.ts: types and helpers.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, ToastAndroid } from "react-native";
import { v4 as uuidv4 } from "uuid";
import type { AIConfig } from "../contexts/AIContext";
import type { OrchestratorResult } from "../lib/orchestrator";
import type { ApplyFilesResult } from "../lib/fileWriter";
import type { ChatMessage } from "../shared/types/chat";
import type { ProjectFile } from "../shared/types/project";


export function extractRawOrchestratorResult(res: any): unknown {
  if (res?.files && Array.isArray(res.files)) return res.files;
  if (res?.text) return res.text;
  return res?.raw;
}


import { runOrchestrator } from "../lib/orchestrator";
import { normalizeAiResponse } from "../lib/normalizer";
import { logger } from "../lib/logger";
import { applyFilesToProject } from "../lib/fileWriter";
import {
  buildBuilderMessages,
  buildPlannerMessages,
  buildValidatorMessages,
} from "../lib/promptEngine";
import {
  looksLikeExplicitFileTask,
  looksLikeAdviceRequest,
  looksAmbiguousBuilderRequest,
  buildChangeDigest,
  buildExplainMessages,
} from "../utils/chatHeuristics";
import { handleMetaCommand } from "../utils/metaCommands";

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
