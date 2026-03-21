import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";

type Props = {
  styles: any;
  handleExportSecretsBackup: () => void;
  handleExportConfigSecretsBackup: () => void;
  handleImportSecureBackup: () => void;
};

export function SecureBackupSection({
  styles,
  handleExportSecretsBackup,
  handleExportConfigSecretsBackup,
  handleImportSecureBackup,
}: Props) {
  return (
    <>
      <Text style={styles.sectionTitle}>🔐 Gesicherte Secret-/Config-Backups</Text>
      <View style={styles.apiBackupContainer}>
        <Text style={styles.apiBackupDescription}>
          Dieser Pfad sichert nur Secrets/Tokens, Connection-Werte und optional die
          AI-/KI-Konfiguration. Projektdateien, Projektstruktur, Chats und sonstige
          Inhalte gehören weiter in den ZIP-Export/-Import.
        </Text>
        <Text style={styles.hint}>
          Alle Secret-Backups werden lokal vor dem Teilen per Passwort/PIN verschlüsselt.
        </Text>

        <View style={styles.backupButtonStack}>
          <TouchableOpacity onPress={handleExportSecretsBackup} style={styles.backupButton}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.palette.primary} />
            <Text style={styles.backupButtonText}>Secrets/Tokens sichern</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleExportConfigSecretsBackup} style={styles.backupButton}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.palette.primary} />
            <Text style={styles.backupButtonText}>Config + Secrets sichern</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleImportSecureBackup}
            style={[styles.backupButton, styles.restoreButton]}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={theme.palette.warning} />
            <Text style={[styles.backupButtonText, styles.restoreButtonText]}>
              Gesichertes Backup importieren
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
