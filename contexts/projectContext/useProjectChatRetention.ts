import { useCallback, useEffect, useRef } from "react";

import type { ChatMessage } from "../../shared/types/chat";
import { loadChatHistorySettings } from "../../lib/chatPrivacySettings";
import { logger } from "../../lib/logger";
import { trimChatHistory } from "../../infra/storage/persistenceHelpers";
import {
  appendChatMessageWithRetention,
  CHAT_HISTORY_RETENTION_FALLBACK,
  sanitizeChatRetentionLimit,
  shouldApplyHydratedRetention,
} from "../projectContextStateHelpers";
import { hydrateChatRetentionLimit } from "../projectContextPersistenceHelpers";
import type { ProjectChatRetentionInput } from "./projectContext.contracts";

export function useProjectChatRetention({ updateProject }: ProjectChatRetentionInput) {
  const chatRetentionLimitRef = useRef<number>(CHAT_HISTORY_RETENTION_FALLBACK);
  const didSetRuntimeRetentionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadRetention = async () => {
      const hydratedLimit = await hydrateChatRetentionLimit({
        loadChatHistorySettings,
        shouldApplyHydratedRetention,
        didSetRuntimeRetention: didSetRuntimeRetentionRef.current,
        onHydrationError: (error) => {
          logger.warn("[ProjectContext] chat retention hydration failed; using fallback", { error });
        },
      });
      if (!cancelled && hydratedLimit !== null) {
        chatRetentionLimitRef.current = hydratedLimit;
      }
    };

    void loadRetention();
    return () => {
      cancelled = true;
    };
  }, []);

  const setChatRetentionLimit = useCallback(
    async (limit: number) => {
      const safeLimit = sanitizeChatRetentionLimit(limit);
      didSetRuntimeRetentionRef.current = true;
      chatRetentionLimitRef.current = safeLimit;
      await updateProject((prev) => ({
        ...prev,
        chatHistory: trimChatHistory(prev.chatHistory || [], safeLimit),
      }));
    },
    [updateProject],
  );

  const addChatMessage = useCallback(
    async (message: ChatMessage) => {
      await updateProject((prev) => ({
        ...prev,
        chatHistory: appendChatMessageWithRetention(
          prev.chatHistory || [],
          message,
          chatRetentionLimitRef.current,
        ),
      }));
    },
    [updateProject],
  );

  const clearChatHistory = useCallback(async () => {
    await updateProject((prev) => ({
      ...prev,
      chatHistory: [],
    }));
  }, [updateProject]);

  return {
    addChatMessage,
    clearChatHistory,
    setChatRetentionLimit,
  };
}
