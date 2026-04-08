import { useEffect, useRef, useState } from "react";

import type { UseDiagnosticFixRunnerOptions, UseDiagnosticFixRunnerState } from "./useDiagnosticFixRunner.contracts";
import type { FixHistoryEntry } from "../types";

export const FIX_RUNNER_MAX_HISTORY = 10;

export function useDiagnosticFixRunnerState(opts: Pick<UseDiagnosticFixRunnerOptions, "clearHistoryRef">): UseDiagnosticFixRunnerState {
  const { clearHistoryRef } = opts;

  const [history, setHistory] = useState<FixHistoryEntry[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewLabel, setPreviewLabel] = useState("");
  const [previewEntries, setPreviewEntries] = useState<UseDiagnosticFixRunnerState["previewEntries"]>([]);
  const [applyBusy, setApplyBusy] = useState(false);
  const applyBusyRef = useRef(false);

  useEffect(() => {
    if (!clearHistoryRef) return;
    clearHistoryRef.current = () => setHistory([]);
    return () => {
      if (clearHistoryRef.current) clearHistoryRef.current = null;
    };
  }, [clearHistoryRef]);

  return {
    history,
    setHistory,
    previewVisible,
    setPreviewVisible,
    previewLabel,
    setPreviewLabel,
    previewEntries,
    setPreviewEntries,
    applyBusy,
    setApplyBusy,
    applyBusyRef,
  };
}
