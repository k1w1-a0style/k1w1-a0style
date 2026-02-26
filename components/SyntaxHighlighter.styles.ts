import { StyleSheet } from "react-native";
import { theme } from "../theme";

export const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
  },
  lineNumbers: {
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: theme.palette.border,
    marginRight: 12,
  },
  lineNumber: {
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 22,
    color: theme.palette.text.disabled,
    textAlign: "right",
    minWidth: 28,
  },
  codeContent: {
    flex: 1,
  },
  codeBlock: {
    fontFamily: "monospace",
    fontSize: 14,
    lineHeight: 22,
  },
  // 🔥 NEON SYNTAX COLORS
  keyword: {
    color: theme.palette.syntax.keyword, // Neon Magenta
    fontWeight: "600",
  },
  string: {
    color: theme.palette.syntax.string, // Neon Türkis
  },
  comment: {
    color: theme.palette.syntax.comment, // Grau
    fontStyle: "italic",
  },
  function: {
    color: theme.palette.syntax.function, // Neon Gelb
  },
  number: {
    color: theme.palette.syntax.number, // Neon Orange
  },
  operator: {
    color: theme.palette.syntax.operator, // Neon Grün
  },
  type: {
    color: theme.palette.syntax.type, // Neon Blau
    fontWeight: "500",
  },
  jsx: {
    color: theme.palette.primary, // Neon Grün für JSX
    fontWeight: "600",
  },
  default: {
    color: theme.palette.syntax.default, // Standard Text
  },
});
