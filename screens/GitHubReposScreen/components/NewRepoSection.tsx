import React, { memo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from "react-native";
import { theme } from "../../../theme";
import { styles } from "../styles";

interface NewRepoSectionProps {
  newRepoName: string;
  setNewRepoName: (name: string) => void;
  newRepoPrivate: boolean;
  setNewRepoPrivate: (isPrivate: boolean) => void;
  isCreating: boolean;
  onCreateRepo: () => void;
}

export const NewRepoSection = memo(function NewRepoSection({
  newRepoName,
  setNewRepoName,
  newRepoPrivate,
  setNewRepoPrivate,
  isCreating,
  onCreateRepo,
}: NewRepoSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Neues Repo</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Repo-Name"
        placeholderTextColor={theme.palette.text.secondary}
        value={newRepoName}
        onChangeText={setNewRepoName}
      />

      <View style={styles.rowBetween}>
        <Text style={styles.smallLabel}>Privat</Text>
        <Switch
          value={newRepoPrivate}
          onValueChange={setNewRepoPrivate}
          accessibilityLabel="Repository als privat markieren"
        />
      </View>

      <TouchableOpacity
        style={[styles.button, isCreating && styles.buttonDisabled]}
        onPress={onCreateRepo}
        disabled={isCreating}
      >
        {isCreating ? (
          <ActivityIndicator size="small" color={theme.palette.primary} />
        ) : (
          <Text style={styles.buttonText}>Repo erstellen</Text>
        )}
      </TouchableOpacity>
    </View>
  );
});
