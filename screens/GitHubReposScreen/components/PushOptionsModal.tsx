import React, { memo, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

type Props = {
  visible: boolean;
  commitMessage: string;
  setCommitMessage: (v: string) => void;
  selected: Record<string, boolean>;
  togglePath: (path: string) => void;
  setAll: (on: boolean) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  busy?: boolean;
};

export const PushOptionsModal = memo(function PushOptionsModal(props: Props) {
  const {
    visible,
    commitMessage,
    setCommitMessage,
    selected,
    togglePath,
    setAll,
    onCancel,
    onConfirm,
    busy,
  } = props;

  const paths = useMemo(() => Object.keys(selected || {}).sort((a, b) => a.localeCompare(b)), [selected]);
  const selectedCount = useMemo(() => paths.filter((p) => !!selected[p]).length, [paths, selected]);

  const canConfirm = useMemo(() => selectedCount > 0 && !!commitMessage.trim() && !busy, [selectedCount, commitMessage, busy]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.55)" }}
      >
        <View
          style={{
            backgroundColor: theme.palette.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.palette.border,
            padding: 14,
            maxHeight: "80%",
          }}
        >
          <View style={styles.rowBetween}>
            <Text style={{ fontSize: 14, fontWeight: "900", color: theme.palette.text.primary }}>
              Push Optionen
            </Text>
            <TouchableOpacity style={styles.iconBtn} onPress={onCancel} disabled={!!busy}>
              <Ionicons name="close" size={18} color={theme.palette.text.secondary} />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, marginTop: 8, color: theme.palette.text.secondary, lineHeight: 18 }}>
            Hinweis: GitHub Contents API erstellt pro Datei einen Commit.
          </Text>

          <Text style={{ fontSize: 12, marginTop: 12, color: theme.palette.text.secondary }}>
            Commit-Text
          </Text>
          <TextInput
            value={commitMessage}
            onChangeText={setCommitMessage}
            placeholder="z.B. chore: sync"
            placeholderTextColor={theme.palette.text.secondary}
            autoCorrect={false}
            style={[styles.searchInput, { marginTop: 8 }]}
          />

          <View style={[styles.rowBetween, { marginTop: 12 }]}>
            <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>
              Dateien ({selectedCount}/{paths.length})
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => setAll(true)} disabled={!!busy}>
                <Text style={{ fontSize: 12, color: theme.palette.primary }}>Alle</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAll(false)} disabled={!!busy}>
                <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>Keine</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={{ marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.palette.border }}>
            {paths.map((p) => {
              const on = !!selected[p];
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => togglePath(p)}
                  disabled={!!busy}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.palette.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Ionicons
                    name={on ? "checkbox" : "square-outline"}
                    size={18}
                    color={on ? theme.palette.primary : theme.palette.text.muted}
                  />
                  <Text style={{ flex: 1, fontSize: 12, color: theme.palette.text.secondary }} numberOfLines={1}>
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, { flex: 1 }, busy && styles.buttonDisabled]}
              onPress={onCancel}
              disabled={!!busy}
            >
              <Text style={styles.buttonTextSecondary}>Abbrechen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { flex: 1 }, !canConfirm && styles.buttonDisabled]}
              onPress={async () => {
                if (!canConfirm) return;
                await onConfirm();
              }}
              disabled={!canConfirm}
            >
              <Text style={styles.buttonText}>{busy ? "Pushe…" : "Push"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});
