// project/services/buildPollingService.ts
// Centralized build status polling (single source of truth)
//
// Notes:
// - Normalizes HTTP and JSON-parse errors into a simple result type.
// - Network/timeout errors are thrown (so callers can handle retry/backoff).

import { getEdgeAdminKey } from "../../infra/github/githubService";
import { mapBuildStatus } from "../../lib/buildStatusMapper";
import { getSupabaseEdgeUrl, SUPABASE_URL_MISSING_ERROR } from '../../lib/supabaseEdge';
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

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") {
      throw new Error("Request timeout - Keine Antwort vom Server");
    }
    throw error;
  }
}

function extractErrorMessage(json: any, statusCode: number): string {
  return json?.error || `HTTP ${statusCode}`;
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
  const edgeAdminKey = await getEdgeAdminKey().catch(() => null);

  const res = await fetchWithTimeout(
    `${edgeUrl}/${SUPABASE_EDGE_FUNCTIONS.CHECK_EAS_BUILD}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(edgeAdminKey ? { "x-k1w1-admin-key": edgeAdminKey } : {}),
      },
      body: JSON.stringify({ jobId }),
    },
    opts?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  );

  let json: any = null;
  try {
    json = await res.json();
  } catch (e) {
    logger.warn("[buildPollingService] JSON Parse fehlgeschlagen", { err: e });
    return { ok: false, error: "Ungültige Server-Antwort", statusCode: res.status };
  }

  if (!res.ok || !json || json.ok === false) {
    return {
      ok: false,
      error: extractErrorMessage(json, res.status),
      statusCode: res.status,
      raw: json,
    };
  }

  // Backwards-compat: support newer and older response shapes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyData: any = json ?? {};
  const job = anyData?.job ?? anyData?.data?.job ?? null;

  const rawStatus: string | undefined =
    (job?.status as string | undefined) ??
    (anyData?.status as string | undefined) ??
    (anyData?.job_status as string | undefined) ??
    undefined;

  const mapped = mapBuildStatus(rawStatus);

  const runIdRaw =
    job?.github_run_id ??
    anyData?.runId ??
    anyData?.run_id ??
    anyData?.github_run_id ??
    null;

  const runId: number | null =
    typeof runIdRaw === "number"
      ? runIdRaw
      : typeof runIdRaw === "string" && /^\d+$/.test(runIdRaw)
        ? Number(runIdRaw)
        : null;

  const urls = job?.urls ?? anyData?.urls ?? {};
  const htmlUrl = urls?.githubRun ?? urls?.html ?? urls?.run ?? urls?.runUrl ?? null;
  const artifactsUrl = urls?.artifacts ?? urls?.artifact ?? null;

  const buildUrl =
    urls?.buildUrl ??
    job?.build_url ??
    anyData?.build_url ??
    anyData?.buildUrl ??
    null;

  const downloadUrl =
    job?.download_url ??
    anyData?.download_url ??
    anyData?.downloadUrl ??
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
  };

  return {
    ok: true,
    status: mapped,
    details,
    raw: json,
  };
}