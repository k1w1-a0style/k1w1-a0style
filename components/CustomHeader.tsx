// components/CustomHeader.tsx
// Minimal header: drawer menu + repo label + Preview shortcut + 3-dot overflow menu

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { DrawerHeaderProps } from "@react-navigation/drawer";

import { theme, HEADER_HEIGHT } from "../theme";
import { useGitHub } from "../contexts/GitHubContext";
import { useProject } from "../contexts/ProjectContext";
import ChatHeaderActions from "./ChatHeaderActions";
import CiLiteHeaderButton from "./CiLiteHeaderButton";

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  const title = options.title ?? "k1w1";
  const { activeRepo, activeBranch } = useGitHub();
  const { projectData } = useProject();
  const insets = useSafeAreaInsets();

  const repoLine = useMemo(() => {
    if (!activeRepo) return "Kein Repo ausgewählt";
    return `${activeRepo}${activeBranch ? `  (${activeBranch})` : ""}`;
  }, [activeRepo, activeBranch]);

  const handlePreviewPress = () => {
    const last = projectData?.lastPreview ?? null;
    const expiresAt = last?.expiresAt ? Date.parse(last.expiresAt) : null;
    const isExpired =
      typeof expiresAt === "number" && !Number.isNaN(expiresAt)
        ? expiresAt <= Date.now()
        : false;

    // If we have a valid last preview URL, jump directly to fullscreen.
    if (last?.url && !isExpired) {
      // Drawer header props are typed to drawer routes; fullscreen preview is on a parent stack.
      // Cast to any to avoid the 'never' navigation type trap.
      const parentNav = navigation.getParent() as any;
      parentNav?.navigate?.("PreviewFullscreen", {
        url: last.url,
        title: projectData?.name || "Preview",
      });
      return;
    }

    // Otherwise open the normal preview screen (it can generate a new preview).
    (navigation as any).navigate?.("Preview");
  };

  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top, height: HEADER_HEIGHT + insets.top },
      ]}
    >
      <View style={styles.left}>
        <Pressable
          onPress={() => navigation.openDrawer()}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && styles.iconBtnPressed,
          ]}
          accessibilityLabel="Menü"
          android_ripple={{
            color: `${theme.palette.primary}22`,
            borderless: true,
          }}
        >
          <Ionicons
            name="menu"
            size={24}
            color={theme.palette.text.primary}
          />
        </Pressable>
      </View>

      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subTitle} numberOfLines={1}>
          {repoLine}
        </Text>
      </View>

      <View style={styles.right}>
        <Pressable
          onPress={handlePreviewPress}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && styles.iconBtnPressed,
          ]}
          accessibilityLabel="Preview"
          android_ripple={{
            color: `${theme.palette.primary}22`,
            borderless: true,
          }}
        >
          <Ionicons
            name="eye-outline"
            size={22}
            color={theme.palette.text.primary}
          />
        </Pressable>

        <CiLiteHeaderButton />

        <ChatHeaderActions topOffset={HEADER_HEIGHT + insets.top} />
      </View>
    </View>
  );
};

export default CustomHeader;

const styles = StyleSheet.create({
  header: {
    height: HEADER_HEIGHT,
    backgroundColor: theme.palette.background,
    borderBottomWidth: 1,
    borderBottomColor: `${theme.palette.primary}22`,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  left: { width: 46, alignItems: "flex-start" },
  center: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  right: {
    width: 156,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  iconBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  iconBtnPressed: {
    backgroundColor: theme.palette.cardHover,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: "700",
  },
  subTitle: {
    marginTop: 2,
    color: theme.palette.text.secondary,
    fontSize: 11,
  },
});
