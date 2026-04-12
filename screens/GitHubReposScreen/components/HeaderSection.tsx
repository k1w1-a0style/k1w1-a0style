import React, { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

type HeaderSectionProps = {
  userLogin: string;
  activeRepo: string | null;
  activeBranch: string | null;
  onNewRepo: () => void;
  onRefresh: () => void;
  syncStatus?: {
    checking: boolean;
    modified: number;
    localOnly: number;
    remoteOnly: number;
    skipped: number;
    error: number;
    checkedLocalFiles: number;
    totalLocalFiles: number;
    isPartial: boolean;
    partialReason: string | null;
    countsAreLowerBounds: boolean;
    checkedAt: number | null;
  };
  onCheckStatus?: () => void;
};

export const HeaderSection = memo(function HeaderSection({
  userLogin,
  activeRepo,
  activeBranch,
  onNewRepo,
  onRefresh,
  syncStatus,
  onCheckStatus,
}: HeaderSectionProps) {
  const dirtyCount =
    (syncStatus?.modified || 0) + (syncStatus?.localOnly || 0) + (syncStatus?.remoteOnly || 0);
  const isPartial = !!syncStatus?.isPartial;
  const isDirty = dirtyCount > 0;
  const countPrefix = syncStatus?.countsAreLowerBounds ? "≥" : "";
  const statusLabel = syncStatus?.checking
    ? "prüfe…"
    : isPartial
      ? isDirty
        ? `dirty ${countPrefix}${dirtyCount}`
        : "teilweise geprüft"
      : isDirty
        ? `dirty ${dirtyCount}`
        : "clean";
  const lastCheckedLabel = syncStatus?.checkedAt
    ? `Zuletzt geprüft: ${new Date(syncStatus.checkedAt).toLocaleTimeString()}`
    : "Noch nicht frisch geprüft";

  return (
    <View style={styles.headerSection}>
      <View style={[styles.headerIcon, styles.neonGlow]}>
        <Ionicons name="logo-github" size={20} color={theme.palette.primary} />
      </View>

      <View style={styles.headerText}>
        <Text style={styles.title} numberOfLines={1}>
          GitHub Repos
        </Text>

        <View style={styles.subtitleRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Text style={[styles.subtitle, { flex: 1 }]} numberOfLines={1}>
              {userLogin ? `${userLogin} • ` : ""}
              {activeRepo ? `Repo: ${activeRepo}` : "Kein Repo gewählt"}
              {activeBranch ? ` • Branch: ${activeBranch}` : ""}
            </Text>

            {activeRepo ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: theme.palette.border,
                  backgroundColor: isDirty
                    ? "rgba(255, 99, 71, 0.12)"
                    : "rgba(0, 255, 160, 0.10)",
                }}
              >
                <Text style={{ fontSize: 10, color: theme.palette.text.secondary }}>
                  {statusLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {!!activeRepo && (
          <Text style={[styles.subtitle, { marginTop: 4 }]} numberOfLines={1}>
            {syncStatus?.checking
              ? "Statusprüfung läuft… (frischer Check)"
              : syncStatus?.partialReason || lastCheckedLabel}
          </Text>
        )}
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={onNewRepo}>
          <Ionicons name="add" size={18} color={theme.palette.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={18} color={theme.palette.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onCheckStatus}
          disabled={!activeRepo || !!syncStatus?.checking}
          accessibilityRole="button"
          accessibilityLabel="Status prüfen"
        >
          <Ionicons
            name="pulse"
            size={18}
            color={activeRepo ? theme.palette.primary : theme.palette.text.muted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});
