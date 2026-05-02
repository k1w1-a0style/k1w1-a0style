import { fetchWithTimeout } from "../../lib/network/fetchWithTimeout";
import { readSupabaseRuntimeConfig } from "../../lib/supabaseRuntimeConfig";
import { isPreviewEdgeErrorCode } from "../../shared/previewErrorContract";
import type { PreviewResponse } from "../../types/preview";
import { buildPreviewInvokeError, safeJson } from "./failure";
import type { PreviewInvokePayload } from "./types";

export async function invokeSavePreview(params: {
  bearerJwt?: string | null;
  adminKey?: string | null;
  payload: PreviewInvokePayload;
  timeoutMs?: number;
}): Promise<PreviewResponse> {
  const supabaseConfig = await readSupabaseRuntimeConfig();
  const supabaseUrl = supabaseConfig.url;
  if (!supabaseUrl) {
    throw buildPreviewInvokeError("Supabase URL fehlt.");
  }

  const timeoutMs = params.timeoutMs ?? 12_000;

  const trimmedJwt = String(params.bearerJwt ?? "").trim();
  const trimmedAdminKey = String(params.adminKey ?? "").trim();
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (trimmedJwt) {
    headers.Authorization = `Bearer ${trimmedJwt}`;
  } else if (trimmedAdminKey) {
    headers["x-k1w1-admin-key"] = trimmedAdminKey;
  }

  try {
    const res = await fetchWithTimeout(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/save_preview`, {
      timeoutMs,
      timeoutMessage: `Supabase Preview Timeout (${timeoutMs}ms)`,
      method: "POST",
      headers,
      body: JSON.stringify(params.payload),
    });

    const rawText = await res.text();
    const parsed = rawText ? safeJson<PreviewResponse>(rawText) : null;
    const errorCode = isPreviewEdgeErrorCode(parsed?.code) ? parsed.code : null;
    const errorMessage =
      typeof parsed?.error === "string" && parsed.error.trim()
        ? parsed.error.trim()
        : rawText.trim() || `HTTP ${res.status}`;

    if (!res.ok) {
      throw buildPreviewInvokeError(errorMessage, res.status, errorCode ?? undefined);
    }

    if (parsed && parsed.ok === false) {
      throw buildPreviewInvokeError(errorMessage, res.status, errorCode ?? undefined);
    }

    return parsed ?? { ok: false, error: "Leere Preview-Antwort" };
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw buildPreviewInvokeError(`Supabase Preview Timeout (${timeoutMs}ms)`);
    }
    throw error;
  }
}
