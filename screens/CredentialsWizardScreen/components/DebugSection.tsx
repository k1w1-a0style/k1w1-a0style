import React from "react";
import { LayoutAnimation, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { theme } from "../../../theme";
import { SectionCard } from "../../../components/diagnostics/SectionCard";

import { styles } from "../styles";
import type { WizardHttpDebug } from "../types";

export function DebugSection({
  lastDebug,
  prettyDebug,
  showDebug,
  setShowDebug,
  onCopyDebug,
}: {
  lastDebug: WizardHttpDebug;
  prettyDebug: string;
  showDebug: boolean;
  setShowDebug: (v: boolean) => void;
  onCopyDebug: () => void | Promise<void>;
}) {
  return (
    <SectionCard
      title="Request Debug"
      subtitle="URL + status + body"
      icon="bug-outline"
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void onCopyDebug()}
            style={styles.iconBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="copy-outline" size={16} color={theme.palette.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowDebug(!showDebug);
            }}
            style={styles.iconBtn}
            activeOpacity={0.85}
          >
            <Ionicons name={showDebug ? "chevron-up" : "chevron-down"} size={16} color={theme.palette.text.primary} />
          </TouchableOpacity>
        </View>
      }
    >
      <Text style={styles.mutedLine} numberOfLines={2}>
        {lastDebug.url}
      </Text>
      <Text style={styles.mutedLine}>
        HTTP {lastDebug.status} {lastDebug.statusText || ""}
      </Text>

      {showDebug ? (
        <View style={styles.codeBox}>
          <Text selectable style={styles.codeText}>
            {prettyDebug}
          </Text>
        </View>
      ) : null}
    </SectionCard>
  );
}
