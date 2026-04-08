import type { ParsedPreviewPageRequest } from "./contracts.ts";

function parseToggleParam(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function parsePreviewPageRequest(req: Request): ParsedPreviewPageRequest {
  const url = new URL(req.url);
  const headerSecret = req.headers.get("x-k1w1-preview-secret") ?? "";

  return {
    url,
    headerSecret,
    secret: headerSecret,
    showRawLogs: parseToggleParam(url.searchParams.get("logs")),
    showRuntimeErrors: parseToggleParam(url.searchParams.get("runtime_errors")),
    transport: (url.searchParams.get("transport") ?? "").trim().toLowerCase(),
  };
}

export function withToggleUrl(params: {
  baseUrl: URL;
  showRawLogs: boolean;
  showRuntimeErrors: boolean;
  secretHash?: string;
}): string {
  const { baseUrl, showRawLogs, showRuntimeErrors, secretHash } = params;
  const url = new URL(baseUrl.toString());
  url.searchParams.set("logs", showRawLogs ? "1" : "0");
  url.searchParams.set("runtime_errors", showRuntimeErrors ? "1" : "0");
  const next = url.toString();
  if (!secretHash) return next;
  return `${next}#secret=${encodeURIComponent(secretHash)}`;
}

export function formatPreviewTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16).replace("T", " ");
}
