import {
  buildPendingPlanCombinedRequest,
  isProceedCommand,
  isValidStagedBlockIndex,
  readBlockCommandIntent,
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
  const blockIntent = readBlockCommandIntent(lower);
  const requestedBlockIndex = readRequestedBlockIndex(lower);
  const wantsDirectBuild = isDirectBuildCommand(lower);
  const wantsProceed = isProceedCommand(lower);

  if (currentPlan.mode === "staged" && blockIntent.isBlockCommand && requestedBlockIndex === null) {
    return {
      kind: "hold",
      message:
        '⚠️ Ungültiger Blockindex. Nutze bitte einen gültigen Befehl wie **"block 1"**, **"mach block 2"** oder **"weiter".',
    };
  }

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

  if (
    currentPlan.mode === "staged" &&
    !isValidStagedBlockIndex({
      blockIndex: forwardedBlockIndex,
      stagedTotalBlocks: currentPlan.stagedTotalBlocks,
    })
  ) {
    const totalHint =
      currentPlan.stagedTotalBlocks && currentPlan.stagedTotalBlocks > 0
        ? ` Erlaubt ist nur **1 bis ${currentPlan.stagedTotalBlocks}**.`
        : "";
    return {
      kind: "hold",
      message: `⚠️ Dieser Block ist außerhalb des gültigen Bereichs.${totalHint}`,
    };
  }

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
