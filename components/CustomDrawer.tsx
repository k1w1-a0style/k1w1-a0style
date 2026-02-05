import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (
  props,
) => {
  const { navigation, state } = props;

  const navigateTo = (screen: string) => {
    navigation.navigate(screen as never);
  };

  const currentRouteName = state.routeNames[state.index] ?? "Home";

  const isActive = (name: string) => currentRouteName === name;

  const renderItem = (
    label: string,
    screen: string,
    iconName: keyof typeof Ionicons.glyphMap,
    badge?: string,
  ) => {
    const active = isActive(screen);
    return (
      <Pressable
        key={screen}
        style={({ pressed }) => [
          styles.drawerItem,
          active && styles.drawerItemActive,
          pressed && styles.drawerItemPressed,
        ]}
        onPress={() => navigateTo(screen)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        android_ripple={{
          color: `${theme.palette.primary}22`,
          borderless: false,
        }}
      >
        {active && <View style={styles.activeIndicator} />}

        <View
          style={[styles.iconContainer, active && styles.iconContainerActive]}
        >
          <Ionicons
            name={iconName}
            size={19}
            color={
              active ? theme.palette.primary : theme.palette.text.secondary
            }
          />
        </View>

        <Text
          style={[styles.drawerItemText, active && styles.drawerItemTextActive]}
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
      </Pressable>
    );
  };

  const renderSectionTitle = (title: string) => (
    <Text style={styles.sectionTitle}>{title}</Text>
  );

  const renderSectionTitleFirst = (title: string) => (
    <Text style={[styles.sectionTitle, styles.sectionTitleFirst]}>{title}</Text>
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="sparkles" size={18} color={theme.palette.primary} />
          </View>
          <View style={styles.logoText}>
            <Text style={styles.appTitle}>K1W1 AO-Style</Text>
            <Text style={styles.appSubTitle}>Prompt → Code → GitHub → APK</Text>
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
        {renderSectionTitleFirst("HAUPTMENÜ")}
        {renderItem("Home", "Home", "home-outline")}
        {renderItem("Verbindungen", "Connections", "link-outline")}
        {renderItem("KI-Einstellungen", "Settings", "options-outline")}

        {renderSectionTitle("ENTWICKLUNG")}
        {renderItem("GitHub Repos", "GitHubRepos", "logo-github")}
        {renderItem("Build", "EnhancedBuild", "construct-outline")}

        {renderSectionTitle("TOOLS")}
        {renderItem("Diagnose", "Diagnostic", "bug-outline")}
        {renderItem("Signing Wizard", "CredentialsWizard", "key-outline")}
        {renderItem("Vorschau", "Preview", "eye-outline")}

        {renderSectionTitle("INFO")}
        {renderItem("App Info", "AppInfo", "information-circle-outline")}
      </ScrollView>

      {/* Footer mit Versionsnummer */}
      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Text style={styles.footerText}>k1w1-a0style</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>v1.0.0-alpha</Text>
          </View>
        </View>
        <Text style={styles.footerSubtext}>Made with 💚 for Expo SDK 54</Text>
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
    paddingTop: 48,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.palette.cardHover,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.sm,
  },
  logoText: {
    flex: 1,
  },
  appTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },
  appSubTitle: {
    marginTop: 2,
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.palette.cardHover,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignSelf: "flex-start",
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
    color: theme.palette.text.secondary,
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.palette.text.disabled,
    letterSpacing: 1.1,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.md,
  },
  sectionTitleFirst: {
    marginTop: theme.spacing.sm,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    marginHorizontal: theme.spacing.sm,
    marginVertical: 2,
    borderRadius: theme.borderRadius.lg,
    position: "relative",
  },
  drawerItemActive: {
    backgroundColor: theme.palette.cardHover,
  },
  drawerItemPressed: {
    backgroundColor: `${theme.palette.primary}10`,
  },
  activeIndicator: {
    position: "absolute",
    left: 8,
    top: 12,
    bottom: 12,
    width: 2,
    backgroundColor: theme.palette.primary,
    borderRadius: 2,
    opacity: 0.9,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.sm,
  },
  iconContainerActive: {
    backgroundColor: `${theme.palette.primary}12`,
    borderColor: `${theme.palette.primary}35`,
  },
  drawerItemText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    flex: 1,
  },
  drawerItemTextActive: {
    fontWeight: "600",
    color: theme.palette.text.primary,
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
    fontWeight: "bold",
    color: "#fff",
  },
  activeChevron: {
    marginLeft: 4,
    opacity: 0.9,
  },
  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  footerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  footerText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.palette.text.primary,
  },
  versionBadge: {
    backgroundColor: theme.palette.cardHover,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  versionText: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.palette.text.secondary,
    fontFamily: "monospace",
  },
  footerSubtext: {
    fontSize: 10,
    color: theme.palette.text.disabled,
    marginTop: 4,
  },
});
