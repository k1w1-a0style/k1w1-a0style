export const extractContextBudgetNotice = (
  llmMessages: Array<{ role: string; content: string }>,
): string => {
  for (const message of llmMessages) {
    if (message.role !== "system") continue;
    const content = String(message.content ?? "");
    const match = content.match(/\[intern\]\s*(Kontext gekürzt \([^)]+\)\.)/i);
    if (match?.[1]) {
      return `🏷️ **Kontext gekürzt:** ${match[1]}`;
    }
  }
  return "";
};
