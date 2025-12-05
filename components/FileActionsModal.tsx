import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export interface FileAction {
  type: 'rename' | 'move' | 'delete' | 'duplicate' | 'info';
  icon: string;
  label: string;
  color: string;
  destructive?: boolean;
}

interface FileActionsModalProps {
  visible: boolean;
  fileName: string;
  filePath: string;
  onClose: () => void;
  onRename: (newName: string) => void;
  onMove: (newPath: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  folders?: string[];
}

export const FileActionsModal: React.FC<FileActionsModalProps> = ({
  visible,
  fileName,
  filePath,
  onClose,
  onRename,
  onMove,
  onDelete,
  onDuplicate,
  folders = [],
}) => {
  const [showRename, setShowRename] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [newName, setNewName] = useState(fileName);
  const [selectedFolder, setSelectedFolder] = useState<string>('');

  const handleRename = () => {
    if (!newName.trim()) {
      Alert.alert('Fehler', 'Bitte einen Namen eingeben');
      return;
    }
    if (newName === fileName) {
      setShowRename(false);
      return;
    }
    onRename(newName);
    setShowRename(false);
    onClose();
  };

  const handleMove = () => {
    if (!selectedFolder && selectedFolder !== '') {
      Alert.alert('Fehler', 'Bitte einen Ordner auswählen');
      return;
    }
    onMove(selectedFolder);
    setShowMove(false);
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      'Löschen bestätigen',
      `"${fileName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            onDelete();
            onClose();
          },
        },
      ]
    );
  };

  const handleDuplicate = () => {
    onDuplicate();
    onClose();
  };

  if (showRename) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRename(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="create-outline" size={24} color={theme.palette.primary} />
              <Text style={styles.modalTitle}>Umbenennen</Text>
            </View>

            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              selectTextOnFocus
              placeholder="Neuer Name"
              placeholderTextColor={theme.palette.text.secondary}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setNewName(fileName);
                  setShowRename(false);
                }}
              >
                <Text style={styles.modalButtonTextSecondary}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleRename}
              >
                <Text style={styles.modalButtonText}>Umbenennen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (showMove) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMove(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="folder-open-outline" size={24} color={theme.palette.primary} />
              <Text style={styles.modalTitle}>Verschieben nach</Text>
            </View>

            <ScrollView style={styles.folderList}>
              <TouchableOpacity
                style={[
                  styles.folderItem,
                  selectedFolder === '' && styles.folderItemSelected,
                ]}
                onPress={() => setSelectedFolder('')}
              >
                <Ionicons name="home" size={20} color={theme.palette.primary} />
                <Text style={styles.folderItemText}>Root (Hauptverzeichnis)</Text>
              </TouchableOpacity>

              {folders.map((folder) => (
                <TouchableOpacity
                  key={folder}
                  style={[
                    styles.folderItem,
                    selectedFolder === folder && styles.folderItemSelected,
                  ]}
                  onPress={() => setSelectedFolder(folder)}
                >
                  <Ionicons name="folder" size={20} color="#FFA726" />
                  <Text style={styles.folderItemText}>{folder}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowMove(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleMove}
              >
                <Text style={styles.modalButtonText}>Verschieben</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.actionSheet}>
          <View style={styles.actionSheetHeader}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle} numberOfLines={1}>
              {fileName}
            </Text>
            <Text style={styles.actionSheetSubtitle} numberOfLines={1}>
              {filePath}
            </Text>
          </View>

          <View style={styles.actionList}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => setShowRename(true)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#2196F315' }]}>
                <Ionicons name="create-outline" size={22} color="#2196F3" />
              </View>
              <Text style={styles.actionText}>Umbenennen</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.palette.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => setShowMove(true)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#9C27B015' }]}>
                <Ionicons name="folder-open-outline" size={22} color="#9C27B0" />
              </View>
              <Text style={styles.actionText}>Verschieben</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.palette.text.secondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={handleDuplicate}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FF980015' }]}>
                <Ionicons name="copy-outline" size={22} color="#FF9800" />
              </View>
              <Text style={styles.actionText}>Duplizieren</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, styles.actionItemDestructive]}
              onPress={handleDelete}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#F4433615' }]}>
                <Ionicons name="trash-outline" size={22} color="#F44336" />
              </View>
              <Text style={[styles.actionText, styles.actionTextDestructive]}>Löschen</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
