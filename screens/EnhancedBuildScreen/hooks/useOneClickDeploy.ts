// screens/EnhancedBuildScreen/hooks/useOneClickDeploy.ts
// One-Click Deploy: Runs all pre-build steps automatically, then triggers build

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useProject } from "../../../contexts/ProjectContext";
import {
  getGitHubToken,
  getExpoToken,
} from "../../../infra/github/githubService";
import { autoSyncRepoSecrets } from "../../../lib/autoSyncRepoSecrets";
import {
  STORAGE_KEYS,
  credKeyForProfile,
  credKeyForProjectUiMode,
  resolveProjectCredentialScope,
} from "../../../lib/storageKeys";
import type { BuildProfile } from "../types";

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
  const [autoSyncSecrets, setAutoSyncSecrets] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEYS.ONE_CLICK_AUTO_SYNC_SECRETS)
      .then((value) => {
        if (cancelled) return;
        setAutoSyncSecrets(value === "true");
      })
      .catch(() => {
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
      AsyncStorage.setItem(STORAGE_KEYS.ONE_CLICK_AUTO_SYNC_SECRETS, next ? "true" : "false").catch(
        () => {},
      );
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
    abortRef.current = false;
    setIsDeploying(true);
    setDeployDone(false);
    resetSteps();

    try {
      if (!repoFullName.trim() || !branchName.trim()) {
        updateStep("readiness", "fail", "Repo/Branch fehlen");
        Alert.alert("Build nicht bereit", "Bitte zuerst Repo und Branch verknuepfen.");
        return;
      }

      // === Step 1: Signing Key pruefen ===
      updateStep("signing_key", "running");
      const keyMode = buildProfile === "development" ? "dev" : buildProfile;
      const projectScope = resolveProjectCredentialScope({
        projectId: projectData?.id,
        linkedRepo: repoFullName,
      });
      const scopedKey = credKeyForProjectUiMode({
        mode: keyMode === "dev" ? "dev" : (keyMode as "preview" | "production"),
        projectScope,
      });
      const legacyKey = credKeyForProfile(
        keyMode === "dev" ? "development" : (keyMode as "preview" | "production"),
      );
      const scopedVal = await AsyncStorage.getItem(scopedKey).catch(() => null);
      const keyExists = scopedVal ?? (scopedKey !== legacyKey ? await AsyncStorage.getItem(legacyKey).catch(() => null) : null);
      if (abortRef.current) return;

      if (keyExists !== "true") {
        updateStep(
          "signing_key",
          "fail",
          "Signing Key fehlt – bitte im Credentials Wizard generieren",
        );
        Alert.alert(
          "Signing Key fehlt",
          "Bitte erst im Credentials Wizard einen Signing Key erzeugen. Danach One-Click Deploy erneut starten.",
        );
        return;
      }
      updateStep("signing_key", "ok", `Key fuer ${buildProfile} vorhanden`);

      // === Step 2: Tokens pruefen ===
      updateStep("tokens", "running");
      const [ghToken, expoToken] = await Promise.all([
        getGitHubToken().catch(() => null),
        getExpoToken().catch(() => null),
      ]);
      if (abortRef.current) return;

      if (!ghToken || !expoToken) {
        updateStep("tokens", "fail", !ghToken ? "GitHub Token fehlt" : "Expo Token fehlt");
        Alert.alert("Tokens fehlen", "Bitte zuerst im Verbindungen-Screen setzen.");
        return;
      }
      updateStep("tokens", "ok", "GitHub + Expo OK");

      // === Step 3: Readiness (Diagnostic + CI-Lite + Repo/Branch Match) ===
      updateStep("readiness", "running");
      const [diagVal, lintOk, typeOk, lastRepo, lastBranch, lastRunAt] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.DIAGNOSTIC_LAST_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_LINT_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_TYPECHECK_OK).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_LAST_REPO).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_LAST_BRANCH).catch(() => null),
        AsyncStorage.getItem(STORAGE_KEYS.CI_LITE_LAST_RUN_AT).catch(() => null),
      ]);
      if (abortRef.current) return;

      const repoMatches = (lastRepo ?? "").trim() === (repoFullName ?? "").trim();
      const branchMatches = (lastBranch ?? "").trim() === (branchName ?? "").trim();
      const runTs = Number(lastRunAt ?? "");
      const stale = !Number.isFinite(runTs) || runTs <= 0 || Date.now() - runTs > 6 * 60 * 60 * 1000;

      let readinessReason: string | null = null;
      if (diagVal !== "true") readinessReason = "Diagnostik nicht gruen";
      else if (lintOk !== "true" || typeOk !== "true") readinessReason = "CI-Lite Lint/Typecheck nicht gruen";
      else if (!repoMatches) readinessReason = "CI-Lite gehoert zu anderem Repo";
      else if (!branchMatches) readinessReason = "CI-Lite gehoert zu anderem Branch";
      else if (stale) readinessReason = "CI-Lite ist veraltet";

      if (readinessReason) {
        updateStep("readiness", "fail", readinessReason);
        Alert.alert("Build nicht bereit", `${readinessReason}. Bitte Diagnostic + Header-Checks erneut ausfuehren.`);
        return;
      }
      updateStep("readiness", "ok", "Diagnostik + CI-Lite OK");

      // === Step 4: Secrets synchronisieren (optional) ===
      if (!autoSyncSecrets) {
        updateStep("secrets_sync", "skip", "Auto-Sync deaktiviert");
      } else {
        updateStep("secrets_sync", "running");
        if (!repoFullName.trim()) {
          updateStep("secrets_sync", "fail", "Kein Repo verknuepft");
          Alert.alert("Kein Repo", "Bitte zuerst ein Repo verknuepfen.");
          return;
        }
        if (abortRef.current) return;

        try {
          const syncResult = await autoSyncRepoSecrets(repoFullName);
          if (abortRef.current) return;
          const detail =
            syncResult.updated.length > 0
              ? `${syncResult.updated.length} Secrets synchronisiert`
              : "Keine Aenderungen noetig";
          updateStep("secrets_sync", "ok", detail);
        } catch (e: any) {
          updateStep("secrets_sync", "fail", e?.message || "Sync fehlgeschlagen");
          Alert.alert("Secrets Sync Fehler", e?.message || "Unbekannter Fehler");
          return;
        }
      }

      // === Step 5: Repo-Sync wird im Build-Start entschieden ===
      const files = projectData?.files;
      if (Array.isArray(files) && files.length > 0) {
        updateStep("push_files", "skip", "Repo-Sync erfolgt im Build-Start (SHA-sicher)");
      } else {
        updateStep("push_files", "skip", "Keine Dateien zum Synchronisieren");
      }

      // === Step 6: Build starten ===
      updateStep("build", "running");
      if (abortRef.current) return;

      if (!startBuild) {
        updateStep("build", "fail", "Build-Funktion nicht verfuegbar");
        return;
      }

      try {
        await startBuild(buildProfile);
        if (abortRef.current) return;
        updateStep("build", "ok", `Build (${buildProfile}) gestartet`);
        setDeployDone(true);
      } catch (e: any) {
        updateStep("build", "fail", e?.message || "Build fehlgeschlagen");
      }
    } finally {
      setIsDeploying(false);
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
    abortRef.current = true;
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
