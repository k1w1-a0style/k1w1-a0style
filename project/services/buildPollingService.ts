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
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const errorName =
      error instanceof Error
        ? error.name
        : typeof error === "object" && error !== null && "name" in error
          ? (error as { name?: unknown }).name
          : null;
    if (errorName === "AbortError") {
      throw new Error("Request timeout - Keine Antwort vom Server");
    }
    throw error;
  }
}

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
