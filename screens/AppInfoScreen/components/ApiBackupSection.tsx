import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";

type Props = {
  styles: any;
  handleExportAPIConfig: () => void;
  handleImportAPIConfig: () => void;
};

export function ApiBackupSection({
  styles,
  handleExportAPIConfig,
  handleImportAPIConfig,
}: Props) {
  return (
    <>
      <Text style={styles.sectionTitle}>💾 API-/KI-Konfiguration</Text>
      <View style={styles.apiBackupContainer}>
        <Text style={styles.apiBackupDescription}>
          Exportiere oder importiere nur die AI-/Provider-Konfiguration. Keine Projektdateien, keine Chats und keine Secret-/Token-Backups.
        </Text>

        <View style={styles.apiBackupButtons}>
          <TouchableOpacity onPress={handleExportAPIConfig} style={styles.backupButton}>
            <Ionicons
              name="download-outline"
              size={20}
              color={theme.palette.primary}
            />
            <Text style={styles.backupButtonText}>Konfig exportieren</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleImportAPIConfig}
            style={[styles.backupButton, styles.restoreButton]}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={20}
              color={theme.palette.warning}
            />
            <Text style={[styles.backupButtonText, styles.restoreButtonText]}>
              Konfig importieren
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
