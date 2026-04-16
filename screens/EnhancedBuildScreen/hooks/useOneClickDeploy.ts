// screens/EnhancedBuildScreen/hooks/useOneClickDeploy.ts
// One-Click Deploy: Runs all pre-build steps automatically, then triggers build

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useProject } from "../../../contexts/ProjectContext";
import { autoSyncRepoSecrets } from "../../../lib/autoSyncRepoSecrets";
import { logger } from "../../../lib/logger";
import { STORAGE_KEYS } from "../../../lib/storageKeys";
import type { BuildProfile } from "../types";
import { evaluateBuildReadiness } from "../../../lib/buildReadiness";
import { readLocalBuildGateState } from "./useBuildPreconditions";
import { readSigningKeyGateState } from "./signingKeyGate";
import { getRepoSyncState } from "../../../lib/repoSyncOrchestration";
import { getMaterializedProjectFiles, getSourceProjectFiles } from "../../../lib/getMaterializedProjectFiles";

export type DeployStepId =
  | "signing_key"
  | "tokens"
  | "readiness"
  | "secrets_sync"
  | "push_files"
  | "build";

export type DeployStepStatus = "pending" | "running" | "ok" | "fail" | "skip";

export type DeployStep = {
  id: DeployStepId;
  label: string;
  status: DeployStepStatus;
  detail?: string;
};

const INITIAL_STEPS: DeployStep[] = [
  { id: "signing_key", label: "Signing Key pruefen", status: "pending" },
  { id: "tokens", label: "Tokens pruefen", status: "pending" },
  { id: "readiness", label: "Diagnose + CI-Lite pruefen", status: "pending" },
  { id: "secrets_sync", label: "Secrets synchronisieren", status: "pending" },
  { id: "push_files", label: "Dateien pushen", status: "pending" },
  { id: "build", label: "Build starten", status: "pending" },
];

type AsyncStorageLike = {
  getItem?: ((key: string) => Promise<string | null>) | undefined;
  setItem?: ((key: string, value: string) => Promise<void>) | undefined;
  default?: AsyncStorageLike | undefined;
};

function resolveAsyncStorageGetItem(): ((key: string) => Promise<string | null>) | null {
  const storage = AsyncStorage as AsyncStorageLike;
  return storage.getItem ?? storage.default?.getItem ?? storage.default?.default?.getItem ?? null;
}

function resolveAsyncStorageSetItem(): ((key: string, value: string) => Promise<void>) | null {
  const storage = AsyncStorage as AsyncStorageLike;
  return storage.setItem ?? storage.default?.setItem ?? storage.default?.default?.setItem ?? null;
}


function getOneClickDeployErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Unbekannter Fehler";
}

function getAbortRunningStepDetail(stepId: DeployStepId): string {
  if (stepId === "build" || stepId === "secrets_sync") {
    return "Lokaler Ablauf abgebrochen; bereits gestartete externe Operation kann noch abschliessen.";
  }
  return "Lokaler Ablauf abgebrochen.";
}

