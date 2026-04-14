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

  const {
    created,
    updated,
    skipped,
    deleted = [],
    renamed = [],
    errors,
  } = pendingChange;
  const sourceSummary = pendingChange.sourceSummary ?? "Dateiliste stammt aus dem Builder-Flow.";

  const summaryText =
    `🤖 Provider: ${provider}` +
    (keysRotated ? ` (${keysRotated}x Key-Rotation)` : "") +
    `\n` +
    `🧠 Quelle: ${sourceSummary}\n` +
    `🆕 Neue Dateien: ${created.length}\n` +
    `✏️ Geänderte Dateien: ${updated.length}\n` +
    `🗑️ Gelöschte Dateien: ${deleted.length}\n` +
    `🔀 Umbenannt: ${renamed.length}\n` +
    `⏭️ Übersprungen: ${skipped.length}\n` +
    `🚫 Geblockt/Hinweise: ${errors?.length ?? 0}`;

  const lines: string[] = [];
  if (created.length) {
    lines.push("🆕 Neue Dateien:");
    created.forEach((p) => lines.push(`  • ${p}`));
  }
  if (updated.length) {
    lines.push("✏️ Geänderte Dateien:");
    updated.forEach((p) => lines.push(`  • ${p}`));
  }
  if (deleted.length) {
    lines.push("🗑️ Gelöschte Dateien:");
    deleted.forEach((p) => lines.push(`  • ${p}`));
  }
  if (renamed.length) {
    lines.push("🔀 Umbenannte Dateien:");
    renamed.forEach(({ from, to }) => lines.push(`  • ${from} → ${to}`));
  }
  if (skipped.length) {
    lines.push("⏭️ Übersprungene Dateien:");
    skipped.forEach((p) => lines.push(`  • ${p}`));
  }
  if (errors?.length) {
    lines.push("🚫 Geblockt/Hinweise:");
    errors.slice(0, 6).forEach((entry) => lines.push(`  • ${entry}`));
    if (errors.length > 6) {
      lines.push(`  ... und ${errors.length - 6} weitere`);
    }
  }

  const filesBlock = lines.length ? `\n\n📂 Details:\n${lines.join("\n")}` : "";
  return `✅ Änderungen erfolgreich angewendet${timing}\n\n${summaryText}${filesBlock}`;
}
