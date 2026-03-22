export type PreviewEdgeErrorCode =
  | "preview_env_missing"
  | "preview_db_error"
  | "preview_payload_invalid"
  | "preview_payload_too_large"
  | "preview_not_found"
  | "preview_expired"
  | "preview_response_too_large"
  | "preview_runtime_error"
  | "preview_unknown_internal_error";

export interface PreviewEdgeErrorPayload {
  ok: false;
  code: PreviewEdgeErrorCode;
  error: string;
}

export const PREVIEW_ERROR_HEADER = "x-k1w1-preview-error";

export const PREVIEW_EDGE_ERROR_STATUS: Record<PreviewEdgeErrorCode, number> = {
  preview_env_missing: 500,
  preview_db_error: 502,
  preview_payload_invalid: 400,
  preview_payload_too_large: 413,
  preview_not_found: 404,
  preview_expired: 410,
  preview_response_too_large: 413,
  preview_runtime_error: 500,
  preview_unknown_internal_error: 500,
};

export const PREVIEW_EDGE_ERROR_MESSAGE: Record<PreviewEdgeErrorCode, string> = {
  preview_env_missing: "Preview-Server ist nicht vollständig konfiguriert.",
  preview_db_error: "Preview konnte serverseitig nicht verarbeitet werden.",
  preview_payload_invalid: "Preview-Payload ist ungueltig.",
  preview_payload_too_large: "Preview-Payload ist zu gross.",
  preview_not_found: "Preview nicht gefunden.",
  preview_expired: "Preview ist abgelaufen.",
  preview_response_too_large: "Generierte Preview ist zu gross.",
  preview_runtime_error: "Preview konnte serverseitig nicht gerendert werden.",
  preview_unknown_internal_error: "Interner Preview-Fehler.",
};

const PREVIEW_EDGE_CODES = new Set<PreviewEdgeErrorCode>([
  "preview_env_missing",
  "preview_db_error",
  "preview_payload_invalid",
  "preview_payload_too_large",
  "preview_not_found",
  "preview_expired",
  "preview_response_too_large",
  "preview_runtime_error",
  "preview_unknown_internal_error",
]);

export function isPreviewEdgeErrorCode(value: unknown): value is PreviewEdgeErrorCode {
  return typeof value === "string" && PREVIEW_EDGE_CODES.has(value as PreviewEdgeErrorCode);
}

export function createPreviewEdgeErrorPayload(
  code: PreviewEdgeErrorCode,
  message?: string,
): PreviewEdgeErrorPayload {
  return {
    ok: false,
    code,
    error: message?.trim() || PREVIEW_EDGE_ERROR_MESSAGE[code],
  };
}
