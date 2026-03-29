// screens/CredentialsWizardScreen/hooks/credentialHelpers.ts
// Extracted from useCredentialsWizardScreen.ts: utility functions.

import { fetchWithTimeout } from "../../../lib/network/fetchWithTimeout";
import { theme } from "../../../theme";

import type { ApiModeId, ModeDef, StatusResult, UiModeId, WizardHttpDebug } from "../types";

import {
  buildEdgeHttpErrorMessage,
  sanitizeErrorForUi,
  sanitizeWizardHttpDebug,
} from "../utils/security";


export const MODES: ModeDef[] = [
  { id: "dev", label: "Dev", hint: "Schnell testen (signed)" },
  { id: "preview", label: "Preview", hint: "Interne APK teilen (signed)" },
  { id: "production", label: "Production", hint: "Release/Store (signed)" },
];

export function normalizeModeForApi(mode: UiModeId): ApiModeId {
  return mode === "dev" ? "development" : mode;
}

export function normalizeModeForUi(mode?: string | null): UiModeId | undefined {
  if (!mode) return undefined;
  const lower = String(mode).toLowerCase();
  if (lower === "development" || lower === "dev") return "dev";
  if (lower === "preview") return "preview";
  if (lower === "production" || lower === "prod") return "production";
  return undefined;
}

export function pickStorageBucket(record?: StatusResult["record"]) {
  return record?.storage?.bucket ?? record?.storage_bucket;
}

export function pickStoragePath(record?: StatusResult["record"]) {
  return record?.storage?.path ?? record?.storage_path;
}

export function pickUpdatedAt(record?: StatusResult["record"]) {
  return record?.updatedAt ?? record?.updated_at;
}

export function paletteTextMuted() {
  return theme.palette.text.muted;
}

export function paletteSuccess() {
  return theme.palette.success;
}

export function paletteError() {
  return theme.palette.error;
}

export async function invokeEdgeJson(
  supabaseUrl: string,
  fn: string,
  adminKey: string,
  userJwt: string,
  payload: Record<string, unknown> | null,
): Promise<
  | { ok: true; data: unknown; debug: WizardHttpDebug }
  | { ok: false; error: string; debug: WizardHttpDebug }
> {
  const REQUEST_TIMEOUT_MS = 12_000;

  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${fn}`;

  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      timeoutMs: REQUEST_TIMEOUT_MS,
      timeoutMessage: `Edge request timeout after ${REQUEST_TIMEOUT_MS}ms`,
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Scoped keystore caller contract:
        // Authorization carries the current Supabase user JWT; x-k1w1-admin-key carries
        // the dedicated local androidKeystoreExportAdminKey.
        Authorization: `Bearer ${userJwt.trim()}`,
        "x-k1w1-admin-key": adminKey.trim(),
      },
      body: JSON.stringify(payload ?? {}),
    });
  } catch (error: unknown) {
    const name = error instanceof Error ? error.name : "";
    if (name === "AbortError" || name === "TimeoutError") {
      throw new Error(`Edge request timeout after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  }

  const bodyText = await res.text();
  const debug: WizardHttpDebug = sanitizeWizardHttpDebug({
    url,
    status: res.status,
    statusText: res.statusText ?? "",
    bodyText,
  });

  if (!res.ok) {
    return {
      ok: false,
      error: buildEdgeHttpErrorMessage(res.status, res.statusText || "", bodyText),
      debug,
    };
  }

  try {
    const data: unknown = bodyText ? JSON.parse(bodyText) : null;

    // Edge functions can reply with HTTP 200 but `{ ok: false, error }`.
    // Normalize this branch so all callers get the same error-path behavior.
    if (
      data &&
      typeof data === "object" &&
      "ok" in data &&
      (data as { ok?: unknown }).ok === false
    ) {
      const errorFromBody =
        typeof (data as { error?: unknown }).error === "string"
          ? (data as { error?: string }).error
          : JSON.stringify(data);
      return {
        ok: false,
        error: sanitizeErrorForUi(errorFromBody || "Edge call failed"),
        debug,
      };
    }

    return { ok: true, data, debug };
  } catch {
    return { ok: true, data: bodyText, debug };
  }
}
