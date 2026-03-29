import React from "react";
import { LayoutAnimation, Text, TextInput, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { theme } from "../../../theme";
import { SectionCard } from "../../../components/diagnostics/SectionCard";

import { InlineHint, PrimaryButton, SecondaryButton } from "./ui";
import { styles } from "../styles";

export function AdminKeySection({
  adminKey,
  setAdminKey,
  adminKeyLoaded,
  canRun,
  busy,
  showAdvanced,
  setShowAdvanced,
  onSaveAdminKey,
  refreshAll,
}: {
  adminKey: string;
  setAdminKey: (v: string) => void;
  adminKeyLoaded: boolean;
  canRun: boolean;
  busy: string | null;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  onSaveAdminKey: () => void | Promise<void>;
  refreshAll: () => void | Promise<void>;
}) {
  return (
    <SectionCard
      title="Lokaler Android Keystore Export Admin Key"
      subtitle="Local only (SecureStore) — not committed to git"
      icon="key-outline"
      right={
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowAdvanced(!showAdvanced);
          }}
          style={styles.advancedBtn}
          activeOpacity={0.85}
        >
          <Ionicons
            name={showAdvanced ? "chevron-up" : "chevron-down"}
            size={16}
            color={theme.palette.text.primary}
          />
          <Text style={styles.advancedBtnText}>{showAdvanced ? "Hide" : "Advanced"}</Text>
        </TouchableOpacity>
      }
    >
      <TextInput
        value={adminKey}
        onChangeText={setAdminKey}
        placeholder={adminKeyLoaded ? "lokalen Android Keystore Export Admin Key einfügen…" : "lade…"}
        placeholderTextColor={theme.palette.text.muted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />

      <View style={styles.actionRow}>
        <PrimaryButton title="Save" onPress={onSaveAdminKey} disabled={!adminKey.trim()} />
        <SecondaryButton title="Refresh all" onPress={refreshAll} disabled={!canRun || Boolean(busy)} />
      </View>

      {showAdvanced ? (
        <View style={styles.advancedBox}>
          <InlineHint
            icon="information-circle-outline"
            text="Tipp: Wenn du nach Copy/Paste plötzlich 401 bekommst: Key nochmal speichern (trim)."
          />
          <InlineHint
            icon="shield-checkmark-outline"
            text="Der dedizierte Keystore-Admin-Key bleibt lokal. Wenn du das Gerät wechselst, musst du ihn neu setzen."
          />
        </View>
      ) : null}
    </SectionCard>
  );
}
