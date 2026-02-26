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
  pctText: {
    color: theme.palette.primary,
    fontWeight: "900",
    fontSize: 18,
    fontFamily: "monospace",
  },
  barOuter: {
    height: 10,
    backgroundColor: theme.palette.backgroundDark,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.palette.border,
    position: "relative",
  },
  barInner: {
    height: "100%",
    borderRadius: 999,
  },
  barGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    borderRadius: 999,
  },
  statusLabel: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 14,
    marginTop: 12,
  },
  message: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  eta: {
    color: theme.palette.warning,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  steps: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 4,
  },
  step: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.backgroundDark,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: {
    borderColor: theme.palette.success,
    backgroundColor: theme.palette.success,
  },
  stepDotCurrent: {
    borderColor: theme.palette.primary,
    backgroundColor: "rgba(0,255,0,0.15)",
  },
  stepDotFail: {
    borderColor: theme.palette.error,
    backgroundColor: "rgba(255,68,68,0.15)",
  },
  stepLabel: {
    color: theme.palette.text.muted,
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 4,
  },
  stepLabelDone: { color: theme.palette.success },
  stepLabelCurrent: { color: theme.palette.primary },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.palette.border,
    marginHorizontal: 4,
  },
  stepLineDone: {
    backgroundColor: theme.palette.success,
  },
});
