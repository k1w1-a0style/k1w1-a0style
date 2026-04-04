import { createSecretBackupPayload, type SecretBackupPayloadV1 } from "../../../lib/appInfoScopedBackup";

type CollectSecretPayloadInput = {
  tokens: {
    githubToken: string | null;
    expoToken: string | null;
    workflowAdminKey: string | null;
    androidKeystoreExportAdminKey: string | null;
    signingAdminKey: string | null;
    signingMasterKey: string | null;
  };
  connections: {
    supabaseRaw: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    easProjectId: string;
  };
  github: {
    linkedRepo: string | null;
    linkedBranch: string | null;
    recentRepos: string[];
  };
};

export function createCollectedSecretBackupPayload(input: CollectSecretPayloadInput): SecretBackupPayloadV1 {
  const { tokens, connections, github } = input;
  return createSecretBackupPayload({
    connections,
    tokens: {
      githubToken: tokens.githubToken,
      expoToken: tokens.expoToken,
      workflowAdminKey: tokens.workflowAdminKey,
      androidKeystoreExportAdminKey: tokens.androidKeystoreExportAdminKey,
      legacyEdgeAdminKey: tokens.workflowAdminKey,
      signingAdminKey: tokens.signingAdminKey,
      signingMasterKey: tokens.signingMasterKey,
    },
    ciSecrets: {},
    github,
  });
}

export type AppliedSecretTokens = {
  githubToken: string;
  expoToken: string;
  workflowAdminKey: string;
  androidKeystoreExportAdminKey: string;
  signingAdminKey: string;
  signingMaster: string;
};

export function readAppliedSecretTokens(payload: SecretBackupPayloadV1): AppliedSecretTokens {
  const t = payload.tokens;
  const cs = payload.ciSecrets;
  return {
    githubToken: t.githubToken?.trim() || cs.GITHUB_TOKEN?.trim() || "",
    expoToken: t.expoToken?.trim() || cs.EXPO_TOKEN?.trim() || "",
    workflowAdminKey: t.workflowAdminKey?.trim() || cs.K1W1_EDGE_WORKFLOW_ADMIN_KEY?.trim() || "",
    androidKeystoreExportAdminKey:
      t.androidKeystoreExportAdminKey?.trim() || cs.K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY?.trim() || "",
    signingAdminKey: t.signingAdminKey?.trim() || cs.SIGNING_ADMIN_KEY?.trim() || "",
    signingMaster: t.signingMasterKey?.trim() || cs.SIGNING_MASTER_KEY?.trim() || "",
  };
}

type TokenPersistenceOps = {
  saveGitHubToken: (value: string) => Promise<void>;
  deleteGitHubToken: () => Promise<void>;
  saveExpoToken: (value: string) => Promise<void>;
  deleteExpoToken: () => Promise<void>;
  saveWorkflowAdminKey: (value: string) => Promise<void>;
  deleteWorkflowAdminKey: () => Promise<void>;
  saveAndroidKeystoreExportAdminKey: (value: string) => Promise<void>;
  deleteAndroidKeystoreExportAdminKey: () => Promise<void>;
  saveSigningAdminKey: (value: string) => Promise<void>;
  deleteSigningAdminKey: () => Promise<void>;
  saveSigningMasterKey: (value: string) => Promise<void>;
  deleteSigningMasterKey: () => Promise<void>;
};

async function persistOneToken(input: {
  value: string;
  save: (value: string) => Promise<void>;
  clear: () => Promise<void>;
}): Promise<void> {
  if (input.value) {
    await input.save(input.value);
    return;
  }
  await input.clear();
}

export async function persistAppliedSecretTokens(tokens: AppliedSecretTokens, ops: TokenPersistenceOps): Promise<void> {
  await persistOneToken({ value: tokens.githubToken, save: ops.saveGitHubToken, clear: ops.deleteGitHubToken });
  await persistOneToken({ value: tokens.expoToken, save: ops.saveExpoToken, clear: ops.deleteExpoToken });
  await persistOneToken({ value: tokens.workflowAdminKey, save: ops.saveWorkflowAdminKey, clear: ops.deleteWorkflowAdminKey });
  await persistOneToken({
    value: tokens.androidKeystoreExportAdminKey,
    save: ops.saveAndroidKeystoreExportAdminKey,
    clear: ops.deleteAndroidKeystoreExportAdminKey,
  });
  await persistOneToken({ value: tokens.signingAdminKey, save: ops.saveSigningAdminKey, clear: ops.deleteSigningAdminKey });
  await persistOneToken({ value: tokens.signingMaster, save: ops.saveSigningMasterKey, clear: ops.deleteSigningMasterKey });
}

type GitHubHydrationOps = {
  clearRecentRepos: () => void | Promise<void>;
  addRecentRepo: (repo: string) => void;
  setLinkedRepo: (repo: string | null, branch: string | null) => void;
};

export async function hydrateGitHubSelectionFromBackup(
  github: SecretBackupPayloadV1["github"],
  ops: GitHubHydrationOps,
): Promise<void> {
  await ops.clearRecentRepos();
  for (const repo of [...github.recentRepos].reverse()) {
    try {
      ops.addRecentRepo(repo);
    } catch {
      // ignore duplicates / no-op
    }
  }
  ops.setLinkedRepo(github.linkedRepo, github.linkedBranch);
}
