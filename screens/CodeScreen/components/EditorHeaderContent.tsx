// screens/CodeScreen/components/EditorHeaderContent.tsx
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

interface EditorHeaderContentProps {
  fileName: string;
  isDirty: boolean;
  isCodeFile: boolean;
  viewMode: "edit" | "preview";
  onBack: () => void;
  onToggleViewMode: () => void;
  onCopy: () => void;
  onSave: () => void;
}

export const EditorHeaderContent: React.FC<EditorHeaderContentProps> = ({
  fileName,
  isDirty,
  isCodeFile,
  viewMode,
  onBack,
  onToggleViewMode,
  onCopy,
  onSave,
}) => {
  return (
    <>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color={theme.palette.primary} />
        <Text style={styles.fileName} numberOfLines={1}>
          {fileName}
          {isDirty ? " •" : ""}
        </Text>
      </TouchableOpacity>

      <View style={styles.editorActions}>
        {isCodeFile && (
          <TouchableOpacity
            onPress={onToggleViewMode}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.actionButton}
          >
            <Ionicons
              name={viewMode === "edit" ? "eye" : "create"}
              size={22}
              color={theme.palette.primary}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onCopy}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.actionButton}
        >
          <Ionicons
            name="copy-outline"
            size={22}
            color={theme.palette.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onSave}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.actionButton, isDirty && styles.actionButtonHighlight]}
        >
          <Ionicons
            name={isDirty ? "save" : "checkmark-circle"}
            size={22}
            color={isDirty ? "#fff" : theme.palette.success}
          />
        </TouchableOpacity>
      </View>
    </>
  );
};
