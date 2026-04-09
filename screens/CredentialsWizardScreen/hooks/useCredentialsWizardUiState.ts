import { useCallback, useRef, useState } from "react";

import type { WizardHttpDebug } from "../types";
import { sanitizeErrorForUi, sanitizeWizardHttpDebug } from "../utils/security";

export function useCredentialsWizardUiState() {
  const isMountedRef = useRef(true);
  const activeActionRef = useRef<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [lastDebug, setLastDebug] = useState<WizardHttpDebug | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showError, setShowError] = useState(false);

  const safeSetLastError = useCallback(
    (err: unknown) => {
      if (!isMountedRef.current) return;
      const text = err instanceof Error ? err.message : String(err ?? "");
      setLastError(sanitizeErrorForUi(text));
    },
    [setLastError],
  );

  const safeSetLastDebug = useCallback(
    (dbg: WizardHttpDebug | null) => {
      if (!isMountedRef.current) return;
      setLastDebug(dbg ? sanitizeWizardHttpDebug(dbg) : null);
    },
    [setLastDebug],
  );

  return {
    isMountedRef,
    activeActionRef,
    busy,
    setBusy,
    lastDebug,
    setLastDebug,
    lastError,
    setLastError,
    showAdvanced,
    setShowAdvanced,
    showDebug,
    setShowDebug,
    showError,
    setShowError,
    safeSetLastError,
    safeSetLastDebug,
  };
}
