import React from "react";
import { Switch, Text, View } from "react-native";

import { styles } from "../styles";

type Props = {
  persistChatHistory: boolean;
  retentionLimit: number;
  onTogglePersist: (v: boolean) => void;
};

export const PrivacySection: React.FC<Props> = ({
  persistChatHistory,
  retentionLimit,
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

      <Text style={styles.note}>
        Retention:{" "}
        <Text style={styles.noteStrong}>
          {persistChatHistory ? `letzte ${retentionLimit} Messages` : "deaktiviert"}
        </Text>
      </Text>
    </View>
  );
};
