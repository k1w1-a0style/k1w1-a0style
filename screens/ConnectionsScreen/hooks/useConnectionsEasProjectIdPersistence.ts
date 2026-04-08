import { useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../../../lib/storageKeys";
import { resolveEasProjectIdPersistenceAction } from "./useConnectionsScreenHelpers";

export function useConnectionsEasProjectIdPersistence() {
  return useCallback(async (projectId: string) => {
    const persistenceAction = resolveEasProjectIdPersistenceAction(projectId);
    if (persistenceAction.mode === "set") {
      await AsyncStorage.setItem(STORAGE_KEYS.EAS_PROJECT_ID, persistenceAction.value);
      return;
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.EAS_PROJECT_ID);
  }, []);
}
