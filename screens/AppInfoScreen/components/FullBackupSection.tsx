import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";

type Props = {
  styles: any;
  handleExportFullBackup: () => void;
  handleImportFullBackup: () => void;
};

export function FullBackupSection({
  styles,
  handleExportFullBackup,
  handleImportFullBackup,
}: Props) {
  return (
    <>
      {/* FULL BACKUP & RESTORE */}
      <Text style={styles.sectionTitle}>🔐 Voll-Backup (ALLE Tokens)</Text>
      <View style={styles.apiBackupContainer}>
        <Text style={styles.apiBackupDescription}>
          Exportiert/Importiert wirklich alles: GitHub/Expo/Supabase/AI Tokens +
          Connections + AI Config.
        </Text>
        <Text style={styles.hint}>
          ⚠️ Enthält Secrets im Klartext. Datei nur sicher speichern!
        </Text>

        <View style={styles.apiBackupButtons}>
          <TouchableOpacity onPress={handleExportFullBackup} style={styles.backupButton}>
            <Ionicons
              name="download-outline"
              size={20}
              color={theme.palette.primary}
            />
            <Text style={styles.backupButtonText}>Voll-Export</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleImportFullBackup}
            style={[styles.backupButton, styles.restoreButton]}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={20}
              color={theme.palette.warning}
            />
            <Text style={[styles.backupButtonText, styles.restoreButtonText]}>
              Voll-Import
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
