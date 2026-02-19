// screens/EnhancedBuildScreen/hooks/useOneClickDeploy.ts
// One-Click Deploy: Runs all pre-build steps automatically, then triggers build

import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useProject } from "../../../contexts/ProjectContext";
import {
  getGitHubToken,
  getExpoToken,
  pushFilesToRepo,
} from "../../../infra/github/githubService";
import { autoSyncRepoSecrets } from "../../../lib/autoSyncRepoSecrets";
import type { BuildProfile } from "../types";

export type DeployStepId =
  | "signing_key"
  | "tokens"
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
      // === Step 1: Signing Key pruefen ===
      updateStep("signing_key", "running");
      const keyMode = buildProfile === "development" ? "dev" : buildProfile;
      const credKey = `cred_key_exists_${keyMode}`;
      const keyExists = await AsyncStorage.getItem(credKey).catch(() => null);
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

      // === Step 3: Secrets synchronisieren ===
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

      // === Step 4: Dateien pushen ===
      updateStep("push_files", "running");
      if (abortRef.current) return;

      try {
        const files = projectData?.files;
        if (files && Array.isArray(files) && files.length > 0) {
          const [owner, repo] = repoFullName.split("/");
          if (owner && repo) {
            await pushFilesToRepo(owner, repo, files as any, branchName || undefined);
            if (abortRef.current) return;
            updateStep("push_files", "ok", `${files.length} Dateien gepusht`);
          } else {
            updateStep("push_files", "fail", "Repo-Name ungueltig");
            return;
          }
        } else {
          updateStep("push_files", "skip", "Keine Dateien zum Pushen");
        }
      } catch (e: any) {
        updateStep("push_files", "fail", e?.message || "Push fehlgeschlagen");
        Alert.alert("Push Fehler", e?.message || "Unbekannter Fehler");
        return;
      }

      // === Step 5: Build starten ===
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
  ]);

  const abort = useCallback(() => {
    abortRef.current = true;
    setIsDeploying(false);
  }, []);

  return {
    steps,
    isDeploying,
    deployDone,
    runDeploy,
    resetSteps,
    abort,
  };
}
