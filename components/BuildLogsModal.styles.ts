// components/BuildLogsModal.styles.ts
// Extracted from BuildLogsModal.tsx
import { StyleSheet } from "react-native";
import { theme } from "../theme";

export const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },
  modalCloseButton: {
    padding: 6,
  },
  logsControlsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.background,
  },
  topContent: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    marginRight: 8,
    marginBottom: 8,
  },
  pillActive: {
    borderColor: theme.palette.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.palette.text.primary,
  },
  pillDisabled: {
    opacity: 0.5,
  },
  logsBody: {
    flex: 1,
    padding: 12,
  },
  logsCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logsHint: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    textAlign: "center",
  },
  logsErrorTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.palette.error,
    marginBottom: 6,
  },
  logsErrorText: {
    fontSize: 13,
    color: theme.palette.text.primary,
    textAlign: "center",
  },
  logsScroll: {
    flex: 1,
  },
  logsScrollContent: {
    paddingBottom: 24,
  },
  logLine: {
    fontSize: 12,
    color: theme.palette.text.primary,
    marginBottom: 4,
    fontFamily: "monospace",
  },
  errorLine: {
    color: theme.palette.error,
    fontWeight: "700",
  },
});
