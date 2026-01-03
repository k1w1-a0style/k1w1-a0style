/**
 * Supabase Types
 * Type-Definitionen und Type Guards für Supabase API Responses
 */

import { BuildStatus, mapBuildStatus } from "./buildStatusMapper";

/**
 * Build Details aus Supabase
 */
export interface BuildDetails {
  id: number;
  github_repo?: string;
  build_profile?: string;
  build_type?: string;
  status: string;
  eas_build_id?: string | null;
  github_run_id?: string | null;
  artifact_url?: string | null;
  created_at?: string;
  updated_at?: string;
  // Fallback für zusätzliche Felder aus der DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Build Status Details mit unified Status
 */
export interface BuildStatusDetails {
  jobId: number;
  status: BuildStatus;
  urls?: {
    html?: string | null;
    artifacts?: string | null;
  };
  raw?: any;
  errorMessage?: string;
  runId?: number | null;
}

/**
 * Supabase Function Response für check-eas-build
 */
export interface CheckBuildResponse {
  ok: boolean;
  status: string;
  urls?: {
    html?: string | null;
    artifacts?: string | null;
  };
  runId?: number | null;
  run_id?: number | null;
  error?: string;
}

/**
 * Supabase Function Response für trigger-eas-build
 */
export interface TriggerBuildResponse {
  ok: boolean;
  githubDispatch?: boolean;
  buildJobCreated?: boolean;
  job?: BuildDetails;
  error?: string;
  details?: unknown;
}

/**
 * Type Guard: Prüft ob Response ein gültiges CheckBuildResponse ist
 */
export function isCheckBuildResponse(data: any): data is CheckBuildResponse {
  return data && typeof data === "object" && typeof data.status === "string";
}

/**
 * Type Guard: Prüft ob Response ein gültiges TriggerBuildResponse ist
 */
export function isTriggerBuildResponse(
  data: any,
): data is TriggerBuildResponse {
  return data && typeof data === "object" && typeof data.ok === "boolean";
}

/**
 * Type Guard: Prüft ob Response ein BuildDetails Objekt ist
 */
export function isBuildDetails(data: any): data is BuildDetails {
  return (
    data &&
    typeof data === "object" &&
    typeof data.id === "number" &&
    typeof data.status === "string"
  );
}

/**
 * Konvertiert CheckBuildResponse zu BuildStatusDetails
 */
export function toBuildStatusDetails(
  jobId: number,
  response: CheckBuildResponse,
): BuildStatusDetails {
  return {
    jobId,
    status: mapBuildStatus(response.status),
    urls: response.urls,
    raw: response,
    runId: response.runId || response.run_id || null,
    errorMessage: response.error,
  };
}

/**
 * Konvertiert BuildDetails zu BuildStatusDetails
 */
export function fromBuildDetails(details: BuildDetails): BuildStatusDetails {
  return {
    jobId: details.id,
    status: mapBuildStatus(details.status),
    urls: {
      artifacts: details.artifact_url,
    },
    raw: details,
    runId: details.github_run_id ? parseInt(details.github_run_id) : null,
  };
}
