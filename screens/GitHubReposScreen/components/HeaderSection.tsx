import React, { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

type HeaderSectionProps = {
  userLogin: string;
  activeRepo: string | null;
  activeBranch: string | null;
  showRepoList: boolean;
  onToggleRepoList: () => void;
  onNewRepo: () => void;
  onRenameRepo: () => void;
  onDeleteRepo: () => void;
  onRefresh: () => void;
  syncStatus?: {
    checking: boolean;
    modified: number;
    localOnly: number;
    remoteOnly: number;
    skipped: number;
    error: number;
    checkedAt: number | null;
  };
  onCheckStatus?: () => void;
};

export const HeaderSection = memo(function HeaderSection({
  userLogin,
  activeRepo,
  activeBranch,
  showRepoList,
  onToggleRepoList,
  onNewRepo,
  onRenameRepo,
  onDeleteRepo,
  onRefresh,
  syncStatus,
  onCheckStatus,
}: HeaderSectionProps) {
  const dirtyCount =
    (syncStatus?.modified || 0) + (syncStatus?.localOnly || 0) + (syncStatus?.remoteOnly || 0);

  return (
    <View style={styles.headerSection}>
      <View style={[styles.headerIcon, styles.neonGlow]}>
        <Ionicons name="logo-github" size={20} color={theme.palette.primary} />
      </View>

      <View style={styles.headerText}>
        <Text style={styles.title}>GitHub Repos</Text>

        <TouchableOpacity
          style={styles.subtitleRow}
          onPress={onToggleRepoList}
          accessibilityRole="button"
          accessibilityLabel="Repo Auswahl öffnen"
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Text style={[styles.subtitle, { flex: 1 }]} numberOfLines={1}>
              {userLogin ? `${userLogin} • ` : ""}
              {activeRepo ? activeRepo : "Kein Repo gewählt"}
              {activeBranch ? ` • ${activeBranch}` : ""}
            </Text>

            {activeRepo ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: theme.palette.border,
                  backgroundColor: dirtyCount ? "rgba(255, 99, 71, 0.12)" : "rgba(0, 255, 160, 0.10)",
                }}
              >
                <Text style={{ fontSize: 10, color: theme.palette.text.secondary }}>
                  {syncStatus?.checking ? "prüfe…" : dirtyCount ? `dirty ${dirtyCount}` : "clean"}
                </Text>
              </View>
            ) : null}
          </View>
          <Ionicons
            name={showRepoList ? "chevron-up" : "chevron-down"}
            size={16}
            color={theme.palette.text.secondary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={onNewRepo}>
          <Ionicons name="add" size={18} color={theme.palette.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onRenameRepo}
          disabled={!activeRepo}
        >
          <Ionicons
            name="pencil"
            size={18}
            color={activeRepo ? theme.palette.primary : theme.palette.text.muted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onDeleteRepo}
          disabled={!activeRepo}
        >
          <Ionicons
            name="trash"
            size={18}
            color={activeRepo ? theme.palette.error : theme.palette.text.muted}
          />
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
