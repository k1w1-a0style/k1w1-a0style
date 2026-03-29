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
  workflowAdminKey: string;
  onChangeWorkflowAdminKey: (v: string) => void;
  androidKeystoreExportAdminKey: string;
  onChangeAndroidKeystoreExportAdminKey: (v: string) => void;
  legacyEdgeAdminKey: string;
  onChangeLegacyEdgeAdminKey: (v: string) => void;
  showGitHub: boolean;
  onToggleShowGitHub: () => void;
  showExpo: boolean;
  onToggleShowExpo: () => void;
  showWorkflowAdmin: boolean;
  onToggleShowWorkflowAdmin: () => void;
  showKeystoreAdmin: boolean;
  onToggleShowKeystoreAdmin: () => void;
  showLegacyEdge: boolean;
  onToggleShowLegacyEdge: () => void;
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
    workflowAdminKey,
    onChangeWorkflowAdminKey,
    androidKeystoreExportAdminKey,
    onChangeAndroidKeystoreExportAdminKey,
    legacyEdgeAdminKey,
    onChangeLegacyEdgeAdminKey,
    showGitHub,
    onToggleShowGitHub,
    showExpo,
    onToggleShowExpo,
    showWorkflowAdmin,
    onToggleShowWorkflowAdmin,
    showKeystoreAdmin,
    onToggleShowKeystoreAdmin,
    showLegacyEdge,
    onToggleShowLegacyEdge,
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
        label="Lokaler Workflow Admin Key (optional, x-k1w1-admin-key)"
        value={workflowAdminKey}
        onChangeText={onChangeWorkflowAdminKey}
        placeholder="lokaler-workflow-admin-key"
        secure
        showToggle
        isShown={showWorkflowAdmin}
        onToggleShow={onToggleShowWorkflowAdmin}
        rightHint="Fuer workflow/build/artifact Routen. Sollte zum Repo-Secret K1W1_EDGE_WORKFLOW_ADMIN_KEY passen."
      />

      <InputRow
        styles={styles}
        label="Lokaler Android Keystore Export Admin Key (optional, x-k1w1-admin-key)"
        value={androidKeystoreExportAdminKey}
        onChangeText={onChangeAndroidKeystoreExportAdminKey}
        placeholder="lokaler-keystore-export-admin-key"
        secure
        showToggle
        isShown={showKeystoreAdmin}
        onToggleShow={onToggleShowKeystoreAdmin}
        rightHint="Nur fuer keystore/status/export Routen. Entspricht K1W1_EDGE_ANDROID_KEYSTORE_EXPORT_ADMIN_KEY."
      />

      <InputRow
        styles={styles}
        label="Lokaler Legacy Edge Admin Key (optional, compat)"
        value={legacyEdgeAdminKey}
        onChangeText={onChangeLegacyEdgeAdminKey}
        placeholder="lokaler-legacy-edge-admin-key"
        secure
        showToggle
        isShown={showLegacyEdge}
        onToggleShow={onToggleShowLegacyEdge}
        rightHint="Nur fuer Legacy-Kompatibilitaet (K1W1_EDGE_ADMIN_KEY). Nicht mehr primaerer Scoped-Key."
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
