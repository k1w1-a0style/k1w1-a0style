import React, { useEffect, useMemo, useState } from "react";
import { Modal, Text, TextInput, TouchableOpacity, View } from "react-native";

import { SECURE_BACKUP_MIN_PASSPHRASE_LENGTH, type SecureBackupScope } from "../../../lib/appInfoScopedBackup";
import type { AppInfoScreenStyles } from "../componentTypes";

const scopeLabel = (scope?: SecureBackupScope) => {
  if (scope === "secrets") return "Secrets/Tokens/Connections";
  if (scope === "config-secrets") return "AI-/KI-Konfiguration + Secrets/Connections";
  return "gesichertes Backup";
};

type Props = {
  styles: AppInfoScreenStyles;
  visible: boolean;
  busy: boolean;
  mode: "export" | "import";
  scope?: SecureBackupScope;
  onClose: () => void;
  onSubmit: (passphrase: string) => Promise<void> | void;
};

export function BackupPassphraseModal({
  styles,
  visible,
  busy,
  mode,
  scope,
  onClose,
  onSubmit,
}: Props) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setPassphrase("");
      setConfirmPassphrase("");
      setError(null);
    }
  }, [visible]);

  const title = useMemo(
    () => (mode === "export" ? "Backup verschlüsseln" : "Backup entschlüsseln"),
    [mode],
  );

  const description = useMemo(() => {
    const target = scopeLabel(scope);
    if (mode === "export") {
      return `Bitte eine starke Passphrase vergeben. Damit wird ${target} verschlüsselt exportiert.`;
    }
    return `Bitte die Passphrase für ${target} eingeben.`;
  }, [mode, scope]);

  const handleConfirm = async () => {
    const trimmed = passphrase.trim();
    if (trimmed.length < SECURE_BACKUP_MIN_PASSPHRASE_LENGTH) {
      setError(`Bitte mindestens ${SECURE_BACKUP_MIN_PASSPHRASE_LENGTH} Zeichen eingeben.`);
      return;
    }

    if (mode === "export" && trimmed !== confirmPassphrase.trim()) {
      setError("Passphrase und Bestätigung stimmen nicht überein.");
      return;
    }

    setError(null);
    await onSubmit(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalDescription}>{description}</Text>
          <Text style={styles.modalHint}>
            Projektdateien und ZIP-Inhalte werden hier nie mit exportiert.
          </Text>

          <TextInput
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="Starke Passphrase"
            placeholderTextColor="#7d7d7d"
            secureTextEntry
            editable={!busy}
            autoCapitalize="none"
            style={styles.modalInput}
          />

          {mode === "export" ? (
            <TextInput
              value={confirmPassphrase}
              onChangeText={setConfirmPassphrase}
              placeholder="Passphrase wiederholen"
              placeholderTextColor="#7d7d7d"
              secureTextEntry
              editable={!busy}
              autoCapitalize="none"
              style={styles.modalInput}
            />
          ) : null}

          {error ? <Text style={styles.modalError}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.backupButton, styles.modalButton, styles.modalCancelButton]}
              disabled={busy}
            >
              <Text style={[styles.backupButtonText, styles.modalCancelText]}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              style={[styles.backupButton, styles.modalButton]}
              disabled={busy}
            >
              <Text style={styles.backupButtonText}>{busy ? "Bitte warten…" : "Weiter"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
