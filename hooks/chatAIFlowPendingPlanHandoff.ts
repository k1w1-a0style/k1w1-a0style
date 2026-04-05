import { buildPendingPlanCombinedRequest, isProceedCommand, shouldHoldPendingPlan } from "./chatAIFlowInputRoutingHelpers";
import type { PendingPlan } from "./chatAIFlowTypes";

export type PendingPlanHandoffResult =
  | {
      kind: "hold";
      message: string;
    }
  | {
      kind: "forward";
      combinedRequest: string;
    };

export type PendingPlanSendDecision =
  | { kind: "none" }
  | { kind: "hold"; message: string }
  | { kind: "forward"; request: string };

export const resolvePendingPlanHandoff = ({
  currentPlan,
  sanitizedUserContent,
  sanitizedAiContent,
  isDirectBuildCommand,
}: {
  currentPlan: PendingPlan;
  sanitizedUserContent: string;
  sanitizedAiContent: string;
  isDirectBuildCommand: (input: string) => boolean;
}): PendingPlanHandoffResult => {
  const lower = sanitizedUserContent.trim().toLowerCase();
  const wantsDirectBuild = isDirectBuildCommand(lower);
  const wantsProceed = isProceedCommand(lower);
  const holdDecision = shouldHoldPendingPlan({
    mode: currentPlan.mode,
    wantsDirectBuild,
    wantsProceed,
  });

  if (holdDecision.hold && holdDecision.message) {
    return {
      kind: "hold",
      message: holdDecision.message,
    };
  }

  return {
    kind: "forward",
    combinedRequest: buildPendingPlanCombinedRequest({
      currentPlan,
      sanitizedAiContent,
      wantsProceed,
    }),
  };
};

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
