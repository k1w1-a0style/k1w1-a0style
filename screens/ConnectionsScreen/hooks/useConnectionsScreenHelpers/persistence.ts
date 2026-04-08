import { logger } from "../../../../lib/logger";
import { runCleanupTask } from "../../../../lib/safeCleanup";
import { STORAGE_KEYS } from "../../../../lib/storageKeys";
import type { PersistableEntry, StorageLike } from "./types";

export const resolveGitHubConnectionPersistence = (params: {
  kind: "ok" | "failed";
  login?: string;
  scopes?: string;
}): {
  ok: boolean;
  login: string;
  scopes: string;
  writes: PersistableEntry[];
  removes: string[];
} => {
  if (params.kind === "failed") {
    return {
      ok: false,
      login: "",
      scopes: "",
      writes: [[STORAGE_KEYS.CONN_GITHUB_OK, "false"]],
      removes: [STORAGE_KEYS.CONN_GITHUB_USER, STORAGE_KEYS.CONN_GITHUB_SCOPES],
    };
  }

  const login = (params.login || "").trim();
  const scopes = (params.scopes || "").trim();
  const writes: PersistableEntry[] = [
    [STORAGE_KEYS.CONN_GITHUB_OK, "true"],
    [STORAGE_KEYS.CONN_GITHUB_USER, login],
  ];
  const removes: string[] = [];
  if (scopes) {
    writes.push([STORAGE_KEYS.CONN_GITHUB_SCOPES, scopes]);
  } else {
    removes.push(STORAGE_KEYS.CONN_GITHUB_SCOPES);
  }

  return {
    ok: true,
    login,
    scopes,
    writes,
    removes,
  };
};

export const resolveExpoConnectionPersistence = (params: {
  kind: "ok" | "failed";
  username?: string;
}): {
  ok: boolean;
  username: string;
  writes: PersistableEntry[];
  removes: string[];
} => {
  if (params.kind === "failed") {
    return {
      ok: false,
      username: "",
      writes: [[STORAGE_KEYS.CONN_EXPO_OK, "false"]],
      removes: [STORAGE_KEYS.CONN_EXPO_USER],
    };
  }

  const username = (params.username || "").trim();
  const writes: PersistableEntry[] = [[STORAGE_KEYS.CONN_EXPO_OK, "true"]];
  const removes: string[] = [];
  if (username) {
    writes.push([STORAGE_KEYS.CONN_EXPO_USER, username]);
  } else {
    removes.push(STORAGE_KEYS.CONN_EXPO_USER);
  }

  return {
    ok: true,
    username,
    writes,
    removes,
  };
};

export const resolveSupabaseConnectionPersistence = (params: {
  kind: "ok" | "rls_protected" | "failed";
  ref?: string;
}): {
  ok: boolean;
  ref: string;
  writes: PersistableEntry[];
  removes: string[];
} => {
  if (params.kind === "failed") {
    return {
      ok: false,
      ref: "",
      writes: [[STORAGE_KEYS.CONN_SUPABASE_OK, "false"]],
      removes: [STORAGE_KEYS.CONN_SUPABASE_REF],
    };
  }

  const ref = (params.ref || "").trim();
  const writes: PersistableEntry[] = [[STORAGE_KEYS.CONN_SUPABASE_OK, "true"]];
  const removes: string[] = [];
  if (params.kind === "ok" && ref) {
    writes.push([STORAGE_KEYS.CONN_SUPABASE_REF, ref]);
  } else {
    removes.push(STORAGE_KEYS.CONN_SUPABASE_REF);
  }

  return {
    ok: true,
    ref,
    writes,
    removes,
  };
};

export const runStorageMultiOpWithFallback = async <T>(params: {
  items: T[];
  runMulti: () => Promise<unknown>;
  runSingle: (item: T) => Promise<unknown>;
  multiFailureLog: string;
  singleFailureLog: (item: T) => string;
}): Promise<void> => {
  if (!params.items.length) return;

  let multiFailed = false;
  try {
    await params.runMulti();
  } catch (error) {
    multiFailed = true;
    logger.warn(params.multiFailureLog, { err: error });
  }

  if (!multiFailed) return;

  await Promise.all(
    params.items.map((item) =>
      runCleanupTask(
        () => params.runSingle(item),
        params.singleFailureLog(item),
      ),
    ),
  );
};

export const persistEntriesWithFallback = async (
  storage: StorageLike,
  entries: PersistableEntry[],
): Promise<void> => {
  await runStorageMultiOpWithFallback({
    items: entries,
    runMulti: () => storage.multiSet(entries),
    runSingle: ([key, value]) => storage.setItem(key, value),
    multiFailureLog: "[ConnectionsScreen] storage multiSet failed, using item fallback",
    singleFailureLog: ([key]) => `[ConnectionsScreen] storage setItem failed for key=${key}`,
  });
};

export const removeEntriesWithFallback = async (
  storage: StorageLike,
  keys: string[],
): Promise<void> => {
  await runStorageMultiOpWithFallback({
    items: keys,
    runMulti: () => storage.multiRemove(keys),
    runSingle: (key) => storage.removeItem(key),
    multiFailureLog: "[ConnectionsScreen] storage multiRemove failed, using item fallback",
    singleFailureLog: (key) => `[ConnectionsScreen] storage removeItem failed for key=${key}`,
  });
};

export const applyPersistenceDelta = async (params: {
  writes?: PersistableEntry[];
  removes?: string[];
  persist: (entries: PersistableEntry[]) => Promise<void>;
  remove: (keys: string[]) => Promise<void>;
}): Promise<void> => {
  const writes = params.writes ?? [];
  const removes = params.removes ?? [];
  if (writes.length) {
    await params.persist(writes);
  }
  if (removes.length) {
    await params.remove(removes);
  }
};
