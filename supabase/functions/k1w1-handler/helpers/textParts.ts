type TextPartRecord = { text?: unknown; type?: unknown };

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object");
}

function readTextPartValue(part: unknown): string {
  const record = asRecord(part);
  if (!record) return "";
  return typeof record.text === "string" ? record.text : "";
}

export function readGeminiTextParts(value: unknown): string {
  return asRecordArray(value)
    .map((part) => readTextPartValue(part))
    .filter(Boolean)
    .join("\n");
}

export function readAnthropicTextParts(value: unknown): string {
  return asRecordArray(value)
    .map((part) => {
      const record = asRecord(part) as TextPartRecord | null;
      if (!record || record.type !== "text") return "";
      return typeof record.text === "string" ? record.text : "";
    })
    .filter(Boolean)
    .join("\n");
}
