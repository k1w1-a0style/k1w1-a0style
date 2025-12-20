// components/ChatHeaderActions.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  Keyboard,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';

const ChatHeaderActions: React.FC = () => {
  const {
    projectData,
    clearChatHistory,
    exportProjectAsZip,
    importProjectFromZip,
    createNewProject,
    setProjectName,
  } = useProject();

  const currentName = useMemo(() => projectData?.name || 'Neues Projekt', [projectData?.name]);

  const [menuVisible, setMenuVisible] = useState(false);

  const [renameVisible, setRenameVisible] = useState(false);
  const [renameDraft, setRenameDraft] = useState(currentName);

  const toggleMenu = () => setMenuVisible(prev => !prev);

  const closeAll = () => {
    setMenuVisible(false);
    Keyboard.dismiss();
  };

  const handleClearChat = async () => {
    closeAll();
    await clearChatHistory();
  };

  const handleNewProject = async () => {
    closeAll();
    await createNewProject();
  };

  const handleExportZip = async () => {
    closeAll();
    await exportProjectAsZip();
  };

  const handleImportZip = async () => {
    closeAll();
    await importProjectFromZip();
  };

  const openRename = () => {
    setMenuVisible(false);
    setRenameDraft(currentName);
    setRenameVisible(true);
  };

  const closeRename = () => {
    setRenameVisible(false);
    Keyboard.dismiss();
  };

  const saveRename = async () => {
    const next = renameDraft.trim();
    if (!next) {
      Alert.alert('Fehler', 'Projektname darf nicht leer sein.');
      return;
    }
    try {
      await setProjectName(next);
      closeRename();
      Alert.alert('✅ Gespeichert', `Projektname: "${next}"`);
    } catch (e: any) {
      Alert.alert('Fehler', e?.message || 'Konnte Projektname nicht speichern.');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={toggleMenu}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.8}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={theme.palette.primary} />
      </TouchableOpacity>

      {/* Dropdown */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={toggleMenu}>
        <TouchableWithoutFeedback onPress={toggleMenu}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuCard}>
                <Text style={styles.menuTitle}>Projekt / Chat</Text>

                <TouchableOpacity style={styles.menuItem} onPress={handleClearChat}>
                  <Ionicons name="chatbubbles-outline" size={18} color={theme.palette.text.primary} />
                  <Text style={styles.menuItemText}>Chat leeren (Projekt behalten)</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={openRename}>
                  <Ionicons name="pencil-outline" size={18} color={theme.palette.text.primary} />
                  <Text style={styles.menuItemText}>Projekt umbenennen</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleNewProject}>
                  <Ionicons name="add-circle-outline" size={18} color={theme.palette.text.primary} />
                  <Text style={styles.menuItemText}>Neues Projekt</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity style={styles.menuItem} onPress={handleExportZip}>
                  <Ionicons name="download-outline" size={18} color={theme.palette.text.primary} />
                  <Text style={styles.menuItemText}>Projekt als ZIP speichern</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleImportZip}>
                  <Ionicons name="cloud-upload-outline" size={18} color={theme.palette.text.primary} />
                  <Text style={styles.menuItemText}>Projekt aus ZIP laden</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Rename Modal */}
      <Modal visible={renameVisible} transparent animationType="fade" onRequestClose={closeRename}>
        <TouchableWithoutFeedback onPress={closeRename}>
          <View style={styles.renameOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.renameCard}>
                <Text style={styles.renameTitle}>Projekt umbenennen</Text>
                <Text style={styles.renameSubtitle}>Aktuell: {currentName}</Text>

                <TextInput
                  value={renameDraft}
                  onChangeText={setRenameDraft}
                  placeholder="Neuer Projektname…"
                  placeholderTextColor={theme.palette.text.secondary}
                  style={styles.renameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveRename}
                />

                <View style={styles.renameActions}>
                  <TouchableOpacity style={[styles.renameBtn, styles.renameBtnGhost]} onPress={closeRename} activeOpacity={0.85}>
                    <Text style={[styles.renameBtnText, styles.renameBtnTextGhost]}>Abbrechen</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.renameBtn, styles.renameBtnPrimary]} onPress={saveRename} activeOpacity={0.85}>
                    <Text style={[styles.renameBtnText, styles.renameBtnTextPrimary]}>Speichern</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },

  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    marginLeft: 12,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  menuCard: {
    width: 270,
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },

  menuTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.palette.text.secondary,
    marginBottom: 4,
    marginLeft: 2,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 10,
  },

  menuItemText: { fontSize: 14, color: theme.palette.text.primary },

  menuDivider: { height: 1, marginVertical: 6, backgroundColor: theme.palette.border },

  // Rename
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },

  renameCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.palette.border,
    padding: 14,
  },

  renameTitle: { fontSize: 16, fontWeight: '700', color: theme.palette.text.primary },
  renameSubtitle: { marginTop: 6, fontSize: 12, color: theme.palette.text.secondary },

  renameInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background,
    fontSize: 14,
  },

  renameActions: { marginTop: 12, flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },

  renameBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },

  renameBtnGhost: { borderColor: theme.palette.border, backgroundColor: 'transparent' },
  renameBtnPrimary: { borderColor: theme.palette.primary, backgroundColor: theme.palette.primary },

  renameBtnText: { fontSize: 14, fontWeight: '700' },
  renameBtnTextGhost: { color: theme.palette.text.primary },
  renameBtnTextPrimary: { color: '#000' },
});

export default ChatHeaderActions;
