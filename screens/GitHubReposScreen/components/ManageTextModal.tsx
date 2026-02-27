import React, { memo, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

type ManageTextModalProps = {
  visible: boolean;
  title: string;
  placeholder: string;
  confirmText?: string;
  value: string;
  setValue: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  busy?: boolean;
};

export const ManageTextModal = memo(function ManageTextModal(props: ManageTextModalProps) {
  const {
    visible,
    title,
    placeholder,
    confirmText,
    value,
    setValue,
    onCancel,
    onConfirm,
    busy,
  } = props;

  const canConfirm = useMemo(() => !!value.trim() && !busy, [value, busy]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
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
          }}
        >
          <View style={styles.rowBetween}>
            <Text style={{ fontSize: 14, fontWeight: "900", color: theme.palette.text.primary }}>
              {title}
            </Text>
            <TouchableOpacity style={styles.iconBtn} onPress={onCancel}>
              <Ionicons name="close" size={18} color={theme.palette.text.secondary} />
            </TouchableOpacity>
          </View>

          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={theme.palette.text.secondary}
            autoCorrect={false}
            autoCapitalize="none"
            style={[styles.searchInput, { marginTop: 12 }]}
          />

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
              <Text style={styles.buttonText}>{confirmText || "OK"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});
