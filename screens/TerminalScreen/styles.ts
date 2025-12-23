import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.palette.background },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: theme.palette.text.primary },
  headerRight: { flexDirection: "row", gap: 8 },
  headerBtn: { padding: 6 },

  topBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    gap: 10,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleTitle: { fontWeight: "800", color: theme.palette.text.primary },
  toggleHint: { fontSize: 12, color: theme.palette.text.secondary },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  statChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.palette.text.secondary,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.palette.text.primary,
  },

  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  filterBtnActive: { borderColor: theme.palette.primary },
  filterText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.palette.text.secondary,
  },
  filterTextActive: { color: theme.palette.primary },

  autoScrollRow: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 10,
  },
  autoScrollLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.palette.text.secondary,
  },

  searchRow: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.palette.text.primary },

  list: { paddingHorizontal: 16, paddingBottom: 80 },

  logRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  logMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  logTime: { fontSize: 12, color: theme.palette.text.secondary },
  logType: { fontSize: 12, fontWeight: "900" },
  logMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.palette.text.primary,
  },

  empty: { paddingTop: 40, alignItems: "center" },
  emptyText: { textAlign: "center", color: theme.palette.text.secondary },
  emptyHint: {
    marginTop: 8,
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
});
