import type { PendingPlan } from "./chatAIFlowTypes";

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
  return (
    normalizedInput === "weiter" ||
    normalizedInput === "mach weiter" ||
    normalizedInput === "ok" ||
    normalizedInput === "ja" ||
    normalizedInput === "go"
  );
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

  return { hold: false, message: null };
};

export const buildPendingPlanCombinedRequest = ({
  currentPlan,
  sanitizedAiContent,
  wantsProceed,
}: {
  currentPlan: PendingPlan;
  sanitizedAiContent: string;
  wantsProceed: boolean;
}): string => {
  return (
    currentPlan.originalRequest +
    "\n\n---\nPlaner-Ausgabe:\n" +
    currentPlan.planText +
    "\n\n---\nNutzer-Antwort/Details:\n" +
    (wantsProceed ? "(User sagt: weiter)" : sanitizedAiContent)
  );
};
