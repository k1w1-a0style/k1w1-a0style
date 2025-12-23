// screens/CodeScreen/components/LoadingView.tsx
import React from "react";
import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../../theme";
import { styles } from "../styles";

export const LoadingView: React.FC = () => {
  return (
    <SafeAreaView
      edges={["left", "right", "bottom"]}
      style={[styles.container, styles.centered]}
    >
      <ActivityIndicator size="large" color={theme.palette.primary} />
      <Text style={styles.loadingText}>Projekt wird geladen...</Text>
    </SafeAreaView>
  );
};
