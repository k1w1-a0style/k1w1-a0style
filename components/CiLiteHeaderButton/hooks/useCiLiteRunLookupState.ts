import { useCallback, useEffect, useRef, useState } from "react";

import { mergeWorkflowRunLookupDiagnosis } from "./useCiLiteWorkflowHelpers";
import type { WorkflowRunLookupDiagnosis } from "./workflowRunMatching";

export function useCiLiteRunLookupState() {
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupDiagnosisRef = useRef<WorkflowRunLookupDiagnosis | null>(null);
  const lookupGenerationRef = useRef(0);
  const [locatingRun, setLocatingRun] = useState(false);
  const [lookupDiagnosis, setLookupDiagnosis] = useState<WorkflowRunLookupDiagnosis | null>(null);

  const stopPolling = useCallback(() => {
    lookupGenerationRef.current += 1;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const isLookupGenerationActive = useCallback((generation: number): boolean => {
    return lookupGenerationRef.current === generation;
  }, []);

  const scheduleLookupPoll = useCallback((params: {
    generation: number;
    attempt: number;
    poll: () => Promise<boolean>;
  }) => {
    if (!isLookupGenerationActive(params.generation)) return;
    const delaysMs = [1200, 1800, 2600, 3500, 4500];
    const delay = delaysMs[Math.min(params.attempt, delaysMs.length - 1)];
    pollTimerRef.current = setTimeout(() => {
      void (async () => {
        if (!isLookupGenerationActive(params.generation)) return;
        const finished = await params.poll();
        if (!finished && isLookupGenerationActive(params.generation)) {
          scheduleLookupPoll({ generation: params.generation, attempt: params.attempt + 1, poll: params.poll });
        }
      })();
    }, delay);
  }, [isLookupGenerationActive]);

  const startRunLookup = useCallback(() => {
    stopPolling();
    const generation = lookupGenerationRef.current;
    lookupDiagnosisRef.current = null;
    setLookupDiagnosis(null);
    setLocatingRun(true);
    return generation;
  }, [stopPolling]);

  const stopRunLookup = useCallback(() => {
    setLocatingRun(false);
    stopPolling();
  }, [stopPolling]);

  const updateLookupDiagnosis = useCallback((diagnosis: WorkflowRunLookupDiagnosis | null) => {
    const merged = mergeWorkflowRunLookupDiagnosis(lookupDiagnosisRef.current, diagnosis);
    lookupDiagnosisRef.current = merged;
    setLookupDiagnosis(merged);
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return {
    locatingRun,
    lookupDiagnosis,
    lookupDiagnosisRef,
    stopPolling,
    isLookupGenerationActive,
    scheduleLookupPoll,
    startRunLookup,
    stopRunLookup,
    updateLookupDiagnosis,
  };
}
