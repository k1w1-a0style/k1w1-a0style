import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useProject } from '../contexts/ProjectContext';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { projectData, clearProject, loadProjectFromZip, isLoading } = useProject();

  const handleLoadZip = () => {
    loadProjectFromZip();
    props.navigation.closeDrawer();
  };

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

        {/* ✅ NAVIGATION */}
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

        {/* ✅ NEU: App Info */}
        <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('AppInfo')}>
          <Ionicons name="information-circle-outline" size={22} color={theme.palette.primary} />
          <Text style={styles.drawerItemText}>App Info</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* ✅ PROJEKT-INFO (nur anzeigen, nicht bearbeiten) */}
        <Text style={styles.projectSectionTitle}>Aktuelles Projekt</Text>

        <View style={styles.projectDisplayContainer}>
          <Ionicons name="folder-outline" size={24} color={theme.palette.primary} />
          <View style={styles.projectTextContainer}>
            <Text style={styles.projectName} numberOfLines={1}>
              {projectData?.name || 'Neues Projekt'}
            </Text>
            <Text style={styles.projectFileCount}>
              {projectData?.files?.length || 0} Dateien
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ✅ AKTIONEN */}
        <Text style={styles.projectSectionTitle}>Aktionen</Text>

        <TouchableOpacity onPress={handleLoadZip} style={styles.customItem} disabled={isLoading}>
          <Ionicons name="cloud-download-outline" size={24} color={theme.palette.primary} />
          <Text style={styles.customItemText}>Projekt aus ZIP laden</Text>
        </TouchableOpacity>

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
  customItemTextWarning: { marginLeft: 15, fontSize: 14, fontWeight: 'bold', color: theme.palette.warning },
  projectSectionTitle: { fontSize: 12, fontWeight: 'bold', color: theme.palette.text.secondary, paddingHorizontal: 20, marginBottom: 10, textTransform: 'uppercase' },
  // ✅ NEU: Projekt-Anzeige (nicht bearbeitbar)
  projectDisplayContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.palette.background, paddingVertical: 12, paddingHorizontal: 16, marginHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: theme.palette.border },
  projectTextContainer: { marginLeft: 12, flex: 1 },
  projectName: { fontSize: 16, fontWeight: 'bold', color: theme.palette.text.primary },
  projectFileCount: { fontSize: 12, color: theme.palette.text.secondary, marginTop: 2 },
});

export default CustomDrawerContent;
