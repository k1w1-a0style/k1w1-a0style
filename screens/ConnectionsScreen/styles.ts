// screens/ConnectionsScreen/styles.ts
// Extracted from ConnectionsScreen/index.tsx
import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.palette.background },
  content: { padding: 16, paddingBottom: 40 },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBtnPressed: {
    backgroundColor: theme.palette.userBubble.background,
  },

  h1: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.palette.text.primary,
    marginBottom: 6,
  },

  debugWrap: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  debugHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  debugTitle: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  debugHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  debugAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.card,
  },
  debugActionPressed: {
    backgroundColor: theme.palette.userBubble.background,
  },
  debugList: { flex: 1 },
  debugListContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  debugEmpty: {
    color: theme.palette.text.muted,
    fontSize: 13,
  },
  debugItem: {
    backgroundColor: theme.palette.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  debugMeta: {
    color: theme.palette.text.muted,
    fontSize: 11,
    marginBottom: 4,
  },
  debugMsg: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },
  debugData: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontFamily: "Courier",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    padding: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalTitle: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: "900",
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  modalClosePressed: {
    backgroundColor: theme.palette.userBubble.background,
  },
  modalLine: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginBottom: 6,
  },
  modalHint: {
    marginTop: 10,
    color: theme.palette.text.secondary,
    fontSize: 12,
  },

  card: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: "800",
  },

  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  btn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.palette.primary,
  },

  dot: { width: 10, height: 10, borderRadius: 999, marginRight: 8 },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  statusLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  statusLabel: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  statusValue: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    maxWidth: "55%",
  },
  statusValueMuted: { color: theme.palette.text.muted, fontSize: 12 },

  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
    flexWrap: "wrap",
    maxWidth: "75%",
  },
  hintInline: { color: theme.palette.text.muted, fontSize: 11 },

  inputRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.input.border,
    backgroundColor: theme.palette.input.background,
  },
  input: {
    flex: 1,
    color: theme.palette.text.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  eyeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  hint: {
    marginTop: 10,
    color: theme.palette.text.muted,
    fontSize: 12,
    lineHeight: 16,
  },
});
