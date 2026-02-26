import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

import { styles } from "./CreationDialog.styles";

interface CreationDialogProps {
  visible: boolean;
  currentPath: string;
  onClose: () => void;
  onCreateFile: (name: string) => void | Promise<void>;
  onCreateFolder: (name: string) => void | Promise<void>;
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

  // Reset fields every time the dialog opens.
  useEffect(() => {
    if (visible) {
      setName('');
      setType('file');
      setError('');
    }
  }, [visible]);

  const handleCreate = async () => {
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
      await Promise.resolve(onCreateFile(trimmedName));
    } else {
      await Promise.resolve(onCreateFolder(trimmedName));
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

