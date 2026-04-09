import React from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import { styles } from "../styles";
import type { EasLinkPresentation } from "../utils/easLinkContract";

type EasLinkSectionProps = {
  easLinkStatus: EasLinkPresentation;
  easProjectId: string;
  setEasProjectId: (value: string) => void;
  isEasLinking: boolean;
  handleEasLinkStatusCheck: () => Promise<unknown>;
  handleEasLink: () => Promise<unknown>;
  handleOpenRepoOnGitHub: () => void;
  activeRepo: string | null;
};

export function EasLinkSection({
  easLinkStatus,
  easProjectId,
  setEasProjectId,
  isEasLinking,
  handleEasLinkStatusCheck,
  handleEasLink,
  handleOpenRepoOnGitHub,
  activeRepo,
}: EasLinkSectionProps) {
  return (
    <View style={[styles.section, styles.sectionNeon]} testID="eas-link-section">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={styles.sectionTitle}>EAS Link</Text>
        <View style={styles.chipRow}>
          <View
            style={[
              styles.chip,
              easLinkStatus.state === "verified" ? styles.chipActive : null,
              easLinkStatus.tone === "error" ? { borderColor: theme.palette.error } : null,
              easLinkStatus.tone === "warn" ? { borderColor: theme.palette.warning ?? theme.palette.primary } : null,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                easLinkStatus.state === "verified" ? styles.chipTextActive : null,
                easLinkStatus.tone === "error" ? { color: theme.palette.error } : null,
                easLinkStatus.tone === "warn" ? { color: theme.palette.warning ?? theme.palette.primary } : null,
              ]}
            >
              {easLinkStatus.label}
            </Text>
          </View>

          <Pressable
            testID="eas-link-refresh"
            onPress={() => void handleEasLinkStatusCheck()}
            style={({ pressed }: { pressed: boolean }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="EAS Status prüfen"
          >
            <Ionicons name="refresh" size={18} color={theme.palette.primary} />
          </Pressable>
        </View>
      </View>

      <Text style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 18, marginTop: -2, marginBottom: 8 }}>
        Dieser Repo-Schritt prueft Workflow und Projektdatei getrennt. Nur ein voll passender Workflow plus passende
        <Text style={{ fontFamily: "monospace", color: theme.palette.text.primary }}> eas-project.json</Text> gilt hier als verifiziert.
        Tokens/Grundverbindungen pflegst du weiterhin im Verbindungen-Screen.
      </Text>

      <Text
        testID="eas-link-detail"
        style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 18, marginBottom: 10 }}
      >
        {easLinkStatus.detail}
      </Text>

      <TextInput
        testID="eas-project-id"
        value={easProjectId}
        onChangeText={setEasProjectId}
        placeholder="EAS Project ID (optional)"
        placeholderTextColor={theme.palette.text.secondary}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.searchInput}
      />

      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <Pressable
          testID="eas-link-run"
          onPress={() => void handleEasLink()}
          disabled={isEasLinking}
          style={({ pressed }: { pressed: boolean }) => [styles.button, pressed && { opacity: 0.85 }, isEasLinking && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{isEasLinking ? "EAS Link läuft…" : "EAS Projekt erstellen/verbinden"}</Text>
        </Pressable>

        <Pressable
          testID="eas-link-open"
          onPress={() => activeRepo && handleOpenRepoOnGitHub()}
          style={({ pressed }: { pressed: boolean }) => [styles.button, styles.buttonSecondary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.buttonTextSecondary}>Repo öffnen</Text>
        </Pressable>
      </View>
    </View>
  );
}
