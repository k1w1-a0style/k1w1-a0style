export type ChatAiFlowSummaryInput = {
  isAutoFix: boolean;
  sourceSummary: string;
  explainText: string;
  preflightIntro: string;
  created: string[];
  updated: string[];
  deleted?: string[];
  renamed?: Array<{ from: string; to: string }>;
  skipped: string[];
  errors?: string[];
  buildPathBulletList: (paths: string[], previewLimit: number) => string;
};

export const buildAiProposalSummary = ({
  isAutoFix,
  sourceSummary,
  explainText,
  preflightIntro,
  created,
  updated,
  deleted = [],
  renamed = [],
  skipped,
  errors,
  buildPathBulletList,
}: ChatAiFlowSummaryInput): string => {
  const prefix = isAutoFix
    ? "🤖 **Auto-Fix Vorschlag:**"
    : "🤖 Die KI möchte folgende Änderungen vornehmen:";

  return (
    `${prefix}\n\n` +
    `${preflightIntro}\n\n` +
    `🧠 **Quelle der finalen Dateiliste:** ${sourceSummary}\n\n` +
    (explainText
      ? `🧾 **Kurz erklärt (warum/was):**\n${explainText}\n\n---\n\n`
      : "") +
    `📝 **Neue Dateien** (${created.length}):\n` +
    buildPathBulletList(created, 6) +
    `\n\n` +
    `📝 **Geänderte Dateien** (${updated.length}):\n` +
    buildPathBulletList(updated, 6) +
    `\n\n` +
    `🗑 **Gelöschte Dateien** (${deleted.length}):\n` +
    buildPathBulletList(deleted, 6) +
    `\n\n` +
    `🔀 **Umbenannte Dateien** (${renamed.length}):\n` +
    buildPathBulletList(renamed.map((entry) => `${entry.from} → ${entry.to}`), 6) +
    (!isAutoFix
      ? `\n\n⏭ **Übersprungen** (${skipped.length}):\n` +
        buildPathBulletList(skipped, 3)
      : "") +
    (errors?.length
      ? `\n\n🚫 **Geblockt/Hinweise** (${errors.length}):\n` +
        errors.slice(0, 4).map((e) => `  • ${e}`).join("\n") +
        (errors.length > 4
          ? `\n  ... und ${errors.length - 4} weitere`
          : "")
      : "") +
    `\n\nMöchtest du diese Änderungen übernehmen?`
  );
};
