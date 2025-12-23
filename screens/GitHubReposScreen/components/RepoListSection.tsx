import React, { memo, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
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
  const renderRepoItem = useCallback(
    ({ item }: { item: GitHubRepo }) => (
      <RepoListItem
        repo={item}
        isActive={item.full_name === activeRepo}
        onPress={onSelectRepo}
        onDelete={onDeleteRepo}
      />
    ),
    [activeRepo, onSelectRepo, onDeleteRepo],
  );

  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Repositories</Text>
        {loadingRepos && (
          <ActivityIndicator size="small" color={theme.palette.primary} />
        )}
      </View>

      <FlatList
        data={filteredRepos}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRepoItem}
        scrollEnabled={false}
      />
    </View>
  );
});
