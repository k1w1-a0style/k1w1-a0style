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

export function readAppliedSecretTokens(payload: SecretBackupPayloadV1): {
  githubToken: string;
  expoToken: string;
  workflowAdminKey: string;
  androidKeystoreExportAdminKey: string;
  signingAdminKey: string;
  signingMaster: string;
} {
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
