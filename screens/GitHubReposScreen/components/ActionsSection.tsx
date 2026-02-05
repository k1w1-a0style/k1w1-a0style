import React, { memo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  const busyPrimary = isPushing || isPulling;

  return (
    <View style={[styles.section, activeRepo && styles.sectionNeon]}>
      <Text style={styles.sectionTitle}>Actions</Text>

      {!activeRepo ? (
        <Text style={styles.smallLabel}>
          Wähle zuerst ein Repo aus, dann kannst du push/pull/secrets nutzen.
        </Text>
      ) : (
        <>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonPrimary,
                busyPrimary && styles.buttonDisabled,
              ]}
              onPress={onPush}
              disabled={busyPrimary}
            >
              {isPushing ? (
                <ActivityIndicator size="small" color={theme.palette.background} />
              ) : (
                <View style={styles.actionButtonContent}>
                  <Ionicons name="arrow-up" size={16} color={theme.palette.background} />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Push</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonPrimary,
                busyPrimary && styles.buttonDisabled,
              ]}
              onPress={onPull}
              disabled={busyPrimary}
            >
              {isPulling ? (
                <ActivityIndicator size="small" color={theme.palette.background} />
              ) : (
                <View style={styles.actionButtonContent}>
                  <Ionicons name="arrow-down" size={16} color={theme.palette.background} />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Pull</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonOutline,
                (isSyncingSecrets || busyPrimary) && styles.buttonDisabled,
              ]}
              onPress={onSyncSecrets}
              disabled={isSyncingSecrets || busyPrimary}
            >
              {isSyncingSecrets ? (
                <ActivityIndicator size="small" color={theme.palette.primary} />
              ) : (
                <View style={styles.actionButtonContent}>
                  <Ionicons name="key" size={16} color={theme.palette.primary} />
                  <Text style={styles.actionButtonText}>Sync Secrets</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.actionButtonOutline]} onPress={onOpenRepoOnGitHub}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="open-outline" size={16} color={theme.palette.primary} />
                <Text style={styles.actionButtonText}>Open</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.actionButtonOutline]} onPress={onOpenManage}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="settings-outline" size={16} color={theme.palette.primary} />
                <Text style={styles.actionButtonText}>Manage</Text>
              </View>
            </TouchableOpacity>
          </View>

          {!!pullProgress && <Text style={styles.progressText}>{pullProgress}</Text>}
        </>
      )}
    </View>
  );
});
