// components/CustomHeader.tsx
// ✅ FIX: Header-Icons sind echte Aktionen + Repo/Branch kommen aus GitHubContext (persistent)

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DrawerHeaderProps } from "@react-navigation/drawer";

import { theme, HEADER_HEIGHT } from "../theme";
import { useGitHub } from "../contexts/GitHubContext";
import { useProject } from "../contexts/ProjectContext";

const CustomHeader: React.FC<DrawerHeaderProps> = ({ navigation, options }) => {
  const title = options.title ?? "k1w1";

  const { activeRepo, activeBranch } = useGitHub();
  const { currentBuild, startBuild } = useProject();

  const repoLine = useMemo(() => {
    if (!activeRepo) return "Kein Repo ausgewählt";
    return `${activeRepo}${activeBranch ? `  (${activeBranch})` : ""}`;
  }, [activeRepo, activeBranch]);

  const isBuilding =
    currentBuild?.status === "queued" || currentBuild?.status === "building";

  const buildUrl =
    currentBuild?.urls?.buildUrl ||
    currentBuild?.urls?.html ||
    currentBuild?.urls?.artifacts ||
    null;

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

  const onPressBuild = async () => {
    if (isBuilding) return;

    if (currentBuild?.status === "success" && buildUrl) {
      try {
        await Linking.openURL(buildUrl);
      } catch {
        Alert.alert("Fehler", "Konnte Build-URL nicht öffnen.");
      }
      return;
    }

    if (!startBuild) {
      Alert.alert("Nicht verfügbar", "startBuild() ist nicht verfügbar.");
      return;
    }

    try {
      await startBuild("preview");
    } catch (e: any) {
      Alert.alert(
        "❌ Build fehlgeschlagen",
        e?.message || "Unbekannter Fehler",
      );
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <TouchableOpacity
          onPress={() => navigation.openDrawer()}
          style={styles.iconBtn}
          accessibilityLabel="Menü"
        >
          <Ionicons name="menu" size={24} color={theme.palette.text.primary} />
        </TouchableOpacity>
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
        <TouchableOpacity
          onPress={() => navigation.navigate("GitHubRepos" as never)}
          style={styles.iconBtn}
          accessibilityLabel="GitHub Repos"
        >
          <Ionicons
            name="logo-github"
            size={22}
            color={theme.palette.text.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("Connections" as never)}
          style={styles.iconBtn}
          accessibilityLabel="Connections"
        >
          <Ionicons
            name="link-outline"
            size={22}
            color={theme.palette.text.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPressBuild}
          style={styles.iconBtn}
          accessibilityLabel="Build"
        >
          {buildIcon()}
        </TouchableOpacity>
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
    paddingHorizontal: 10,
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
    borderRadius: 12,
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
