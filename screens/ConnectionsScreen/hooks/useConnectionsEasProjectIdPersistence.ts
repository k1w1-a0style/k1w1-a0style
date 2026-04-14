import { useCallback } from "react";
import { persistScopedEasProjectId } from "../../../lib/easProjectIdScope";
import { resolveEasProjectIdPersistenceAction } from "./useConnectionsScreenHelpers";

export function useConnectionsEasProjectIdPersistence() {
  return useCallback(async (projectId: string, repoFullName?: string | null) => {
    const persistenceAction = resolveEasProjectIdPersistenceAction(projectId);
    if (persistenceAction.mode === "set") {
      await persistScopedEasProjectId({
        projectId: persistenceAction.value,
        repoFullName,
      });
      return;
    }
    await persistScopedEasProjectId({
      projectId: "",
      repoFullName,
    });
  }, []);
}
