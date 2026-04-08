import { isPreviewEdgeErrorCode, type PreviewEdgeErrorCode } from "../../shared/previewErrorContract";
import { EMPTY_REMOTE_PREVIEW_FILES_ERROR, PREVIEW_EDGE_ERROR_MESSAGES } from "./constants";

export type PreviewInvokeError = Error & {
  status?: number;
  code?: PreviewEdgeErrorCode;
};

export function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/** Simple DJB2 string hash for fingerprinting. */
export function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function getPreviewEdgeErrorCode(error: unknown): PreviewEdgeErrorCode | null {
  const readCode = (value: unknown): unknown => {
    if (!value || typeof value !== "object") return null;
    return (value as { code?: unknown }).code;
  };

  const directCode = readCode(error);
  if (isPreviewEdgeErrorCode(directCode)) return directCode;

  if (error && typeof error === "object") {
    const response = (error as { response?: unknown }).response;
    const nestedCode = readCode(response);
    if (isPreviewEdgeErrorCode(nestedCode)) return nestedCode;
  }

  return null;
}

export function describeRemotePreviewFailure(params: {
  bearerJwt?: string | null;
  statusCode?: number | null;
  error: unknown;
}): string {
  const message =
    params.error instanceof Error
      ? params.error.message
      : typeof params.error === "string"
        ? params.error
        : "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("timeout") ||
    normalized.includes("network request failed") ||
    normalized.includes("fetch failed") ||
    normalized.includes("not reachable")
  ) {
    return "Preview-Server derzeit nicht erreichbar.";
  }

  const errorCode = getPreviewEdgeErrorCode(params.error);
  if (errorCode) {
    return PREVIEW_EDGE_ERROR_MESSAGES[errorCode];
  }

  if (
    normalized.includes("files fehlt/leer") ||
    normalized.includes("no valid files") ||
    normalized.includes("keine zulaessigen projektdateien")
  ) {
    return EMPTY_REMOTE_PREVIEW_FILES_ERROR;
  }

  if (!String(params.bearerJwt ?? "").trim()) {
    return "Remote-Preview blockiert: Supabase-Login-JWT fehlt oder ist lokal nicht verfuegbar.";
  }

  if (
    params.statusCode === 401 ||
    params.statusCode === 403 ||
    normalized.includes("bearer") ||
    normalized.includes("jwt") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden")
  ) {
    return "Remote-Preview blockiert: Der aktuelle Supabase-Login-JWT wurde vom Preview-Edge-Vertrag abgelehnt.";
  }

  return "Remote-Preview konnte nicht zuverlässig bereitgestellt werden.";
}

export function buildPreviewInvokeError(
  message: string,
  status?: number,
  code?: PreviewEdgeErrorCode,
): PreviewInvokeError {
  const error = new Error(message) as PreviewInvokeError;
  if (typeof status === "number") {
    error.status = status;
  }
  if (code) {
    error.code = code;
  }
  return error;
}
