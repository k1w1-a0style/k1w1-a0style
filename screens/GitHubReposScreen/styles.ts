import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1, backgroundColor: theme.palette.background },
  content: { padding: 16, paddingBottom: 32 },

  // Subtle neon (A): dark surfaces + primary accent with soft glow
  neonGlow: {
    shadowColor: theme.palette.primary,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  noTokenTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.palette.text.primary,
  },
  noTokenText: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    textAlign: "center",
    lineHeight: 18,
  },

  headerSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    columnGap: 12,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    paddingTop: 2,
    backgroundColor: theme.palette.card,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.palette.text.primary,
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.secondary,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  iconBtnActive: {
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.card,
    shadowColor: theme.palette.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  chipRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.secondary,
  },
  chipActive: {
    borderColor: theme.palette.primary,
  },
  chipText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  chipTextActive: {
    color: theme.palette.primary,
  },

  section: {
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 12,
  },
  sectionNeon: {
    borderColor: theme.palette.primary,
    shadowColor: theme.palette.primary,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.3,
    color: theme.palette.primary,
    marginBottom: 10,
  },

  tokenLoader: { flexDirection: "row", alignItems: "center", gap: 8 },
  tokenText: { fontSize: 12, color: theme.palette.text.primary, lineHeight: 18 },
  errorText: { fontSize: 12, color: theme.palette.error, marginTop: 8 },

  button: {
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    borderColor: theme.palette.border,
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderColor: theme.palette.primary,
  },
  buttonDanger: {
    backgroundColor: "transparent",
    borderColor: theme.palette.error,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: {
    color: theme.palette.primary,
    fontWeight: "900",
    fontSize: 13,
  },
  buttonTextSecondary: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 13,
  },
  buttonTextGhost: {
    color: theme.palette.primary,
    fontWeight: "900",
    fontSize: 13,
  },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: {
    flex: 1,
    backgroundColor: theme.palette.secondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    color: theme.palette.text.primary,
  },

  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.secondary,
  },
  filterButtonActive: {
    borderColor: theme.palette.primary,
  },
  filterButtonText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    fontWeight: "700",
  },
  filterButtonTextActive: {
    color: theme.palette.primary,
  },

  noRecentText: { fontSize: 12, color: theme.palette.text.secondary, marginTop: 10 },
  recentContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  recentPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: theme.palette.secondary,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  recentPillActive: {
    borderColor: theme.palette.primary,
  },
  recentPillText: {
    fontSize: 12,
    color: theme.palette.text.primary,
    fontWeight: "700",
  },
  clearRecentText: {
    marginTop: 10,
    color: theme.palette.error,
    fontWeight: "800",
    fontSize: 12,
  },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  smallLabel: { fontSize: 12, color: theme.palette.text.secondary, lineHeight: 18 },
  currentRepoText: { fontSize: 12, color: theme.palette.text.primary, fontWeight: "800" },

  actionsLabel: { fontSize: 12, color: theme.palette.text.secondary, marginTop: 6 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },

  
  actionButton: {
    backgroundColor: theme.palette.secondary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    minWidth: 76,
    alignItems: "center",
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButtonPrimary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
  },
  actionButtonOutline: {
    backgroundColor: "transparent",
    borderColor: theme.palette.primary,
  },
  actionButtonText: {
    fontSize: 13,
    color: theme.palette.primary,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  actionButtonTextPrimary: {
    color: theme.palette.primary,
  },
  progressText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    marginTop: 8,
    textAlign: "center",
  },

  manageCard: {
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    marginTop: 8,
    marginBottom: 4,
    shadowColor: theme.palette.primary,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  manageTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.palette.text.primary,
    marginBottom: 10,
  },
  manageInput: {
    backgroundColor: theme.palette.secondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    color: theme.palette.text.primary,
  },
  manageRow: { flexDirection: "row", gap: 10, marginTop: 12 },
});
