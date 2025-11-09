import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { projectData, createNewProject, importProjectFromZip, isLoading } = useProject();
  const [iconPreview, setIconPreview] = useState<string | null>(null);

  useEffect(() => {
    if (projectData && projectData.files) {
      const iconFile = projectData.files.find((f) => f.path === 'assets/icon.png');
      if (iconFile && iconFile.content) {
        if (
          iconFile.content.length > 100 &&
          !iconFile.content.includes('{') &&
          !iconFile.content.startsWith('data:')
        ) {
          setIconPreview(`data:image/png;base64,${iconFile.content}`);
        } else if (iconFile.content.startsWith('data:image/png;base64,')) {
          setIconPreview(iconFile.content);
        } else {
          setIconPreview(null);
        }
      } else {
        setIconPreview(null);
      }
    }
  }, [projectData?.files, projectData?.lastModified]);

  const handleLoadZip = () => {
    importProjectFromZip();
    props.navigation.closeDrawer();
  };

  const handleNewProject = () => {
    createNewProject();
    props.navigation.closeDrawer();
  };

  const navigateTo = (screen: string) => {
    // @ts-ignore
    props.navigation.navigate(screen);
    props.navigation.closeDrawer();
  };

  const fileCount = projectData?.files?.length ?? 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
      <DrawerContentScrollView {...props}>
        {/* Navigation */}
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

        <TouchableOpacity style={styles.drawerItem} onPress={() => navigateTo('AppInfo')}>
          <Ionicons name="information-circle-outline" size={22} color={theme.palette.primary} />
          <Text style={styles.drawerItemText}>App Info</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Projekt-Info */}
        {projectData && (
          <>
            <Text style={styles.projectSectionTitle}>Aktives Projekt</Text>
            <View style={styles.projectDisplayContainer}>
              {iconPreview ? (
                <Image source={{ uri: iconPreview }} style={styles.projectIcon} />
              ) : (
                <View style={styles.projectIcon} />
              )}
              <View style={styles.projectTextContainer}>
                <Text style={styles.projectName}>
                  {projectData.name || 'Unbenanntes Projekt'}
                </Text>
                <Text style={styles.projectFileCount}>
                  {fileCount} Datei{fileCount === 1 ? '' : 'en'}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Aktionen */}
        <TouchableOpacity
          onPress={handleLoadZip}
          style={styles.customItem}
          disabled={isLoading}
        >
          <Ionicons
            name="cloud-download-outline"
            size={24}
            color={theme.palette.primary}
          />
          <Text style={styles.customItemText}>Projekt aus ZIP laden</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNewProject}
          style={styles.customItem}
          disabled={isLoading}
        >
          <Ionicons
            name="add-circle-outline"
            size={24}
            color={theme.palette.warning}
          />
          <Text style={styles.customItemTextWarning}>Neues Projekt starten</Text>
        </TouchableOpacity>
      </DrawerContentScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.palette.card,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  drawerItemText: {
    marginLeft: 15,
    fontSize: 16,
    color: theme.palette.text.primary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: theme.palette.border,
    marginVertical: 15,
    marginHorizontal: 16,
  },
  customItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  customItemText: {
    marginLeft: 15,
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.palette.primary,
  },
  customItemTextWarning: {
    marginLeft: 15,
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.palette.warning,
  },
  projectSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.palette.text.secondary,
    paddingHorizontal: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  projectDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.palette.background,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  projectIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  projectTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
  },
  projectFileCount: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
});

export default CustomDrawerContent;
