// screens/CodeScreen/styles.ts
import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.palette.text.secondary,
  },

  // ==================== EXPLORER HEADER ====================
  explorerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    minHeight: 60,
  },
  projectTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: theme.palette.text.primary,
    flex: 1,
    marginRight: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12 as any,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  // ✅ dunkel + Schatten dunkel (#000 ist ok)
  addButton: {
    backgroundColor: theme.palette.secondary,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  // ==================== SELECTION MODE ====================
  selectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16 as any,
  },
  selectionCount: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.palette.text.primary,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8 as any,
  },
  selectionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  selectionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.palette.primary,
  },

  // ✅ Export Button dunkel + Text hell
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6 as any,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.palette.secondary,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.palette.text.primary,
  },

  // ==================== EDITOR HEADER ====================
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    minHeight: 56,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  fileName: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.palette.text.primary,
    marginLeft: 8,
    fontFamily: "monospace",
    flex: 1,
  },
  editorActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8 as any,
  },
  actionButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: theme.palette.background,
  },

  // ✅ dirty highlight dunkel
  actionButtonHighlight: {
    backgroundColor: theme.palette.secondary,
  },

  // ==================== SYNTAX ERRORS ====================
  errorContainer: {
    backgroundColor: theme.palette.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  errorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6 as any,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  errorBadgeError: {
    backgroundColor: `${theme.palette.error}15`,
    borderWidth: 1,
    borderColor: theme.palette.error,
  },
  errorBadgeWarning: {
    backgroundColor: `${theme.palette.warning}15`,
    borderWidth: 1,
    borderColor: theme.palette.warning,
  },
  errorBadgeText: {
    fontSize: 12,
    maxWidth: 300,
  },
  errorTextError: {
    color: theme.palette.error,
  },
  errorTextWarning: {
    color: theme.palette.warning,
  },

  // ==================== CODE EDITOR ====================
  codeEditor: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "monospace",
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background,
    textAlignVertical: "top",
  },
  codeEditorError: {
    backgroundColor: `${theme.palette.error}05`,
  },
  previewContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: theme.palette.card,
  },

  // ==================== IMAGE VIEWER ====================
  imageScrollContainer: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  imageContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    minHeight: 400,
  },
  imagePreview: {
    width: "100%",
    height: undefined,
    aspectRatio: 1,
    maxHeight: 500,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
  },
  imageInfo: {
    marginTop: 16,
    fontSize: 14,
    color: theme.palette.text.secondary,
    textAlign: "center",
  },

  // ==================== FILE LIST ====================
  listContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: theme.palette.text.secondary,
    marginTop: 16,
    marginBottom: 24,
  },

  // ✅ Button dunkel + Schatten dunkel (#000 ok)
  createFirstButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.palette.secondary,
    borderRadius: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  createFirstButtonText: {
    fontSize: 16,
    color: theme.palette.text.primary,
    fontWeight: "600",
  },
});
