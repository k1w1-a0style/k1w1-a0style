export type IntentConfirmationPayload = {
  intent: string;
  confidence: number;
  reason: string;
};

export const buildIntentConfirmationMessage = (
  payload: IntentConfirmationPayload,
): string => {
  return (
    "🤔 **Kurze Intent-Bestätigung:** Soll ich zuerst planen/fragen oder direkt einen Build-Vorschlag erzeugen?\n\n" +
    `Aktuelle Einschätzung: \`${payload.intent}\` (Confidence ${Math.round(payload.confidence * 100)}%, Grund: ${payload.reason}).\n\n` +
    "Antwortoptionen: `planen` oder `direkt build`."
  );
};

export const buildPlannerPreviewMessage = (
  planText: string,
  guardPolicyPreHint: string,
): string => {
  return (
    "🧩 **Kurz bevor ich Code anfasse:**\n\n" +
    guardPolicyPreHint +
    "\n\n" +
    planText +
    "\n\n🔒 **Hinweis zu Guarded-Pfaden:** Kritische/manual-only oder baseline/read-only Dateien setze ich nicht blind um; ich markiere sie vor dem Apply explizit.\n\n" +
    '➡️ Antworte kurz auf die Fragen **oder** sag „weiter", dann starte ich den Build.'
  );
};
