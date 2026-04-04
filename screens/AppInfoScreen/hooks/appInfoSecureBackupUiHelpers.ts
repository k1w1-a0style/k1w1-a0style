import type { SecureBackupPayloadV1 } from "../../../lib/appInfoScopedBackup";

export function getSecureBackupExportSuccessMessage(input: {
  scope: "secrets" | "config-secrets";
  fileName: string;
}): string {
  return input.scope === "secrets"
    ? `Secrets-/Token-Backup wurde verschlüsselt als "${input.fileName}" exportiert. Keine Projektdateien oder Chats sind enthalten.`
    : `Gesichertes Konfig-Backup wurde verschlüsselt als "${input.fileName}" exportiert. Enthalten sind nur AI-/KI-Konfiguration plus Secrets/Connections – keine Projektdateien.`;
}

export function getSecureBackupImportScopeText(imported: SecureBackupPayloadV1): string {
  return imported.kind === "config-secret-snapshot"
    ? "AI-/KI-Konfiguration plus Secrets/Connections"
    : "Secrets/Tokens/Connections";
}
