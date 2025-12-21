// styles/chatScreenStyles.ts
import { StyleSheet } from "react-native";
import { theme } from "../theme";

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

  // ConfirmChangesModal Styles
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
