import {
  LogBox,
  StyleSheet,
  StatusBar as RNStatusBar,
  View,
  Text,
  ActivityIndicator,
} from 'react-native';

LogBox.ignoreAllLogs(true);

import 'react-native-get-random-values';
import 'react-native-reanimated';

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';

import { TerminalProvider } from './contexts/TerminalContext';
import { AIProvider } from './contexts/AIContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';

import ChatScreen from './screens/ChatScreen';
import CodeScreen from './screens/CodeScreen';
import TerminalScreen from './screens/TerminalScreen';
import SettingsScreen from './screens/SettingsScreen';
import ConnectionsScreen from './screens/ConnectionsScreen';
import AppInfoScreen from './screens/AppInfoScreen';
import BuildScreen from './screens/BuildScreen';

import CustomHeader from './components/CustomHeader';
import { CustomDrawerContent } from './components/CustomDrawer';
import { StatusBar } from 'expo-status-bar';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// ---------------------------------------------------------------
// TAB NAVIGATION
// ---------------------------------------------------------------

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
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
      })}
    >
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Code" component={CodeScreen} />
      <Tab.Screen name="Terminal" component={TerminalScreen} />
    </Tab.Navigator>
  );
};

// ---------------------------------------------------------------
// DRAWER NAVIGATION
// ---------------------------------------------------------------

const AppNavigation = () => {
  const { isLoading } = useProject();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.palette.primary} />
        <Text style={styles.loadingText}>Projekt-Manager wird geladen...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={theme.palette.card} />

      <Drawer.Navigator
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          header: (props) => <CustomHeader {...props} />,
          drawerStyle: { backgroundColor: theme.palette.card },
          drawerActiveTintColor: theme.palette.primary,
          drawerInactiveTintColor: theme.palette.text.primary,
        }}
      >
        <Drawer.Screen
          name="Home"
          component={TabNavigator}
          options={{ title: 'k1w1-a0style', drawerLabel: 'Home' }}
        />

        <Drawer.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'KI-Einstellungen', drawerLabel: 'KI-Einstellungen' }}
        />

        <Drawer.Screen
          name="Connections"
          component={ConnectionsScreen}
          options={{ title: 'Verbindungen', drawerLabel: 'Verbindungen' }}
        />

        <Drawer.Screen
          name="Builds"
          component={BuildScreen}
          options={{ title: 'Build Status', drawerLabel: '📦 Builds' }}
        />

        <Drawer.Screen
          name="AppInfo"
          component={AppInfoScreen}
          options={{ title: 'App Info', drawerLabel: 'App Info' }}
        />
      </Drawer.Navigator>
    </NavigationContainer>
  );
};

// ---------------------------------------------------------------
// ROOT WRAPPER
// ---------------------------------------------------------------

export default function App() {
  return (
    <TerminalProvider>
      <AIProvider>
        <ProjectProvider>
          <AppNavigation />
        </ProjectProvider>
      </AIProvider>
    </TerminalProvider>
  );
}

// ---------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.palette.background,
    paddingTop: RNStatusBar.currentHeight || 0,
  },
  loadingText: {
    marginTop: 15,
    color: theme.palette.text.secondary,
    fontSize: 16,
  },
});
