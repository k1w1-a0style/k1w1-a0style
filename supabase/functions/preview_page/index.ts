// supabase/functions/preview_page/index.ts
// Thin route/orchestration facade for preview page delivery.

import {
  MAX_FILES_BYTES,
  approxFilesPayloadSize,
  classifyPreviewPageUnexpectedError,
  getRequestClientIp,
  getRequestRateLimitSubject,
  hashPreviewSecret,
  html,
  htmlPreviewError,
  isHashedPreviewSecret,
  isValidPreviewSecretFormat,
  previewPageErrorResponse,
  randomNonce,
  rateLimit,
  requireDurableRateLimit,
  sanitizeErrorText,
} from "./helpers.ts";
import type { PreviewRecord } from "./helpers.ts";
import type { PreviewMeta } from "./contracts.ts";
import { deletePreviewRecord, fetchPreviewRecord, isExpired } from "./store.ts";
import { formatPreviewTimestamp, parsePreviewPageRequest, withToggleUrl } from "./request.ts";
import { renderFragmentBootstrapPage, renderPage, renderPreviewResponse } from "./render.ts";

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return previewPageErrorResponse({
      code: "preview_payload_invalid",
      nonce: randomNonce(),
      title: "Method not allowed",
      message: "Preview page accepts GET/HEAD only.",
      status: 405,
    });
  }

  const durableRl = await requireDurableRateLimit(req, {
    scope: "preview_page",
    subject: getRequestRateLimitSubject(req),
    max: 60,
    windowMs: 60_000,
    enforceDurable: true,
  });
  if (durableRl) return durableRl;

  const rl = rateLimit(req, "preview_page", 60, 60_000);
  if (rl) return rl;

  const started = Date.now();
  const ip = getRequestClientIp(req);

  try {
    const { url, headerSecret, secret, showRawLogs, showRuntimeErrors, transport } = parsePreviewPageRequest(req);
    const nonce = randomNonce();

    if (!secret) {
      if (transport === "fragment") {
        return html(renderFragmentBootstrapPage({ nonce }), nonce, 200);
      }
      return html(
        `<!doctype html><meta charset="utf-8"><title>Missing secret</title><pre>Missing preview secret header.</pre>`,
        nonce,
        400,
      );
    }

    if (!isValidPreviewSecretFormat(secret)) {
      return htmlPreviewError({
        code: "preview_payload_invalid",
        nonce,
        title: "Invalid preview token",
        message: "Preview token has an invalid format.",
      });
    }

    const recordResult = await fetchPreviewRecord(secret);
    if (!recordResult.ok) {
      const lookupErrorCode = (recordResult as { ok: false; code: Parameters<typeof previewPageErrorResponse>[0]["code"] }).code;
      return previewPageErrorResponse({
        code: lookupErrorCode,
        nonce,
      });
    }

    const record = recordResult.record;
    if (!record) {
      return htmlPreviewError({
        code: "preview_not_found",
        nonce,
        title: "Not found",
        message: "Preview not found (invalid secret?)",
      });
    }

    if (isExpired(record.expires_at)) {
      await deletePreviewRecord(secret);
      return htmlPreviewError({
        code: "preview_expired",
        nonce,
        title: "Expired",
        message: "Preview expired. Please create a new one.",
      });
    }

    const fileBytes = approxFilesPayloadSize(record.files ?? {});
    if (fileBytes > MAX_FILES_BYTES) {
      return htmlPreviewError({
        code: "preview_payload_too_large",
        nonce,
        title: "Too large",
        message: "Preview files exceed size limit.",
      });
    }

    const metaTemplate =
      record?.meta && typeof record.meta === "object"
        ? (record.meta as PreviewMeta).template
        : undefined;

    const safeToggleSecret = !headerSecret
      ? undefined
      : isHashedPreviewSecret(secret)
        ? secret.trim()
        : await hashPreviewSecret(secret);

    const logsToggleUrl = withToggleUrl({
      baseUrl: url,
      showRawLogs: !showRawLogs,
      showRuntimeErrors,
      secretHash: safeToggleSecret,
    });
    const runtimeErrorsToggleUrl = withToggleUrl({
      baseUrl: url,
      showRawLogs,
      showRuntimeErrors: !showRuntimeErrors,
      secretHash: safeToggleSecret,
    });

    const page = renderPage({
      nonce,
      name: record.name || "Preview",
      createdAt: formatPreviewTimestamp(record.created_at),
      expiresAt: formatPreviewTimestamp(record.expires_at),
      files: record.files ?? {},
      dependencies: record.dependencies ?? undefined,
      template: typeof metaTemplate === "string" ? metaTemplate : undefined,
      showRawLogs,
      showRuntimeErrors,
      logsToggleUrl,
      runtimeErrorsToggleUrl,
    });

    const ms = Date.now() - started;
    const fileCount = countPreviewFiles(record);
    console.warn(
      `[preview_page] ip=${ip} name=${record.name ?? "?"} files=${fileCount} bytes=${fileBytes} logs=${showRawLogs ? "on" : "off"} runtimeErrors=${showRuntimeErrors ? "on" : "off"} ms=${ms}`,
    );

    return renderPreviewResponse({ page, nonce });
  } catch (e) {
    const safeError = sanitizeErrorText(e instanceof Error ? e.message : String(e));
    console.error("[preview_page] error:", safeError);
    return previewPageErrorResponse({
      code: classifyPreviewPageUnexpectedError(e),
      nonce: randomNonce(),
    });
  }
});

function countPreviewFiles(record: PreviewRecord): number {
  return record.files ? Object.keys(record.files).length : 0;
}
