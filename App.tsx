import "react-native-gesture-handler";
import "./polyfills";
import "react-native-get-random-values";
import "react-native-reanimated";

import React, { useEffect, useMemo, useState } from "react";
import {
  LogBox,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  StatusBar as RNStatusBar,
} from "react-native";

import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "./theme";

import { TerminalProvider } from "./contexts/TerminalContext";
import { AIProvider } from "./contexts/AIContext";
import { ProjectProvider, useProject } from "./contexts/ProjectContext";
import { GitHubProvider } from "./contexts/GitHubContext";

import ChatScreen from "./screens/ChatScreen";
import CodeScreen from "./screens/CodeScreen";
import TerminalScreen from "./screens/TerminalScreen";
import SettingsScreen from "./screens/SettingsScreen";
import ConnectionsScreen from "./screens/ConnectionsScreen";
import AppInfoScreen from "./screens/AppInfoScreen";
import GitHubReposScreen from "./screens/GitHubReposScreen";
import DiagnosticScreen from "./screens/DiagnosticScreen";
import AppStatusScreen from "./screens/AppStatusScreen";
import PreviewScreen from "./screens/PreviewScreen";
import EnhancedBuildScreen from "./screens/EnhancedBuildScreen";
import CredentialsWizardScreen from "./screens/CredentialsWizardScreen";

import PreviewFullscreenScreen from "./screens/PreviewFullscreenScreen";

import CustomHeader from "./components/CustomHeader";
import { CustomDrawerContent } from "./components/CustomDrawer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { logger } from "./lib/logger";
import { getSupabaseEdgeUrl } from "./lib/supabaseEdge";

LogBox.ignoreLogs([
  // Patch 616: Keep this as a temporary, narrowly scoped dev-noise suppressor
  // for a known Reanimated listener warning that is not actionable in app code.
  // Removal condition: drop this rule as soon as upstream/library updates stop
  // emitting this warning in local dev without functional impact.
  "Sending `onAnimatedValueUpdate` with no listeners registered.",
]);

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();
const APP_BOOT_LOADING_TIMEOUT_MS = 20_000;

const TabNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "help-circle";

          if (route.name === "Chat") {
            iconName = focused
              ? "chatbubble-ellipses"
              : "chatbubble-ellipses-outline";
          } else if (route.name === "Code") {
            iconName = focused ? "code-slash" : "code-slash-outline";
          } else if (route.name === "Terminal") {
            iconName = focused ? "terminal" : "terminal-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.palette.primary,
        tabBarInactiveTintColor: theme.palette.text.secondary,
        tabBarStyle: {
          backgroundColor: theme.palette.card,
          borderTopColor: theme.palette.border,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Code" component={CodeScreen} />
      <Tab.Screen name="Terminal" component={TerminalScreen} />
    </Tab.Navigator>
  );
};

const DrawerRoot = () => {
  return (
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
        options={{ title: "k1w1-a0style", drawerLabel: "Home" }}
      />

      <Drawer.Screen
        name="Preview"
        component={PreviewScreen}
        options={{ title: "Preview", drawerLabel: "👁️ Preview" }}
      />

      <Drawer.Screen
        name="EnhancedBuild"
        component={EnhancedBuildScreen}
        options={{ title: "Build", drawerLabel: "🏗️ Build" }}
      />

      <Drawer.Screen
        name="AppStatus"
        component={AppStatusScreen}
        options={{ title: "Status", drawerLabel: "📊 Status" }}
      />

      <Drawer.Screen
        name="GitHubRepos"
        component={GitHubReposScreen}
        options={{ title: "GitHub Repos", drawerLabel: "🐙 GitHub Repos" }}
      />

      <Drawer.Screen
        name="Connections"
        component={ConnectionsScreen}
        options={{ title: "Verbindungen", drawerLabel: "🔌 Verbindungen" }}
      />

      <Drawer.Screen
        name="CredentialsWizard"
        component={CredentialsWizardScreen}
        options={{
          title: "🔑 Credentials Wizard",
          drawerLabel: "🔑 Credentials Wizard",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="key-outline" color={color} size={size} />
          ),
        }}
      />

      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Einstellungen", drawerLabel: "⚙️ Einstellungen" }}
      />

      <Drawer.Screen
        name="Diagnostic"
        component={DiagnosticScreen}
        options={{ title: "Diagnose", drawerLabel: "🧪 Diagnose" }}
      />

      <Drawer.Screen
        name="AppInfo"
        component={AppInfoScreen}
        options={{ title: "App Info", drawerLabel: "ℹ️ App Info" }}
      />
    </Drawer.Navigator>
  );
};

const AppNavigation = () => {
  const { isLoading } = useProject();
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setLoadingTimedOut(false);
      return;
    }
    const timeoutId = setTimeout(() => {
      setLoadingTimedOut(true);
      logger.warn("[AppNavigation] Projekt-Initialisierung laeuft laenger als erwartet.", {
        timeoutMs: APP_BOOT_LOADING_TIMEOUT_MS,
      });
    }, APP_BOOT_LOADING_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [isLoading]);

  useEffect(() => {
    const validateEdgeConfig = async () => {
      try {
        const edgeUrl = (await getSupabaseEdgeUrl()).trim();
        if (edgeUrl) return;
        logger.info("[AppNavigation] Supabase Edge URL missing at startup; non-blocking hint is shown in Connections.");
      } catch (error) {
        logger.warn("[AppNavigation] Supabase Edge URL validation failed (non-blocking)", { error });
      }
    };
    void validateEdgeConfig();
  }, []);

  const loadingMessage = useMemo(
    () =>
      loadingTimedOut
        ? "Laden dauert ungewoehnlich lang. Bitte Verbindungen pruefen oder App neu starten."
        : "Projekt wird geladen…",
    [loadingTimedOut],
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.palette.primary} />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={theme.palette.card} />

      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Root" component={DrawerRoot} />

        {/* Vollbild-Preview als Modal (kein Browser-Wechsel) */}
        <Stack.Screen
          name="PreviewFullscreen"
          component={PreviewFullscreenScreen}
          options={{ presentation: "modal" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <TerminalProvider>
            <AIProvider>
              <ProjectProvider>
                <GitHubProvider>
                  <AppNavigation />
                </GitHubProvider>
              </ProjectProvider>
            </AIProvider>
          </TerminalProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.palette.background,
    paddingTop: RNStatusBar.currentHeight || 0,
  },
  loadingText: {
    marginTop: 15,
    color: theme.palette.text.secondary,
    fontSize: 16,
    fontWeight: "700",
  },
});
