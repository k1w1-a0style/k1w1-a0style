import { normalizeAiResponseDetailed } from "../lib/normalizer";

type NormalizedAiFiles = Array<{ path: string; content: string }>;

type NormalizedAiResult = {
  files: NormalizedAiFiles | null;
  deletePaths: string[];
  renames: Array<{ from: string; to: string }>;
  parseError: string;
  responseText: string;
};

const toTrimmedText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const normalizeResultFiles = (raw: unknown): NormalizedAiResult => {
  const normalizedResult = normalizeAiResponseDetailed(raw);
  return {
    files: normalizedResult?.files?.length ? normalizedResult.files : null,
    deletePaths: normalizedResult?.deletePaths ?? [],
    renames: normalizedResult?.renames ?? [],
    parseError: toTrimmedText(normalizedResult?.parseError),
    responseText: toTrimmedText(normalizedResult?.responseText),
  };
};

export const readBuilderFilesOrThrow = (
  normalizedResult: NormalizedAiResult,
  aiText: string,
): NormalizedAiFiles => {
  if (normalizedResult.files && normalizedResult.files.length > 0) {
    return normalizedResult.files;
  }

  const rawText = normalizedResult.responseText || toTrimmedText(aiText);
  if (rawText.length > 0) {
    const preview = rawText.slice(0, 900);
    const parseHint = normalizedResult.parseError
      ? ` [Normalizer: ${normalizedResult.parseError}]`
      : "";

    throw new Error(
      "Builder hat keine gültige JSON-Dateiliste geliefert. " +
        `Ich konnte daher keine Dateien anwenden.${parseHint}\n\n` +
        "KI-Antwort (gekürzt):\n" +
        preview,
    );
  }

  throw new Error(
    "Builder/Normalizer konnte keine verwertbare Dateiliste erzeugen.",
  );
};
