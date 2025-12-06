import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { theme, getNeonGlow } from '../theme';

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
    iconName: keyof typeof Ionicons.glyphMap,
    badge?: string
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
        activeOpacity={0.7}
      >
        {/* Neon Glow Indicator für aktives Item */}
        {active && <View style={styles.activeIndicator} />}
        
        <View style={[
          styles.iconContainer,
          active && styles.iconContainerActive,
        ]}>
          <Ionicons
            name={iconName}
            size={20}
            color={
              active
                ? theme.palette.primary
                : theme.palette.text.secondary
            }
          />
        </View>
        
        <Text
          style={[
            styles.drawerItemText,
            active && styles.drawerItemTextActive,
          ]}
        >
          {label}
        </Text>

        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}

        {active && (
          <View style={styles.activeChevron}>
            <Ionicons 
              name="chevron-forward" 
              size={16} 
              color={theme.palette.primary} 
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSectionTitle = (title: string) => (
    <Text style={styles.sectionTitle}>{title}</Text>
  );

  return (
    <View style={styles.root}>
      {/* Header mit Neon-Akzent */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={[styles.logoIcon, getNeonGlow(theme.palette.primary, 'subtle')]}>
            <Text style={styles.logoEmoji}>⚡</Text>
          </View>
          <View style={styles.logoText}>
            <Text style={styles.appTitle}>K1W1 AO-Style</Text>
            <Text style={styles.appSubTitle}>
              Prompt → Code → GitHub → APK
            </Text>
          </View>
        </View>
        
        {/* Status Indicator */}
        <View style={styles.statusBar}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Bereit</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderSectionTitle('HAUPTMENÜ')}
        {renderItem('Home', 'Home', 'home-outline')}
        {renderItem('KI-Einstellungen', 'Settings', 'options-outline')}
        {renderItem('Verbindungen', 'Connections', 'link-outline')}

        {renderSectionTitle('ENTWICKLUNG')}
        {renderItem('GitHub Repos', 'GitHubRepos', 'logo-github')}
        {renderItem('Builds', 'Builds', 'construct-outline')}

        {renderSectionTitle('ANALYSE')}
        {renderItem('Diagnose', 'Diagnostic', 'bug-outline')}
        {renderItem('Vorschau', 'Preview', 'eye-outline')}

        {renderSectionTitle('INFO')}
        {renderItem('App Info', 'AppInfo', 'information-circle-outline')}
      </ScrollView>

      {/* Footer mit Versionsnummer */}
      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Text style={styles.footerText}>k1w1-a0style</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>v1.0.0-alpha</Text>
          </View>
        </View>
        <Text style={styles.footerSubtext}>
          Made with 💚 for Expo SDK 54
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: `${theme.palette.primary}15`,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoEmoji: {
    fontSize: 22,
  },
  logoText: {
    flex: 1,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.palette.primary,
    letterSpacing: 0.5,
  },
  appSubTitle: {
    marginTop: 2,
    fontSize: 11,
    color: theme.palette.text.secondary,
    letterSpacing: 0.3,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: `${theme.palette.primary}10`,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.primary,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: theme.palette.primary,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.palette.text.disabled,
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 16,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 10,
    position: 'relative',
  },
  drawerItemActive: {
    backgroundColor: `${theme.palette.primary}12`,
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: '25%',
    bottom: '25%',
    width: 3,
    backgroundColor: theme.palette.primary,
    borderRadius: 2,
    ...getNeonGlow(theme.palette.primary, 'subtle'),
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconContainerActive: {
    backgroundColor: `${theme.palette.primary}20`,
  },
  drawerItemText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    flex: 1,
  },
  drawerItemTextActive: {
    fontWeight: '600',
    color: theme.palette.primary,
  },
  badge: {
    backgroundColor: theme.palette.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  activeChevron: {
    marginLeft: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.palette.text.primary,
  },
  versionBadge: {
    backgroundColor: `${theme.palette.primary}15`,
    borderWidth: 1,
    borderColor: `${theme.palette.primary}30`,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  versionText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.palette.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footerSubtext: {
    fontSize: 10,
    color: theme.palette.text.disabled,
    marginTop: 4,
  },
});
