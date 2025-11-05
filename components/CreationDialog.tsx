import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface CreationDialogProps {
  visible: boolean;
  currentPath: string;
  onClose: () => void;
  onCreateFile: (name: string) => void;
  onCreateFolder: (name: string) => void;
}

export const CreationDialog: React.FC<CreationDialogProps> = ({ 
  visible, 
  currentPath, 
  onClose, 
  onCreateFile, 
  onCreateFolder 
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'file' | 'folder'>('file');

  const handleCreate = () => {
    if (!name.trim()) return;

    if (type === 'file') {
      onCreateFile(name.trim());
    } else {
      onCreateFolder(name.trim());
    }

    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.creationModal}>
          <Text style={styles.modalTitle}>Neu erstellen</Text>

          <View style={styles.pathInfo}>
            <Ionicons name="folder-outline" size={16} color={theme.palette.text.secondary} />
            <Text style={styles.pathText}>in: /{currentPath || 'Root'}</Text>
          </View>

          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, type === 'file' && styles.typeButtonActive]}
              onPress={() => setType('file')}
            >
              <Ionicons name="document-text-outline" size={20} color={type === 'file' ? '#fff' : theme.palette.text.secondary} />
              <Text style={[styles.typeButtonText, type === 'file' && styles.typeButtonTextActive]}>
                Datei
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeButton, type === 'folder' && styles.typeButtonActive]}
              onPress={() => setType('folder')}
            >
              <Ionicons name="folder-outline" size={20} color={type === 'folder' ? '#fff' : theme.palette.text.secondary} />
              <Text style={[styles.typeButtonText, type === 'folder' && styles.typeButtonTextActive]}>
                Ordner
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder={type === 'file' ? 'Dateiname.tsx' : 'Ordnername'}
            placeholderTextColor={theme.palette.text.secondary}
            autoFocus
            autoCapitalize="none"
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, !name.trim() && styles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={!name.trim()}
            >
              <Text style={styles.createButtonText}>Erstellen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  creationModal: {
    backgroundColor: theme.palette.background.primary,
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  pathInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.palette.background.secondary,
    borderRadius: 8,
  },
  pathText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    marginLeft: 6,
    fontFamily: 'monospace',
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: theme.palette.background.secondary,
    borderRadius: 8,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 6,
  },
  typeButtonActive: {
    backgroundColor: theme.palette.primary,
  },
  typeButtonText: {
    fontSize: 16,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.secondary,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: theme.palette.text.secondary,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.palette.primary,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
