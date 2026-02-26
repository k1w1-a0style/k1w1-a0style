// components/FileActionsModal/styles.ts
// Extracted from FileActionsModal.tsx

import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: theme.palette.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  actionSheetHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    alignItems: 'center',
  },
  actionSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.palette.border,
    borderRadius: 2,
    marginBottom: 12,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  actionSheetSubtitle: {
    fontSize: 14,
    color: theme.palette.text.secondary,
  },
  actionList: {
    padding: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: theme.palette.background,
  },
  actionItemDestructive: {
    marginTop: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.palette.text.primary,
    flex: 1,
  },
  actionTextDestructive: {
    color: '#F44336',
  },
  cancelButton: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 16,
    backgroundColor: theme.palette.background,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.primary,
  },
  modalContent: {
    backgroundColor: theme.palette.card,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.palette.text.primary,
    marginLeft: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: theme.palette.primary,
  },
  modalButtonSecondary: {
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  folderList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: theme.palette.background,
  },
  folderItemSelected: {
    backgroundColor: `${theme.palette.primary}15`,
    borderWidth: 2,
    borderColor: theme.palette.primary,
  },
  folderItemText: {
    fontSize: 15,
    color: theme.palette.text.primary,
    marginLeft: 12,
  },
});
