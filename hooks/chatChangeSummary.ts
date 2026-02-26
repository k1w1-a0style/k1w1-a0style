// hooks/chatChangeSummary.ts
// Pure helper for building the post-apply confirmation text.

import type { PendingChange } from "./chatAIFlowTypes";

function formatTiming(durationMs?: number | null): string {
  if (!durationMs || !Number.isFinite(durationMs)) return "";
  return ` (${(durationMs / 1000).toFixed(1)}s)`;
}

export function buildChangeConfirmationText(pendingChange: PendingChange): string {
  const timing = formatTiming(pendingChange.aiResponse?.timing?.durationMs ?? null);
  const provider = pendingChange.aiResponse?.provider || "unbekannt";
  const keysRotated = pendingChange.aiResponse?.keysRotated;

  const { created, updated, skipped } = pendingChange;

  const summaryText =
    `🤖 Provider: ${provider}` +
    (keysRotated ? ` (${keysRotated}x Key-Rotation)` : "") +
    `\n` +
    `🆕 Neue Dateien: ${created.length}\n` +
    `✏️ Geänderte Dateien: ${updated.length}\n` +
    `⏭️ Übersprungen: ${skipped.length}`;

  const lines: string[] = [];
  if (created.length) {
    lines.push("🆕 Neue Dateien:");
    created.forEach((p) => lines.push(`  • ${p}`));
  }
  if (updated.length) {
    lines.push("✏️ Geänderte Dateien:");
    updated.forEach((p) => lines.push(`  • ${p}`));
  }
  if (skipped.length) {
    lines.push("⏭️ Übersprungene Dateien:");
    skipped.forEach((p) => lines.push(`  • ${p}`));
  }

  const filesBlock = lines.length ? `\n\n📂 Details:\n${lines.join("\n")}` : "";
  return `✅ Änderungen erfolgreich angewendet${timing}\n\n${summaryText}${filesBlock}`;
}
