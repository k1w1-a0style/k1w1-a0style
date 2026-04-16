import { diagnosticReadinessRecordKeyForSelection } from "./storageKeys";
import { computeProjectFilesSignature } from "./repoSyncOrchestration";
import type { ProjectFile } from "../shared/types/project";

export type DiagnosticReadinessRecord = {
  version: 2;
  repo: string;
  branch: string;
  projectFingerprint: string;
  diagnosticOk: boolean;
  includePipelineChecks: boolean;
  focusedModes: string[];
  checkedAt: string;
};

export const computeDiagnosticProjectFingerprint = (files: ProjectFile[]): string =>
  computeProjectFilesSignature(files);

export const buildDiagnosticReadinessRecord = (params: {
  repo: string;
  branch: string;
  projectFingerprint: string;
  diagnosticOk: boolean;
  includePipelineChecks: boolean;
  focusedModes: string[];
  checkedAt?: string;
}): DiagnosticReadinessRecord => ({
  version: 2,
  repo: String(params.repo).trim().toLowerCase(),
  branch: String(params.branch).trim(),
  projectFingerprint: String(params.projectFingerprint ?? "").trim(),
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
    if (parsed.version !== 2) return null;
    const repo = String(parsed.repo ?? "").trim().toLowerCase();
    const branch = String(parsed.branch ?? "").trim();
    const projectFingerprint = String(parsed.projectFingerprint ?? "").trim();
    if (!repo || !branch || !projectFingerprint) return null;
    return buildDiagnosticReadinessRecord({
      repo,
      branch,
      projectFingerprint,
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
  projectFiles?: ProjectFile[] | null;
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
  if (Array.isArray(params.projectFiles)) {
    const currentFingerprint = computeDiagnosticProjectFingerprint(params.projectFiles);
    if (parsed.projectFingerprint !== currentFingerprint) return null;
  }
  return parsed;
};
