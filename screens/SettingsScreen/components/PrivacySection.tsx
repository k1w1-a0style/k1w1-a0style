import React from "react";
import { Switch, Text, TextInput, TouchableOpacity, View } from "react-native";

import { styles } from "../styles";

type Props = {
  persistChatHistory: boolean;
  retentionLimit: number;
  retentionInput: string;
  onRetentionInputChange: (value: string) => void;
  onSaveRetention: () => void;
  onTogglePersist: (v: boolean) => void;
};

export const PrivacySection: React.FC<Props> = ({
  persistChatHistory,
  retentionLimit,
  retentionInput,
  onRetentionInputChange,
  onSaveRetention,
  onTogglePersist,
}) => {
  return (
    <View style={styles.card}>
      <Text style={styles.h2}>Privacy</Text>

      <View style={styles.privacyRow}>
        <View style={styles.privacyTextCol}>
          <Text style={styles.privacyLabel}>Chat-Verlauf speichern</Text>
          <Text style={styles.privacyHint}>
            Wenn aus, wird dein Chat-Verlauf nicht in AsyncStorage abgelegt.
          </Text>
        </View>

        <Switch value={persistChatHistory} onValueChange={onTogglePersist} />
      </View>


      {persistChatHistory && (
        <View style={styles.retentionEditor}>
          <Text style={styles.retentionLabel}>Retention Limit (Messages)</Text>
          <View style={styles.retentionRow}>
            <TextInput
              style={styles.retentionInput}
              value={retentionInput}
              onChangeText={onRetentionInputChange}
              keyboardType="number-pad"
              placeholder="200"
              placeholderTextColor="#7b7f86"
            />
            <TouchableOpacity
              style={styles.retentionSaveBtn}
              onPress={onSaveRetention}
              activeOpacity={0.85}
            >
              <Text style={styles.retentionSaveBtnText}>Speichern</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.note}>
        Retention:{" "}
        <Text style={styles.noteStrong}>
          {persistChatHistory ? `letzte ${retentionLimit} Messages` : "deaktiviert"}
        </Text>
      </Text>
    </View>
  );
};
