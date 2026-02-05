import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { theme } from "../../../theme";
import { styles } from "../styles";

export function HeaderSection({ subtitle }: { subtitle: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.h1}>Credentials Wizard</Text>
      <Text style={styles.p}>Android Signing (Supabase + CI)</Text>
      <View style={styles.headerMeta}>
        <Ionicons name="git-branch-outline" size={14} color={theme.palette.text.secondary} />
        <Text style={styles.headerMetaText}>{subtitle}</Text>
      </View>
    </View>
  );
}
