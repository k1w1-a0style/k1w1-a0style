import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: theme.palette.text.primary,
    marginTop: 20,
    marginBottom: 12,
  },

  settingsContainer: { marginBottom: 16 },
  label: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    marginBottom: 8,
  },
  inputRow: { flexDirection: "row", alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: theme.palette.input.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10, // Android-only Wert (Original iOS: 12, Android: 10)
    color: theme.palette.text.primary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  saveButton: { padding: 8, marginLeft: 10 },
  hint: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 5,
    fontStyle: "italic",
  },

  iconButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.palette.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  iconButtonText: {
    marginLeft: 12,
    fontSize: 14,
    color: theme.palette.text.secondary,
  },
  iconPreview: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
  },
  iconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },

  assetsStatus: {
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.palette.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  assetsStatusTitle: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginBottom: 8,
    fontWeight: "600",
  },
  assetsStatusList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  assetStatusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: theme.palette.card,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  assetStatusText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    fontFamily: "monospace",
  },

  templateInfoContainer: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 8,
  },
  projectInfoContainer: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  infoLabel: { fontSize: 14, color: theme.palette.text.secondary },
  infoValue: { fontSize: 14, fontWeight: "bold", color: theme.palette.primary },
  infoValueMono: {
    fontSize: 12,
    fontFamily: "monospace",
    color: theme.palette.primary,
    maxWidth: "60%",
  },
  infoHint: {
    fontSize: 12,
    color: theme.palette.text.disabled,
    marginTop: 10,
    fontStyle: "italic",
  },

  // API Backup Styles
  apiBackupContainer: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 8,
  },
  apiBackupDescription: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 16,
  },
  apiBackupButtons: {
    flexDirection: "row",
    gap: 12,
  },
  backupButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.palette.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  restoreButton: {
    borderColor: theme.palette.warning,
  },
  backupButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.palette.primary,
  },
  restoreButtonText: {
    color: theme.palette.warning,
  },

  // API Keys Display Styles
  apiKeysContainer: {
    backgroundColor: theme.palette.card,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
    marginBottom: 8,
  },
  apiKeysDescription: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginBottom: 16,
    fontStyle: "italic",
  },
  providerKeySection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  providerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  providerEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  providerName: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.palette.text.primary,
    flex: 1,
  },
  keyCountBadge: {
    backgroundColor: theme.palette.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  keyCountText: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.palette.background,
  },
  noKeysText: {
    fontSize: 13,
    color: theme.palette.text.disabled,
    fontStyle: "italic",
    paddingLeft: 28,
  },
  keysList: {
    paddingLeft: 28,
  },
  keyItem: {
    marginBottom: 8,
    backgroundColor: theme.palette.background,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  keyItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  keyIndexLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.palette.primary,
    textTransform: "uppercase",
  },
  keyText: {
    fontSize: 11,
    fontFamily: "monospace",
    color: theme.palette.text.secondary,
    lineHeight: 16,
  },
});
