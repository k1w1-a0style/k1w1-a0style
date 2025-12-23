// screens/CodeScreen/components/SyntaxErrorBar.tsx
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";
import type { SyntaxError as ValidationError } from "../../../utils/syntaxValidator";

interface SyntaxErrorBarProps {
  visible: boolean;
  errors: ValidationError[];
}

export const SyntaxErrorBar: React.FC<SyntaxErrorBarProps> = ({
  visible,
  errors,
}) => {
  if (!visible) return null;

  return (
    <ScrollView
      style={styles.errorContainer}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {errors.map((error, index) => (
        <View
          key={index}
          style={[
            styles.errorBadge,
            error.severity === "error"
              ? styles.errorBadgeError
              : styles.errorBadgeWarning,
          ]}
        >
          <Ionicons
            name={error.severity === "error" ? "close-circle" : "warning"}
            size={14}
            color={
              error.severity === "error"
                ? theme.palette.error
                : theme.palette.warning
            }
          />
          <Text
            style={[
              styles.errorBadgeText,
              error.severity === "error"
                ? styles.errorTextError
                : styles.errorTextWarning,
            ]}
          >
            {error.line ? `Line ${error.line}: ` : ""}
            {error.message}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
};
