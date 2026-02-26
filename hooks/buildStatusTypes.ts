// hooks/buildStatusTypes.ts
// Extracted from useBuildStatus.ts: types and constants.

// hooks/useBuildStatus.ts - OPTIMIZED VERSION
// ✅ Timeout bei Netzwerkfehlern
// ✅ Error-Counter stoppt Polling nach 5 Fehlern (mit useRef statt State)
// ✅ Automatischer Stop bei finalen Status (success/failed)
// ✅ Besseres Status-Mapping (zentralisiert über buildStatusMapper)
// ✅ Callbacks statt Alert (bessere Testbarkeit)
// ✅ Kein Race Condition durch errorCount in Dependencies

import { useEffect, useState, useRef, useCallback } from "react";
import { AppState } from "react-native";
import type { BuildStatus, BuildStatusDetails } from "../shared/types/build";
import {
  pollBuildStatusOnce,
  isFinalStatus,
} from "../project/services/buildPollingService";

import { logger } from "../lib/logger";


export const POLL_INTERVAL_MS = 6000; // 6 Sekunden
export const MAX_ERRORS = 5; // Nach 5 Fehlern stoppen
export const REQUEST_TIMEOUT_MS = 10000; // 10 Sekunden Timeout pro Request

// ============================================
// CALLBACK TYPES
// ============================================
export interface UseBuildStatusCallbacks {
  onSuccess?: (details: BuildStatusDetails) => void;
  onFailed?: (details: BuildStatusDetails) => void;
  onError?: (error: string, errorCount: number) => void;
  onMaxErrors?: (lastError: string, maxErrors: number) => void;
}

// ============================================
// HOOK
// ============================================
