import { useCallback } from "react";
import { Alert } from "react-native";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { rebasePendingChangeOnLatest } from "../../lib/chatFlowStateGuards";
import { buildChangeConfirmationText } from "../chatChangeSummary";
import {
  buildAssistantMessage,
  buildSystemMessage,
} from "../chatAIFlowChatMessageFactory";
import type { PendingChange } from "./chatAIFlow.contracts";
import type { ChatMessage } from "../../shared/types/chat";
import type { ProjectFile } from "../../shared/types/project";

export type UseChatAIChangeLifecycleArgs = {
  pendingChange: PendingChange | null;
  safe: <T>(fn: () => T) => T | undefined;
  projectFilesRef: MutableRefObject<ProjectFile[]>;
  updateProjectFiles: (files: ProjectFile[]) => Promise<void>;
  addChatMessage: (message: ChatMessage) => void;
  hardScrollToBottom: (animated: boolean) => void;
  setShowConfirmModal: (value: boolean) => void;
  setPendingChange: Dispatch<SetStateAction<PendingChange | null>>;
};

export const useChatAIChangeLifecycle = ({
  pendingChange,
  safe,
  projectFilesRef,
  updateProjectFiles,
  addChatMessage,
  hardScrollToBottom,
  setShowConfirmModal,
  setPendingChange,
}: UseChatAIChangeLifecycleArgs) => {
  const applyChanges = useCallback(async () => {
    if (!pendingChange) return;

    safe(() => setShowConfirmModal(false));

    try {
      const { applyResult, driftDetected } = rebasePendingChangeOnLatest(
        projectFilesRef.current,
        pendingChange,
      );

      await updateProjectFiles(applyResult.files);

      if (driftDetected) {
        addChatMessage(
          buildSystemMessage(
            "ℹ️ Projektzustand hat sich seit dem KI-Vorschlag geändert. Änderungen wurden auf den aktuellen Stand neu angewendet.",
            { stateDrift: true },
          ),
        );
      }

      const confirmationText = buildChangeConfirmationText({
        ...pendingChange,
        files: applyResult.files,
        created: applyResult.created,
        updated: applyResult.updated,
        skipped: applyResult.skipped,
        errors: applyResult.errors ?? pendingChange.errors,
      });

      addChatMessage(
        buildAssistantMessage(confirmationText, {
          provider: pendingChange.aiResponse?.provider || "system",
        }),
      );

      requestAnimationFrame(() => hardScrollToBottom(true));
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      Alert.alert(
        "Fehler beim Anwenden",
        error.message || "Änderungen konnten nicht angewendet werden.",
      );
      addChatMessage(
        buildSystemMessage(
          `⚠️ Fehler beim Anwenden der Änderungen: ${error.message || "Unbekannt"}`,
          { error: true },
        ),
      );
    } finally {
      safe(() => setPendingChange(null));
    }
  }, [
    addChatMessage,
    hardScrollToBottom,
    pendingChange,
    projectFilesRef,
    safe,
    setPendingChange,
    setShowConfirmModal,
    updateProjectFiles,
  ]);

  const rejectChanges = useCallback(() => {
    addChatMessage(
      buildSystemMessage("❌ Änderungen wurden abgelehnt. Keine Dateien wurden geändert."),
    );
    safe(() => setShowConfirmModal(false));
    safe(() => setPendingChange(null));
  }, [addChatMessage, safe, setPendingChange, setShowConfirmModal]);

  return { applyChanges, rejectChanges };
};
