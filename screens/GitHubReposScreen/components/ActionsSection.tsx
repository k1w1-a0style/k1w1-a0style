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
  onOpenActions: () => void;
  pullProgress: string;
}

export const ActionsSection = memo(function ActionsSection({
  activeRepo,
  isPushing,
  onPush,
  isPulling,
  onPull,
  onOpenActions,
  pullProgress,
}: ActionsSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Aktionen für aktives Repo</Text>
      <Text style={styles.actionsLabel}>
        Aktives Repo: {activeRepo || "– keins –"}
      </Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onPush}
          disabled={isPushing}
        >
          {isPushing ? (
            <ActivityIndicator size="small" color={theme.palette.primary} />
          ) : (
            <Text style={styles.actionButtonText}>Push</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onPull}
          disabled={isPulling}
        >
          {isPulling ? (
            <ActivityIndicator size="small" color={theme.palette.primary} />
          ) : (
            <Text style={styles.actionButtonText}>Pull</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onOpenActions}>
          <Text style={styles.actionButtonText}>Actions</Text>
        </TouchableOpacity>
      </View>

      {!!pullProgress && (
        <Text style={styles.progressText}>{pullProgress}</Text>
      )}
    </View>
  );
});
