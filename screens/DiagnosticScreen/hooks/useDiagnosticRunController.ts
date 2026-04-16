import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PreflightCheckResult, PreflightTarget } from "../../../lib/diagnostics/preflightTypes";
import {
  buildDiagnosticReadinessRecord,
  computeDiagnosticProjectFingerprint,
} from "../../../lib/diagnosticReadinessRecord";
import { STORAGE_KEYS, diagnosticLastOkKeyForSelection, diagnosticReadinessRecordKeyForSelection } from "../../../lib/storageKeys";
import { runCleanupTask } from "../../../lib/safeCleanup";
import { getDiagnosticUiErrorMessage } from "./diagnosticErrorHelpers";
import { runLocalChecks, runPipelineChecks } from "./diagnosticRunners";
import { buildDiagnosticSelectionScope, resolveDiagnosticFocusedProfiles } from "./useDiagnosticScreenHelpers";
import type { DiagnosticRunControllerParams, RunDiagnostics } from "./diagnosticScreen.contracts";

export function useDiagnosticRunController(params: DiagnosticRunControllerParams) {
  const {
    projectRef,
    mountedRef,
    linkedRepo,
    linkedBranch,
    includeLocalChecks,
    includePipelineChecks,
    modesAll,
    selectedModes,
    recommendedMode,
    pipelineAppliesToFocus,
    clearSelection,
    clearHistoryRef,
    onScopeInvalidated,
  } = params;

  const [target, setTarget] = useState<PreflightTarget>({ mode: "expoGo" });
  const [results, setResults] = useState<PreflightCheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const [scopeResetSeq, setScopeResetSeq] = useState(0);

  const runningRef = useRef(false);
  const diagnosticRunEpochRef = useRef(0);
  const activeSelectionScopeRef = useRef<string | null>(null);

  useEffect(() => {
    activeSelectionScopeRef.current = buildDiagnosticSelectionScope(linkedRepo, linkedBranch);
  }, [linkedRepo, linkedBranch]);

  const runDiagnostics = useCallback<RunDiagnostics>(
    async (opts) => {
      if (!projectRef.current) {
        Alert.alert("Kein Projekt", "Bitte zuerst ein Projekt laden.");
        return;
      }
      if (runningRef.current) return;

      runningRef.current = true;
      setRunning(true);

      const runEpoch = ++diagnosticRunEpochRef.current;
      const runScope = activeSelectionScopeRef.current;
      const isCurrentRun = () =>
        mountedRef.current &&
        diagnosticRunEpochRef.current === runEpoch &&
        activeSelectionScopeRef.current === runScope;
      const guardedSetResults = (nextResults: PreflightCheckResult[]) => {
        if (isCurrentRun()) setResults(nextResults);
      };
      const guardedSetProgressStage = (nextStage: string | null) => {
        if (isCurrentRun()) setProgressStage(nextStage);
      };
      const persistScopedReadiness = async (params: {
        diagnosticOk: boolean;
        includePipelineChecksValue: boolean;
        focusedProfiles: string[];
      }) => {
        const hasPersistableSelection = Boolean(String(linkedRepo ?? "").trim() && String(linkedBranch ?? "").trim());
        if (!hasPersistableSelection) {
          await runCleanupTask(
            () =>
              AsyncStorage.multiRemove([
                STORAGE_KEYS.DIAGNOSTIC_LAST_OK,
                STORAGE_KEYS.DIAGNOSTIC_READINESS_RECORD,
              ]),
            `[DiagnosticScreen] remove unscoped diagnostic flag failed for key=${STORAGE_KEYS.DIAGNOSTIC_LAST_OK}`,
          );
          return;
        }
        const files = projectRef.current?.files ?? [];
        const scopedDiagnosticKey = diagnosticLastOkKeyForSelection({
          linkedRepo,
          linkedBranch,
        });
        const readinessRecordKey = diagnosticReadinessRecordKeyForSelection({
          linkedRepo,
          linkedBranch,
        });
        const readinessRecord = buildDiagnosticReadinessRecord({
          repo: linkedRepo ?? "",
          branch: linkedBranch ?? "",
          projectFingerprint: computeDiagnosticProjectFingerprint(files),
          diagnosticOk: params.diagnosticOk,
          includePipelineChecks: params.includePipelineChecksValue,
          focusedModes: params.focusedProfiles,
        });
        await runCleanupTask(
          async () => {
            await AsyncStorage.multiSet([
              [scopedDiagnosticKey, params.diagnosticOk ? "true" : "false"],
              [readinessRecordKey, JSON.stringify(readinessRecord)],
            ]);
          },
          `[DiagnosticScreen] persist scoped diagnostic flag failed for key=${scopedDiagnosticKey}`,
        );
      };

      const resetSelection = opts?.resetSelection !== false;
      const resetHistory = opts?.resetHistory !== false;
      setResults([]);
      if (resetSelection) clearSelection();
      if (resetHistory) clearHistoryRef.current?.();
      setProgressStage("Checks starten…");

      try {
        const files = projectRef.current.files;
        const all: PreflightCheckResult[] = [];

        const focusedProfiles = resolveDiagnosticFocusedProfiles({
          modesAll,
          selectedModes,
          recommendedMode,
        });
        await persistScopedReadiness({
          diagnosticOk: false,
          includePipelineChecksValue: includePipelineChecks,
          focusedProfiles,
        });

        await runLocalChecks({
          includeLocalChecks,
          focusedProfiles,
          files,
          all,
          mountedRef,
          setResults: guardedSetResults,
          setProgressStage: guardedSetProgressStage,
        });
        await runPipelineChecks({
          includePipelineChecks,
          linkedRepo,
          linkedBranch,
          files,
          pipelineAppliesToFocus,
          all,
          mountedRef,
          setResults: guardedSetResults,
          setProgressStage: guardedSetProgressStage,
        });

        if (isCurrentRun()) {
          setResults(all);
          setLastRunAt(Date.now());
          setProgressStage(null);

          const hasFails = all.some((r) => r.status === "fail");
          await persistScopedReadiness({
            diagnosticOk: !hasFails,
            includePipelineChecksValue: includePipelineChecks,
            focusedProfiles,
          });
        }
      } catch (e: unknown) {
        if (isCurrentRun()) {
          const focusedProfiles = resolveDiagnosticFocusedProfiles({
            modesAll,
            selectedModes,
            recommendedMode,
          });
          await persistScopedReadiness({
            diagnosticOk: false,
            includePipelineChecksValue: includePipelineChecks,
            focusedProfiles,
          });
          Alert.alert("Diagnostics fehlgeschlagen", getDiagnosticUiErrorMessage(e));
          setProgressStage(null);
        }
      } finally {
        if (diagnosticRunEpochRef.current === runEpoch) {
          runningRef.current = false;
          if (mountedRef.current) setRunning(false);
        }
      }
    },
    [
      clearHistoryRef,
      clearSelection,
      includeLocalChecks,
      includePipelineChecks,
      linkedRepo,
      linkedBranch,
      modesAll,
      mountedRef,
      pipelineAppliesToFocus,
      projectRef,
      recommendedMode,
      selectedModes,
    ],
  );

  const lastSelectionScopeRef = useRef<string | null>(null);
  const didInitSelectionScopeRef = useRef(false);

  useEffect(() => {
    const nextScope = buildDiagnosticSelectionScope(linkedRepo, linkedBranch);
    const previousScope = lastSelectionScopeRef.current;
    lastSelectionScopeRef.current = nextScope;

    if (!didInitSelectionScopeRef.current) {
      didInitSelectionScopeRef.current = true;
      return;
    }

    if (previousScope === nextScope) {
      return;
    }

    diagnosticRunEpochRef.current += 1;
    runningRef.current = false;
    setRunning(false);
    setResults([]);
    clearSelection();
    setLastRunAt(null);
    setProgressStage(null);
    clearHistoryRef.current?.();
    setScopeResetSeq((v) => v + 1);
    onScopeInvalidated();
  }, [clearHistoryRef, clearSelection, linkedRepo, linkedBranch, onScopeInvalidated]);

  return {
    target,
    setTarget,
    results,
    setResults,
    running,
    progressStage,
    lastRunAt,
    runDiagnostics,
    scopeResetSeq,
  };
}
