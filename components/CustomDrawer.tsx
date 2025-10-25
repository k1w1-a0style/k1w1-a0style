import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useProject } from '../contexts/ProjectContext';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { projectData, clearProject, loadProjectFromZip, setProjectName, deleteCurrentProject, isLoading } = useProject();
  const [editingName, setEditingName] = useState('');

  const handleSaveName = async () => {
    if (editingName.trim()) {
      await setProjectName(editingName.trim());
    } else {
      if (projectData?.name) setEditingName(projectData.name);
    }
  };

  useEffect(() => {
    if (projectData?.name && projectData.name !== editingName) {
      setEditingName(projectData.name);
    }
  }, [projectData?.name]);

  const handleLoadZip = () => {
    loadProjectFromZip();
    props.navigation.closeDrawer();
  };

  const handleChooseIcon = () => {
    Alert.alert('TODO', 'Icon-Auswahl noch nicht implementiert.');
  };

  // ✅ FIX: NUR EINE Funktion (nicht mehr 2!)
  const handleNewProject = () => {
    Alert.alert(
      'Neues Projekt starten',
      'Möchtest du das aktuelle Projekt wirklich verwerfen? Alle Dateien und der Chatverlauf gehen verloren.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Ja, neu starten',
          style: 'destructive',
          onPress: async () => {
            await clearProject();
            console.log('CustomDrawer: Neues Projekt gestartet.');
            props.navigation.closeDrawer();
            // @ts-ignore
            props.navigation.navigate('Home', { screen: 'Chat' });
          },
        },
      ]
    );
  };

  const navigateTo = (screen: string) => {
    // @ts-ignore
    props.navigation.navigate(screen);
    props.navigation.closeDrawer();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
      <DrawerContentScrollView {...props}>
        <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('Home')}>
          <Ionicons name="home-outline" size={22} color={theme.palette.primary} />
          <Text style={styles.drawerItemText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('Settings')}>
          <Ionicons name="settings-outline" size={22} color={theme.palette.primary} />
          <Text style={styles.drawerItemText}>KI-Einstellungen</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('Connections')}>
          <Ionicons name="cloud-outline" size={22} color={theme.palette.primary} />
          <Text style={styles.drawerItemText}>Verbindungen</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.projectSectionTitle}>Aktuelles Projekt</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Projektname:</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={editingName}
              onChangeText={setEditingName}
              placeholder="App-Name"
              placeholderTextColor={theme.palette.text.secondary}
              onEndEditing={handleSaveName}
              editable={!isLoading}
            />
            <TouchableOpacity onPress={handleSaveName} style={styles.saveButton}>
              <Ionicons name="checkmark" size={24} color={theme.palette.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={handleChooseIcon} style={styles.customItem} disabled={isLoading}>
          <Ionicons name="image-outline" size={24} color={theme.palette.text.secondary} />
          <Text style={styles.customItemTextSecondary}>App Icon ändern (TODO)</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.projectSectionTitle}>Aktionen</Text>

        <TouchableOpacity onPress={handleLoadZip} style={styles.customItem} disabled={isLoading}>
          <Ionicons name="cloud-download-outline" size={24} color={theme.palette.primary} />
          <Text style={styles.customItemText}>Projekt aus ZIP laden</Text>
        </TouchableOpacity>

        {/* ✅ FIX: NUR NOCH EIN BUTTON (kombiniert) */}
        <TouchableOpacity onPress={handleNewProject} style={styles.customItem} disabled={isLoading}>
          <Ionicons name="add-circle-outline" size={24} color={theme.palette.warning} />
          <Text style={styles.customItemTextWarning}>Neues Projekt starten</Text>
        </TouchableOpacity>
      </DrawerContentScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.palette.card },
  drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: theme.palette.border },
  drawerItemText: { marginLeft: 15, fontSize: 16, color: theme.palette.text.primary, fontWeight: '500' },
  divider: { height: 1, backgroundColor: theme.palette.border, marginVertical: 15, marginHorizontal: 16 },
  customItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  customItemText: { marginLeft: 15, fontSize: 14, fontWeight: 'bold', color: theme.palette.primary },
  customItemTextSecondary: { marginLeft: 15, fontSize: 14, fontWeight: 'bold', color: theme.palette.text.secondary },
  customItemTextWarning: { marginLeft: 15, fontSize: 14, fontWeight: 'bold', color: theme.palette.warning },
  projectSectionTitle: { fontSize: 12, fontWeight: 'bold', color: theme.palette.text.secondary, paddingHorizontal: 20, marginBottom: 10, textTransform: 'uppercase' },
  inputGroup: { paddingHorizontal: 20, marginBottom: 10 },
  label: { fontSize: 14, color: theme.palette.text.secondary, marginBottom: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: theme.palette.input.background, borderRadius: 8, padding: 10, color: theme.palette.text.primary, borderWidth: 1, borderColor: theme.palette.border, fontSize: 14 },
  saveButton: { padding: 5, marginLeft: 10 }
});

export default CustomDrawerContent;
