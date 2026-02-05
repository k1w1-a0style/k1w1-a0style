import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { styles } from "../styles";

type Props = {
  isInitialized: boolean;
  hasPermissions: boolean;
  requestPermissions: () => void;
  pushToken: string | null;
};

export const NotificationsSection: React.FC<Props> = ({
  isInitialized,
  hasPermissions,
  requestPermissions,
  pushToken,
}) => {
  return (
    <View style={styles.card}>
      <Text style={styles.h2}>Notifications</Text>
      <Text style={styles.note}>
        Status:{" "}
        <Text style={styles.noteStrong}>
          {isInitialized ? "Initialisiert" : "Nicht initialisiert"}
        </Text>
        {"\n"}
        Permissions:{" "}
        <Text style={styles.noteStrong}>{hasPermissions ? "OK" : "Fehlt"}</Text>
        {"\n"}
        Token:{" "}
        <Text style={styles.noteStrong}>{pushToken ? "Vorhanden" : "—"}</Text>
      </Text>

      {!hasPermissions && (
        <TouchableOpacity
          style={styles.notifyBtn}
          onPress={requestPermissions}
          activeOpacity={0.85}
        >
          <Ionicons name="notifications" size={18} color="#000" />
          <Text style={styles.notifyBtnText}>Permissions anfordern</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
