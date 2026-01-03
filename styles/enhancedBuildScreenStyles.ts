// styles/enhancedBuildScreenStyles.ts
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
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },

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

  card: {
    marginTop: 14,
    marginHorizontal: 16,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 15,
    marginBottom: 14,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    padding: 12,
    backgroundColor: theme.palette.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  statusEmoji: { fontSize: 28 },
  statusTextWrap: { flex: 1 },
  statusLabel: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 14,
  },
  statusMessage: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },

  inputRow: { gap: 12, marginBottom: 14 },
  inputWrap: { gap: 6 },
  inputLabel: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },
  input: {
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "600",
  },

  primaryBtn: {
    backgroundColor: theme.palette.primary,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    borderRadius: 12,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    color: theme.palette.secondary,
    fontWeight: "900",
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.5 },

  warningBox: {
    backgroundColor: withOpacity("#FFAA00", 0.1),
    borderWidth: 1,
    borderColor: withOpacity("#FFAA00", 0.3),
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  warningText: {
    color: "#FFAA00",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },

  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: withOpacity(theme.palette.error, 0.1),
    borderWidth: 1,
    borderColor: withOpacity(theme.palette.error, 0.3),
  },
  errorText: {
    color: theme.palette.error,
    fontSize: 13,
    fontWeight: "700",
  },

  emptyState: {
    marginTop: 16,
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  runList: { marginTop: 16, gap: 10 },
  runItem: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    borderRadius: 12,
    padding: 14,
  },
  runHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  runTitle: {
    flex: 1,
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 14,
  },
  runMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  runStatus: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  runDivider: {
    color: theme.palette.text.secondary,
    fontSize: 10,
  },
  runTime: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "600",
  },
  runBranch: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 120,
  },
  moreText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },

  // Profile-Buttons (verbesserter Zustand)
  profileRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  profileBtn: {
    flex: 1,
    backgroundColor: theme.palette.background,
    borderWidth: 2,
    borderColor: theme.palette.border,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  profileBtnActive: {
    borderColor: theme.palette.primary,
    backgroundColor: withOpacity(theme.palette.primary, 0.1),
  },
  profileBtnText: {
    color: theme.palette.text.secondary,
    fontWeight: "700",
    fontSize: 12,
    textTransform: "capitalize",
  },
  profileBtnTextActive: {
    color: theme.palette.primary,
    fontWeight: "900",
  },

  // Workflow-Status-Box in der Logs-Sektion
  workflowStatusBox: {
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },

  // Historie-Link
  historyLink: {
    marginTop: 8,
  },
  historyIcon: {
    fontSize: 16,
    marginRight: 8,
  },

  // Analyse-/Logs-Sektion
  analysisContainer: {
    marginTop: 12,
    gap: 10,
  },
  logsContainer: {
    marginTop: 12,
  },
  logsBtnSpacing: {
    marginTop: 10,
  },
  historyBtnSpacing: {
    marginTop: 12,
  },
});
