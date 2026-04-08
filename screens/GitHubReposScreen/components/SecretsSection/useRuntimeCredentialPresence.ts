import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAndroidKeystoreExportAdminKey,
  getExpoToken,
  getWorkflowAdminKey,
} from "../../../../infra/github/githubService";
import { RuntimePresenceState } from "./secretsSectionContracts";

const EMPTY_RUNTIME_PRESENCE: RuntimePresenceState = {
  expoToken: null,
  workflowAdminKey: null,
  androidKeystoreExportAdminKey: null,
};

async function readRuntimeSecretOrNull(
  key: keyof RuntimePresenceState,
  read: () => Promise<string | null>,
): Promise<string | null> {
  try {
    return await read();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[SecretsSection] runtime credential read failed (${key}): ${reason}`);
    return null;
  }
}

export function useRuntimeCredentialPresence(activeRepo: string | null) {
  const [runtimePresence, setRuntimePresence] = useState<RuntimePresenceState>(EMPTY_RUNTIME_PRESENCE);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const runtimeRequestRef = useRef(0);

  const loadRuntimePresence = useCallback(async () => {
    if (!activeRepo) {
      setRuntimePresence(EMPTY_RUNTIME_PRESENCE);
      setRuntimeLoading(false);
      return;
    }

    const requestId = runtimeRequestRef.current + 1;
    runtimeRequestRef.current = requestId;
    setRuntimeLoading(true);

    try {
      const [expoToken, workflowAdminKey, androidKeystoreExportAdminKey] = await Promise.all([
        readRuntimeSecretOrNull("expoToken", getExpoToken),
        readRuntimeSecretOrNull("workflowAdminKey", getWorkflowAdminKey),
        readRuntimeSecretOrNull("androidKeystoreExportAdminKey", getAndroidKeystoreExportAdminKey),
      ]);

      if (runtimeRequestRef.current !== requestId) return;
      setRuntimePresence({
        expoToken: !!expoToken?.trim(),
        workflowAdminKey: !!workflowAdminKey?.trim(),
        androidKeystoreExportAdminKey: !!androidKeystoreExportAdminKey?.trim(),
      });
    } finally {
      if (runtimeRequestRef.current === requestId) {
        setRuntimeLoading(false);
      }
    }
  }, [activeRepo]);

  useEffect(() => {
    runtimeRequestRef.current += 1;
    setRuntimePresence(EMPTY_RUNTIME_PRESENCE);
    setRuntimeLoading(false);
  }, [activeRepo]);

  useEffect(() => {
    void loadRuntimePresence();
  }, [loadRuntimePresence]);

  return { runtimePresence, runtimeLoading };
}
