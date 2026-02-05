import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import { InputRow } from "./InputRow";

export function EasCard(props: {
  styles: any;
  easProjectId: string;
  onChangeEasProjectId: (v: string) => void;
}) {
  const { styles, easProjectId, onChangeEasProjectId } = props;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons
          name="rocket-outline"
          size={18}
          color={theme.palette.primary}
        />
        <Text style={styles.cardTitle}>EAS</Text>
      </View>

      <InputRow
        styles={styles}
        label="EAS Project ID (optional)"
        value={easProjectId}
        onChangeText={onChangeEasProjectId}
        placeholder="5e5a7791-8751-416b-9a1f-831adfffcb6c"
        rightHint="Wird beim EAS-Link genutzt"
      />

      <Text style={styles.hint}>
        EAS-Link/Init ist im Repo-Screen (dort wird auch geprüft/auto-fix:
        Workflow-Dateien im Ziel-Repo).
      </Text>
    </View>
  );
}
