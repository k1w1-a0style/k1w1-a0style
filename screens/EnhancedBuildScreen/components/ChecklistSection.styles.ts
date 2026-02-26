// screens/EnhancedBuildScreen/components/ChecklistSection.styles.ts
import { StyleSheet } from "react-native";
import { theme } from "../../../theme";

export const s = StyleSheet.create({
  card: {
    marginTop: 14,
    marginHorizontal: 16,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  title: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 15,
    flex: 1,
  },
  allOkBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.success,
    backgroundColor: "rgba(0,255,0,0.08)",
  },
  allOkText: {
    color: theme.palette.success,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  list: { gap: 6 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowOk: {
    borderColor: "rgba(0,255,0,0.12)",
    backgroundColor: "rgba(0,255,0,0.03)",
  },
  rowFail: {
    borderColor: "rgba(255,0,0,0.18)",
    backgroundColor: "rgba(255,0,0,0.04)",
  },
  rowTextWrap: { flex: 1 },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  rowLabelOk: { color: theme.palette.text.primary },
  rowLabelFail: { color: theme.palette.error },
  rowDetail: {
    color: theme.palette.text.muted,
    fontSize: 11,
    marginTop: 2,
  },

  rowTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  rowTagError: {
    borderColor: theme.palette.error,
    backgroundColor: "rgba(255,0,0,0.08)",
  },
  rowTagInfo: {
    borderColor: theme.palette.primary,
    backgroundColor: "rgba(0,150,255,0.08)",
  },
  rowTagWarn: {
    borderColor: theme.palette.warning,
    backgroundColor: "rgba(255,170,0,0.10)",
  },
  rowTagText: {
    color: theme.palette.text.primary,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  chipText: {
    color: theme.palette.text.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  chipBadge: {
    marginLeft: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chipBadgeText: {
    color: theme.palette.text.secondary,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
});
