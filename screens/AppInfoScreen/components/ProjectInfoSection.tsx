import React from "react";
import { Text, View } from "react-native";
import type { ProjectData } from "../../../contexts/types";
import { styles } from "../styles";

type Props = {
  projectData: ProjectData | null;
  fileCount: number;
  messageCount: number;
};

export const ProjectInfoSection = ({
  projectData,
  fileCount,
  messageCount,
}: Props) => {
  return (
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
  );
};
