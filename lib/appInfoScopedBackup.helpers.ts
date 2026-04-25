import {
  asRecord,
  isRecord,
  readOptionalString,
  readString,
  readStringArray,
  readStringRecord,
} from "./validation/recordReaders";
import {
  type SecretBackupPayloadV1,
  type SecretConnectionsSnapshotV1,
  type SecretGithubContextSnapshotV1,
  type SecretTokensSnapshotV1,
} from "./appInfoScopedBackup";

export function buildSecretConnectionsSnapshot(input: SecretConnectionsSnapshotV1): SecretConnectionsSnapshotV1 {
  return {
    supabaseRaw: readString(input.supabaseRaw),
    supabaseUrl: readString(input.supabaseUrl),
    supabaseAnonKey: readString(input.supabaseAnonKey),
    easProjectId: readString(input.easProjectId),
  };
}

export function buildSecretTokensSnapshot(input: SecretTokensSnapshotV1): SecretTokensSnapshotV1 {
  return {
    githubToken: readOptionalString(input.githubToken),
    expoToken: readOptionalString(input.expoToken),
    workflowAdminKey: readOptionalString(input.workflowAdminKey),
    androidKeystoreExportAdminKey: readOptionalString(input.androidKeystoreExportAdminKey),
    legacyEdgeAdminKey: null,
    signingAdminKey: readOptionalString(input.signingAdminKey),
    signingMasterKey: readOptionalString(input.signingMasterKey),
  };
}

export function buildSecretGithubContext(input: SecretGithubContextSnapshotV1): SecretGithubContextSnapshotV1 {
  return {
    linkedRepo:
      readOptionalString(input.linkedRepo) ??
      readOptionalString(input.activeRepo),
    linkedBranch:
      readOptionalString(input.linkedBranch) ??
      readOptionalString(input.activeBranch),
    recentRepos: readStringArray(input.recentRepos),
  };
}

export function buildCiSecretsSnapshot(ciSecrets: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(ciSecrets ?? {}).map(([key, value]) => [key, readString(value)]),
  );
}

export function sanitizeSecretPayloadRecord(
  raw: unknown,
  expectedVersion: SecretBackupPayloadV1["version"],
): SecretBackupPayloadV1 {
  if (!isRecord(raw) || raw.kind !== "secret-snapshot" || raw.version !== expectedVersion) {
    throw new Error("Ungültiger Secret-Backup-Inhalt");
  }

  const connections = asRecord(raw.connections) ?? {};
  const tokens = asRecord(raw.tokens) ?? {};
  const ciSecrets = asRecord(raw.ciSecrets) ?? {};
  const github = asRecord(raw.github) ?? {};

  return {
    kind: "secret-snapshot",
    version: expectedVersion,
    exportDate: readString(raw.exportDate),
    connections: {
      supabaseRaw: readString(connections.supabaseRaw),
      supabaseUrl: readString(connections.supabaseUrl),
      supabaseAnonKey: readString(connections.supabaseAnonKey),
      easProjectId: readString(connections.easProjectId),
    },
    tokens: {
      githubToken: readOptionalString(tokens.githubToken),
      expoToken: readOptionalString(tokens.expoToken),
      edgeAdminKey: readOptionalString(tokens.edgeAdminKey),
      workflowAdminKey:
        readOptionalString(tokens.workflowAdminKey) ??
        readOptionalString(tokens.edgeAdminKey),
      androidKeystoreExportAdminKey: readOptionalString(tokens.androidKeystoreExportAdminKey),
      legacyEdgeAdminKey:
        readOptionalString(tokens.legacyEdgeAdminKey) ??
        readOptionalString(tokens.edgeAdminKey),
      signingAdminKey: readOptionalString(tokens.signingAdminKey),
      signingMasterKey: readOptionalString(tokens.signingMasterKey),
    },
    ciSecrets: readStringRecord(ciSecrets) ?? {},
    github: {
      linkedRepo:
        readOptionalString(github.linkedRepo) ??
        readOptionalString(github.activeRepo),
      linkedBranch:
        readOptionalString(github.linkedBranch) ??
        readOptionalString(github.activeBranch),
      recentRepos: readStringArray(github.recentRepos),
    },
  };
}
