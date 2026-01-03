import React, { memo } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { theme } from "../../../theme";
import { RepoListItem } from "../../../components/RepoListItem";
import { GitHubRepo } from "../../../hooks/useGitHubRepos";
import { styles } from "../styles";

interface RepoListSectionProps {
  loadingRepos: boolean;
  filteredRepos: GitHubRepo[];
  activeRepo: string | null;
  onSelectRepo: (repo: GitHubRepo) => void;
  onDeleteRepo: (repo: GitHubRepo) => void;
}

export const RepoListSection = memo(function RepoListSection({
  loadingRepos,
  filteredRepos,
  activeRepo,
  onSelectRepo,
  onDeleteRepo,
}: RepoListSectionProps) {
  const hasRepos = filteredRepos.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Repositories</Text>
        {loadingRepos && (
          <ActivityIndicator size="small" color={theme.palette.primary} />
        )}
      </View>

      {!loadingRepos && !hasRepos && (
        <View style={localStyles.emptyState}>
          <Text style={localStyles.emptyIcon}>📁</Text>
          <Text style={localStyles.emptyTitle}>Keine Repositories</Text>
          <Text style={localStyles.emptyText}>
            Lade Repos mit dem Button oben oder erstelle ein neues Repo.
          </Text>
        </View>
      )}

      {/* FIX: Map statt FlatList um VirtualizedList-in-ScrollView Warning zu vermeiden */}
      {filteredRepos.map((repo) => (
        <RepoListItem
          key={String(repo.id)}
          repo={repo}
          isActive={repo.full_name === activeRepo}
          onPress={onSelectRepo}
          onDelete={onDeleteRepo}
        />
      ))}
    </View>
  );
});

const localStyles = StyleSheet.create({
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },
  emptyText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    textAlign: "center",
    lineHeight: 18,
  },
});
