import { useCallback } from "react";
import { Alert } from "react-native";

import { ensureCiLiteWorkflowBootstrap } from "../../../lib/ciLiteWorkflowBootstrap";
import { resolveCiLiteDispatchSelection } from "./useCiLiteWorkflowContracts";

type UseCiLiteWorkflowProvisionParams = {
  githubRepo: string;
  branch: string;
  setLocalError: (value: string | null) => void;
};

export function useCiLiteWorkflowProvision(params: UseCiLiteWorkflowProvisionParams) {
  return useCallback(async (workflowFile: string) => {
    const selection = resolveCiLiteDispatchSelection({
      githubRepo: params.githubRepo,
      branch: params.branch,
    });
    if (!selection.ok) {
      Alert.alert("CI Lite Repair", selection.message);
      return false;
    }
    const { owner, repo, branch } = selection.selection;
    try {
      const result = await ensureCiLiteWorkflowBootstrap({ owner, repo, branch, workflowFile });
      if (result.status === "skipped_tokenless") {
        throw new Error("Repair lokal nicht verfügbar: GitHub verbinden und erneut versuchen.");
      }
      if (result.status === "skipped_unknown_workflow") {
        throw new Error(`Workflow '${workflowFile}' ist unmanaged und wird nicht automatisch überschrieben.`);
      }
      params.setLocalError(null);
      Alert.alert("CI Lite Repair", `Workflow ${result.workflowFile}: ${result.status}.`);
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      params.setLocalError(msg);
      Alert.alert("CI Lite Repair", msg);
      return false;
    }
  }, [params]);
}
