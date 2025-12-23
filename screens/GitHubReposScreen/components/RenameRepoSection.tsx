import React, { memo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { theme } from "../../../theme";
import { styles } from "../styles";

interface RenameRepoSectionProps {
  activeRepo: string | null;
  renameName: string;
  setRenameName: (name: string) => void;
  isRenaming: boolean;
  onRenameRepo: () => void;
}

export const RenameRepoSection = memo(function RenameRepoSection({
  activeRepo,
  renameName,
  setRenameName,
  isRenaming,
  onRenameRepo,
}: RenameRepoSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Repo umbenennen</Text>

      <Text style={styles.currentRepoText}>
        Aktives Repo: {activeRepo ? activeRepo : "– keins ausgewählt –"}
      </Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Neuer Repo-Name"
        placeholderTextColor={theme.palette.text.secondary}
        value={renameName}
        onChangeText={setRenameName}
      />

      <TouchableOpacity
        style={[styles.button, isRenaming && styles.buttonDisabled]}
        onPress={onRenameRepo}
        disabled={isRenaming}
      >
        {isRenaming ? (
          <ActivityIndicator size="small" color={theme.palette.primary} />
        ) : (
          <Text style={styles.buttonText}>Umbenennen</Text>
        )}
      </TouchableOpacity>
    </View>
  );
});
