// project/services/buildPollingService.ts
// Centralized build status polling (single source of truth)
//
// Notes:
// - Normalizes HTTP and JSON-parse errors into a simple result type.
// - Network/timeout errors are thrown (so callers can handle retry/backoff).

import AsyncStorage from "@react-native-async-storage/async-storage";

import { CONFIG } from "../../config";
import { getEdgeAdminKey } from "../../contexts/githubService";
import { BuildStatus, mapBuildStatus } from "../../lib/buildStatusMapper";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import { BuildStatusDetails } from "../../lib/supabaseTypes";

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

export async function getSupabaseEdgeUrl(): Promise<string> {
  const storedUrl = await AsyncStorage.getItem(STORAGE_KEYS.SUPABASE_URL).catch(
    () => null,
  );

  const runtimeUrl =
    storedUrl ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((typeof process !== "undefined"
      ? (process as any).env?.EXPO_PUBLIC_SUPABASE_URL
      : null) as string | null) ||
    null;

  if (runtimeUrl) {
    return `${runtimeUrl.replace(/\/$/, "")}/functions/v1`;
  }

  return CONFIG.API.SUPABASE_EDGE_URL;
}

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
  const edgeAdminKey = await getEdgeAdminKey().catch(() => null);

  const res = await fetchWithTimeout(
    `${edgeUrl}/check-eas-build`,
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
    console.warn("[buildPollingService] JSON Parse fehlgeschlagen:", e);
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

  const mapped = mapBuildStatus(json.status);

  const details: BuildStatusDetails = {
    jobId,
    status: mapped,
    urls: json.urls ?? undefined,
    raw: json,
    runId: json.runId || json.run_id || null,
  };

  return {
    ok: true,
    status: mapped,
    details,
    raw: json,
  };
}
