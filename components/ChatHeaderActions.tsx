// components/ChatHeaderActions.tsx
// Minimal overflow menu (3 dots): New Project / ZIP export / ZIP import / Clear chat

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useProject } from "../contexts/ProjectContext";

const ChatHeaderActions: React.FC = () => {
  const { clearChatHistory, exportProjectAsZip, importProjectFromZip, createNewProject } = useProject();

  const [menuVisible, setMenuVisible] = useState(false);

  const toggleMenu = () => setMenuVisible((prev) => !prev);
  const closeMenu = () => setMenuVisible(false);

  const handleNewProject = async () => {
    closeMenu();
    await createNewProject();
  };

  const handleExportZip = async () => {
    closeMenu();
    await exportProjectAsZip();
  };

  const handleImportZip = async () => {
    closeMenu();
    await importProjectFromZip();
  };

  const handleClearChat = async () => {
    closeMenu();
    await clearChatHistory();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={toggleMenu}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.8}
        accessibilityLabel="Projekt-Menü"
      >
        <Ionicons name="ellipsis-vertical" size={20} color={theme.palette.text.primary} />
      </TouchableOpacity>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={toggleMenu}>
        <TouchableWithoutFeedback onPress={toggleMenu}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuCard}>
                <Text style={styles.menuTitle}>Projekt</Text>

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

                <View style={styles.menuDivider} />

                <TouchableOpacity style={styles.menuItem} onPress={handleClearChat}>
                  <Ionicons name="chatbubbles-outline" size={18} color={theme.palette.text.primary} />
                  <Text style={styles.menuItemText}>Chat leeren</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", marginRight: 4 },

  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    marginLeft: 8,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 56,
    paddingRight: 8,
    backgroundColor: "rgba(0,0,0,0.25)",
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
    fontWeight: "600",
    color: theme.palette.text.secondary,
    marginBottom: 4,
    marginLeft: 2,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 10,
  },

  menuItemText: { fontSize: 14, color: theme.palette.text.primary },

  menuDivider: { height: 1, marginVertical: 6, backgroundColor: theme.palette.border },
});

export default ChatHeaderActions;
