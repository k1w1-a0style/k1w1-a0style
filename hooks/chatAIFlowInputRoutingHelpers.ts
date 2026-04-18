import type { PendingPlan } from "./chatAIFlowTypes";

const BLOCK_COMMAND_RE = /^block\s*(\d+)$/i;
const BLOCK_IN_TEXT_RE = /\bblock\s*(\d+)\b/gi;

export const getNormalizedSendInputs = (
  rawInput: string,
  aiInput?: string,
): {
  userContent: string;
  aiContent: string;
  candidateInput: string;
  hasAnyInput: boolean;
} => {
  const userContent = rawInput.trim();
  const aiContent = (aiInput ?? rawInput).trim();
  const candidateInput = aiContent || userContent;

  return {
    userContent,
    aiContent,
    candidateInput,
    hasAnyInput: Boolean(userContent || candidateInput),
  };
};

export const isProceedCommand = (normalizedInput: string): boolean => {
  if (BLOCK_COMMAND_RE.test(normalizedInput)) return true;
  return (
    normalizedInput === "weiter" ||
    normalizedInput === "mach weiter" ||
    normalizedInput === "ok" ||
    normalizedInput === "ja" ||
    normalizedInput === "go"
  );
};

export const readRequestedBlockIndex = (normalizedInput: string): number | null => {
  const match = normalizedInput.match(BLOCK_COMMAND_RE);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
};

export const inferStagedTotalBlocksFromPlan = (planText: string): number | null => {
  let match: RegExpExecArray | null;
  let max = 0;
  while ((match = BLOCK_IN_TEXT_RE.exec(planText))) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > max) max = Math.trunc(parsed);
  }
  BLOCK_IN_TEXT_RE.lastIndex = 0;
  return max > 0 ? max : null;
};

export const resolveEffectiveStagedBlockIndex = ({
  requestedBlockIndex,
  stagedNextBlockIndex,
}: {
  requestedBlockIndex: number | null;
  stagedNextBlockIndex?: number;
}): number | null => {
  if (requestedBlockIndex && requestedBlockIndex > 0) return requestedBlockIndex;
  if (stagedNextBlockIndex && stagedNextBlockIndex > 0) return stagedNextBlockIndex;
  return 1;
};

export const shouldHoldPendingPlan = ({
  mode,
  wantsDirectBuild,
  wantsProceed,
}: {
  mode: PendingPlan["mode"];
  wantsDirectBuild: boolean;
  wantsProceed: boolean;
}): { hold: boolean; message: string | null } => {
  if (mode === "scout" && !wantsDirectBuild) {
    return {
      hold: true,
      message:
        "🧭 **Scout-Modus aktiv:** Ich bleibe bei Analyse/Plan ohne Builder-Phase.\n\n" +
        'Wenn du trotzdem direkt umsetzen willst, antworte mit **„direkt build"**.',
    };
  }

  if (mode === "advice" && !wantsProceed) {
    return {
      hold: true,
      message:
        'Alles klar. Wenn du willst, kann ich das direkt umsetzen – sag einfach **„weiter"** oder nenn die Features.',
    };
  }

  if (mode === "staged" && !wantsProceed && !wantsDirectBuild) {
    return {
      hold: true,
      message:
        "🧩 **Stufenmodus aktiv:** Ich setze große Aufgaben blockweise um.\n\n" +
        'Starte mit **„block 1"** oder **„weiter"**, dann liefere ich nur den ersten Teilpatch.',
    };
  }

  return { hold: false, message: null };
};

export const buildPendingPlanCombinedRequest = ({
  currentPlan,
  sanitizedAiContent,
  wantsProceed,
  requestedBlockIndex,
}: {
  currentPlan: PendingPlan;
  sanitizedAiContent: string;
  wantsProceed: boolean;
  requestedBlockIndex?: number | null;
}): string => {
  const blockDirective =
    currentPlan.mode === "staged" && requestedBlockIndex && requestedBlockIndex > 0
      ? `\n\n---\nBlock-Fokus:\nNur Block ${requestedBlockIndex} umsetzen.`
      : "";

  return (
    currentPlan.originalRequest +
    "\n\n---\nPlaner-Ausgabe:\n" +
    currentPlan.planText +
    blockDirective +
    "\n\n---\nNutzer-Antwort/Details:\n" +
    (wantsProceed ? "(User sagt: weiter)" : sanitizedAiContent)
  );
};
