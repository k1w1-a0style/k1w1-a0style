import {
  buildPendingPlanCombinedRequest,
  isProceedCommand,
  readRequestedBlockIndex,
  resolveEffectiveStagedBlockIndex,
  shouldHoldPendingPlan,
} from "./chatAIFlowInputRoutingHelpers";
import type { PendingPlan } from "./chatAIFlowTypes";

export type PendingPlanHandoffResult =
  | {
      kind: "hold";
      message: string;
    }
  | {
      kind: "forward";
      combinedRequest: string;
      forwardedBlockIndex: number | null;
    };

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
  const requestedBlockIndex = readRequestedBlockIndex(lower);
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

  const forwardedBlockIndex =
    currentPlan.mode === "staged"
      ? resolveEffectiveStagedBlockIndex({
          requestedBlockIndex,
          stagedNextBlockIndex: currentPlan.stagedNextBlockIndex,
        })
      : null;

  return {
    kind: "forward",
    combinedRequest: buildPendingPlanCombinedRequest({
      currentPlan,
      sanitizedAiContent,
      wantsProceed,
      requestedBlockIndex: forwardedBlockIndex ?? requestedBlockIndex,
    }),
    forwardedBlockIndex,
  };
};
