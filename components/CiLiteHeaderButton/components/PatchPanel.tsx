// components/CiLiteHeaderButton/components/PatchPanel.tsx
// Collapsible patch JSON input panel with validate / apply / paste.

import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { theme } from "../../../theme";
import { safeUi } from "../../ciLite/ciLiteUtils";
import { styles } from "../styles";

interface PatchPanelProps {
  patchText: string;
  onChangePatchText: (t: string) => void;
  patchBusy: boolean;
  patchInfo: string | null;
  onPaste: () => void;
  onValidate: () => void;
  onApply: () => void;
  onClose: () => void;
}

export function PatchPanel({
  patchText, onChangePatchText, patchBusy, patchInfo,
  onPaste, onValidate, onApply, onClose,
}: PatchPanelProps) {
  return (
    <View style={styles.patchPanelCompact}>
      <View style={styles.patchTopRow}>
        <Text style={styles.patchTitleCompact}>Apply Patch (JSON)</Text>
        <Pressable
          onPress={onPaste}
          style={({ pressed }) => [styles.tinyBtn, pressed && styles.tinyBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Paste"
        >
          <Text style={styles.tinyBtnText}>Paste</Text>
        </Pressable>
      </View>

      <TextInput
        value={patchText}
        onChangeText={onChangePatchText}
        placeholder='{"upsert":[{"path":"...","content":"..."}]}'
        placeholderTextColor={theme.palette.text.secondary}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.patchInputCompact}
      />

      <View style={styles.patchBtnRow}>
        <Pressable onPress={onValidate} style={({ pressed }) => [styles.tinyBtn, pressed && styles.tinyBtnPressed]}>
          <Text style={styles.tinyBtnText}>Validate</Text>
        </Pressable>
        <Pressable
          onPress={onApply}
          disabled={patchBusy}
          style={({ pressed }) => [
            styles.tinyBtn, styles.tinyBtnPrimary,
            pressed && !patchBusy && styles.tinyBtnPressed,
            patchBusy && styles.tinyBtnDisabled,
          ]}
        >
          <Text style={styles.tinyBtnText}>{patchBusy ? "Applying…" : "Apply"}</Text>
        </Pressable>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.tinyBtn, pressed && styles.tinyBtnPressed]}>
          <Text style={styles.tinyBtnText}>Close</Text>
        </Pressable>
      </View>

      {patchInfo ? (
        <Text style={styles.patchInfoCompact} numberOfLines={8}>
          {safeUi(patchInfo)}
        </Text>
      ) : null}
    </View>
  );
}
