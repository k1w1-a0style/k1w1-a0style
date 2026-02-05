import React from "react";
import { Text, View } from "react-native";

import { styles } from "../../../styles/enhancedBuildScreenStyles";

export function HeaderSection({
  projectName,
}: {
  projectName?: string | null;
}): React.ReactElement {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>🛠️ Build</Text>
      <Text style={styles.subtitle}>
        {projectName ? `Projekt: ${projectName}` : "Build-Status & GitHub Actions"}
      </Text>
    </View>
  );
}
