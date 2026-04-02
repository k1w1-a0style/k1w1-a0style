import AsyncStorage from "@react-native-async-storage/async-storage";

import { getAndroidKeystoreExportAdminKey } from "../../../infra/github/githubService";
import {
  credKeyForProfile,
  credKeyForProjectUiMode,
  credStatusMetaKeyForProjectUiMode,
  resolveProjectCredentialScope,
} from "../../../lib/storageKeys";
import type { VerificationContractState } from "../../../lib/status/verificationContract";
import type { BuildProfile } from "../types";

type StorageReader = (key: string) => Promise<string | null>;
type AsyncStorageLike = {
  getItem?: ((key: string) => Promise<string | null>) | undefined;
  default?: AsyncStorageLike | undefined;
};

function resolveAsyncStorageGetItem(): StorageReader | null {
  const storage = AsyncStorage as AsyncStorageLike;
  return storage.getItem ?? storage.default?.getItem ?? storage.default?.default?.getItem ?? null;
}

export type SigningKeyGateState = {
  hasSigningKey: boolean;
  reason: string | null;
  localEdgeAdminKeyPresent: boolean;
  credentialState: VerificationContractState | null;
  credentialDetail: string | null;
};

export type ReadSigningKeyGateStateParams = {
  buildProfile: BuildProfile;
  repoFullName: string;
  projectData?: { id?: string | null } | null;
  deps?: {
    storageGetItem?: StorageReader;
    getAndroidKeystoreExportAdminKey?: typeof getAndroidKeystoreExportAdminKey;
  };
};

async function readScopedCredentialValue(params: {
  scopedKey: string;
  legacyKey: string;
  allowLegacyFallback: boolean;
  storageGetItem: StorageReader;
}): Promise<string | null> {
  const scopedVal = await params.storageGetItem(params.scopedKey).catch(() => null);
  if (scopedVal !== null) return scopedVal;
  if (!params.allowLegacyFallback || params.scopedKey === params.legacyKey) return null;
  return params.storageGetItem(params.legacyKey).catch(() => null);
}

export function describeSigningKeyGateReason(params: {
  hasSigningKey: boolean;
  localEdgeAdminKeyPresent: boolean;
  credentialState: VerificationContractState | null;
  credentialDetail: string | null;
  buildProfile: BuildProfile;
}): string | null {
  if (params.hasSigningKey) return null;

  if (!params.localEdgeAdminKeyPresent) {
    return "Lokaler Android Keystore Export Admin Key fehlt – Credentials Wizard und Build-Vorbereitung koennen den Keystore-Status ohne diesen lokalen scoped App-Wert nicht verifizieren.";
  }

  const detail = params.credentialDetail?.trim() || null;
  if (detail) return detail;

  if (params.credentialState === "auth_error") {
    return "Lokaler Android Keystore Export Admin Key wurde vom Edge-Server fuer den Keystore-Check abgelehnt (401/403). Repo-/Server-Secrets koennen trotzdem vorhanden sein.";
  }

  if (params.credentialState === "missing") {
    return `Signing Key fuer ${params.buildProfile} fehlt laut letztem Wizard-Check.`;
  }

  return `Signing Key fuer ${params.buildProfile} fehlt oder ist noch nicht frisch verifiziert – bitte im Credentials Wizard pruefen oder erzeugen.`;
}

export async function readSigningKeyGateState(
  params: ReadSigningKeyGateStateParams,
): Promise<SigningKeyGateState> {
  const asyncStorageGetItem = resolveAsyncStorageGetItem();
  const storageGetItem =
    params.deps?.storageGetItem ??
    (asyncStorageGetItem ? ((key: string) => asyncStorageGetItem(key)) : async () => null);
  const readEdgeAdminKey =
    params.deps?.getAndroidKeystoreExportAdminKey ?? getAndroidKeystoreExportAdminKey;

  const keyMode = params.buildProfile === "development" ? "dev" : params.buildProfile;
  const projectScope = resolveProjectCredentialScope({
    projectId: params.projectData?.id,
    linkedRepo: params.repoFullName,
  });
  const allowLegacyFallback = !projectScope;

  const scopedExistsKey = credKeyForProjectUiMode({
    mode: keyMode === "dev" ? "dev" : (keyMode as "preview" | "production"),
    projectScope,
  });
  const legacyExistsKey = credKeyForProfile(
    keyMode === "dev" ? "development" : (keyMode as "preview" | "production"),
  );
  const scopedStateKey = credStatusMetaKeyForProjectUiMode({
    mode: keyMode === "dev" ? "dev" : (keyMode as "preview" | "production"),
    field: "state",
    projectScope,
  });
  const legacyStateKey = credStatusMetaKeyForProjectUiMode({
    mode: keyMode === "dev" ? "dev" : (keyMode as "preview" | "production"),
    field: "state",
  });
  const scopedDetailKey = credStatusMetaKeyForProjectUiMode({
    mode: keyMode === "dev" ? "dev" : (keyMode as "preview" | "production"),
    field: "detail",
    projectScope,
  });
  const legacyDetailKey = credStatusMetaKeyForProjectUiMode({
    mode: keyMode === "dev" ? "dev" : (keyMode as "preview" | "production"),
    field: "detail",
  });

  const [existsRaw, stateRaw, detailRaw, edgeAdminKey] = await Promise.all([
    readScopedCredentialValue({
      scopedKey: scopedExistsKey,
      legacyKey: legacyExistsKey,
      allowLegacyFallback,
      storageGetItem,
    }),
    readScopedCredentialValue({
      scopedKey: scopedStateKey,
      legacyKey: legacyStateKey,
      allowLegacyFallback,
      storageGetItem,
    }),
    readScopedCredentialValue({
      scopedKey: scopedDetailKey,
      legacyKey: legacyDetailKey,
      allowLegacyFallback,
      storageGetItem,
    }),
    readEdgeAdminKey().catch(() => null),
  ]);

  const hasSigningKey = existsRaw === "true";
  const credentialState =
    stateRaw === "verified" ||
    stateRaw === "missing" ||
    stateRaw === "unknown" ||
    stateRaw === "auth_error" ||
    stateRaw === "stale"
      ? stateRaw
      : null;
  const credentialDetail = detailRaw?.trim() || null;
  const localEdgeAdminKeyPresent = Boolean(edgeAdminKey?.trim());

  return {
    hasSigningKey,
    reason: describeSigningKeyGateReason({
      hasSigningKey,
      localEdgeAdminKeyPresent,
      credentialState,
      credentialDetail,
      buildProfile: params.buildProfile,
    }),
    localEdgeAdminKeyPresent,
    credentialState,
    credentialDetail,
  };
}
