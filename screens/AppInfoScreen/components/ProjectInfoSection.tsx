import React from "react";
import { View, Text } from "react-native";
import type { AppInfoProjectInfoData, AppInfoScreenStyles } from "../componentTypes";

type Props = {
  styles: AppInfoScreenStyles;
  projectData: AppInfoProjectInfoData;
  fileCount: number;
  messageCount: number;
};

export function ProjectInfoSection({
  styles,
  projectData,
  fileCount,
  messageCount,
}: Props) {
  return (
    <>
      {/* PROJEKT-INFO */}
      <Text style={styles.sectionTitle}>ℹ️ Aktuelles Projekt</Text>
      <View style={styles.projectInfoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Projekt-ID:</Text>
          <Text style={styles.infoValueMono} numberOfLines={1}>
            {projectData?.id ? projectData.id.substring(0, 13) + "..." : "N/A"}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Dateien:</Text>
          <Text style={styles.infoValue}>{fileCount}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nachrichten:</Text>
          <Text style={styles.infoValue}>{messageCount}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Letzte Änderung:</Text>
          <Text style={styles.infoValueMono} numberOfLines={1}>
            {projectData?.lastModified
              ? new Date(projectData.lastModified).toLocaleString("de-DE")
              : "N/A"}
          </Text>
        </View>
      </View>
    </>
  );
}
