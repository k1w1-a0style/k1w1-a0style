import type { PendingPlan } from "./chatAIFlowTypes";
import { resolvePendingPlanHandoff } from "./chatAIFlowPendingPlanHandoff";

export const buildSendValidationErrorMessage = (error?: string): string =>
  error === "Nachricht ist zu lang"
    ? "⚠️ Deine Nachricht ist zu lang. Bitte kürze den Prompt oder teile ihn in kleinere Schritte auf."
    : `⚠️ ${error || "Nachricht konnte nicht verarbeitet werden."}`;

export const resolveSanitizedUserContent = ({
  userContent,
  sanitizedAiContent,
  sanitizeInput,
}: {
  userContent: string;
  sanitizedAiContent: string;
  sanitizeInput: (input: string) => { sanitized: string };
}): string => {
  if (!userContent) return sanitizedAiContent;
  return sanitizeInput(userContent).sanitized || userContent;
};

export type HandlePendingPlanDecisionArgs = {
  currentPlan: PendingPlan | null;
  sanitizedUserContent: string;
  sanitizedAiContent: string;
  isDirectBuildCommand: (input: string) => boolean;
  clearPendingPlan: () => void;
  addAssistantMessage: (message: string) => void;
  processRequest: (request: string) => Promise<void>;
};

export const handlePendingPlanDecision = async ({
  currentPlan,
  sanitizedUserContent,
  sanitizedAiContent,
  isDirectBuildCommand,
  clearPendingPlan,
  addAssistantMessage,
  processRequest,
}: HandlePendingPlanDecisionArgs): Promise<boolean> => {
  if (!currentPlan) return false;

  const handoff = resolvePendingPlanHandoff({
    currentPlan,
    sanitizedUserContent,
    sanitizedAiContent,
    isDirectBuildCommand,
  });

  if (handoff.kind === "hold") {
    addAssistantMessage(handoff.message);
    return true;
  }

  clearPendingPlan();
  await processRequest(handoff.combinedRequest);
  return true;
};
