export type JsonRecord = Record<string, unknown>;

export const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

export const readJsonRecordSafe = async (response: Response): Promise<JsonRecord> => {
  try {
    const json = await response.json();
    return isJsonRecord(json) ? json : {};
  } catch {
    return {};
  }
};

export const readJsonArraySafe = async (response: Response): Promise<JsonRecord[]> => {
  try {
    const json = await response.json();
    return Array.isArray(json) ? json.filter(isJsonRecord) : [];
  } catch {
    return [];
  }
};

export const readStringField = (record: JsonRecord, key: string): string => {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
};

export const readGitHubMessage = (record: JsonRecord): string =>
  readStringField(record, "message");


export const readRecordArrayField = (record: JsonRecord, key: string): JsonRecord[] => {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isJsonRecord);
};

export const readNestedSha = (record: JsonRecord, parentKey: string): string => {
  const parent = record[parentKey];
  if (!isJsonRecord(parent)) return "";
  return readStringField(parent, "sha");
};

export const hasGitHubErrorMessageContaining = (record: JsonRecord, needle: string): boolean => {
  return readRecordArrayField(record, "errors").some((entry) => {
    const message = readStringField(entry, "message");
    return message.includes(needle);
  });
};

export const readBooleanField = (record: JsonRecord, key: string): boolean => {
  const value = record[key];
  return typeof value === "boolean" ? value : false;
};

export const readNumberField = (record: JsonRecord, key: string): number | null => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};
