import { StyleSheet } from "react-native";
import { theme, getNeonGlow } from "../theme";

export const styles = StyleSheet.create({
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  fileItemSelected: {
    backgroundColor: `${theme.palette.primary}12`,
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.primary,
    ...getNeonGlow(theme.palette.primary, "subtle"),
  },
  checkbox: {
    marginRight: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.palette.text.primary,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  fileDetails: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    fontFamily: "monospace",
  },
});
