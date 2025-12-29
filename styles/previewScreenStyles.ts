// styles/previewScreenStyles.ts
import { Platform, StyleSheet } from "react-native";
import { theme } from "../theme";

function withOpacity(color: string, opacity: number): string {
  if (!color.startsWith("#")) return color;
  let hex = color.slice(1);
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  if (hex.length !== 6) return color;
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${hex}${alpha}`;
}

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },

  modeRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  modeChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modeChipActive: {
    borderColor: theme.palette.primary,
    backgroundColor: withOpacity(theme.palette.primary, 0.12),
  },
  modeChipText: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
    fontSize: 14,
  },
  modeChipTextActive: {
    color: theme.palette.primary,
  },

  controls: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },

  autoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  autoLabel: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "800",
  },

  hint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },

  snackButtons: {
    gap: 10,
  },

  snackActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    alignItems: "center",
  },

  btn: {
    backgroundColor: theme.palette.primary,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: theme.palette.secondary,
    fontWeight: "900",
    fontSize: 15,
  },

  btnWide: {
    alignSelf: "stretch",
  },

  btnSmall: {
    minWidth: 50,
    minHeight: 46,
    paddingVertical: 10,
  },

  btnGhost: {
    backgroundColor: "transparent",
    borderColor: theme.palette.border,
  },
  btnGhostText: {
    color: theme.palette.text.primary,
  },

  btnDisabled: {
    opacity: 0.5,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  urlInput: {
    flex: 1,
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "700",
  },

  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  presetChip: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetChipText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "800",
  },

  errorBox: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: withOpacity(theme.palette.error, 0.1),
    borderWidth: 1,
    borderColor: withOpacity(theme.palette.error, 0.3),
  },
  errorText: {
    color: theme.palette.error,
    fontSize: 13,
    fontWeight: "800",
  },

  webWrap: {
    flex: 1,
    marginTop: 6,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  emptyTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withOpacity("#000000", 0.45),
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    gap: 10,
  },
  loadingText: {
    color: "#00FF00",
    fontWeight: "900",
    fontSize: 13,
  },

  // Modal
  modalRoot: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  modalTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 15,
  },
  modalBtnText: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
    fontSize: 14,
  },
  modalBtnPrimary: {
    color: theme.palette.primary,
  },
  modalScroll: {
    flex: 1,
  },
  modalEditor: {
    minHeight: 420,
    padding: 16,
    fontSize: 13,
    color: theme.palette.text.primary,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
  },
});
