// project/services/buildPollingService.ts
// Centralized build status polling (single source of truth)
//
// Notes:
// - Normalizes HTTP and JSON-parse errors into a simple result type.
// - Network/timeout errors are thrown (so callers can handle retry/backoff).

import { getWorkflowAdminKey } from "../../infra/github/githubService";
import { fetchWithTimeout as sharedFetchWithTimeout } from "../../lib/network/fetchWithTimeout";
import { mapBuildStatus } from "../../lib/buildStatusMapper";
import { getSupabaseEdgeUrl, SUPABASE_URL_MISSING_ERROR } from '../../lib/supabaseEdge';
import { ensureSupabaseClient } from "../../lib/supabase";
import { SUPABASE_EDGE_FUNCTIONS } from "../../shared/constants/supabase";
import type { BuildStatus, BuildStatusDetails } from "../../shared/types/build";
import { logger } from "../../lib/logger";

export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export type PollBuildResult =
  | {
      ok: true;
      status: BuildStatus;
      details: BuildStatusDetails;
      raw: unknown;
    }
  | {
      ok: false;
      error: string;
      statusCode?: number;
      raw?: unknown;
    };

export { fetchWithTimeout } from "../../lib/network/fetchWithTimeout";


function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function extractErrorMessage(json: unknown, statusCode: number): string {
  const obj = asRecord(json);
  return readString(obj, "error") ?? `HTTP ${statusCode}`;
}

export function isFinalStatus(status: BuildStatus): boolean {
  return ["success", "failed", "error"].includes(status);
}

export async function pollBuildStatusOnce(
  jobId: string,
  opts?: { timeoutMs?: number },
): Promise<PollBuildResult> {
  const edgeUrl = await getSupabaseEdgeUrl();
  if (!edgeUrl) {
    return {
      ok: false,
      error: SUPABASE_URL_MISSING_ERROR,
    };
  }
  const supabase = await ensureSupabaseClient();
  const workflowAdminKey = await getWorkflowAdminKey().catch(() => null);
  const session = await supabase.auth.getSession().catch(() => null);
  const accessToken = session?.data?.session?.access_token ?? null;

  if (!accessToken) {
    return {
      ok: false,
      error: "Build-Status blockiert: Der aktuelle Supabase-Login hat keine Operator-Rolle. Erforderlich ist JWT role=build_admin (oder service_role fuer Server-Caller). build_admin wird im Betriebs-/Provisioning-Prozess ausserhalb dieses Repos per Supabase-User-Claim vergeben. Normale eingeloggte Nutzer ohne extern provisionierten build_admin-Claim sind fuer diesen Operator-Flow fail-closed blockiert.",
    };
  }
  if (!workflowAdminKey) {
    return {
      ok: false,
      error: "Build-Status blockiert: Lokaler Workflow-Admin-Key fehlt. Bitte Verbindungen pruefen.",
    };
  }

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  const res = await sharedFetchWithTimeout(`${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.CHECK_EAS_BUILD}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "x-k1w1-admin-key": workflowAdminKey,
    },
    body: JSON.stringify({ jobId }),
    timeoutMs,
    timeoutMessage: "Request timeout - Keine Antwort vom Server",
  });

  let json: unknown = null;
  try {
    json = await res.json();
  } catch (e) {
    logger.warn("[buildPollingService] JSON Parse fehlgeschlagen", { err: e });
    return { ok: false, error: "Ungültige Server-Antwort", statusCode: res.status };
  }

  const responseObject = asRecord(json);
  if (!res.ok || !responseObject || responseObject.ok === false) {
    return {
      ok: false,
      error: extractErrorMessage(json, res.status),
      statusCode: res.status,
      raw: json,
    };
  }

  // Backwards-compat: support newer and older response shapes
  const dataRecord = asRecord(responseObject.data);
  const job = asRecord(responseObject.job) ?? asRecord(dataRecord?.job) ?? null;

  const rawStatus: string | undefined =
    readString(job, "status") ??
    readString(responseObject, "status") ??
    readString(responseObject, "job_status") ??
    undefined;

  const mapped = mapBuildStatus(rawStatus);

  const runIdRaw =
    job?.github_run_id ??
    responseObject.runId ??
    responseObject.run_id ??
    responseObject.github_run_id ??
    null;

  const runId: number | null =
    typeof runIdRaw === "number"
      ? runIdRaw
      : typeof runIdRaw === "string" && /^\d+$/.test(runIdRaw)
        ? Number(runIdRaw)
        : null;

  const urls = asRecord(job?.urls) ?? asRecord(responseObject.urls) ?? null;
  const htmlUrl =
    readString(urls, "githubRun") ??
    readString(urls, "html") ??
    readString(urls, "run") ??
    readString(urls, "runUrl");
  const artifactsUrl = readString(urls, "artifacts") ?? readString(urls, "artifact");

  const buildUrl =
    readString(urls, "buildUrl") ??
    readString(job, "build_url") ??
    readString(responseObject, "build_url") ??
    readString(responseObject, "buildUrl") ??
    null;

  const downloadUrl =
    readString(job, "download_url") ??
    readString(responseObject, "download_url") ??
    readString(responseObject, "downloadUrl") ??
    null;

  const sourceCommitSha =
    readString(job, "source_commit_sha") ??
    readString(responseObject, "source_commit_sha") ??
    readString(dataRecord, "source_commit_sha") ??
    null;

  const details: BuildStatusDetails = {
    jobId,
    status: mapped,
    urls: {
      html: htmlUrl,
      artifacts: artifactsUrl,
      // Priority: direct download_url → artifacts page → EAS build url
      buildUrl:
        (typeof downloadUrl === "string" && downloadUrl.trim() ? downloadUrl : null) ??
        (typeof artifactsUrl === "string" && artifactsUrl.trim() ? artifactsUrl : null) ??
        (typeof buildUrl === "string" && buildUrl.trim() ? buildUrl : null) ??
        null,
    },
    raw: json,
    runId: runId ?? null,
    sourceCommitSha,
  };

  return {
    ok: true,
    status: mapped,
    details,
    raw: json,
  };
}
