// components/CustomDrawer/index.tsx
// REFACTORED: styles → styles.ts, PulseDot → PulseDot.tsx

import React, { useMemo } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useGitHub } from "../../contexts/GitHubContext";
import { useProject } from "../../contexts/ProjectContext";
import { theme } from "../../theme";

import { PulseDot } from "./PulseDot";
import { styles, HAIRLINE } from "./styles";

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (
  props,
) => {
  const { navigation, state } = props;

  const { activeRepo, activeBranch } = useGitHub();
  const { projectData } = useProject();

  const repoChip = useMemo(() => {
    const r = (activeRepo ?? "").trim();
    if (!r) return "Kein Repo";
    const b = (activeBranch ?? "").trim();
    return b ? `${r} • ${b}` : r;
  }, [activeRepo, activeBranch]);

  const profileChip = useMemo(() => {
    const p =
      (projectData as any)?.preferredBuildProfile ??
      (projectData as any)?.buildProfile;
    return p ? `Profil: ${String(p)}` : "Profil: auto";
  }, [projectData]);

  const statusOk = useMemo(() => Boolean((activeRepo ?? "").trim()), [activeRepo]);
  const statusLabel = statusOk ? "Bereit" : "Repo wählen";

  const navigateTo = (screen: string) => {
    navigation.navigate(screen as never);
  };

  const currentRouteName = state.routeNames[state.index] ?? "Home";
  const isActive = (name: string) => currentRouteName === name;

  const renderSectionTitle = (title: string, icon: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.sectionRow}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={14} color={theme.palette.text.disabled} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );

  const renderItem = (
    label: string,
    screen: string,
    iconName: keyof typeof Ionicons.glyphMap,
    badge?: string,
  ) => {
    const active = isActive(screen);

    const accent = (() => {
      switch (screen) {
        case "Home":
          return theme.palette.info;
        case "Connections":
          return theme.palette.warning;
        case "Settings":
          return theme.palette.info;
        case "GitHubRepos":
          return theme.palette.primary;
        case "EnhancedBuild":
          return theme.palette.primary;
        case "Diagnostic":
          return theme.palette.error;
        case "CredentialsWizard":
          return theme.palette.warning;
        case "Preview":
          return theme.palette.info;
        case "AppInfo":
          return theme.palette.info;
        default:
          return theme.palette.text.secondary;
      }
    })();

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
        {active && (
          <LinearGradient
            colors={[`${theme.palette.primary}66`, `${theme.palette.primary}00`]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.activeRail}
          />
        )}

        <PulseDot
          size={8}
          color={theme.palette.primary}
          idleColor={`${theme.palette.text.disabled}66`}
          active={active}
          pulse={active}
        />

        <View
          style={[
            styles.iconContainer,
            active && styles.iconContainerActive,
            !active && { borderColor: `${accent}33` },
          ]}
        >
          <Ionicons
            name={iconName}
            size={19}
            color={active ? theme.palette.primary : accent}
          />
        </View>

        <Text style={[styles.drawerItemText, active && styles.drawerItemTextActive]}>
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

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[
          theme.palette.backgroundDark,
          theme.palette.card,
          theme.palette.background,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        {/* Decorative overlay */}
        <View pointerEvents="none" style={styles.headerOverlay} />
        <View pointerEvents="none" style={styles.headerGrid} />

        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons name="sparkles" size={18} color={theme.palette.primary} />
          </View>
          <View style={styles.logoText}>
            <Text style={styles.appTitle}>K1W1 AO-Style</Text>
            <Text style={styles.appSubTitle}>Prompt → Code → GitHub → APK</Text>
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusBar}>
          <PulseDot
            size={8}
            color={theme.palette.primary}
            idleColor={theme.palette.text.disabled}
            active={statusOk}
            pulse={statusOk}
          />
          <Text style={styles.statusText}>{statusLabel}</Text>
          <View style={styles.statusSpacer} />
          <Ionicons
            name={statusOk ? "checkmark-circle-outline" : "alert-circle-outline"}
            size={16}
            color={statusOk ? theme.palette.primary : theme.palette.text.disabled}
          />
        </View>

        {/* Chips */}
        <View style={styles.chipRow}>
          <LinearGradient
            colors={[theme.palette.userBubble.background, `${theme.palette.primary}00`]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.chip, statusOk && styles.chipGlow]}
          >
            <Ionicons
              name="git-branch-outline"
              size={12}
              color={theme.palette.primary}
            />
            <Text style={styles.chipText} numberOfLines={1}>
              {repoChip}
            </Text>
          </LinearGradient>

          <View style={styles.chip}>
            <Ionicons
              name="rocket-outline"
              size={12}
              color={theme.palette.text.secondary}
            />
            <Text style={styles.chipText} numberOfLines={1}>
              {profileChip}
            </Text>
          </View>
        </View>

        <LinearGradient
          colors={[`${theme.palette.primary}00`, `${theme.palette.primary}55`, `${theme.palette.primary}00`]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.neonDivider}
        />
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderSectionTitle("HAUPTMENÜ", "apps-outline")}
        {renderItem("Home", "Home", "home-outline")}
        {renderItem("Verbindungen", "Connections", "link-outline")}
        {renderItem("KI-Einstellungen", "Settings", "options-outline")}

        {renderSectionTitle("ENTWICKLUNG", "code-slash-outline")}
        {renderItem("GitHub Repos", "GitHubRepos", "logo-github")}
        {renderItem("Build", "EnhancedBuild", "construct-outline")}

        {renderSectionTitle("TOOLS", "flash-outline")}
        {renderItem("Diagnose", "Diagnostic", "bug-outline")}
        {renderItem("Signing Wizard", "CredentialsWizard", "key-outline")}
        {renderItem("Vorschau", "Preview", "eye-outline")}

        {renderSectionTitle("INFO", "information-circle-outline")}
        {renderItem("App Info", "AppInfo", "information-circle-outline")}
      </ScrollView>

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
