import React, { memo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { theme } from "../../../theme";
import { styles } from "../styles";

interface ActionsSectionProps {
  activeRepo: string | null;

  isPushing: boolean;
  onPush: () => void;

  isPulling: boolean;
  onPull: () => void;

  isSyncingSecrets: boolean;
  onSyncSecrets: () => void;

  onOpenRepoOnGitHub: () => void;
  onOpenManage: () => void;

  pullProgress: string;
}

export const ActionsSection = memo(function ActionsSection({
  activeRepo,
  isPushing,
  onPush,
  isPulling,
  onPull,
  isSyncingSecrets,
  onSyncSecrets,
  onOpenRepoOnGitHub,
  onOpenManage,
  pullProgress,
}: ActionsSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Actions</Text>

      {!activeRepo ? (
        <Text style={styles.smallLabel}>
          Wähle zuerst ein Repo aus, dann kannst du push/pull/secrets nutzen.
        </Text>
      ) : (
        <>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, (isPushing || isPulling) && styles.buttonDisabled]}
              onPress={onPush}
              disabled={isPushing || isPulling}
            >
              {isPushing ? (
                <ActivityIndicator size="small" color={theme.palette.primary} />
              ) : (
                <Text style={styles.actionButtonText}>Push</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, (isPushing || isPulling) && styles.buttonDisabled]}
              onPress={onPull}
              disabled={isPushing || isPulling}
            >
              {isPulling ? (
                <ActivityIndicator size="small" color={theme.palette.primary} />
              ) : (
                <Text style={styles.actionButtonText}>Pull</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, (isSyncingSecrets || isPushing || isPulling) && styles.buttonDisabled]}
              onPress={onSyncSecrets}
              disabled={isSyncingSecrets || isPushing || isPulling}
            >
              {isSyncingSecrets ? (
                <ActivityIndicator size="small" color={theme.palette.primary} />
              ) : (
                <Text style={styles.actionButtonText}>Secrets</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={onOpenRepoOnGitHub}>
              <Text style={styles.actionButtonText}>GitHub</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={onOpenManage}>
              <Text style={styles.actionButtonText}>Manage</Text>
            </TouchableOpacity>
          </View>

          {!!pullProgress && <Text style={styles.progressText}>{pullProgress}</Text>}
        </>
      )}
    </View>
  );
});
