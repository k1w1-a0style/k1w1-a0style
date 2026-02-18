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
}: HeaderSectionProps) {
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
          <Text style={styles.subtitle} numberOfLines={1}>
            {userLogin ? `${userLogin} • ` : ""}
            {activeRepo ? activeRepo : "Kein Repo gewählt"}
            {activeBranch ? ` • ${activeBranch}` : ""}
          </Text>
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
      </View>
    </View>
  );
});
