import { StyleSheet } from "react-native";

import { theme } from "../../theme";

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1, backgroundColor: theme.palette.background },
  content: {
    padding: theme.layout.screenPadding,
    paddingBottom: 140,
  },

  header: {
    marginBottom: theme.spacing.md,
  },
  h1: {
    color: theme.palette.text.primary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  p: {
    color: theme.palette.text.secondary,
    marginTop: 6,
  },
  headerMeta: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerMetaText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    flex: 1,
  },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "900",
  },

  kvRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.palette.border,
  },
  kvLabel: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  kvValue: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "800",
    maxWidth: "70%",
    textAlign: "right",
  },
  kvMuted: {
    color: theme.palette.text.secondary,
    fontSize: 12,
  },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    color: theme.palette.text.primary,
    fontSize: 14,
  },

  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },

  btn: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnSmall: {
    minHeight: 38,
    paddingVertical: 8,
  },
  btnText: {
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  btnPrimary: {
    backgroundColor: theme.palette.primary,
  },
  btnSecondary: {
    backgroundColor: theme.palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },
  btnTertiary: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },
  btnDisabled: {
    opacity: 0.5,
  },

  advancedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
  },
  advancedBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  advancedBox: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.palette.border,
    gap: 8,
  },

  segmentWrap: {
    flexDirection: "row",
    backgroundColor: theme.palette.backgroundDark,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentOn: {
    backgroundColor: theme.palette.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.borderLight,
  },
  segmentText: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
    fontSize: 13,
  },
  segmentTextOn: {
    color: theme.palette.text.primary,
  },

  modeActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },

  statusRow: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.palette.backgroundDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    borderRadius: theme.borderRadius.lg,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  statusRowActive: {
    borderColor: "rgba(0,255,0,0.35)",
    backgroundColor: "rgba(0,255,0,0.05)",
  },
  statusTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  statusTitle: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  statusMeta: {
    fontSize: 12,
    fontWeight: "900",
  },

  inlineHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineHintText: {
    fontSize: 12,
    flex: 1,
  },

  notice: {
    marginTop: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,170,0,0.35)",
    backgroundColor: "rgba(255,170,0,0.06)",
  },
  noticeText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    flex: 1,
  },

  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.backgroundDark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },

  mutedLine: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },

  codeBox: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.palette.backgroundDark,
    borderRadius: theme.borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    padding: theme.spacing.md,
  },
  codeText: {
    color: theme.palette.text.primary,
    fontFamily: theme.typography.monoFamily,
    fontSize: 12,
    lineHeight: 16,
  },

  footerBusy: {
    marginTop: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  footerBusyText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "800",
  },
});
