// screens/shared/preview/useWebViewCrashRecovery.ts
//
// Kapselt die One-Shot-Recovery-Logik für WebView-Abstürze.
// Shared zwischen PreviewScreen und PreviewFullscreenScreen.

import { useCallback, useRef } from 'react';
import type { WebView } from 'react-native-webview';

interface UseWebViewCrashRecoveryOptions {
  webViewRef: React.RefObject<WebView | null>;
  isMountedRef: React.RefObject<boolean>;
  onError: (message: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

interface UseWebViewCrashRecoveryReturn {
  handleContentProcessDidTerminate: (evt: { nativeEvent?: unknown }) => void;
  handleRenderProcessGone: (evt: { nativeEvent?: { didCrash?: boolean } }) => boolean;
  resetRecoveryState: () => void;
}

export function useWebViewCrashRecovery({
  webViewRef,
  isMountedRef,
  onError,
  onLoadingChange,
}: UseWebViewCrashRecoveryOptions): UseWebViewCrashRecoveryReturn {
  const processTerminatedRef = useRef(false);
  const autoReloadAttemptedRef = useRef(false);
  const recoveryReloadInFlightRef = useRef(false);

  const resetRecoveryState = useCallback(() => {
    processTerminatedRef.current = false;
    autoReloadAttemptedRef.current = false;
    recoveryReloadInFlightRef.current = false;
  }, []);

  const attemptRecovery = useCallback(
    (softMsg: string, hardMsg: string) => {
      if (!autoReloadAttemptedRef.current) {
        autoReloadAttemptedRef.current = true;
        recoveryReloadInFlightRef.current = true;
        onError(softMsg);
        setTimeout(() => {
          if (!isMountedRef.current) return;
          webViewRef.current?.reload();
        }, 1000);
        return;
      }
      onError(hardMsg);
    },
    [webViewRef, isMountedRef, onError],
  );

  const handleContentProcessDidTerminate = useCallback(
    (_evt: { nativeEvent?: unknown }) => {
      if (!isMountedRef.current) return;
      if (processTerminatedRef.current) return;
      processTerminatedRef.current = true;
      onLoadingChange(false);
      attemptRecovery(
        'WebView-Prozess wurde beendet. Neustart…',
        'WebView-Prozess wurde beendet. Bitte neu laden.',
      );
    },
    [isMountedRef, onLoadingChange, attemptRecovery],
  );

  const handleRenderProcessGone = useCallback(
    (evt: { nativeEvent?: { didCrash?: boolean } }): boolean => {
      if (!isMountedRef.current) return true;
      if (processTerminatedRef.current) return true;
      processTerminatedRef.current = true;
      onLoadingChange(false);
      const didCrash = Boolean(evt?.nativeEvent?.didCrash);
      attemptRecovery(
        didCrash ? 'WebView ist abgestürzt. Neustart…' : 'WebView wurde beendet. Neustart…',
        didCrash ? 'WebView ist abgestürzt. Bitte neu laden.' : 'WebView wurde beendet. Bitte neu laden.',
      );
      return true;
    },
    [isMountedRef, onLoadingChange, attemptRecovery],
  );

  return { handleContentProcessDidTerminate, handleRenderProcessGone, resetRecoveryState };
}
