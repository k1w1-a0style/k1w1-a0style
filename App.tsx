import { LogBox } from 'react-native'; 
LogBox.ignoreAllLogs(); // Deaktiviert ALLE Logs und Fehler-Overlays!

import 'react-native-get-random-values'; 
import 'react-native-reanimated';
import React from 'react';
import { StyleSheet } from 'react-native'; 
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';
import { TerminalProvider } from './contexts/TerminalContext';
import { AIProvider } from './contexts/AIContext';
// Single-Project Provider
import { ProjectProvider } from './contexts/ProjectContext'; 

// Screens
import ChatScreen from './screens/ChatScreen';
import CodeScreen from './screens/CodeScreen';
import TerminalScreen from './screens/TerminalScreen';
import SettingsScreen from './screens/SettingsScreen';
import ConnectionsScreen from './screens/ConnectionsScreen';

// Komponenten
import CustomHeader from './components/CustomHeader';
import { CustomDrawerContent } from './components/CustomDrawer';
import { StatusBar } from 'expo-status-bar'; 

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// Voller TabNavigator
const TabNavigator = () => {
  return (
    <Tab.Navigator
       screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help-circle';
          if (route.name === 'Chat') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'Code') iconName = focused ? 'code-slash' : 'code-slash-outline';
          else if (route.name === 'Terminal') iconName = focused ? 'terminal' : 'terminal-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.palette.primary,
        tabBarInactiveTintColor: theme.palette.text.secondary,
        tabBarStyle: { backgroundColor: theme.palette.card, borderTopWidth: 0 },
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

// Volle App-Struktur
export default function App() {
  console.log("=== APP START - PLAN B (Alle Fixes + LogBox Ignore) ===");
  return (
    <TerminalProvider>
      <AIProvider>
        {/* ProjectProvider umschließt Navigation */}
        <ProjectProvider> 
          <NavigationContainer>
            <StatusBar style="light" backgroundColor={theme.palette.card} />
            <Drawer.Navigator
              // Voller Custom Drawer (Single-Project Version)
              drawerContent={(props) => <CustomDrawerContent {...props} />} 
              screenOptions={{
                // Voller Custom Header (Single-Project Version)
                header: (props) => <CustomHeader {...props} />, 
                drawerStyle: { backgroundColor: theme.palette.card }, 
                drawerActiveTintColor: theme.palette.primary,
                drawerInactiveTintColor: theme.palette.text.primary, 
              }}
            >
              <Drawer.Screen name="Home" component={TabNavigator} options={{ title: 'k1w1-a0style' }} />
              <Drawer.Screen name="Settings" component={SettingsScreen} options={{ title: 'KI-Einstellungen' }} />
              <Drawer.Screen name="Connections" component={ConnectionsScreen} options={{ title: 'Verbindungen' }} />
            </Drawer.Navigator>
          </NavigationContainer>
        </ProjectProvider>
      </AIProvider>
    </TerminalProvider>
  );
}

// Keine Styles hier nötig

