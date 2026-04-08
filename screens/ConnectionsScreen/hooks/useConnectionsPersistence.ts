import { useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { debugLog } from "../../../lib/debugOverlay";
import { redactSecrets, truncateWithMarker } from "../../../lib/secretRedaction";
import { type VerificationContractState } from "../../../lib/status/verificationContract";
import { safeAlertText } from "../utils/validation";
import {
  applyPersistenceDelta,
  persistEntriesWithFallback,
  removeEntriesWithFallback,
  resolveEasStatusPersistence,
  resolveExpoConnectionPersistence,
  resolveGitHubConnectionPersistence,
  resolveSupabaseConnectionPersistence,
} from "./useConnectionsScreenHelpers";
import {
  easClearedPersistence,
  expoClearedPersistence,
  githubClearedPersistence,
  supabaseClearedPersistence,
} from "./useConnectionsScreenState";
import type { ConnectionPersistenceDelta } from "./connections.contracts";

export function useConnectionsPersistence() {
  const [githubOk, setGithubOk] = useState(false);
  const [githubUser, setGithubUser] = useState("");
  const [githubScopes, setGithubScopes] = useState("");
  const [supabaseOk, setSupabaseOk] = useState(false);
  const [supabaseRef, setSupabaseRef] = useState("");
  const [expoOk, setExpoOk] = useState(false);
  const [expoUser, setExpoUser] = useState("");
  const [easOk, setEasOk] = useState(false);
  const [easState, setEasState] = useState<VerificationContractState>("missing");
  const [easLastVerifiedAt, setEasLastVerifiedAt] = useState<string | null>(null);
  const [repoOk, setRepoOk] = useState(false);
  const [repoOkLine, setRepoOkLine] = useState("");

  const applyEasConnectionState = useCallback((status: {
    ok: boolean;
    state: VerificationContractState;
    verifiedAt: string | null;
  }): void => {
    setEasOk(status.ok);
    setEasState(status.state);
    setEasLastVerifiedAt(status.verifiedAt);
  }, []);

  const persistConnLights = useCallback(async (entries: Array<[string, string]>) => {
    await persistEntriesWithFallback(AsyncStorage, entries);
  }, []);

  const removeConnLights = useCallback(async (keys: string[]) => {
    await removeEntriesWithFallback(AsyncStorage, keys);
  }, []);

  const applyConnectionPersistence = useCallback(
    async (params: { persistence: ConnectionPersistenceDelta; applyState: () => void }) => {
      params.applyState();
      await applyPersistenceDelta({
        writes: params.persistence.writes,
        removes: params.persistence.removes,
        persist: persistConnLights,
        remove: removeConnLights,
      });
    },
    [persistConnLights, removeConnLights],
  );

  const logConnectionFailure = useCallback((params: { channel: string; message: string; error: unknown }) => {
    debugLog(params.channel, params.message, {
      error: redactSecrets(truncateWithMarker(safeAlertText(params.error), 800)),
    });
  }, []);

  const applyClearedConnectionState = useCallback(
    async (params: { resetState: () => void; persistence: ConnectionPersistenceDelta }) => {
      params.resetState();
      await applyPersistenceDelta({
        writes: params.persistence.writes,
        removes: params.persistence.removes,
        persist: persistConnLights,
        remove: removeConnLights,
      });
    },
    [persistConnLights, removeConnLights],
  );

  const saveConnEasStatus = useCallback(
    async (params: { ok: boolean; state: VerificationContractState; verifiedAt?: string | null }) => {
      const verifiedAt = params.verifiedAt ?? null;
      applyEasConnectionState({ ok: params.ok, state: params.state, verifiedAt });
      const persistence = resolveEasStatusPersistence({ ok: params.ok, state: params.state, verifiedAt });
      await applyPersistenceDelta({
        writes: persistence.writes,
        removes: persistence.removes,
        persist: persistConnLights,
        remove: removeConnLights,
      });
    },
    [applyEasConnectionState, persistConnLights, removeConnLights],
  );

  const clearGithubConnectionState = useCallback(async () => {
    await applyClearedConnectionState({
      resetState: () => {
        setGithubOk(false);
        setGithubUser("");
        setGithubScopes("");
        setRepoOk(false);
        setRepoOkLine("");
        applyEasConnectionState({ ok: false, state: "missing", verifiedAt: null });
      },
      persistence: githubClearedPersistence(),
    });
  }, [applyClearedConnectionState, applyEasConnectionState]);

  const clearExpoConnectionState = useCallback(async () => {
    await applyClearedConnectionState({
      resetState: () => {
        setExpoOk(false);
        setExpoUser("");
      },
      persistence: expoClearedPersistence(),
    });
  }, [applyClearedConnectionState]);

  const clearEasConnectionState = useCallback(async () => {
    await applyClearedConnectionState({
      resetState: () => applyEasConnectionState({ ok: false, state: "missing", verifiedAt: null }),
      persistence: easClearedPersistence(),
    });
  }, [applyClearedConnectionState, applyEasConnectionState]);

  const clearSupabaseConnectionState = useCallback(async () => {
    await applyClearedConnectionState({
      resetState: () => {
        setSupabaseOk(false);
        setSupabaseRef("");
      },
      persistence: supabaseClearedPersistence(),
    });
  }, [applyClearedConnectionState]);

  const applyGitHubPersistence = useCallback(
    async (persistence: ReturnType<typeof resolveGitHubConnectionPersistence>) => {
      await applyConnectionPersistence({
        persistence,
        applyState: () => {
          setGithubOk(persistence.ok);
          setGithubUser(persistence.login);
          setGithubScopes(persistence.scopes);
        },
      });
    },
    [applyConnectionPersistence],
  );

  const applyExpoPersistence = useCallback(
    async (persistence: ReturnType<typeof resolveExpoConnectionPersistence>) => {
      await applyConnectionPersistence({
        persistence,
        applyState: () => {
          setExpoOk(persistence.ok);
          setExpoUser(persistence.username);
        },
      });
    },
    [applyConnectionPersistence],
  );

  const applySupabasePersistence = useCallback(
    async (persistence: ReturnType<typeof resolveSupabaseConnectionPersistence>) => {
      await applyConnectionPersistence({
        persistence,
        applyState: () => {
          setSupabaseOk(persistence.ok);
          setSupabaseRef(persistence.ref);
        },
      });
    },
    [applyConnectionPersistence],
  );

  return {
    state: {
      githubOk,
      githubUser,
      githubScopes,
      supabaseOk,
      supabaseRef,
      expoOk,
      expoUser,
      easOk,
      easState,
      easLastVerifiedAt,
      repoOk,
      repoOkLine,
    },
    setters: {
      setGithubOk,
      setGithubUser,
      setGithubScopes,
      setSupabaseOk,
      setSupabaseRef,
      setExpoOk,
      setExpoUser,
      setRepoOk,
      setRepoOkLine,
    },
    actions: {
      persistConnLights,
      removeConnLights,
      logConnectionFailure,
      saveConnEasStatus,
      clearGithubConnectionState,
      clearExpoConnectionState,
      clearEasConnectionState,
      clearSupabaseConnectionState,
      applyGitHubPersistence,
      applyExpoPersistence,
      applySupabasePersistence,
      applyEasConnectionState,
    },
  };
}
