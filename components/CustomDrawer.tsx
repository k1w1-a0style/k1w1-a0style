import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useProject } from '../contexts/ProjectContext';

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (
  props,
) => {
  const { state, navigation } = props;
  const currentRouteName = state.routeNames[state.index];
  const { createNewProject, projectData } = useProject();

  const renderItem = (
    label: string,
    routeName: string,
    iconName: keyof typeof Ionicons.glyphMap,
  ) => {
    const isActive = currentRouteName === routeName;

    return (
      <TouchableOpacity
        key={routeName}
        style={[
          styles.drawerItem,
          isActive && styles.drawerItemActive,
        ]}
        onPress={() => navigation.navigate(routeName as never)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={iconName}
          size={20}
          color={
            isActive
              ? theme.palette.primary
              : theme.palette.text.secondary
          }
          style={styles.drawerIcon}
        />
        <Text
          style={[
            styles.drawerItemText,
            isActive && styles.drawerItemTextActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.appTitle}>k1w1-a0style</Text>
            <Text style={styles.appSubTitle}>
              Prompt → Code → GitHub → Build
            </Text>
          </View>
          <TouchableOpacity
            style={styles.newProjectButton}
            onPress={createNewProject}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle" size={24} color={theme.palette.primary} />
          </TouchableOpacity>
        </View>
        {projectData && (
          <View style={styles.projectInfo}>
            <Ionicons name="folder-open-outline" size={14} color={theme.palette.text.secondary} />
            <Text style={styles.projectName} numberOfLines={1}>
              {projectData.name || 'Unbenanntes Projekt'}
            </Text>
          </View>
        )}
      </View>

      {/* Einträge */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HOME */}
        {renderItem('🏠 Projekt', 'Home', 'home-outline')}

        {/* SETTINGS */}
        {renderItem('🤖 KI-Einstellungen', 'Settings', 'settings-outline')}

        {/* KEYS / BACKUP */}
        {renderItem('🔐 Keys & Backup', 'KeyBackup', 'key-outline')}

        {/* CONNECTIONS */}
        {renderItem('🔗 Verbindungen', 'Connections', 'link-outline')}

        {/* GITHUB */}
        {renderItem('🐙 GitHub Repos', 'GitHubRepos', 'logo-github')}

        {/* DIAGNOSTIC */}
        {renderItem('🔍 Diagnose', 'Diagnostic', 'medkit-outline')}

        {/* PREVIEW */}
        {renderItem('👁 Vorschau', 'Preview', 'eye-outline')}

        {/* EINZIGER BUILD-EINTRAG */}
        {renderItem('📦 Builds', 'BuildsV2', 'rocket-outline')}

        {/* INFO */}
        {renderItem('ℹ️ App Info', 'AppInfo', 'information-circle-outline')}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>k1w1-a0style · Alpha v1.0.0</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.palette.card,
  },
  header: {
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  appTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.palette.text.primary,
  },
  appSubTitle: {
    marginTop: 4,
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  newProjectButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: theme.palette.primarySoft,
  },
  projectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    gap: 6,
  },
  projectName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: theme.palette.text.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  drawerItemActive: {
    backgroundColor: theme.palette.background,
    borderLeftWidth: 3,
    borderLeftColor: theme.palette.primary,
  },
  drawerIcon: {
    marginRight: 12,
  },
  drawerItemText: {
    fontSize: 14,
    color: theme.palette.text.secondary,
    fontWeight: '500',
  },
  drawerItemTextActive: {
    color: theme.palette.primary,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    padding: 12,
  },
  footerText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    textAlign: 'center',
  },
});
