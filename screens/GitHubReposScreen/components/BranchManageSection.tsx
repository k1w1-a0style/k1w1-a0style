import React, { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

type BranchManageSectionProps = {
  activeRepo: string | null;
  activeBranch: string | null;
  onCreateBranch: () => void;
  onRenameBranch: () => void;
  onDeleteBranch: () => void;
};

export const BranchManageSection = memo(function BranchManageSection(props: BranchManageSectionProps) {
  const { activeRepo, activeBranch, onCreateBranch, onRenameBranch, onDeleteBranch } = props;

  const disabled = !activeRepo;
  const branchDisabled = !activeRepo || !activeBranch;

  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Branch Tools</Text>
      </View>

      <Text style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 18 }}>
        Aktuell: {activeBranch || "(kein Branch gewählt)"}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, { flexDirection: "row", gap: 8, alignItems: "center" }, disabled && styles.buttonDisabled]}
          onPress={onCreateBranch}
          disabled={disabled}
        >
          <Ionicons name="add-circle-outline" size={16} color={disabled ? theme.palette.text.muted : theme.palette.text.primary} />
          <Text style={[styles.buttonTextSecondary, { color: disabled ? theme.palette.text.muted : theme.palette.text.primary }]}>Neu</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, { flexDirection: "row", gap: 8, alignItems: "center" }, branchDisabled && styles.buttonDisabled]}
          onPress={onRenameBranch}
          disabled={branchDisabled}
        >
          <Ionicons name="pencil-outline" size={16} color={branchDisabled ? theme.palette.text.muted : theme.palette.text.primary} />
          <Text style={[styles.buttonTextSecondary, { color: branchDisabled ? theme.palette.text.muted : theme.palette.text.primary }]}>Umbenennen</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonDanger, { flexDirection: "row", gap: 8, alignItems: "center" }, branchDisabled && styles.buttonDisabled]}
          onPress={onDeleteBranch}
          disabled={branchDisabled}
        >
          <Ionicons name="trash-outline" size={16} color={branchDisabled ? theme.palette.text.muted : theme.palette.error} />
          <Text style={[styles.buttonText, { color: branchDisabled ? theme.palette.text.muted : theme.palette.error }]}>Löschen</Text>
        </TouchableOpacity>
      </View>

      {!activeRepo ? (
        <Text style={{ fontSize: 11, marginTop: 10, color: theme.palette.text.muted, lineHeight: 16 }}>
          Repo wählen → Branch Tools werden aktiv.
        </Text>
      ) : null}
    </View>
  );
});
