// styles/chatComposerStyles.ts
import { Platform, StyleSheet } from "react-native";
import { theme } from "../theme";

const INPUT_BAR_MIN_H = 56;
const SELECTED_FILE_ROW_H = 42;

export const styles = StyleSheet.create({
  bottomArea: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: theme.palette.card,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },

  planHint: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0, 255, 0, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 255, 0, 0.2)",
  },
  planHintText: {
    color: theme.palette.text.primary,
    fontSize: 13,
    lineHeight: 18,
  },

  selectedFileBox: {
    height: SELECTED_FILE_ROW_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  selectedFileText: {
    flex: 1,
    fontSize: 13,
    color: theme.palette.text.primary,
    fontWeight: "500",
  },

  inputContainer: {
    minHeight: INPUT_BAR_MIN_H,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.palette.card,
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  iconButtonActive: {
    borderColor: theme.palette.primary,
  },

  textInput: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: theme.palette.text.primary,
    fontSize: 14,
    backgroundColor: theme.palette.background,
  },

  sendButton: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.palette.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#00FF00",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});
