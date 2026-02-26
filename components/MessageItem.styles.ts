// components/MessageItem.styles.ts
// Extracted from MessageItem.tsx
import { StyleSheet } from "react-native";
import { theme } from "../theme";

export const styles = StyleSheet.create({
  // ✅ Fix gegen “Briefmarken-Bubbles”: Row ist 100% breit und richtet links/rechts aus
  messageRow: {
    width: "100%",
    flexDirection: "row",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  messageRowUser: { justifyContent: "flex-end" },
  messageRowOther: { justifyContent: "flex-start" },

  messageBubble: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: "88%",
    minWidth: 140,
    borderWidth: 1.5,
    flexShrink: 1,
  },

  messageContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    minWidth: 0,
    flexShrink: 1,
  },

  textColumn: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
  },

  icon: { marginRight: 6, marginTop: 2 },

  userMessage: {
    backgroundColor: theme.palette.userBubble.background,
    borderColor: theme.palette.userBubble.border,
    borderBottomRightRadius: 4,
  },
  userMessageText: {
    fontSize: 14,
    color: theme.palette.userBubble.text,
    lineHeight: 20,
  },

  aiMessage: {
    backgroundColor: theme.palette.aiBubble.background,
    borderColor: theme.palette.aiBubble.border,
    borderBottomLeftRadius: 4,
  },
  aiMessageText: {
    fontSize: 14,
    color: theme.palette.aiBubble.text,
    lineHeight: 20,
  },

  systemMessage: {
    backgroundColor: theme.palette.systemBubble.background,
    borderColor: theme.palette.systemBubble.border,
    borderBottomLeftRadius: 4,
  },
  systemMessageText: {
    fontSize: 13,
    color: theme.palette.systemBubble.text,
    lineHeight: 19,
    fontStyle: "italic",
  },

  errorMessage: {
    backgroundColor: `${theme.palette.error}15`,
    borderColor: theme.palette.error,
    borderBottomLeftRadius: 4,
  },
  errorMessageText: {
    fontSize: 14,
    color: theme.palette.error,
    lineHeight: 20,
  },

  messagePressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },

  timestamp: {
    fontSize: 10,
    color: theme.palette.text.disabled,
    marginTop: 4,
    alignSelf: "flex-end",
  },

  messageBubbleWithCode: { maxWidth: "95%" },
  messagePartsContainer: { flexShrink: 1, minWidth: 0 },

  codeBlockContainer: {
    backgroundColor: theme.palette.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    overflow: "hidden",
    marginVertical: 4,
  },
  codeBlockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: `${theme.palette.border}50`,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  codeLanguage: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.palette.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  copyCodeButton: { padding: 4 },
  codeScrollView: { maxHeight: 300 },
  codeContent: { padding: 10, minWidth: "100%" },
});
