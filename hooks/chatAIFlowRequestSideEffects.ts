import { Platform, ToastAndroid } from "react-native";
import { v4 as uuidv4 } from "uuid";
import type { OrchestratorResult } from "../lib/orchestrator";
import { logger } from "../lib/logger";
import { buildSystemMessage } from "./chatAIFlowChatMessageFactory";
import { extractContextBudgetNotice } from "./chatAIFlowContextBudgetHelpers";
import { readOrchestratorRuntimeNote } from "./useChatAIFlowRetryHelpers";

type AddChatMessage = (message: ReturnType<typeof buildSystemMessage>) => void;

type MutableRef<T> = { current: T };

export const notifyKeyRotationEffect = ({
  result,
  addChatMessage,
}: {
  result: OrchestratorResult | null | undefined;
  addChatMessage: AddChatMessage;
}): void => {
  if (!result) return;
  const count = result.keysRotated ?? 0;
  if (count <= 0) return;

  const provider = result.provider ?? "unbekannt";
  const msg = `🔑 Key rotiert (${count}x) wegen 429/Rate-Limit • Provider: ${provider}`;

  try {
    if (Platform.OS === "android") {
      ToastAndroid.show(msg, ToastAndroid.LONG);
    }
  } catch (e) {
    logger.warn("[notifyKeyRotation] Toast failed:", e);
  }

  addChatMessage({
    id: uuidv4(),
    role: "system",
    content: msg,
    timestamp: new Date().toISOString(),
    meta: { keyRotation: true, provider },
  });
};

export const announceRuntimeNoteEffect = ({
  result,
  addChatMessage,
}: {
  result: OrchestratorResult | null | undefined;
  addChatMessage: AddChatMessage;
}): void => {
  const note = readOrchestratorRuntimeNote(result);
  if (!note) return;

  addChatMessage({
    id: uuidv4(),
    role: "system",
    content: note,
    timestamp: new Date().toISOString(),
    meta: { runtimeNote: true, fallbackUsed: !!result?.fallbackUsed },
  });
};

export const announceContextBudgetNoteEffect = ({
  llmMessages,
  lastContextBudgetNoticeRef,
  addChatMessage,
}: {
  llmMessages: Array<{ role: string; content: string }>;
  lastContextBudgetNoticeRef: MutableRef<string>;
  addChatMessage: AddChatMessage;
}): void => {
  const note = extractContextBudgetNotice(llmMessages);
  if (!note) return;
  if (note === lastContextBudgetNoticeRef.current) return;
  lastContextBudgetNoticeRef.current = note;

  addChatMessage({
    id: uuidv4(),
    role: "system",
    content: note,
    timestamp: new Date().toISOString(),
    meta: { runtimeNote: true, contextBudgetNote: true },
  });
};
