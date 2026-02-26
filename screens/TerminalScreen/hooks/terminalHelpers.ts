// screens/TerminalScreen/hooks/terminalHelpers.ts
// Extracted from useTerminalScreen.ts: constants and helpers.

import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Animated, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { zip } from "react-native-zip-archive";

import { useTerminal, LogEntry } from "../../../contexts/TerminalContext";
import { useProject } from "../../../contexts/ProjectContext";
import type { Filter } from "../types";
import { getLogLabel } from "../utils/logPresentation";
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

