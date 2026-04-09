import { logger } from "../../../lib/logger";

export function consumeChatPrefillText(params: {
  prefillText: string | undefined;
  currentTextInput: string;
  setTextInput: (next: string | ((prev: string) => string)) => void;
  clearPrefillText: () => void;
}): void {
  const prefill = params.prefillText;
  if (typeof prefill !== "string" || !prefill.trim()) return;

  if (!params.currentTextInput) {
    params.setTextInput(prefill);
  }

  try {
    params.clearPrefillText();
  } catch (error: unknown) {
    logger.warn("[useChatScreen] prefill param cleanup failed", { error });
  }
}
