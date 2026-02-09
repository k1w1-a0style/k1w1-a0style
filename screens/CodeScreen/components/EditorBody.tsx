// screens/CodeScreen/components/EditorBody.tsx
import React from "react";
import { ScrollView, TextInput, View } from "react-native";
import { theme } from "../../../theme";
import { SyntaxHighlighter } from "../../../components/SyntaxHighlighter";
import type { SyntaxError as ValidationError } from "../../../utils/syntaxValidator";
import { styles } from "../styles";
import WebCodeEditor from "./WebCodeEditor";

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
  const hasErrors = syntaxErrors.some((e) => e.severity === "error");

  return viewMode === "edit" ? (
    <View style={{ flex: 1 }}>
      <WebCodeEditor
        value={content}
        onChangeText={onChangeText}
        hasErrors={hasErrors}
        placeholder="// Code eingeben..."
        placeholderColor={theme.palette.text.secondary}
      />
    </View>
  ) : (
    <ScrollView style={styles.previewContainer}>
      <SyntaxHighlighter code={content} />
    </ScrollView>
  );
};
