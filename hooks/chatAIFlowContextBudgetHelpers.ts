export const extractContextBudgetNotice = (
  llmMessages: Array<{ role: string; content: string }>,
): string => {
  for (const message of llmMessages) {
    if (message.role !== "system") continue;
    const content = String(message.content ?? "");
    const match = content.match(/\[intern\]\s*(Kontext gekürzt \([^)]+\)\.)/i);
    if (match?.[1]) {
      const baseNotice = `🏷️ **Kontext gekürzt:** ${match[1]}`;
      const snapshotDropMatch = match[1].match(/Snapshot-Dateien:\s*-(\d+)/i);
      const trimmedFilesMatch = match[1].match(/Dateiausschnitte gekürzt:\s*(\d+)/i);
      const droppedFiles = Number(snapshotDropMatch?.[1] ?? "0");
      const trimmedFiles = Number(trimmedFilesMatch?.[1] ?? "0");
      const isLargeTaskSignal = droppedFiles >= 4 || trimmedFiles >= 4;

      if (isLargeTaskSignal) {
        return (
          `${baseNotice}\n` +
          "➡️ **Hinweis große Aufgabe:** Teile den Auftrag in 2–4 Blöcke (Analyse → Plan → Patch-Schritte → Recheck), " +
          "damit der Kontext pro Schritt stabil bleibt."
        );
      }

      return baseNotice;
    }
  }
  return "";
};
