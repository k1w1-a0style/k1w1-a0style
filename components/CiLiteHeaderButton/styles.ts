// components/CiLiteHeaderButton/styles.ts
// Extracted from the monolithic CiLiteHeaderButton.tsx (formerly ~300 lines of styles).

import { StyleSheet } from "react-native";
import { theme } from "../../theme";

const HAIRLINE = StyleSheet.hairlineWidth;

export const styles = StyleSheet.create({
  // --- Header icon button ---
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.background,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}22`,
  },
  iconBtnPressed: {
    backgroundColor: theme.palette.userBubble.background,
  },
  ciBtnRunning: {
    borderColor: theme.palette.primary,
    ...theme.glow.primary,
  },
  ciIconWrap: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}66`,
    ...theme.glow.primary,
  },

  // --- Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: `${theme.palette.primary}2a`,
    backgroundColor: theme.palette.card,
    padding: 14,
    ...(theme.glow.primarySubtle as any),
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: `${theme.palette.primary}22`,
    backgroundColor: theme.palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnPressed: {
    opacity: 0.85,
  },

  // --- Status row ---
  statusRow: {
    flexDirection: "column",
    alignItems: "stretch",
    marginBottom: 10,
  },

  statusTopRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },

  statusText: {
    color: theme.palette.text.secondary,
    fontWeight: "800",
    fontSize: 12,
  },
  dots: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
    fontSize: 12,
    marginLeft: 2,
  },

  // --- Progress bar ---
  progressWrap: {
    marginTop: 8,
    marginBottom: 2,
    width: "100%",
  },
  progressMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: {
    color: theme.palette.text.secondary,
    fontWeight: "800",
    fontSize: 12,
  },
  progressPct: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
    fontSize: 12,
  },
  progressTrack: {
    position: "relative",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: `${theme.palette.primary}1a`,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}22`,
  },
  progressFill: {
    height: 8,
    maxWidth: "100%",
    borderRadius: 999,
    backgroundColor: theme.palette.primary,
    opacity: 0.75,
  },
  progressShimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
    borderRadius: 999,
    backgroundColor: `${theme.palette.primary}55`,
    opacity: 0.35,
  },

  // --- Meta box ---
  metaBox: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    borderRadius: 16,
    padding: 12,
  },
  metaLine: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginBottom: 3,
  },
  runMetaRow: {
    marginTop: 6,
  },
  stepsCompactRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  stepCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  stepCompactText: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 12,
  },

  // Legacy compat (StepPill)
  stepPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  stepText: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 12,
  },

  // --- Error ---
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${theme.palette.error}44`,
    backgroundColor: "rgba(255,68,68,0.08)",
  },
  errorText: {
    flex: 1,
    color: theme.palette.text.primary,
    fontSize: 12,
  },

  // --- Results ---
  resultsHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 8,
  },
  resultsTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 13,
  },
  okText: {
    color: theme.palette.primary,
    fontWeight: "900",
  },
  badText: {
    color: theme.palette.error,
    fontWeight: "900",
  },
  waitText: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
  },
  resultsBox: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    borderRadius: 16,
    padding: 10,
    maxHeight: 260,
  },
  okHint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    paddingVertical: 6,
  },
  logLine: {
    color: theme.palette.text.primary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },

  // --- Patch panel ---
  patchPanelCompact: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    borderRadius: 16,
    padding: 10,
  },
  patchTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  patchTitleCompact: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  patchInputCompact: {
    minHeight: 90,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 10,
    color: theme.palette.text.primary,
    fontSize: 12,
  },
  patchBtnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  patchInfoCompact: {
    marginTop: 10,
    color: theme.palette.text.secondary,
    fontSize: 12,
  },

  // --- Action buttons ---
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${theme.palette.primary}22`,
    backgroundColor: theme.palette.background,
    minWidth: 92,
  },
  actionBtnPrimary: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
    ...(theme.glow.primarySubtle as any),
  },
  actionBtnPressed: {
    opacity: 0.85,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  actionBtnTextPrimary: {
    color: theme.palette.background,
  },

  // --- Tiny buttons (patch panel) ---
  tinyBtn: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tinyBtnPrimary: {
    borderColor: theme.palette.primary,
  },
  tinyBtnPressed: {
    opacity: 0.85,
  },
  tinyBtnDisabled: {
    opacity: 0.55,
  },
  tinyBtnText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 12,
  },
});
