import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import type { ConnectionsStyles } from "./types";
import { ActionButton } from "./ActionButton";
import { InputRow } from "./InputRow";

export function TokensCard(props: {
  styles: ConnectionsStyles;
  busy: boolean;
  githubToken: string;
  onChangeGitHubToken: (v: string) => void;
  expoToken: string;
  onChangeExpoToken: (v: string) => void;
  edgeAdminKey: string;
  onChangeEdgeAdminKey: (v: string) => void;
  showGitHub: boolean;
  onToggleShowGitHub: () => void;
  showExpo: boolean;
  onToggleShowExpo: () => void;
  showEdge: boolean;
  onToggleShowEdge: () => void;
  onSave: () => void;
  onTestGitHub: () => void;
  onTestExpo: () => void;
}) {
  const {
    styles,
    busy,
    githubToken,
    onChangeGitHubToken,
    expoToken,
    onChangeExpoToken,
    edgeAdminKey,
    onChangeEdgeAdminKey,
    showGitHub,
    onToggleShowGitHub,
    showExpo,
    onToggleShowExpo,
    showEdge,
    onToggleShowEdge,
    onSave,
    onTestGitHub,
    onTestExpo,
  } = props;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="key-outline" size={18} color={theme.palette.primary} />
        <Text style={styles.cardTitle}>Tokens</Text>
      </View>

      <InputRow
        styles={styles}
        label="GitHub Token (PAT)"
        value={githubToken}
        onChangeText={onChangeGitHubToken}
        placeholder="ghp_..."
        secure
        showToggle
        isShown={showGitHub}
        onToggleShow={onToggleShowGitHub}
        rightHint="Scopes: repo + workflow"
      />

      <InputRow
        styles={styles}
        label="Expo / EAS Token (EXPO_TOKEN)"
        value={expoToken}
        onChangeText={onChangeExpoToken}
        placeholder="expo_..."
        secure
        showToggle
        isShown={showExpo}
        onToggleShow={onToggleShowExpo}
      />

      <InputRow
        styles={styles}
        label="Edge Admin Key (optional, x-k1w1-admin-key)"
        value={edgeAdminKey}
        onChangeText={onChangeEdgeAdminKey}
        placeholder="selbst-gewähltes-secret"
        secure
        showToggle
        isShown={showEdge}
        onToggleShow={onToggleShowEdge}
      />

      <View style={styles.row}>
        <ActionButton
          styles={styles}
          busy={busy}
          label="Speichern"
          icon="save-outline"
          onPress={onSave}
        />
      </View>

      <View style={styles.row}>
        <ActionButton
          styles={styles}
          busy={busy}
          label="GitHub testen"
          icon="logo-github"
          variant="ghost"
          onPress={onTestGitHub}
        />
        <ActionButton
          styles={styles}
          busy={busy}
          label="Expo testen"
          icon="checkmark-circle-outline"
          variant="ghost"
          onPress={onTestExpo}
        />
      </View>
    </View>
  );
}
