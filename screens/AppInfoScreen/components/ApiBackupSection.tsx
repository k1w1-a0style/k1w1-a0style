import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

type Props = {
  onExport: () => void;
  onImport: () => void;
};

export const ApiBackupSection = ({ onExport, onImport }: Props) => {
  return (
    <View style={styles.apiBackupContainer}>
      <Text style={styles.apiBackupDescription}>
        Exportiere oder importiere alle API-Keys und Einstellungen als Datei.
      </Text>

      <View style={styles.apiBackupButtons}>
        <TouchableOpacity onPress={onExport} style={styles.backupButton}>
          <Ionicons
            name="download-outline"
            size={20}
            color={theme.palette.primary}
          />
          <Text style={styles.backupButtonText}>Exportieren</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onImport}
          style={[styles.backupButton, styles.restoreButton]}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={20}
            color={theme.palette.warning}
          />
          <Text style={[styles.backupButtonText, styles.restoreButtonText]}>
            Importieren
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
