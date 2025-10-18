import 'react-native-reanimated';
import React from 'react';
import { StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';
import { TerminalProvider } from './contexts/TerminalContext'; // Korrekter Import

// Importiere jeden Screen EINZELN
import ChatScreen from './screens/ChatScreen';
import CodeScreen from './screens/CodeScreen';
import TerminalScreen from './screens/TerminalScreen';
import SettingsScreen from './screens/SettingsScreen';
import CustomHeader from './components/CustomHeader';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

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
}

export default function App() {
  return (
    <TerminalProvider> 
      <NavigationContainer>
        <StatusBar style="light" backgroundColor={theme.palette.card} />
        <Drawer.Navigator
          screenOptions={{
            header: (props) => <CustomHeader {...props} />,
            drawerStyle: {
              backgroundColor: theme.palette.background,
            },
            drawerActiveTintColor: theme.palette.primary,
            drawerInactiveTintColor: theme.palette.text.primary,
          }}
        >
          <Drawer.Screen
            name="Home"
            component={TabNavigator}
            options={{ title: 'k1w1-a0style' }}
          />
          <Drawer.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
        </Drawer.Navigator>
      </NavigationContainer>
    </TerminalProvider>
  );
}
