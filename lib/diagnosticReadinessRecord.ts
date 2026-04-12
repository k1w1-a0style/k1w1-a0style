import { diagnosticReadinessRecordKeyForSelection } from "./storageKeys";

export type DiagnosticReadinessRecord = {
  version: 1;
  repo: string;
  branch: string;
  diagnosticOk: boolean;
  includePipelineChecks: boolean;
  focusedModes: string[];
  checkedAt: string;
};

export const buildDiagnosticReadinessRecord = (params: {
  repo: string;
  branch: string;
  diagnosticOk: boolean;
  includePipelineChecks: boolean;
  focusedModes: string[];
  checkedAt?: string;
}): DiagnosticReadinessRecord => ({
  version: 1,
  repo: String(params.repo).trim().toLowerCase(),
  branch: String(params.branch).trim(),
  diagnosticOk: Boolean(params.diagnosticOk),
  includePipelineChecks: Boolean(params.includePipelineChecks),
  focusedModes: Array.from(
    new Set((params.focusedModes ?? []).map((mode) => String(mode).trim()).filter(Boolean)),
  ),
  checkedAt: params.checkedAt ?? new Date().toISOString(),
});

export const parseDiagnosticReadinessRecord = (
  raw: string | null | undefined,
): DiagnosticReadinessRecord | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DiagnosticReadinessRecord>;
    if (parsed.version !== 1) return null;
    const repo = String(parsed.repo ?? "").trim().toLowerCase();
    const branch = String(parsed.branch ?? "").trim();
    if (!repo || !branch) return null;
    return buildDiagnosticReadinessRecord({
      repo,
      branch,
      diagnosticOk: parsed.diagnosticOk === true,
      includePipelineChecks: parsed.includePipelineChecks === true,
      focusedModes: Array.isArray(parsed.focusedModes) ? parsed.focusedModes : [],
      checkedAt:
        typeof parsed.checkedAt === "string" && parsed.checkedAt.trim()
          ? parsed.checkedAt
          : new Date().toISOString(),
    });
  } catch {
    return null;
  }
};

export const readDiagnosticReadinessRecord = async (params: {
  linkedRepo?: string | null;
  linkedBranch?: string | null;
  storageGetItem: (key: string) => Promise<string | null>;
}): Promise<DiagnosticReadinessRecord | null> => {
  const key = diagnosticReadinessRecordKeyForSelection(params);
  const raw = await params.storageGetItem(key);
  const parsed = parseDiagnosticReadinessRecord(raw);
  if (!parsed) return null;
  const repo = String(params.linkedRepo ?? "").trim().toLowerCase();
  const branch = String(params.linkedBranch ?? "").trim();
  if (!repo || !branch) return null;
  if (parsed.repo !== repo || parsed.branch !== branch) return null;
  return parsed;
};

