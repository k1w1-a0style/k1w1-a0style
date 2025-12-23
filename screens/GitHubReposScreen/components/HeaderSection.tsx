import React, { memo } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

export const HeaderSection = memo(function HeaderSection() {
  return (
    <View style={styles.headerSection}>
      <Ionicons name="logo-github" size={32} color={theme.palette.primary} />
      <View style={styles.headerText}>
        <Text style={styles.title}>GitHub Repositories</Text>
        <Text style={styles.subtitle}>
          Verwalte deine Repos, verknüpfe sie mit dem Projekt und nutze
          Push/Pull für den Builder-Flow.
        </Text>
      </View>
    </View>
  );
});
