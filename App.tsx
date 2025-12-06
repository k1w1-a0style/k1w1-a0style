// App.tsx – mit Performance-Optimierungen (V3)

import 'react-native-get-random-values';
import 'react-native-reanimated';

import React, { memo, useCallback } from 'react';
import {
  LogBox,
  StyleSheet,
  StatusBar as RNStatusBar,
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { theme } from './theme';

import { TerminalProvider } from './contexts/TerminalContext';
import { AIProvider } from './contexts/AIContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { GitHubProvider } from './contexts/GitHubContext';

import ChatScreen from './screens/ChatScreen';
import CodeScreen from './screens/CodeScreen';
import TerminalScreen from './screens/TerminalScreen';
import SettingsScreen from './screens/SettingsScreen';
import ConnectionsScreen from './screens/ConnectionsScreen';
import AppInfoScreen from './screens/AppInfoScreen';
import GitHubReposScreen from './screens/GitHubReposScreen';
import BuildScreenV2 from './screens/BuildScreenV2';
import DiagnosticScreen from './screens/DiagnosticScreen';
import PreviewScreen from './screens/PreviewScreen';
import KeyBackupScreen from './screens/KeyBackupScreen';

import CustomHeader from './components/CustomHeader';
import { CustomDrawerContent } from './components/CustomDrawer';

LogBox.ignoreAllLogs(true);

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// ---------------------------------------------------------------
// TAB NAVIGATION - MIT MEMO OPTIMIERT
// ---------------------------------------------------------------

const TabNavigator: React.FC = memo(() => {
  const tabScreenOptions = useCallback(
    ({ route }: { route: { name: string } }) => ({
      tabBarIcon: ({
        focused,
        color,
        size,
      }: {
        focused: boolean;
        color: string;
        size: number;
      }) => {
        let iconName: keyof typeof Ionicons.glyphMap = 'help-circle';

        if (route.name === 'Chat') {
          iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
        } else if (route.name === 'Code') {
          iconName = focused ? 'code-slash' : 'code-slash-outline';
        } else if (route.name === 'Terminal') {
          iconName = focused ? 'terminal' : 'terminal-outline';
        }

        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: theme.palette.primary,
      tabBarInactiveTintColor: theme.palette.text.secondary,
      tabBarStyle: {
        backgroundColor: theme.palette.card,
        borderTopWidth: 0,
      },
      headerShown: false,
      tabBarShowLabel: true,
    }),
    [],
  );

  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Code" component={CodeScreen} />
      <Tab.Screen name="Terminal" component={TerminalScreen} />
    </Tab.Navigator>
  );
});

TabNavigator.displayName = 'TabNavigator';

// ---------------------------------------------------------------
// DRAWER NAVIGATION - MIT MEMO UND USE-CALLBACK
// ---------------------------------------------------------------

const AppNavigation: React.FC = memo(() => {
  const { isLoading } = useProject();

  const drawerScreenOptions = useCallback(
    () => ({
      header: (props: any) => <CustomHeader {...props} />,
    }),
    [],
  );

  const drawerContent = useCallback(
    (props: any) => <CustomDrawerContent {...props} />,
    [],
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.palette.primary} />
        <Text style={styles.loadingText}>
          Projekt-Manager wird geladen...
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Drawer.Navigator
        initialRouteName="Home"
        screenOptions={drawerScreenOptions}
        drawerContent={drawerContent}
      >
        {/* HOME: Tabs (Chat / Code / Terminal) */}
        <Drawer.Screen
          name="Home"
          component={TabNavigator}
          options={{
            title: 'Projekt',
            drawerLabel: '🏠 Projekt',
          }}
        />

        {/* SETTINGS */}
        <Drawer.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'KI-Einstellungen',
            drawerLabel: '🤖 KI-Einstellungen',
          }}
        />

        {/* KEYS / BACKUP */}
        <Drawer.Screen
          name="KeyBackup"
          component={KeyBackupScreen}
          options={{
            title: 'API-Keys & Backup',
            drawerLabel: '🔐 Keys & Backup',
          }}
        />

        {/* CONNECTIONS */}
        <Drawer.Screen
          name="Connections"
          component={ConnectionsScreen}
          options={{
            title: 'Verbindungen',
            drawerLabel: '🔗 Verbindungen',
          }}
        />

        {/* GitHub Repos */}
        <Drawer.Screen
          name="GitHubRepos"
          component={GitHubReposScreen}
          options={{
            title: 'GitHub Repositories',
            drawerLabel: '🐙 GitHub Repos',
          }}
        />

        {/* DIAGNOSTIC */}
        <Drawer.Screen
          name="Diagnostic"
          component={DiagnosticScreen}
          options={{
            title: 'Projekt-Diagnose',
            drawerLabel: '🔍 Diagnose',
          }}
        />

        {/* PREVIEW */}
        <Drawer.Screen
          name="Preview"
          component={PreviewScreen}
          options={{
            title: 'Vorschau',
            drawerLabel: '👁 Vorschau',
          }}
        />

        {/* EINZIGER Build-Screen: V2 */}
        <Drawer.Screen
          name="BuildsV2"
          component={BuildScreenV2}
          options={{
            title: 'Build Status',
            drawerLabel: '📦 Builds',
          }}
        />

        {/* APP INFO */}
        <Drawer.Screen
          name="AppInfo"
          component={AppInfoScreen}
          options={{
            title: 'App Info',
            drawerLabel: 'ℹ️ App Info',
          }}
        />
      </Drawer.Navigator>
    </NavigationContainer>
  );
});

AppNavigation.displayName = 'AppNavigation';

// ---------------------------------------------------------------
// ROOT APP - EINFACHER WRAPPER
// ---------------------------------------------------------------

const App: React.FC = memo(() => {
  return (
    <ProjectProvider>
      <GitHubProvider>
        <TerminalProvider>
          <AIProvider>
            <View
              style={{
                flex: 1,
                backgroundColor: theme.palette.background,
              }}
            >
              <RNStatusBar barStyle="light-content" />
              <StatusBar style="light" />
              <AppNavigation />
            </View>
          </AIProvider>
        </TerminalProvider>
      </GitHubProvider>
    </ProjectProvider>
  );
});

App.displayName = 'App';

export default App;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.palette.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: theme.palette.text.secondary,
  },
});
