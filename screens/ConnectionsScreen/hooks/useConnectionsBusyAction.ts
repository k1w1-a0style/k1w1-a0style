import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";

import { logger } from "../../../lib/logger";
import { safeAlertText } from "../utils/validation";
import { resolveConnectionsActionAlert } from "./useConnectionsScreenHelpers";
import { BusyGuardActiveError, isBusyGuardActiveError } from "./busyGuard";
import type { GuardedActionParams } from "./connections.contracts";

export function useConnectionsBusyAction() {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // Invariant contract marker retained for source-based tests
  const withBusyGuard = useCallback(async (task: () => Promise<void>): Promise<void> => {
    if (busyRef.current) {
      throw new BusyGuardActiveError();
    }

    busyRef.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const showActionError = useCallback((defaultTitle: string, error: unknown) => {
    const alert = resolveConnectionsActionAlert({
      isBusy: isBusyGuardActiveError(error),
      error: safeAlertText(error),
      defaultTitle,
    });
    Alert.alert(alert.title, alert.message);
  }, []);

  const runGuardedAction = useCallback(
    async (params: GuardedActionParams): Promise<void> => {
      try {
        await withBusyGuard(params.task);
      } catch (error: unknown) {
        if (isBusyGuardActiveError(error)) {
          showActionError(params.defaultTitle, error);
          return;
        }
        if (params.onNonBusyError) {
          try {
            await params.onNonBusyError(error);
          } catch (cleanupError: unknown) {
            logger.warn("[ConnectionsScreen] non-busy cleanup failed", { error: cleanupError });
          }
        }
        showActionError(params.defaultTitle, error);
      }
    },
    [showActionError, withBusyGuard],
  );

  return {
    busy,
    busyRef,
    runGuardedAction,
  };
}
