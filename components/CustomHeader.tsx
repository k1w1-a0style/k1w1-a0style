// components/CustomHeader.tsx
// ✅ FIX: Header-Icons sind echte Aktionen + Repo/Branch kommen aus GitHubContext (persistent)

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DrawerHeaderProps } from "@react-navigation/drawer";

import { theme, HEADER_HEIGHT } from "../theme";
import { useGitHub } from "../contexts/GitHubContext";
import { useProject } from "../contexts/ProjectContext";

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  const title = options.title ?? "k1w1";

  const { activeRepo, activeBranch } = useGitHub();
  const { currentBuild } = useProject();

  const repoLine = useMemo(() => {
    if (!activeRepo) return "Kein Repo ausgewählt";
    return `${activeRepo}${activeBranch ? `  (${activeBranch})` : ""}`;
  }, [activeRepo, activeBranch]);

  const isBuilding =
    currentBuild?.status === "queued" || currentBuild?.status === "building";

  const buildIcon = () => {
    if (isBuilding)
      return <ActivityIndicator size="small" color={theme.palette.warning} />;

    if (currentBuild?.status === "success") {
      return (
        <Ionicons
          name="checkmark-circle"
          size={22}
          color={theme.palette.success}
        />
      );
    }
    if (currentBuild?.status === "failed" || currentBuild?.status === "error") {
      return (
        <Ionicons name="close-circle" size={22} color={theme.palette.error} />
      );
    }
    return (
      <Ionicons name="rocket-outline" size={22} color={theme.palette.primary} />
    );
  };

  const onPressBuild = () => {
    navigation.navigate("EnhancedBuild" as never);
  };

  return (
    <View style={styles.header}>
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
          <Ionicons name="menu" size={24} color={theme.palette.text.primary} />
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
          onPress={() => navigation.navigate("GitHubRepos" as never)}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && styles.iconBtnPressed,
          ]}
          accessibilityLabel="GitHub Repos"
          android_ripple={{
            color: `${theme.palette.primary}22`,
            borderless: true,
          }}
        >
          <Ionicons
            name="logo-github"
            size={22}
            color={theme.palette.text.primary}
          />
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("Connections" as never)}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && styles.iconBtnPressed,
          ]}
          accessibilityLabel="Connections"
          android_ripple={{
            color: `${theme.palette.primary}22`,
            borderless: true,
          }}
        >
          <Ionicons
            name="link-outline"
            size={22}
            color={theme.palette.text.primary}
          />
        </Pressable>

        <Pressable
          onPress={onPressBuild}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && styles.iconBtnPressed,
          ]}
          accessibilityLabel="Build"
          android_ripple={{
            color: `${theme.palette.primary}22`,
            borderless: true,
          }}
        >
          {buildIcon()}
        </Pressable>
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
    borderBottomColor: theme.palette.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  left: { width: 46, alignItems: "flex-start" },
  center: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  right: {
    width: 140,
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
