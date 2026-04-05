export const getExplainFallbackNoticeText = (): string => {
  return "ℹ️ Konnte die Kurz-Erklärung für die Änderungen nicht erzeugen. Dateien können trotzdem übernommen werden.";
};

export const getXssSanitizationNoticeText = (): string => {
  return "ℹ️ Eingabe enthielt auffällige Script-/XSS-Muster und wurde vor dem AI-Flow bereinigt. Der Flow läuft mit der sanitizten Eingabe weiter.";
};

export const getBuilderFlowErrorNoticeText = (message?: string): string => {
  return `⚠️ ${message || "Es ist ein Fehler im Builder-Flow aufgetreten."}`;
};

export const getEmptyMessageNoticeText = (): string => {
  return "⚠️ Nachricht ist leer.";
};
