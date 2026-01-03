import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1, backgroundColor: theme.palette.background },
  content: { padding: 16, paddingBottom: 32 },

  headerSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    columnGap: 12,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 16,
  },

  section: {
    marginBottom: 24,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.palette.text.primary,
    marginBottom: 8,
  },

  tokenLoader: { marginBottom: 8 },
  tokenText: { fontSize: 12, color: theme.palette.text.secondary },
  errorText: { color: theme.palette.error, fontSize: 12, marginBottom: 8 },

  // Buttons: dark background + neon (primary) text/icon
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 8,
    marginTop: 8,
    backgroundColor: theme.palette.secondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: theme.palette.primary, fontWeight: "700" },

  searchRow: { flexDirection: "row", marginBottom: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: theme.palette.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: theme.palette.text.primary,
    fontSize: 14,
  },

  filterRow: { flexDirection: "row", marginBottom: 8, flexWrap: "wrap" },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginRight: 8,
    marginBottom: 4,
    backgroundColor: theme.palette.background,
  },
  // Active Filter: dark bg + neon border
  filterButtonActive: {
    backgroundColor: theme.palette.secondary,
    borderColor: theme.palette.primary,
  },
  filterButtonText: { fontSize: 13, color: theme.palette.text.secondary },
  // Active text neon
  filterButtonTextActive: {
    fontSize: 13,
    color: theme.palette.primary,
    fontWeight: "700",
  },

  noRecentText: { fontSize: 12, color: theme.palette.text.secondary },
  recentContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },

  recentPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: theme.palette.background,
  },
  // Active pill: dark bg + neon border
  recentPillActive: {
    backgroundColor: theme.palette.secondary,
    borderColor: theme.palette.primary,
  },
  recentPillText: { fontSize: 12, color: theme.palette.primary },
  clearRecentText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    paddingVertical: 6,
  },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  smallLabel: { fontSize: 13, color: theme.palette.text.secondary },
  currentRepoText: {
    fontSize: 13,
    color: theme.palette.text.primary,
    marginBottom: 8,
  },

  actionsLabel: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginTop: 8,
    marginBottom: 4,
  },
  actionsRow: { flexDirection: "row", marginTop: 8, columnGap: 8 },

  // Action Buttons: dark bg + neon text
  actionButton: {
    backgroundColor: theme.palette.secondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    minWidth: 70,
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 13,
    color: theme.palette.primary,
    fontWeight: "700",
    textAlign: "center",
  },
  progressText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginTop: 6,
    textAlign: "center",
  },
});
