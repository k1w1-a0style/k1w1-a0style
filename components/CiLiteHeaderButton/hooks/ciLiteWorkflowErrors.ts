import { safeUi } from "../../ciLite/ciLiteUtils";
import {
  describeLocalEdgeAdminKeyIssue,
  inferLocalEdgeAdminKeyIssueKind,
} from "../../../screens/CredentialsWizardScreen/utils/localAdminKey";

export type CiLiteWorkflowErrorCode =
  | "missing_github_token"
  | "invalid_or_missing_local_admin_key"
  | "workflow_not_found"
  | "workflow_lookup_not_scoped"
  | "workflow_run_contract_mismatch"
  | "workflow_run_ambiguous"
  | "forbidden"
  | "upstream_http_error"
  | "timeout"
  | "unknown";

export type CiLiteWorkflowErrorContext = "dispatch" | "lookup" | "artifact";

type JsonRecord = Record<string, unknown>;

type NormalizeCiLiteWorkflowErrorParams = {
  context: CiLiteWorkflowErrorContext;
  adminKey?: string | null;
  statusCode?: number | null;
  statusText?: string | null;
  payload?: unknown;
  text?: string | null;
  note?: string | null;
  error?: unknown;
};

export type CiLiteWorkflowError = {
  code: CiLiteWorkflowErrorCode;
  statusCode: number | null;
  detail: string;
  userMessage: string;
};


export type CiLiteLookupFailureKind = "timeout" | "contract_mismatch" | "ambiguous";

