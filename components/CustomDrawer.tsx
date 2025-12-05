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

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (
  props
) => {
  const { navigation, state } = props;

  const navigateTo = (screen: string) => {
    navigation.navigate(screen as never);
  };

  const currentRouteName =
    state.routeNames[state.index] ?? 'Home';

  const isActive = (name: string) => currentRouteName === name;

  const renderItem = (
    label: string,
    screen: string,
    iconName: keyof typeof Ionicons.glyphMap
  ) => {
    const active = isActive(screen);
    return (
      <TouchableOpacity
        key={screen}
        style={[
          styles.drawerItem,
          active && styles.drawerItemActive,
        ]}
        onPress={() => navigateTo(screen)}
      >
        <Ionicons
          name={iconName}
          size={22}
          color={
            active
              ? theme.palette.primary
              : theme.palette.text.primary
          }
          style={styles.drawerIcon}
        />
        <Text
          style={[
            styles.drawerItemText,
            active && styles.drawerItemTextActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>K1W1 AO-Style</Text>
        <Text style={styles.appSubTitle}>
          Prompt → Code → GitHub → APK
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {renderItem('Home', 'Home', 'home-outline')}
        {renderItem(
          'KI-Einstellungen',
          'Settings',
          'options-outline'
        )}
        {renderItem(
          'Verbindungen',
          'Connections',
          'link-outline'
        )}

        {/* 🔥 NEU: GitHub Repo Manager */}
        {renderItem(
          'GitHub Repos',
          'GitHubRepos',
          'logo-github'
        )}

        {/* Builds */}
        {renderItem(
          'Builds',
          'Builds',
          'construct-outline'
        )}

        {/* ✅ NEUE SCREENS */}
        {renderItem(
          '🔍 Diagnose',
          'Diagnostic',
          'bug-outline'
        )}
        {renderItem(
          '👁 Vorschau',
          'Preview',
          'eye-outline'
        )}

        {renderItem('App Info', 'AppInfo', 'information-circle-outline')}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          k1w1-a0style · Alpha
        </Text>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  drawerItemActive: {
    backgroundColor: theme.palette.background,
  },
  drawerIcon: {
    marginRight: 12,
  },
  drawerItemText: {
    fontSize: 15,
    color: theme.palette.text.primary,
  },
  drawerItemTextActive: {
    fontWeight: '600',
    color: theme.palette.primary,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
  },
  footerText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
});
