import React, { memo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

type RepoSyncSectionProps = {
  activeRepo: string | null;
  activeBranch: string | null;
  hasLocalFiles: boolean;
  isPulling: boolean;
  isPushing: boolean;
  pullProgress: string;
  onPull: () => void;
  onPush: () => void;
};

export const RepoSyncSection = memo(function RepoSyncSection(props: RepoSyncSectionProps) {
  const {
    activeRepo,
    activeBranch,
    hasLocalFiles,
    isPulling,
    isPushing,
    pullProgress,
    onPull,
    onPush,
  } = props;

  const disabled = !activeRepo;
  const pushDisabled = disabled || !hasLocalFiles || isPushing || isPulling;
  const pullDisabled = disabled || isPulling || isPushing;

  return (
    <View style={[styles.section, styles.sectionNeon]}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Sync</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {(isPulling || isPushing) ? (
            <ActivityIndicator size="small" color={theme.palette.primary} />
          ) : null}
        </View>
      </View>

      <Text style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 18 }}>
        Repo: {activeRepo || "(nicht gewählt)"}
        {activeRepo ? ` • Branch: ${activeBranch || "(default)"}` : ""}
      </Text>
      <Text style={{ fontSize: 11, marginTop: 8, color: theme.palette.text.muted, lineHeight: 16 }}>
        Pull öffnet den Dialog mit Merge Overwrite / Merge Skip / Full Sync (Mirror). Mirror ist destruktiv und löscht lokale-only Dateien nur nach expliziter Bestätigung.
      </Text>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, { flex: 1, flexDirection: "row", gap: 8, justifyContent: "center" }, pullDisabled && styles.buttonDisabled]}
          onPress={onPull}
          disabled={pullDisabled}
          accessibilityRole="button"
          accessibilityLabel="Pull von GitHub"
        >
          <Ionicons name="download-outline" size={16} color={pullDisabled ? theme.palette.text.muted : theme.palette.text.primary} />
          <Text style={[styles.buttonTextSecondary, { color: pullDisabled ? theme.palette.text.muted : theme.palette.text.primary }]}>Pull (Dialog)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, { flex: 1, flexDirection: "row", gap: 8, justifyContent: "center" }, pushDisabled && styles.buttonDisabled]}
          onPress={onPush}
          disabled={pushDisabled}
          accessibilityRole="button"
          accessibilityLabel="Push nach GitHub"
        >
          <Ionicons name="cloud-upload-outline" size={16} color={pushDisabled ? theme.palette.text.muted : theme.palette.primary} />
          <Text style={[styles.buttonText, { color: pushDisabled ? theme.palette.text.muted : theme.palette.primary }]}>Push (Merge)</Text>
        </TouchableOpacity>
      </View>

      {isPulling && pullProgress ? (
        <Text style={{ fontSize: 11, marginTop: 10, color: theme.palette.text.secondary, lineHeight: 16 }}>
          {pullProgress}
        </Text>
      ) : null}

      {!activeRepo ? (
        <Text style={{ fontSize: 11, marginTop: 10, color: theme.palette.text.muted, lineHeight: 16 }}>
          Erst Repo wählen → dann Pull/Push.
        </Text>
      ) : null}
      {activeRepo && !hasLocalFiles ? (
        <Text style={{ fontSize: 11, marginTop: 10, color: theme.palette.text.muted, lineHeight: 16 }}>
          Keine lokalen Projektdateien gefunden → Push ist deaktiviert.
        </Text>
      ) : null}
    </View>
  );
});
