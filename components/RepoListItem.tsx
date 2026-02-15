// components/RepoListItem.tsx - Repository list item component
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';
import { GitHubRepo } from '../hooks/useGitHubRepos';

type Props = {
  repo: GitHubRepo;
  isActive: boolean;
  onPress: (repo: GitHubRepo) => void;
  onDelete: (repo: GitHubRepo) => void;
};

export const RepoListItem = React.memo<Props>(({ repo, isActive, onPress, onDelete }) => {
  return (
    <View style={[styles.container, isActive && styles.containerActive]}>
      <View
        style={[
          styles.lamp,
          isActive ? styles.lampOn : styles.lampOff,
        ]}
      />
      <TouchableOpacity style={styles.info} onPress={() => onPress(repo)}>
        <Text style={styles.name}>{repo.name}</Text>
        <Text style={styles.fullName}>{repo.full_name}</Text>
        {repo.description && (
          <Text style={styles.description} numberOfLines={2}>
            {repo.description}
          </Text>
        )}
        <Text style={styles.meta}>
          Zuletzt aktualisiert: {new Date(repo.updated_at).toLocaleString()}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(repo)}>
        <Text style={styles.deleteButtonText}>🗑</Text>
      </TouchableOpacity>
    </View>
  );
});

RepoListItem.displayName = 'RepoListItem';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    marginBottom: 10,
  },
  containerActive: {
    borderColor: theme.palette.primary,
    backgroundColor: 'rgba(0, 255, 0, 0.06)',
    ...theme.glow.primarySubtle,
  },
  lamp: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 10,
    borderWidth: 1,
  },
  lampOff: {
    backgroundColor: theme.palette.border,
    borderColor: theme.palette.borderLight,
  },
  lampOn: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primaryLight,
    ...theme.glow.primarySubtle,
  },
  info: {
    flex: 1,
    paddingRight: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  fullName: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  description: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginTop: 4,
  },
  deleteButton: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
  },
});
