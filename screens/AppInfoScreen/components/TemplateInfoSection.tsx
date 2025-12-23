import React from "react";
import { Text, View } from "react-native";
import { styles } from "../styles";
import { TEMPLATE_INFO } from "../constants";

export const TemplateInfoSection = ({ fileCount }: { fileCount: number }) => {
  return (
    <View style={styles.templateInfoContainer}>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Template:</Text>
        <Text style={styles.infoValue}>{TEMPLATE_INFO.name}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Expo SDK:</Text>
        <Text style={styles.infoValue}>{TEMPLATE_INFO.sdkVersion}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>React Native:</Text>
        <Text style={styles.infoValue}>{TEMPLATE_INFO.rnVersion}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Standard-Dateien:</Text>
        <Text style={styles.infoValue}>{fileCount}</Text>
      </View>
      <Text style={styles.infoHint}>
        ℹ️ Neue Projekte starten automatisch mit diesem Template.
      </Text>
    </View>
  );
};
