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

// ✅ ADDED: Filename validation
const isValidFilename = (name: string): boolean => {
  // Erlaubt: Buchstaben, Zahlen, Punkt, Unterstrich, Bindestrich
  return /^[a-zA-Z0-9._-]+$/.test(name);
};

export const CreationDialog: React.FC<CreationDialogProps> = ({
  visible,
  currentPath,
  onClose,
  onCreateFile,
  onCreateFolder,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'file' | 'folder'>('file');
  const [error, setError] = useState<string>('');

  const handleCreate = () => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      setError('Name darf nicht leer sein');
      return;
    }

    // ✅ FIXED: Validierung für Dateinamen
    if (!isValidFilename(trimmedName)) {
      setError('Nur Buchstaben, Zahlen, Punkt, Unterstrich und Bindestrich erlaubt');
      return;
    }

    if (type === 'file') {
      onCreateFile(trimmedName);
    } else {
      onCreateFolder(trimmedName);
    }

    setName('');
    setError('');
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
              <Ionicons
                name="document-text-outline"
                size={20}
                color={type === 'file' ? '#fff' : theme.palette.text.secondary}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'file' && styles.typeButtonTextActive,
                ]}
              >
                Datei
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeButton, type === 'folder' && styles.typeButtonActive]}
              onPress={() => setType('folder')}
            >
              <Ionicons
                name="folder-outline"
                size={20}
                color={type === 'folder' ? '#fff' : theme.palette.text.secondary}
              />
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'folder' && styles.typeButtonTextActive,
                ]}
              >
                Ordner
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError('');
            }}
            placeholder={type === 'file' ? 'Dateiname.ext' : 'Ordnername'}
            placeholderTextColor={theme.palette.text.secondary}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.createButton,
                (!name.trim() || !type) && styles.createButtonDisabled,
              ]}
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
