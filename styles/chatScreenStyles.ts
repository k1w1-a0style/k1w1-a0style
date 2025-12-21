// styles/chatScreenStyles.ts
import { StyleSheet } from "react-native";
import { theme } from "../theme";

// Werte kommen aus ChatScreen.tsx – für StyleSheet identisch hier gespiegelt
const INPUT_BAR_MIN_H = 56;
const SELECTED_FILE_ROW_H = 42;

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1 },
  listContainer: { flex: 1 },

  // ✅ WICHTIG: damit wenige Messages unten kleben und Layout nicht "oben hängt"
  listContent: {
    padding: 12,
    width: "100%",
    flexGrow: 1,
    justifyContent: "flex-end",
  },

  loadingOverlay: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingOverlayText: { marginTop: 12, color: theme.palette.text.secondary },

  loadingFooter: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    marginVertical: 8,
    gap: 8,
  },
  loadingText: { color: theme.palette.text.secondary, fontWeight: "600" },
  streamingText: {
    marginTop: 6,
    color: theme.palette.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },

  thinkingDots: { flexDirection: "row", gap: 4, marginLeft: 4, marginTop: 2 },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.primary,
  },

  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.palette.error + "20",
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.error,
  },
  errorText: { flex: 1, color: theme.palette.error, fontSize: 13 },

  bottomArea: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: theme.palette.card,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
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
  iconButtonActive: { borderColor: theme.palette.secondary },

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
    shadowColor: theme.palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: { opacity: 0.6 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.palette.card,
    borderRadius: 16,
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
    borderWidth: 2,
    borderColor: theme.palette.primary,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },

  modalBody: { padding: 20, maxHeight: 420 },
  modalText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    lineHeight: 22,
  },

  modalFooter: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },
  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
  },
  modalButtonReject: {
    backgroundColor: "transparent",
    borderColor: theme.palette.error,
  },
  modalButtonAccept: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  modalButtonTextReject: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.palette.error,
  },
  modalButtonTextAccept: { fontSize: 14, fontWeight: "600", color: "#000" },

  scrollToBottomButton: {
    position: "absolute",
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.palette.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
