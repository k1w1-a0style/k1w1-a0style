import React, { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

type HeaderSectionProps = {
  showRepoList: boolean;
  onToggleRepoList: () => void;
  showNewRepo: boolean;
  onToggleNewRepo: () => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onRefresh: () => void;
};

export const HeaderSection = memo(function HeaderSection({
  showRepoList,
  onToggleRepoList,
  showNewRepo,
  onToggleNewRepo,
  showAdvanced,
  onToggleAdvanced,
  onRefresh,
}: HeaderSectionProps) {
  return (
    <View style={styles.headerSection}>
      <View style={styles.headerIcon}>
        <Ionicons name="logo-github" size={20} color={theme.palette.primary} />
      </View>

      <View style={styles.headerText}>
        <Text style={styles.title}>GitHub Repos</Text>
        <Text style={styles.subtitle}>Repo- & Branch-Management</Text>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={18} color={theme.palette.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, showRepoList && styles.iconBtnActive]}
          onPress={onToggleRepoList}
        >
          <Ionicons name="list" size={18} color={theme.palette.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, showNewRepo && styles.iconBtnActive]}
          onPress={onToggleNewRepo}
        >
          <Ionicons name="add" size={18} color={theme.palette.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, showAdvanced && styles.iconBtnActive]}
          onPress={onToggleAdvanced}
        >
          <Ionicons name="sparkles" size={18} color={theme.palette.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});
