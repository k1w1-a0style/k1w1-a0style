import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  credKeyForProjectUiMode,
  credKeyForUiMode,
  credStatusMetaKeyForProjectUiMode,
} from "../../../lib/storageKeys";

import type { StatusResult, UiModeId } from "../types";
import { MODES } from "./credentialHelpers";

const EMPTY_STATUS_BY_MODE: Record<UiModeId, StatusResult | null> = {
  dev: null,
  preview: null,
  production: null,
};

function parsePersistedExists(value: string | null): boolean | null {
  return value === "true" ? true : value === "false" ? false : null;
}

function parsePersistedCredentialState(value: string | null): StatusResult["credentialState"] {
  if (
    value === "verified" ||
    value === "missing" ||
    value === "unknown" ||
    value === "auth_error" ||
    value === "stale" ||
    value === "generated_pending_verification"
  ) {
    return value;
  }
  return undefined;
}

export function mergePersistedStatusByMode(
  next: Partial<Record<UiModeId, StatusResult>>,
): Record<UiModeId, StatusResult | null> {
  return {
    ...EMPTY_STATUS_BY_MODE,
    ...next,
  };
}

export function getEmptyStatusByMode(): Record<UiModeId, StatusResult | null> {
  return { ...EMPTY_STATUS_BY_MODE };
}

async function readWithLegacyFallback(scopedKey: string, legacyKey: string): Promise<string | null> {
  const scopedValue = await AsyncStorage.getItem(scopedKey).catch(() => null);
  if (scopedValue !== null || scopedKey === legacyKey) return scopedValue;
  return AsyncStorage.getItem(legacyKey).catch(() => null);
}

export async function hydratePersistedStatusByMode(projectScope: string | null | undefined) {
  const next: Partial<Record<UiModeId, StatusResult>> = {};

  for (const mode of MODES.map((m) => m.id)) {
    const scopedKey = credKeyForProjectUiMode({ mode, projectScope });
    const legacyKey = credKeyForUiMode(mode);

    const scopedStateKey = credStatusMetaKeyForProjectUiMode({
      mode,
      field: "state",
      projectScope,
    });
    const legacyStateKey = credStatusMetaKeyForProjectUiMode({ mode, field: "state" });

    const scopedDetailKey = credStatusMetaKeyForProjectUiMode({
      mode,
      field: "detail",
      projectScope,
    });
    const legacyDetailKey = credStatusMetaKeyForProjectUiMode({ mode, field: "detail" });

    const exists = parsePersistedExists(await readWithLegacyFallback(scopedKey, legacyKey));
    const credentialState = await readWithLegacyFallback(scopedStateKey, legacyStateKey);
    const stateDetail = await readWithLegacyFallback(scopedDetailKey, legacyDetailKey);

    if (exists !== null || credentialState || stateDetail) {
      next[mode] = {
        exists: exists ?? false,
        credentialState: parsePersistedCredentialState(credentialState),
        stateDetail: stateDetail ?? undefined,
      };
    }
  }

  return mergePersistedStatusByMode(next);
}

export async function persistWizardStatusByMode(params: {
  mode: UiModeId;
  status: StatusResult | null;
  projectScope: string | null | undefined;
}) {
  const { mode, status, projectScope } = params;

  const existsKey = credKeyForProjectUiMode({ mode, projectScope });
  const stateKey = credStatusMetaKeyForProjectUiMode({ mode, field: "state", projectScope });
  const detailKey = credStatusMetaKeyForProjectUiMode({ mode, field: "detail", projectScope });

  const removeItem =
    typeof AsyncStorage.removeItem === "function"
      ? AsyncStorage.removeItem.bind(AsyncStorage)
      : async () => undefined;

  await Promise.all([
    AsyncStorage.setItem(existsKey, status?.exists ? "true" : "false").catch(() => {}),
    status?.credentialState
      ? AsyncStorage.setItem(stateKey, status.credentialState).catch(() => {})
      : removeItem(stateKey).catch(() => {}),
    status?.stateDetail
      ? AsyncStorage.setItem(detailKey, status.stateDetail).catch(() => {})
      : removeItem(detailKey).catch(() => {}),
  ]);
}
