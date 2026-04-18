// screens/DiagnosticScreen/styles.ts
// Extracted from DiagnosticScreen/index.tsx

import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  header: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  busyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(13,19,18,0.95)",
    borderWidth: 1,
    borderColor: `${theme.palette.primary}33`,
  },
  busyText: {
    color: theme.palette.text.secondary,
    fontWeight: "800",
    fontSize: 12,
  },

  content: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
  },
  stack: {
    gap: theme.spacing.sm,
  },

  muted: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },

  // Buttons
  btnRow: {
    marginTop: theme.spacing.md,
    flexDirection: "row",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
    minHeight: 44,
    flexGrow: 1,
  },
  btnPrimaryText: {
    color: theme.palette.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(13,19,18,0.95)",
    borderWidth: 1,
    borderColor: `${theme.palette.primary}33`,
    minHeight: 44,
    flexGrow: 1,
  },
  btnSecondaryText: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  btnTertiary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: `${theme.palette.primary}44`,
    minHeight: 44,
  },
  btnTertiaryText: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  ghostBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: `${theme.palette.primary}44`,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.5 },

  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: 12,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: `${theme.palette.primary}44`,
  },
  checkTitle: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  checkMsg: {
    marginTop: 4,
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 16,
  },
  fixHint: {
    color: theme.palette.text.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  issueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: 12,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: "rgba(13,19,18,0.95)",
    borderWidth: 1,
    borderColor: `${theme.palette.primary}33`,
  },
  issueTitle: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  issueMsg: {
    marginTop: 4,
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 16,
  },


  chatFixBtn: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${theme.palette.primary}77`,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: `${theme.palette.primary}11`,
  },
  chatFixText: {
    color: theme.palette.primary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  // Counts
  countRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  countPill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: `${theme.palette.primary}44`,
  },
  countPillNum: {
    color: theme.palette.text.primary,
    fontSize: 18,
    fontWeight: "900",
  },
  countPillLabel: {
    marginTop: 2,
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "800",
  },
  countBig: {
    color: theme.palette.text.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  countLabel: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: `${theme.palette.primary}44`,
    color: theme.palette.text.primary,
    fontWeight: "900",
    overflow: "hidden",
  },

  // Issues filter chips
  filtersRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: `${theme.palette.primary}44`,
  },
  filterChipOn: {
    backgroundColor: "rgba(0,255,0,0.10)",
    borderColor: "rgba(0,255,0,0.25)",
  },
  filterChipText: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
    fontSize: 13,
  },
  filterChipTextOn: {
    color: theme.palette.text.primary,
  },

  // Advanced toggles
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: 6,
  },
  switchTitle: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  switchHint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },

  advRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  advRowText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
  },
  scopeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: `${theme.palette.primary}44`,
  },
  scopeBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
  },

  // Manual pick list
  pickRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
  },
  pickTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 13,
  },
  pickHint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  pickSeverity: {
    color: theme.palette.text.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  // Preview modal
  previewWrap: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  previewHeader: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.layout.screenPadding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.palette.border,
  },
  previewTitle: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: "900",
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  previewCard: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    padding: theme.spacing.md,
  },
  previewPath: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    marginBottom: 6,
  },
  previewLabel: {
    marginTop: theme.spacing.sm,
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  previewText: {
    marginTop: 6,
    color: theme.palette.text.primary,
    fontFamily: theme.typography.monoFamily,
    fontSize: 12,
    lineHeight: 16,
  },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.palette.borderLight,
    backgroundColor: theme.palette.card,
    alignItems: "center",
    justifyContent: "center",
  },

  // Fix run modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: "100%",
    backgroundColor: theme.palette.card,
    borderRadius: theme.borderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
    padding: theme.spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  modalTitle: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  modalSubtitle: {
    marginTop: 6,
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  modalHint: {
    marginTop: 8,
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  progressOuter: {
    height: 8,
    backgroundColor: theme.palette.backgroundDark,
    borderRadius: theme.borderRadius.full,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.palette.border,
  },
  progressInner: {
    height: 8,
    backgroundColor: theme.palette.primary,
  },
  stepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  stepRowActive: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  stepTitle: { color: theme.palette.text.secondary, fontWeight: "800" },
  stepMsg: { marginTop: 2, color: theme.palette.text.muted, fontSize: 12 },
  moreText: {
    marginTop: 8,
    color: theme.palette.text.muted,
    fontSize: 12,
    textAlign: "center",
  },
  modalFooter: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  modalFooterText: { color: theme.palette.text.secondary, fontWeight: "700" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.lg,
    backgroundColor: theme.palette.background,
  },
});


export type DiagnosticScreenStyles = typeof styles;
