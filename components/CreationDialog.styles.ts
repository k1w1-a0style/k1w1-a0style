import { StyleSheet } from "react-native";
import { theme } from "../theme";

export const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  creationModal: {
    width: '90%',
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    marginBottom: 12,
  },
  pathInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pathText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    marginLeft: 6,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: theme.palette.background,
    borderRadius: 8,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  typeButtonActive: {
    backgroundColor: theme.palette.primary,
  },
  typeButtonText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    marginLeft: 8,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  nameInput: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    fontWeight: '500',
  },
  createButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: theme.palette.primary,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: theme.palette.error,
    marginBottom: 12,
    marginTop: -8,
  },
});
