import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useGitHub } from "../contexts/GitHubContext";
import { useProject } from "../contexts/ProjectContext";
import { theme } from "../theme";

type PulseDotProps = {
  size?: number;
  color: string;
  idleColor: string;
  active: boolean;
  pulse?: boolean;
};

const PulseDot: React.FC<PulseDotProps> = ({
  size = 8,
  color,
  idleColor,
  active,
  pulse = true,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(active ? 1 : 0.6)).current;

  useEffect(() => {
    scale.stopAnimation();
    opacity.stopAnimation();

    if (!active) {
      scale.setValue(1);
      opacity.setValue(0.55);
      return;
    }

    opacity.setValue(1);

    if (!pulse) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.25,
            duration: 650,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.65,
            duration: 650,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 650,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 650,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [active, pulse, opacity, scale]);

  const baseColor = active ? color : idleColor;

  return (
    <Animated.View
      style={[
        styles.pulseDot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: baseColor,
          borderColor: active ? `${color}66` : theme.palette.border,
          transform: [{ scale }],
          opacity,
        },
        active ? (theme.glow.primarySubtle as any) : null,
      ]}
    />
  );
};

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

        <View style={[styles.iconContainer, active && styles.iconContainerActive]}>
          <Ionicons
            name={iconName}
            size={19}
            color={active ? theme.palette.primary : theme.palette.text.secondary}
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
            colors={["rgba(0,255,0,0.10)", "rgba(0,0,0,0.00)"]}
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

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <Pressable style={styles.quickAction} onPress={() => navigateTo("GitHubRepos")}>
            <View style={styles.quickIconWrap}>
              <Ionicons name="logo-github" size={18} color={theme.palette.primary} />
            </View>
            <Text style={styles.quickActionText}>Repos</Text>
          </Pressable>

          <Pressable style={styles.quickAction} onPress={() => navigateTo("EnhancedBuild")}>
            <View style={styles.quickIconWrap}>
              <Ionicons name="construct-outline" size={18} color={theme.palette.primary} />
            </View>
            <Text style={styles.quickActionText}>Build</Text>
          </Pressable>

          <Pressable style={styles.quickAction} onPress={() => navigateTo("Diagnostic")}>
            <View style={styles.quickIconWrap}>
              <Ionicons name="bug-outline" size={18} color={theme.palette.primary} />
            </View>
            <Text style={styles.quickActionText}>Diagnose</Text>
          </Pressable>
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
    borderBottomColor: `${theme.palette.primary}18`,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  headerGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,255,0,0.08)",
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
    backgroundColor: "rgba(0,255,0,0.10)",
    borderWidth: 1,
    borderColor: "rgba(0,255,0,0.28)",
    ...(theme.glow.primarySubtle as any),
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
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,255,0,0.08)",
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: "rgba(0,255,0,0.22)",
    alignSelf: "flex-start",
    gap: 8,
  },
  statusText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  statusSpacer: {
    width: 2,
  },

  chipRow: {
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "transparent",
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: `${theme.palette.primary}1a`,
    overflow: "hidden",
  },
  chipGlow: {
    borderColor: `${theme.palette.primary}33`,
    ...(theme.glow.primarySubtle as any),
  },
  chipText: {
    flex: 1,
    fontSize: 11,
    color: theme.palette.text.secondary,
  },

  quickRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  quickAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: `${theme.palette.primary}22`,
    backgroundColor: "transparent",
  },
  quickIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: `${theme.palette.primary}22`,
    backgroundColor: "rgba(0,255,0,0.06)",
    ...(theme.glow.primarySubtle as any),
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.palette.text.secondary,
    letterSpacing: 0.2,
  },

  neonDivider: {
    height: 1,
    marginTop: theme.spacing.md,
    opacity: 0.95,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    gap: 8,
  },
  sectionIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: `${theme.palette.primary}12`,
    backgroundColor: "rgba(0,255,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.palette.text.disabled,
    letterSpacing: 1.1,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    marginLeft: 8,
    backgroundColor: `${theme.palette.primary}10`,
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
    borderWidth: 1,
    borderColor: "transparent",
    position: "relative",
    overflow: "hidden",
  },
  drawerItemActive: {
    backgroundColor: "rgba(0,255,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,255,0,0.28)",
    ...(theme.glow.primarySubtle as any),
  },
  drawerItemPressed: {
    backgroundColor: `${theme.palette.primary}10`,
  },

  activeRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 10,
    opacity: 0.9,
  },

  pulseDot: {
    borderWidth: 1,
    marginRight: 8,
  },

  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.palette.background,
    borderWidth: 1,
    borderColor: "rgba(0,255,0,0.22)",
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
    fontWeight: "700",
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
    backgroundColor: "transparent",
  },
  footerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  footerText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },
  versionBadge: {
    backgroundColor: "rgba(0,255,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,255,0,0.22)",
    ...(theme.glow.primarySubtle as any),
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  versionText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.palette.text.secondary,
    fontFamily: "monospace",
  },
  footerSubtext: {
    fontSize: 10,
    color: theme.palette.text.disabled,
    marginTop: 4,
  },
});
