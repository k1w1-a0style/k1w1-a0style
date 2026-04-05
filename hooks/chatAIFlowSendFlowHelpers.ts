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

export type PendingPlanSendDecision =
  | { kind: "none" }
  | { kind: "hold"; message: string }
  | { kind: "forward"; request: string };

export const resolvePendingPlanSendDecision = ({
  currentPlan,
  sanitizedUserContent,
  sanitizedAiContent,
  isDirectBuildCommand,
}: {
  currentPlan: PendingPlan | null;
  sanitizedUserContent: string;
  sanitizedAiContent: string;
  isDirectBuildCommand: (input: string) => boolean;
}): PendingPlanSendDecision => {
  if (!currentPlan) return { kind: "none" };

  const handoff = resolvePendingPlanHandoff({
    currentPlan,
    sanitizedUserContent,
    sanitizedAiContent,
    isDirectBuildCommand,
  });

  if (handoff.kind === "hold") {
    return {
      kind: "hold",
      message: handoff.message,
    };
  }

  return {
    kind: "forward",
    request: handoff.combinedRequest,
  };
};