export function buildCiLiteLookupFailureMessage(params: {
  workflowLabel: string;
  kind: CiLiteLookupFailureKind;
  hasExistingRunCandidate?: boolean;
}): string {
  const workflowLabel = safeUi(params.workflowLabel || "Workflow");

  if (params.kind === "ambiguous") {
    return `${workflowLabel} wurde gestartet und GitHub hat mehrere frische Kandidaten geliefert, aber keine eindeutige Zuordnung war möglich. Bitte den Ziel-Workflow auf den aktuellen job_id-Correlation-Contract aktualisieren oder den gewünschten Run manuell öffnen.`;
  }

  if (params.kind === "contract_mismatch") {
    return params.hasExistingRunCandidate
      ? `${workflowLabel} wurde gestartet und ein plausibler GitHub-Run existiert, aber der Ziel-Workflow erfüllt den erwarteten Correlation-Contract nicht vollständig. Bitte den Workflow auf den aktuellen job_id-Correlation-Contract aktualisieren oder den Run manuell öffnen.`
      : `${workflowLabel} wurde gestartet, aber der Ziel-Workflow erfüllt den erwarteten Correlation-Contract nicht vollständig. Bitte den Workflow auf den aktuellen job_id-Correlation-Contract aktualisieren.`;
  }

  return `${workflowLabel} wurde gestartet, aber kein passender Run gefunden (Timeout). Bitte Run-Übersicht öffnen.`;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function collectStrings(payload: JsonRecord | null): string[] {
  if (!payload) return [];

  const details = asRecord(payload.details);
  const missing = Array.isArray(payload.missing)
    ? payload.missing
    : Array.isArray(details?.missing)
      ? details?.missing
      : [];

  return [
    readString(payload.error),
    readString(payload.message),
    readString(payload.hint),
    readString(payload.required),
    readString(details?.error),
    readString(details?.message),
    readString(details?.hint),
    readString(details?.required),
    ...missing.map((entry) => readString(entry)).filter(Boolean),
  ].filter(Boolean);
}

function parsePayloadFromText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function readCiLiteErrorResponse(response: Response): Promise<{ payload: unknown; text: string }> {
  const text = await response.text().catch(() => "");
  const payload = parsePayloadFromText(text);
  return { payload, text };
}

function buildAdminKeyMessage(context: CiLiteWorkflowErrorContext, reason: string): string {
  const normalizedReason = reason
    .replace(/Edge Admin Key/g, "Workflow Admin Key")
    .replace(/edge admin key/g, "workflow admin key");
  if (context === "artifact") {
    return `CI Lite Ergebnisabruf blockiert: ${normalizedReason}`;
  }
  if (context === "lookup") {
    return `CI Lite Workflow-Run-Lookup blockiert: ${normalizedReason}`;
  }
  return `CI Lite Dispatch blockiert: ${normalizedReason}`;
}

function buildMissingGitHubTokenMessage(context: CiLiteWorkflowErrorContext): string {
  if (context === "artifact") {
    return "CI Lite Ergebnisabruf blockiert: GitHub-Token fehlt auf dem Edge-Server. Bitte GITHUB_TOKEN/GH_TOKEN dort konfigurieren.";
  }
  if (context === "lookup") {
    return "CI Lite Workflow-Run-Lookup blockiert: GitHub-Token fehlt auf dem Edge-Server. Bitte GITHUB_TOKEN/GH_TOKEN dort konfigurieren.";
  }
  return "CI Lite Dispatch blockiert: GitHub-Token fehlt auf dem Edge-Server. Bitte GITHUB_TOKEN/GH_TOKEN dort konfigurieren.";
}

function buildWorkflowNotFoundMessage(detail: string): string {
  const suffix = detail ? ` (${safeUi(detail)})` : "";
  return `CI Lite Dispatch blockiert: Workflow-Datei/Workflow auf dem gewählten Branch nicht gefunden.${suffix}`;
}

function buildForbiddenMessage(context: CiLiteWorkflowErrorContext, detail: string): string {
  const base =
    context === "artifact"
      ? "CI Lite Ergebnisabruf wurde vom Server verweigert."
      : context === "lookup"
        ? "CI Lite Workflow-Run-Lookup wurde vom Server verweigert."
        : "CI Lite Dispatch wurde vom Server verweigert.";
  return detail ? `${base} ${safeUi(detail)}` : base;
}

function buildTimeoutMessage(context: CiLiteWorkflowErrorContext): string {
  if (context === "lookup") {
    return "CI Lite Workflow-Run-Lookup ist in ein Timeout gelaufen. Bitte erneut versuchen oder die Run-Übersicht prüfen.";
  }
  if (context === "artifact") {
    return "CI Lite Ergebnisabruf ist in ein Timeout gelaufen. Bitte Run öffnen oder erneut versuchen.";
  }
  return "CI Lite Dispatch ist in ein Timeout gelaufen. Bitte erneut versuchen.";
}

function buildUpstreamHttpMessage(context: CiLiteWorkflowErrorContext, statusCode: number | null, detail: string): string {
  const base =
    context === "artifact"
      ? "CI Lite Ergebnisabruf fehlgeschlagen"
      : context === "lookup"
        ? "CI Lite Workflow-Run-Lookup fehlgeschlagen"
        : "CI Lite Dispatch fehlgeschlagen";

  const statusPart = statusCode ? ` (HTTP ${statusCode})` : "";
  const detailPart = detail ? `: ${safeUi(detail)}` : ".";
  return `${base}${statusPart}${detailPart}`;
}

export function normalizeCiLiteWorkflowError(
  params: NormalizeCiLiteWorkflowErrorParams,
): CiLiteWorkflowError {
  const payload = asRecord(params.payload);
  const strings = collectStrings(payload);
  const detail = [
    ...strings,
    readString(params.note),
    readString(params.text),
    readString(params.statusText),
    readString(params.error instanceof Error ? params.error.message : params.error),
  ].filter(Boolean)[0] ?? "";
  const normalizedDetail = safeUi(detail);
  const combined = [
    ...strings,
    readString(params.note),
    readString(params.text),
    readString(params.statusText),
    readString(params.error instanceof Error ? params.error.message : params.error),
  ]
    .join(" | ")
    .toLowerCase();

  if (readString(params.note)) {
    return {
      code: "workflow_lookup_not_scoped",
      statusCode: params.statusCode ?? null,
      detail: normalizedDetail,
      userMessage: `Workflow-Run-Lookup ist nicht workflow-spezifisch abgesichert (${safeUi(readString(params.note))}).`,
    };
  }
  const adminKeyIssue = inferLocalEdgeAdminKeyIssueKind({
    adminKey: params.adminKey,
    statusCode: params.statusCode,
    error: detail || params.error,
  });
  const prioritizeAdminKeyIssue =
    adminKeyIssue === "rejected" ||
    ((adminKeyIssue === "missing" || adminKeyIssue === "invalid") &&
      (!params.statusCode || params.statusCode === 401 || params.statusCode === 403));

  if (prioritizeAdminKeyIssue) {
    const adminReason = describeLocalEdgeAdminKeyIssue({
      adminKey: params.adminKey,
      statusCode: params.statusCode,
      error: detail || params.error,
    });

    return {
      code: "invalid_or_missing_local_admin_key",
      statusCode: params.statusCode ?? null,
      detail: normalizedDetail,
      userMessage: buildAdminKeyMessage(params.context, adminReason || normalizedDetail),
    };
  }



  if (
    combined.includes("missing github token") ||
    combined.includes("github token for artifact lookup") ||
    combined.includes("github_token") ||
    combined.includes("gh_token")
  ) {
    return {
      code: "missing_github_token",
      statusCode: params.statusCode ?? null,
      detail: normalizedDetail,
      userMessage: buildMissingGitHubTokenMessage(params.context),
    };
  }

  if (
    params.context === "dispatch" &&
    (params.statusCode === 404 ||
      combined.includes("workflow not found") ||
      combined.includes("workflow missing") ||
      combined.includes("workflow-datei") ||
      combined.includes(".github/workflows"))
  ) {
    return {
      code: "workflow_not_found",
      statusCode: params.statusCode ?? null,
      detail: normalizedDetail,
      userMessage: buildWorkflowNotFoundMessage(normalizedDetail),
    };
  }

  if (
    params.statusCode === 408 ||
    params.statusCode === 504 ||
    combined.includes("timeout") ||
    combined.includes("timed out") ||
    combined.includes("abort")
  ) {
    return {
      code: "timeout",
      statusCode: params.statusCode ?? null,
      detail: normalizedDetail,
      userMessage: buildTimeoutMessage(params.context),
    };
  }

  if (params.statusCode === 403 || combined.includes("forbidden")) {
    return {
      code: "forbidden",
      statusCode: params.statusCode ?? null,
      detail: normalizedDetail,
      userMessage: buildForbiddenMessage(params.context, normalizedDetail),
    };
  }

  if (typeof params.statusCode === "number" && params.statusCode >= 400) {
    return {
      code: "upstream_http_error",
      statusCode: params.statusCode,
      detail: normalizedDetail,
      userMessage: buildUpstreamHttpMessage(params.context, params.statusCode, normalizedDetail),
    };
  }

  return {
    code: "unknown",
    statusCode: params.statusCode ?? null,
    detail: normalizedDetail,
    userMessage: normalizedDetail || "Unbekannter CI-Lite-Fehler.",
  };
}