export function useOneClickDeploy(
  buildProfile: BuildProfile,
  repoFullName: string,
  branchName: string,
  startBuild: ((profile: BuildProfile) => Promise<void>) | undefined,
) {
  const [steps, setSteps] = useState<DeployStep[]>(INITIAL_STEPS);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployDone, setDeployDone] = useState(false);
  const abortRef = useRef(false);
  const activeRunIdRef = useRef(0);
  const [autoSyncSecrets, setAutoSyncSecrets] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const getItem = resolveAsyncStorageGetItem();
    if (!getItem) {
      setAutoSyncSecrets(false);
      return () => {
        cancelled = true;
      };
    }

    getItem(STORAGE_KEYS.ONE_CLICK_AUTO_SYNC_SECRETS)
      .then((value) => {
        if (cancelled) return;
        setAutoSyncSecrets(value === "true");
      })
      .catch((error: unknown) => {
        logger.warn("[EnhancedBuild] failed to read one-click auto-sync preference", { error });
        if (cancelled) return;
        setAutoSyncSecrets(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAutoSyncSecrets = useCallback(() => {
    setAutoSyncSecrets((prev) => {
      const next = !prev;
      const setItem = resolveAsyncStorageSetItem();
      if (setItem) {
        setItem(STORAGE_KEYS.ONE_CLICK_AUTO_SYNC_SECRETS, next ? "true" : "false").catch(
          (error: unknown) => {
            logger.warn("[EnhancedBuild] failed to persist one-click auto-sync preference", { error });
          },
        );
      }
      return next;
    });
  }, []);

  const { projectData } = useProject();

  const updateStep = useCallback(
    (id: DeployStepId, status: DeployStepStatus, detail?: string) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status, detail } : s)),
      );
    },
    [],
  );

  const resetSteps = useCallback(() => {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setDeployDone(false);
  }, []);

  const runDeploy = useCallback(async () => {
    if (isDeploying) return;
    const runId = activeRunIdRef.current + 1;
    activeRunIdRef.current = runId;
    const isRunActive = () => activeRunIdRef.current === runId && !abortRef.current;
    const setDeployingState = (value: boolean) => {
      if (activeRunIdRef.current !== runId) return;
      setIsDeploying(value);
    };
    const setDoneState = (value: boolean) => {
      if (activeRunIdRef.current !== runId) return;
      setDeployDone(value);
    };
    const updateStepScoped = (id: DeployStepId, status: DeployStepStatus, detail?: string) => {
      if (activeRunIdRef.current !== runId) return;
      updateStep(id, status, detail);
    };

    abortRef.current = false;
    setDeployingState(true);
    setDoneState(false);
    resetSteps();

    try {
      if (!repoFullName.trim() || !branchName.trim()) {
        updateStepScoped("readiness", "fail", "Repo/Branch fehlen");
        Alert.alert("Build nicht bereit", "Bitte zuerst Repo und Branch verknuepfen.");
        return;
      }

      // === Step 1: Signing Key pruefen ===
      updateStepScoped("signing_key", "running");
      const signingGate = await readSigningKeyGateState({
        buildProfile,
        repoFullName,
        projectData,
      });
      if (!isRunActive()) return;

      if (!signingGate.hasSigningKey) {
        const signingReason =
          signingGate.reason || "Signing Key fehlt – bitte im Credentials Wizard generieren";
        updateStepScoped("signing_key", "fail", signingReason);
        Alert.alert("Signing Key fehlt", signingReason);
        return;
      }
      updateStepScoped("signing_key", "ok", `Key fuer ${buildProfile} vorhanden`);

      // === Step 2: Tokens pruefen ===
      updateStepScoped("tokens", "running");
      const localGate = await readLocalBuildGateState().catch((error: unknown) => {
        logger.warn("[EnhancedBuild] local gate read failed during one-click deploy", { error });
        return null;
      });
      if (!isRunActive()) return;

      if (!localGate?.hasTokens || !localGate.hasWorkflowAdminKey || !localGate.hasOperatorJwt) {
        const reason =
          localGate?.tokenReason ??
          localGate?.workflowAdminKeyReason ??
          localGate?.operatorJwtReason ??
          "Build-Start Gate nicht erfüllt";
        updateStepScoped("tokens", "fail", reason);
        Alert.alert("Build nicht bereit", reason);
        return;
      }
      updateStepScoped("tokens", "ok", "GitHub + Expo + Workflow-Key + Operator-JWT OK");

      // === Step 3: Readiness (Diagnostic + CI-Lite + Repo/Branch Match) ===
      updateStepScoped("readiness", "running");
      const sourceFiles = getSourceProjectFiles(projectData);
      const files = getMaterializedProjectFiles(projectData);
      const readiness = await evaluateBuildReadiness({
        id: projectData?.id ?? "one-click-deploy",
        name: projectData?.name ?? "One-Click Deploy",
        chatHistory: projectData?.chatHistory ?? [],
        createdAt: projectData?.createdAt ?? new Date(0).toISOString(),
        lastModified: projectData?.lastModified ?? new Date().toISOString(),
        linkedRepo: repoFullName,
        linkedBranch: branchName,
        files: sourceFiles,
      });
      if (!isRunActive()) return;

      let readinessReason: string | null = null;
      if (sourceFiles.length === 0) readinessReason = "Projekt ist leer – zuerst Dateien erzeugen oder importieren";
      else if (!readiness.ok) readinessReason = readiness.message;

      if (readinessReason) {
        updateStepScoped("readiness", "fail", readinessReason);
        Alert.alert("Build nicht bereit", `${readinessReason}. Bitte Diagnostic + Header-Checks erneut ausfuehren.`);
        return;
      }

      if (sourceFiles.length > 0) {
        const syncState = await getRepoSyncState({
          linkedRepo: repoFullName,
          linkedBranch: branchName,
          files,
        }).catch((error: unknown) => {
          logger.warn("[EnhancedBuild] getRepoSyncState failed during one-click deploy readiness", { error });
          return "unknown" as const;
        });

        if (!isRunActive()) return;

        if (syncState === "unknown") {
          const syncReason = "Repo-Sync-Status unklar – bitte zuerst explizit pushen und danach erneut deployen";
          updateStepScoped("readiness", "fail", syncReason);
          Alert.alert("Build nicht bereit", syncReason);
          return;
        }

        updateStepScoped(
          "readiness",
          "ok",
          syncState === "out_of_sync"
            ? "Diagnostik + CI-Lite OK · Repo wird beim Build-Start kontrolliert gepusht"
            : "Diagnostik + CI-Lite OK · Repo-Sync bekannt",
        );
      } else {
        updateStepScoped("readiness", "ok", "Diagnostik + CI-Lite OK");
      }

      // === Step 4: Secrets synchronisieren (optional) ===
      if (!autoSyncSecrets) {
        updateStepScoped("secrets_sync", "skip", "Auto-Sync deaktiviert");
      } else {
        updateStepScoped("secrets_sync", "running");
        if (!repoFullName.trim()) {
          updateStepScoped("secrets_sync", "fail", "Kein Repo verknuepft");
          Alert.alert("Kein Repo", "Bitte zuerst ein Repo verknuepfen.");
          return;
        }
        if (!isRunActive()) return;

        try {
          const syncResult = await autoSyncRepoSecrets(repoFullName);
          if (!isRunActive()) return;
          const detail =
            syncResult.updated.length > 0
              ? `${syncResult.updated.length} Secrets synchronisiert`
              : "Keine Aenderungen noetig";
          updateStepScoped("secrets_sync", "ok", detail);
        } catch (e: unknown) {
          const message = getOneClickDeployErrorMessage(e);
          updateStepScoped("secrets_sync", "fail", message === "Unbekannter Fehler" ? "Sync fehlgeschlagen" : message);
          Alert.alert("Secrets Sync Fehler", message);
          return;
        }
      }

      // === Step 5: Repo-Sync wird im Build-Start entschieden ===
      const projectFiles = projectData?.files;
      if (Array.isArray(projectFiles) && projectFiles.length > 0) {
        updateStepScoped("push_files", "skip", "Repo-Sync erfolgt im Build-Start (SHA-sicher)");
      } else {
        updateStepScoped("push_files", "skip", "Keine Dateien zum Synchronisieren");
      }

      // === Step 6: Build starten ===
      updateStepScoped("build", "running");
      if (!isRunActive()) return;

      if (!startBuild) {
        updateStepScoped("build", "fail", "Build-Funktion nicht verfuegbar");
        return;
      }

      try {
        await startBuild(buildProfile);
        if (!isRunActive()) return;
        updateStepScoped("build", "ok", `Build (${buildProfile}) gestartet`);
        setDoneState(true);
      } catch (e: unknown) {
        const message = getOneClickDeployErrorMessage(e);
        updateStepScoped("build", "fail", message === "Unbekannter Fehler" ? "Build fehlgeschlagen" : message);
      }
    } finally {
      setDeployingState(false);
    }
  }, [
    isDeploying,
    buildProfile,
    repoFullName,
    branchName,
    startBuild,
    projectData,
    updateStep,
    resetSteps,
    autoSyncSecrets,
  ]);

  const abort = useCallback(() => {
    const activeRunId = activeRunIdRef.current;
    if (activeRunId <= 0) return;
    abortRef.current = true;
    setSteps((prev) =>
      prev.map((step) => {
        if (step.status === "running") {
          return {
            ...step,
            status: "fail",
            detail: getAbortRunningStepDetail(step.id),
          };
        }
        if (step.status === "pending") {
          return { ...step, status: "skip", detail: "Lokal vor Ausfuehrung abgebrochen" };
        }
        return step;
      }),
    );
    setIsDeploying(false);
  }, []);

  return {
    steps,
    isDeploying,
    deployDone,
    autoSyncSecrets,
    toggleAutoSyncSecrets,
    runDeploy,
    resetSteps,
    abort,
  };
}
