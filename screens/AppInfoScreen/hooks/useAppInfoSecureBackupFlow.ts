import { useCallback, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createConfigAndSecretsBackupPayload,
  type SecretBackupPayloadV1,
  type SecureBackupPayloadV1,
  type SecureBackupScope,
} from "../../../lib/appInfoScopedBackup";
import { STORAGE_KEYS, legacyClientServiceRoleStorageKeys } from "../../../lib/storageKeys";
import { getSupabaseAnonKey, saveSupabaseAnonKey } from "../../../lib/supabaseAnonKeyStorage";
import { persistScopedEasProjectId, readScopedEasProjectId } from "../../../lib/easProjectIdScope";
import { normalizeStoredSupabaseRaw } from "../../ConnectionsScreen/utils/validation";
import {
  deleteAndroidKeystoreExportAdminKey,
  deleteExpoToken,
  deleteGitHubToken,
  deleteSigningAdminKey,
  deleteSigningMasterKey,
  deleteWorkflowAdminKey,
  getAndroidKeystoreExportAdminKey,
  getExpoToken,
  getGitHubToken,
  getSigningAdminKey,
  getSigningMasterKey,
  getWorkflowAdminKey,
  saveAndroidKeystoreExportAdminKey,
  saveExpoToken,
  saveGitHubToken,
  saveSigningAdminKey,
  saveSigningMasterKey,
  saveWorkflowAdminKey,
} from "../../../infra/github/githubService";
import { safeFormatBackupDate, sanitizeAiConfigFromBackup } from "../../../lib/appInfoBackup";
import { logger } from "../../../lib/logger";
import { recoverFromPendingJournal, runRecoverableCommit } from "../../../lib/recoverableCommit";
import { getSecureBackupExportSuccessMessage, getSecureBackupImportScopeText } from "./appInfoSecureBackupUiHelpers";
import {
  createCollectedSecretBackupPayload,
  hydrateGitHubSelectionFromBackup,
  persistAppliedSecretTokens,
  readAppliedSecretTokens,
} from "./appInfoSecretFlowHelpers";
import { resolveEasProjectIdImportDecision } from "./easProjectIdImportHelpers";
import { importEncryptedScopedBackup, exportEncryptedScopedBackup } from "./importExportHelpers";
import { getImportExportErrorMessage, isImportExportAborted } from "./importExportErrorHelpers";
import { resetDerivedStatusAfterSecretImport } from "./secretImportStatusReset";
import type { AIConfig } from "../../../contexts/AIContext/models";

export type SecureBackupRequest =
  | { mode: "export"; scope: SecureBackupScope }
  | { mode: "import" };


