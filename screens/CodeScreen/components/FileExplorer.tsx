// screens/CodeScreen/components/FileExplorer.tsx
import React from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Breadcrumb } from "../../../components/Breadcrumb";
import { FileItem } from "../../../components/FileItem";
import type { TreeNode } from "../../../components/FileTree";
import { theme } from "../../../theme";
import { styles } from "../styles";

interface FileExplorerProps {
  currentFolderPath: string;
  currentFolderItems: TreeNode[];
  selectionMode: boolean;
  selectedFiles: Set<string>;
  onNavigate: (path: string) => void;
  onItemPress: (node: TreeNode) => void;
  onItemLongPress: (node: TreeNode) => void;
  onOpenCreationDialog: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  currentFolderPath,
  currentFolderItems,
  selectionMode,
  selectedFiles,
  onNavigate,
  onItemPress,
  onItemLongPress,
  onOpenCreationDialog,
}) => {
  return (
    <>
      <Breadcrumb currentPath={currentFolderPath} onNavigate={onNavigate} />

      <FlatList
        data={currentFolderItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FileItem
            node={item}
            onPress={() => onItemPress(item)}
            onLongPress={() => onItemLongPress(item)}
            isSelected={item.file ? selectedFiles.has(item.file.path) : false}
            selectionMode={selectionMode}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="folder-open-outline"
              size={64}
              color={theme.palette.text.secondary}
            />
            <Text style={styles.emptyText}>Dieser Ordner ist leer</Text>

            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={onOpenCreationDialog}
            >
              <Ionicons
                name="add-circle"
                size={20}
                color={theme.palette.primary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.createFirstButtonText}>
                Erste Datei erstellen
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
    </>
  );
};
