// screens/TerminalScreen/hooks/terminalHelpers.ts
// Extracted from useTerminalScreen.ts: constants and helpers.

import * as FileSystem from "expo-file-system/legacy";

import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";


export const MAX_CLIPBOARD_LOGS = 500;
export const MAX_EXPORT_LOGS = 2000;
export const MAX_AI_LOGS = 250;

// hard caps for perf / share limits
export const MAX_CLIPBOARD_CHARS = 100_000;
export const MAX_EXPORT_CHARS = 200_000;
export const MAX_AI_CHARS = 15_000;

export function safeDir(dir: string | null | undefined): string {
  // expo-file-system returns null in some envs; fall back to cache.
  return dir ?? FileSystem.cacheDirectory ?? "";
}

export type ToTextOptions = {
  maxLogs?: number;
  maxChars?: number;
  redact?: boolean;
};

const MAX_DEBUG_SEARCH_QUERY_CHARS = 120;

export function sanitizeDebugSearchQuery(raw: string): string {
  const normalized = truncateWithMarker(redactSecrets(String(raw ?? "")), MAX_DEBUG_SEARCH_QUERY_CHARS);
  return normalized.trim();
}

export function formatSanitizedSearchQuery(raw: string): string {
  const sanitized = sanitizeDebugSearchQuery(raw);
  return sanitized || "-";
}
