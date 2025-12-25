/**
 * EnhancedBuildScreen Styles
 * Ausgelagerte StyleSheet-Definition für bessere Übersichtlichkeit
 */

import { StyleSheet } from "react-native";
import { theme, getNeonGlow } from "../theme";

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    padding: 16,
    alignItems: "center",
  },
  title: {
    color: theme.palette.primary,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
    ...getNeonGlow(theme.palette.primary, "subtle"),
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  repoInfo: {
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.palette.primary + "40",
  },
  repoLabel: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginBottom: 6,
  },
  repoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.palette.primary,
  },
  noRepoCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: theme.palette.warning,
    alignItems: "center",
  },
  noRepoIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  noRepoTitle: {
    color: theme.palette.warning,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  noRepoText: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  buildButton: {
    flex: 1,
    backgroundColor: theme.palette.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    ...getNeonGlow(theme.palette.primary, "normal"),
  },
  buildButtonActive: {
    backgroundColor: theme.palette.primaryDark,
    opacity: 1,
  },
  buildButtonDisabled: {
    opacity: 0.5,
    ...getNeonGlow(theme.palette.primary, "subtle"),
  },
  buildButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buildButtonText: {
    color: theme.palette.secondary,
    fontWeight: "bold",
    fontSize: 16,
  },
  buildButtonTextActive: {
    color: theme.palette.secondary,
    fontWeight: "600",
    fontSize: 14,
  },

  // Secondary button for Dev Client builds
  devBuildButton: {
    flex: 1,
    backgroundColor: theme.palette.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.palette.primary + "60",
    ...getNeonGlow(theme.palette.primary, "subtle"),
  },
  devBuildButtonText: {
    color: theme.palette.primary,
    fontWeight: "800",
    fontSize: 14,
  },
  resetButton: {
    backgroundColor: theme.palette.card,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  resetButtonText: {
    fontSize: 20,
  },
  hintCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  hintText: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  liveCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  cardMeta: {
    color: theme.palette.text.secondary,
    fontSize: 13,
  },
  statusText: {
    color: theme.palette.text.primary,
    fontSize: 14,
    marginBottom: 12,
  },
  progressBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.palette.background,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: theme.palette.primary,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  linkText: {
    color: theme.palette.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  previewNavButton: {
    marginTop: 12,
    backgroundColor: theme.palette.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    ...getNeonGlow(theme.palette.primary, "normal"),
  },
  previewNavText: {
    color: theme.palette.secondary,
    fontWeight: "800",
  },
});
