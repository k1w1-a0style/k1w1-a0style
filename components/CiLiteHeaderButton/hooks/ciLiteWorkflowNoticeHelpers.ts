const ARTIFACT_DETAIL_MAX = 180;

export function sanitizeArtifactDetail(input: string): string {
  const singleLine = String(input || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!singleLine) return "";

  const redacted = singleLine
    .replace(/(github_pat_[A-Za-z0-9_]+)/gi, "[redacted-token]")
    .replace(/(gh[pousr]_[A-Za-z0-9_]+)/gi, "[redacted-token]")
    .replace(/(x-k1w1-admin-key\s*[:=]\s*)([^\s,;]+)/gi, "$1[redacted]")
    .replace(/(authorization\s*[:=]\s*bearer\s+)([^\s,;]+)/gi, "$1[redacted]");

  if (redacted.length <= ARTIFACT_DETAIL_MAX) return redacted;
  return `${redacted.slice(0, ARTIFACT_DETAIL_MAX)}…`;
}

export function getArtifactUiMessage(params: {
  artifactError: string | null;
  workflowStatus?: string | null;
  workflowConclusion?: string | null;
}): string {
  if (!params.artifactError) return "";

  const detail = sanitizeArtifactDetail(params.artifactError);
  const detailSuffix = detail ? ` Detail: ${detail}` : "";

  const status = String(params.workflowStatus ?? "").trim().toLowerCase();
  const conclusion = String(params.workflowConclusion ?? "").trim().toLowerCase();
  if (status === "completed" && conclusion === "success") {
    return `Workflow war erfolgreich, aber das Ergebnis-Artefakt konnte nicht geladen werden. Bitte Run öffnen oder erneut starten.${detailSuffix}`;
  }

  return `Zusätzliche Ergebnisdaten zum Run konnten nicht geladen werden. Bitte Run öffnen oder erneut starten.${detailSuffix}`;
}
