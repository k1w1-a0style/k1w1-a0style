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
  modalHeaderCopy: { flex: 1, gap: 8 },
  modalMetaPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  modalMetaNeutral: {
    color: theme.palette.text.secondary,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  modalMetaSuccess: {
    color: theme.palette.primary,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.primary + "18",
  },
  modalMetaWarning: {
    color: "#F5C451",
    borderWidth: 1,
    borderColor: "#F5C451",
    backgroundColor: "rgba(245, 196, 81, 0.12)",
  },
  modalBody: { padding: 20, maxHeight: 420 },
  modalText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    lineHeight: 22,
  },
  modalSummaryCard: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.02)",
    gap: 8,
  },
  modalSummaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },
  modalSummaryText: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.palette.text.secondary,
  },
  modalMetaGrid: {
    gap: 8,
    marginTop: 2,
  },
  modalMetaRow: {
    gap: 4,
  },
  modalMetaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.palette.primary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  modalMetaValue: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.palette.text.secondary,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.palette.text.primary,
    marginBottom: 10,
  },
  modalEmptyText: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 14,
  },
  modalDiffCard: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  modalDiffHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  modalDiffPath: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },
  modalDiffKind: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  modalDiffKindNew: {
    color: theme.palette.primary,
  },
  modalDiffKindUpdated: {
    color: "#7DD3FC",
  },
  modalDiffKindSkipped: {
    color: "#F5C451",
  },
  modalPathChipRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  modalPathChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modalPathChipChange: {
    borderColor: "rgba(0,255,0,0.35)",
    backgroundColor: "rgba(0,255,0,0.11)",
  },
  modalPathChipManual: {
    borderColor: "rgba(245,196,81,0.45)",
    backgroundColor: "rgba(245,196,81,0.16)",
  },
  modalPathChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.palette.text.primary,
    letterSpacing: 0.2,
  },
  modalDiffLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.palette.text.secondary,
    marginBottom: 6,
  },
  modalCodeBlock: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.palette.text.primary,
    fontFamily: "monospace",
    backgroundColor: "rgba(0,0,0,0.24)",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  modalBeforeAfterRow: { gap: 10 },
  modalBeforeAfterCol: { gap: 4 },
  modalHintText: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.palette.text.secondary,
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
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
  },
  modalButtonTextReject: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.palette.error,
  },
  modalButtonTextAccept: { fontSize: 14, fontWeight: "600", color: theme.palette.primary },

  scrollToBottomButton: {
    position: "absolute",
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.palette.primary,
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.palette.primary,
    elevation: 8,
  },
});