async function readSecretOrNull(read: () => Promise<string | null>): Promise<string | null> {
  try {
    const value = await read();
    const trimmed = String(value ?? "").trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

async function readStorageOrNull(key: string): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    const trimmed = String(value ?? "").trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

type GitHubSelectionDeps = {
  activeRepo: string | null;
  activeBranch: string | null;
  recentRepos: string[];
  addRecentRepo: (repo: string) => void | Promise<void>;
  clearRecentRepos: () => void | Promise<void>;
  setLinkedRepo: (repo: string | null, branch?: string | null) => void | Promise<void>;
};

async function removeLegacyClientServiceRoleKeys(): Promise<void> {
  const keys = legacyClientServiceRoleStorageKeys();
  const results = await Promise.allSettled(keys.map((key) => AsyncStorage.removeItem(key)));
  const failedKeys = results
    .map((result, index) => (result.status === "rejected" ? keys[index] : null))
    .filter((entry): entry is string => Boolean(entry));

  if (failedKeys.length > 0) {
    logger.warn("[useAppInfoScreen] Legacy Service-Role-Keys konnten nicht vollstaendig bereinigt werden.", {
      failedKeys,
    });
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return getImportExportErrorMessage(error, fallback);
}

function isAbortLikeError(error: unknown): boolean {
  return isImportExportAborted(error);
}

export function useAppInfoSecureBackupFlow(params: {
  config: AIConfig;
  setConfig: (next: AIConfig) => void;
  github: GitHubSelectionDeps;
}) {
  const { config, setConfig, github } = params;
  const [secureBackupRequest, setSecureBackupRequest] = useState<SecureBackupRequest | null>(null);
  const [secureBackupBusy, setSecureBackupBusy] = useState(false);
  const SECURE_BACKUP_IMPORT_JOURNAL_KEY = "secure_backup_import_recoverable_journal_v1";

  const collectSecretBackupPayload = useCallback(async () => {
    const [githubToken, expoToken, workflowAdminKey, androidKeystoreExportAdminKey, signingAdminKey, signingMasterKey] = await Promise.all([
      readSecretOrNull(getGitHubToken),
      readSecretOrNull(getExpoToken),
      readSecretOrNull(getWorkflowAdminKey),
      readSecretOrNull(getAndroidKeystoreExportAdminKey),
      readSecretOrNull(getSigningAdminKey),
      readSecretOrNull(getSigningMasterKey),
    ]);

    await removeLegacyClientServiceRoleKeys();

    const [supabaseRaw, supabaseUrl, supabaseAnonKey, easProjectId] = await Promise.all([
      readStorageOrNull(STORAGE_KEYS.SUPABASE_RAW),
      readStorageOrNull(STORAGE_KEYS.SUPABASE_URL),
      readSecretOrNull(getSupabaseAnonKey),
      readScopedEasProjectId(github.activeRepo),
    ]);

    const normalizedSupabaseRaw = normalizeStoredSupabaseRaw(supabaseRaw ?? "", supabaseUrl ?? "");

    return createCollectedSecretBackupPayload({
      connections: {
        supabaseRaw: normalizedSupabaseRaw,
        supabaseUrl: supabaseUrl ?? "",
        supabaseAnonKey: supabaseAnonKey ?? "",
        easProjectId: easProjectId ?? "",
      },
      tokens: { githubToken, expoToken, workflowAdminKey, androidKeystoreExportAdminKey, signingAdminKey, signingMasterKey },
      github: {
        linkedRepo: github.activeRepo,
        linkedBranch: github.activeBranch,
        recentRepos: github.recentRepos,
      },
    });
  }, [github.activeRepo, github.activeBranch, github.recentRepos]);

  const persistImportedConnectionSecrets = useCallback(async (payload: SecretBackupPayloadV1) => {
    const c = payload.connections;
    const normalizedSupabaseRaw = normalizeStoredSupabaseRaw(c.supabaseRaw, c.supabaseUrl);
    const easProjectIdDecision = resolveEasProjectIdImportDecision(c.easProjectId);

    await removeLegacyClientServiceRoleKeys();
    const writes: Promise<unknown>[] = [
      AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_RAW, normalizedSupabaseRaw),
      AsyncStorage.setItem(STORAGE_KEYS.SUPABASE_URL, c.supabaseUrl),
      saveSupabaseAnonKey(c.supabaseAnonKey),
    ];

    if (easProjectIdDecision.mode === "set") {
      writes.push(
        persistScopedEasProjectId({
          projectId: easProjectIdDecision.value,
          repoFullName: github.activeRepo,
        }),
      );
    } else if (easProjectIdDecision.mode === "clear") {
      writes.push(
        persistScopedEasProjectId({
          projectId: "",
          repoFullName: github.activeRepo,
        }),
      );
    } else {
      logger.warn("[useAppInfoScreen] Ignoriere ungueltige EAS Project ID aus Secret-Import.", {
        easProjectIdPreview: easProjectIdDecision.value.slice(0, 8),
      });
    }

    await Promise.all(writes);
  }, [github.activeRepo]);

  const persistImportedTokenSecrets = useCallback(async (payload: SecretBackupPayloadV1) => {
    const tokens = readAppliedSecretTokens(payload);
    await persistAppliedSecretTokens(tokens, {
      saveGitHubToken,
      deleteGitHubToken,
      saveExpoToken,
      deleteExpoToken,
      saveWorkflowAdminKey,
      deleteWorkflowAdminKey,
      saveAndroidKeystoreExportAdminKey,
      deleteAndroidKeystoreExportAdminKey,
      saveSigningAdminKey,
      deleteSigningAdminKey,
      saveSigningMasterKey,
      deleteSigningMasterKey,
    });
  }, []);

  const hydrateImportedGitHubSelection = useCallback(async (payload: SecretBackupPayloadV1) => {
    await hydrateGitHubSelectionFromBackup(payload.github, {
      clearRecentRepos: github.clearRecentRepos,
      addRecentRepo: github.addRecentRepo,
      setLinkedRepo: github.setLinkedRepo,
    });
  }, [github.addRecentRepo, github.clearRecentRepos, github.setLinkedRepo]);

  const applySecretBackupPayloadCore = useCallback(async (payload: SecretBackupPayloadV1) => {
    await persistImportedConnectionSecrets(payload);
    await persistImportedTokenSecrets(payload);
    await hydrateImportedGitHubSelection(payload);
  }, [hydrateImportedGitHubSelection, persistImportedConnectionSecrets, persistImportedTokenSecrets]);

  const openSecureBackupFlow = useCallback((request: SecureBackupRequest) => {
    setSecureBackupRequest(request);
  }, []);

  const handleExportSecretsBackup = useCallback(() => {
    openSecureBackupFlow({ mode: "export", scope: "secrets" });
  }, [openSecureBackupFlow]);

  const handleExportConfigSecretsBackup = useCallback(() => {
    openSecureBackupFlow({ mode: "export", scope: "config-secrets" });
  }, [openSecureBackupFlow]);

  const handleImportSecureBackup = useCallback(() => {
    Alert.alert(
      "⚠️ Gesichertes Backup importieren",
      "Dieses Backup stellt nur Secrets/Tokens/Connections und optional die AI-/KI-Konfiguration wieder her. Projektdateien, Chats und ZIP-Inhalte gehören nicht in diesen Pfad. Fortfahren?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Weiter",
          style: "destructive",
          onPress: () => openSecureBackupFlow({ mode: "import" }),
        },
      ],
    );
  }, [openSecureBackupFlow]);

  const closeSecureBackupPrompt = useCallback(() => {
    if (secureBackupBusy) return;
    setSecureBackupRequest(null);
  }, [secureBackupBusy]);

  const runSecureBackupExport = useCallback(async (passphrase: string, scope: SecureBackupScope) => {
    const secretPayload = await collectSecretBackupPayload();
    const payload: SecureBackupPayloadV1 =
      scope === "secrets"
        ? secretPayload
        : createConfigAndSecretsBackupPayload({ aiConfig: config, secrets: secretPayload });

    const result = await exportEncryptedScopedBackup({ scope, passphrase, payload });

    Alert.alert(
      "✅ Export erfolgreich",
      getSecureBackupExportSuccessMessage({ scope, fileName: result.fileName }),
    );
  }, [collectSecretBackupPayload, config]);

  const runSecureBackupImport = useCallback(async (passphrase: string) => {
    const result = await importEncryptedScopedBackup(passphrase);
    const imported = result.data;
    const secretPayload = imported.kind === "config-secret-snapshot" ? imported.secrets : imported;
    await recoverFromPendingJournal<SecretBackupPayloadV1>({
      journalKey: SECURE_BACKUP_IMPORT_JOURNAL_KEY,
      flow: "secure_backup_import",
      restoreSnapshot: applySecretBackupPayloadCore,
    });
    const rollbackSecrets = await collectSecretBackupPayload();

    await runRecoverableCommit({
      journalKey: SECURE_BACKUP_IMPORT_JOURNAL_KEY,
      flow: "secure_backup_import",
      snapshot: rollbackSecrets,
      apply: async () => {
        await applySecretBackupPayloadCore(secretPayload);
        await resetDerivedStatusAfterSecretImport();
      },
      rollback: async (snapshot) => applySecretBackupPayloadCore(snapshot),
    });

    if (imported.kind === "config-secret-snapshot") {
      setConfig(sanitizeAiConfigFromBackup(imported.aiConfig, config));
    }

    const exportDate = safeFormatBackupDate(result.exportDate);
    const scopeText = getSecureBackupImportScopeText(imported);
    Alert.alert(
      "✅ Import erfolgreich",
      `Gesichertes Backup wurde importiert. Wiederhergestellt: ${scopeText}.\n\nBackup-Datum: ${exportDate}\n\nProjektdateien, Chats und ZIP-Inhalte wurden nicht berührt.`,
    );
  }, [applySecretBackupPayloadCore, collectSecretBackupPayload, setConfig, config]);

  const handleSubmitSecureBackupPassphrase = useCallback(async (passphrase: string) => {
    if (!secureBackupRequest || secureBackupBusy) return;

    setSecureBackupBusy(true);
    try {
      if (secureBackupRequest.mode === "export") {
        await runSecureBackupExport(passphrase, secureBackupRequest.scope);
      } else {
        await runSecureBackupImport(passphrase);
      }
      setSecureBackupRequest(null);
    } catch (error: unknown) {
      if (isAbortLikeError(error)) {
        logger.info("[useAppInfoScreen] Secure-Backup-Flow wurde abgebrochen.");
      } else {
        Alert.alert("Fehler beim gesicherten Backup", getErrorMessage(error, "Backup fehlgeschlagen"));
      }
    } finally {
      setSecureBackupBusy(false);
    }
  }, [secureBackupRequest, secureBackupBusy, runSecureBackupExport, runSecureBackupImport]);

  return {
    secureBackupRequest,
    secureBackupBusy,
    closeSecureBackupPrompt,
    handleSubmitSecureBackupPassphrase,
    handleExportSecretsBackup,
    handleExportConfigSecretsBackup,
    handleImportSecureBackup,
  };
}
