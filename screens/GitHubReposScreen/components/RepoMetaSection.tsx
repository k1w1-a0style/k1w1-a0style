import React, { useCallback } from "react";
import { View, Text, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

export function RepoMetaSection(props: {
  userLogin: string;
  activeRepo: string | null;
  onOpenRepoOnGitHub: () => void;
}) {
  const { userLogin, activeRepo, onOpenRepoOnGitHub } = props;

  const onOpenUser = useCallback(() => {
    if (!userLogin) return;
    Linking.openURL(`https://github.com/${userLogin}`).catch((error) => {
      console.warn("[RepoMetaSection] failed to open GitHub user URL", { userLogin, error });
    });
  }, [userLogin]);

  return (
    <View style={[styles.section, styles.sectionNeon]}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Repo Info</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onOpenUser}
            disabled={!userLogin}
          >
            <Ionicons
              name="person-circle"
              size={18}
              color={userLogin ? theme.palette.primary : theme.palette.text.muted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onOpenRepoOnGitHub}
            disabled={!activeRepo}
          >
            <Ionicons
              name="open-outline"
              size={18}
              color={activeRepo ? theme.palette.primary : theme.palette.text.muted}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 18 }}>
        User: {userLogin || "(unbekannt)"}
      </Text>
      <Text style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 18 }}>
        Repo: {activeRepo || "(nicht gewählt)"}
      </Text>

      {!activeRepo ? (
        <Text style={{ fontSize: 11, color: theme.palette.text.muted, marginTop: 8, lineHeight: 16 }}>
          Wähle oben ein Repo aus (Dropdown). Danach sind Branch / Secrets / Diff verfügbar.
        </Text>
      ) : null}
    </View>
  );
}
