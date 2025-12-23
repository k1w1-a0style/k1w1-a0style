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
    gap: 12 as any,
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
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.palette.text.primary,
    marginBottom: 8,
  },

  tokenLoader: { marginBottom: 8 },
  tokenText: { fontSize: 12, color: theme.palette.text.secondary },
  errorText: { color: theme.palette.error, fontSize: 12, marginBottom: 8 },

  // ✅ Buttons: dark background + neon (primary) text/icon
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8 as any,
    marginTop: 8,
    backgroundColor: theme.palette.secondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: theme.palette.primary, fontWeight: "600" },

  searchRow: { flexDirection: "row", marginBottom: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: theme.palette.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: theme.palette.text.primary,
    fontSize: 13,
  },

  filterRow: { flexDirection: "row", marginBottom: 8 },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginRight: 8,
    backgroundColor: theme.palette.background,
  },
  // ✅ Active Filter: dark bg + neon border
  filterButtonActive: {
    backgroundColor: theme.palette.secondary,
    borderColor: theme.palette.primary,
  },
  filterButtonText: { fontSize: 12, color: theme.palette.text.secondary },
  // ✅ Active text neon
  filterButtonTextActive: {
    fontSize: 12,
    color: theme.palette.primary,
    fontWeight: "600",
  },

  noRecentText: { fontSize: 12, color: theme.palette.text.secondary },
  recentContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6 as any,
    marginTop: 8,
  },

  recentPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginRight: 4,
    marginBottom: 4,
    backgroundColor: theme.palette.background,
  },
  // ✅ Active pill: dark bg + neon border
  recentPillActive: {
    backgroundColor: theme.palette.secondary,
    borderColor: theme.palette.primary,
  },
  recentPillText: { fontSize: 11, color: theme.palette.primary },
  clearRecentText: { fontSize: 11, color: theme.palette.text.secondary },

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
  actionsRow: { flexDirection: "row", marginTop: 8, gap: 8 as any },

  // ✅ Action Buttons: dark bg + neon text
  actionButton: {
    backgroundColor: theme.palette.secondary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  actionButtonText: {
    fontSize: 12,
    color: theme.palette.primary,
    textAlign: "center",
  },
  progressText: {
    fontSize: 10,
    color: theme.palette.text.secondary,
    marginTop: 4,
    textAlign: "center",
  },
});
