import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  value: {
    marginTop: 4,
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  advBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
  },
  advBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 13,
  },
  advanced: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
  },
  chipOn: {
    backgroundColor: "rgba(0,255,0,0.10)",
    borderColor: "rgba(0,255,0,0.25)",
  },
  chipText: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
  },
  chipTextOn: {
    color: theme.palette.text.primary,
  },
  allRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  allText: {
    color: theme.palette.text.primary,
    fontWeight: "800",
  },
  allHint: {
    color: theme.palette.text.muted,
    fontSize: 12,
    marginLeft: 4,
  },
  disabled: {
    opacity: 0.55,
  },
});
