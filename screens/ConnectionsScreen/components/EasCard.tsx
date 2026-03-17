import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import type { ConnectionsStyles } from "./types";
import { InputRow } from "./InputRow";

export function EasCard(props: {
  styles: ConnectionsStyles;
  busy?: boolean;
  easProjectId: string;
  onChangeEasProjectId: (v: string) => void;
  onTestEas?: () => void;
  onLinkExisting?: () => void;
  onCreateAndLink?: () => void;
}) {
  const {
    styles,
    busy = false,
    easProjectId,
    onChangeEasProjectId,
    onTestEas,
    onLinkExisting,
    onCreateAndLink,
  } = props;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons
          name="rocket-outline"
          size={18}
          color={theme.palette.primary}
        />
        <Text style={styles.cardTitle}>EAS</Text>
      </View>

      <InputRow
        styles={styles}
        label="EAS Project ID (optional)"
        value={easProjectId}
        onChangeText={onChangeEasProjectId}
        placeholder="5e5a7791-8751-416b-9a1f-831adfffcb6c"
        rightHint="Wird beim EAS-Link im GitHub-Repos-Screen genutzt"
      />



      <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Pressable
          onPress={onTestEas}
          disabled={busy || !onTestEas}
          style={({ pressed }) => [
            styles.summaryBtn,
            pressed && styles.summaryBtnPressed,
            (busy || !onTestEas) && { opacity: 0.5 },
          ]}
        >
          <Ionicons name="flask-outline" size={16} color={theme.palette.primary} />
          <Text style={{ color: theme.palette.primary, fontWeight: "800", fontSize: 12 }}>
            EAS prüfen
          </Text>
        </Pressable>

        <Pressable
          onPress={onLinkExisting}
          disabled={busy || !onLinkExisting}
          style={({ pressed }) => [
            styles.summaryBtn,
            pressed && styles.summaryBtnPressed,
            (busy || !onLinkExisting) && { opacity: 0.5 },
          ]}
        >
          <Ionicons name="link-outline" size={16} color={theme.palette.primary} />
          <Text style={{ color: theme.palette.primary, fontWeight: "800", fontSize: 12 }}>
            Vorhandene ID verlinken
          </Text>
        </Pressable>

        <Pressable
          onPress={onCreateAndLink}
          disabled={busy || !onCreateAndLink}
          style={({ pressed }) => [
            styles.summaryBtn,
            pressed && styles.summaryBtnPressed,
            (busy || !onCreateAndLink) && { opacity: 0.5 },
          ]}
        >
          <Ionicons name="add-circle-outline" size={16} color={theme.palette.primary} />
          <Text style={{ color: theme.palette.primary, fontWeight: "800", fontSize: 12 }}>
            Neue ID erstellen + verlinken
          </Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Verbindungen verwaltet Token + EAS Project ID.\n        EAS-Link/Init (Workflow im Ziel-Repo schreiben/prüfen) läuft im GitHub-Repos-Screen.
      </Text>
    </View>
  );
}
