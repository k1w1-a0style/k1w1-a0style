import React from "react";
import { LayoutAnimation, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { theme } from "../../../theme";
import { SectionCard } from "../../../components/diagnostics/SectionCard";

import { InlineHint } from "./ui";
import { styles } from "../styles";

export function ErrorSection({
  lastError,
  prettyError,
  showError,
  setShowError,
  onCopyError,
}: {
  lastError: string;
  prettyError: string;
  showError: boolean;
  setShowError: (v: boolean) => void;
  onCopyError: () => void | Promise<void>;
}) {
  return (
    <SectionCard
      title="Error"
      subtitle="Letzte Anfrage"
      icon="alert-circle-outline"
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void onCopyError()}
            style={styles.iconBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="copy-outline" size={16} color={theme.palette.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowError(!showError);
            }}
            style={styles.iconBtn}
            activeOpacity={0.85}
          >
            <Ionicons name={showError ? "chevron-up" : "chevron-down"} size={16} color={theme.palette.text.primary} />
          </TouchableOpacity>
        </View>
      }
    >
      <InlineHint icon="close-circle-outline" tone="danger" text={lastError} />
      {showError ? (
        <View style={styles.codeBox}>
          <Text selectable style={styles.codeText}>
            {prettyError}
          </Text>
        </View>
      ) : null}
    </SectionCard>
  );
}
