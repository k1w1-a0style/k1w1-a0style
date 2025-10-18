import 'react-native-reanimated';
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { NavigationContainer, DrawerActions, DefaultTheme } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Importiere den NEUEN SettingsScreen
import SettingsScreen from './screens/SettingsScreen';

const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: 'white',
    background: '#0a0f21',
    card: '#0b122f',
    text: 'white',
    border: '#1a2b4e',
  },
};

const CustomHeader = () => {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={{ backgroundColor: '#0b122f' }}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
          <Ionicons name="menu" size={30} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>k1w1-a0style</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => console.log("Build Pressed")}>
            <Ionicons name="hammer-outline" size={26} color="white" style={styles.headerIcon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => console.log("Expo Go Pressed")}>
            <Ionicons name="qr-code-outline" size={26} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const ChatScreen = () => (<View style={styles.screen}><Text style={styles.screenText}>Chat Screen</Text></View>);
const CodeScreen = () => (<View style={styles.screen}><Text style={styles.screenText}>Code Screen</Text></View>);
const TerminalScreen = () => (<View style={styles.screen}><Text style={styles.screenText}>Terminal Screen</Text></View>);

const TabNavigator = () => {
  return (
    <View style={{ flex: 1 }}>
      <CustomHeader />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: '#0b122f', borderTopWidth: 0 },
          tabBarInactiveTintColor: 'gray',
          tabBarActiveTintColor: 'white',
        }}>
        <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="chatbubble-outline" size={size} color={color} />) }} />
        <Tab.Screen name="Code" component={CodeScreen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="code-outline" size={size} color={color} />) }} />
        <Tab.Screen name="Terminal" component={TerminalScreen} options={{ tabBarIcon: ({ color, size }) => (<Ionicons name="terminal-outline" size={size} color={color} />) }} />
      </Tab.Navigator>
    </View>
  );
};

const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <NavigationContainer theme={DarkTheme}>
          <LinearGradient colors={['#0a0f21', '#0b122f']} style={{ flex: 1 }}>
            <Drawer.Navigator
              screenOptions={{
                headerShown: false,
                drawerStyle: { backgroundColor: '#0b122f' },
                drawerInactiveTintColor: 'gray',
                drawerActiveTintColor: 'white',
              }}>
              <Drawer.Screen name="Home" component={TabNavigator} />
              <Drawer.Screen name="Settings" component={SettingsScreen} />
            </Drawer.Navigator>
          </LinearGradient>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0f21' },
  screenText: { fontSize: 20, color: 'white' },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: 'white' },
  headerIcons: { flexDirection: 'row' },
  headerIcon: { marginRight: 15 },
});

export default App;
