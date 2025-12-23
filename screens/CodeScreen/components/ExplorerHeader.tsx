// screens/CodeScreen/components/ExplorerHeader.tsx
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

interface ExplorerHeaderProps {
  projectName: string;
  selectionMode: boolean;
  selectedCount: number;
  onExitSelection: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExport: () => void;
  onEnterSelection: () => void;
  onOpenCreationDialog: () => void;
}

export const ExplorerHeader: React.FC<ExplorerHeaderProps> = ({
  projectName,
  selectionMode,
  selectedCount,
  onExitSelection,
  onSelectAll,
  onDeselectAll,
  onExport,
  onEnterSelection,
  onOpenCreationDialog,
}) => {
  return (
    <View style={styles.explorerHeader}>
      {selectionMode ? (
        <>
          <View style={styles.selectionHeader}>
            <TouchableOpacity
              onPress={onExitSelection}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="close"
                size={24}
                color={theme.palette.text.primary}
              />
            </TouchableOpacity>
            <Text style={styles.selectionCount}>
              {selectedCount} ausgewählt
            </Text>
          </View>

          <View style={styles.selectionActions}>
            <TouchableOpacity
              onPress={onSelectAll}
              style={styles.selectionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.selectionButtonText}>Alle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onDeselectAll}
              style={styles.selectionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.selectionButtonText}>Keine</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onExport}
              style={[
                styles.exportButton,
                selectedCount === 0 && styles.exportButtonDisabled,
              ]}
              disabled={selectedCount === 0}
            >
              <Ionicons
                name="download"
                size={20}
                color={theme.palette.text.primary}
              />
              <Text style={styles.exportButtonText}>Export</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.projectTitle} numberOfLines={1}>
            {projectName || "Kein Projekt"}
          </Text>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onEnterSelection}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="checkbox-outline"
                size={24}
                color={theme.palette.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addButton}
              onPress={onOpenCreationDialog}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="add"
                size={24}
                color={theme.palette.text.primary}
              />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};
