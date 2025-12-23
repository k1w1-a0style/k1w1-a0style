// screens/CodeScreen/components/EditorBody.tsx
import React from "react";
import { ScrollView, TextInput } from "react-native";
import { theme } from "../../../theme";
import { SyntaxHighlighter } from "../../../components/SyntaxHighlighter";
import type { SyntaxError as ValidationError } from "../../../utils/syntaxValidator";
import { styles } from "../styles";

interface EditorBodyProps {
  viewMode: "edit" | "preview";
  content: string;
  syntaxErrors: ValidationError[];
  onChangeText: (text: string) => void;
}

export const EditorBody: React.FC<EditorBodyProps> = ({
  viewMode,
  content,
  syntaxErrors,
  onChangeText,
}) => {
  return viewMode === "edit" ? (
    <TextInput
      style={[
        styles.codeEditor,
        syntaxErrors.some((e) => e.severity === "error") &&
          styles.codeEditorError,
      ]}
      value={content}
      onChangeText={onChangeText}
      multiline
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      textAlignVertical="top"
      placeholder="// Code eingeben..."
      placeholderTextColor={theme.palette.text.secondary}
    />
  ) : (
    <ScrollView style={styles.previewContainer}>
      <SyntaxHighlighter code={content} />
    </ScrollView>
  );
};
