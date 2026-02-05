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
      <View style={[styles.headerIcon, styles.neonGlow]}>
        <Ionicons name="logo-github" size={20} color={theme.palette.primary} />
      </View>

      <View style={styles.headerText}>
        <Text style={styles.title}>GitHub Repos</Text>
        <Text style={styles.subtitle}>Repo- & Branch-Management</Text>

        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, showRepoList && styles.chipActive]}
            onPress={onToggleRepoList}
          >
            <Text style={[styles.chipText, showRepoList && styles.chipTextActive]}>Liste</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, showNewRepo && styles.chipActive]}
            onPress={onToggleNewRepo}
          >
            <Text style={[styles.chipText, showNewRepo && styles.chipTextActive]}>Neu</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, showAdvanced && styles.chipActive]}
            onPress={onToggleAdvanced}
          >
            <Text style={[styles.chipText, showAdvanced && styles.chipTextActive]}>Advanced</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={18} color={theme.palette.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, showAdvanced && styles.iconBtnActive]}
          onPress={onToggleAdvanced}
        >
          <Ionicons
            name={showAdvanced ? "sparkles" : "sparkles-outline"}
            size={18}
            color={theme.palette.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});
