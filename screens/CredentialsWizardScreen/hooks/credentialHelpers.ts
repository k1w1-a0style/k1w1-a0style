// screens/CredentialsWizardScreen/hooks/credentialHelpers.ts
// Extracted from useCredentialsWizardScreen.ts: utility functions.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useProject } from "../../../contexts/ProjectContext";
import { ensureSupabaseClient } from "../../../lib/supabase";
import { getEdgeAdminKey, saveEdgeAdminKey } from "../../../infra/github/githubService";
import { credKeyForUiMode } from "../../../lib/storageKeys";

import { useInlineToast } from "../../../components/diagnostics/useInlineToast";
import { theme } from "../../../theme";

import type { ApiModeId, ModeDef, StatusResult, UiModeId, WizardHttpDebug } from "../types";

import {
  isLikelyValidAdminKey,
  isLikelyValidRepoFullName,
  isLikelyValidSupabaseUrl,
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
  payload: Record<string, unknown> | null,
): Promise<
  | { ok: true; data: unknown; debug: WizardHttpDebug }
  | { ok: false; error: string; debug: WizardHttpDebug }
> {
  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/${fn}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Defensive: trim to avoid accidental whitespace/newlines from copy/paste.
      "x-k1w1-admin-key": adminKey.trim(),
    },
    body: JSON.stringify(payload ?? {}),
  });

  const bodyText = await res.text();
  const debug: WizardHttpDebug = sanitizeWizardHttpDebug({
    url,
    status: res.status,
    statusText: res.statusText ?? "",
    bodyText,
  });

  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status} ${res.statusText || ""}`.trim(), debug };
  }

  try {
    const data: unknown = bodyText ? JSON.parse(bodyText) : null;
    return { ok: true, data, debug };
  } catch {
    return { ok: true, data: bodyText, debug };
  }
}
