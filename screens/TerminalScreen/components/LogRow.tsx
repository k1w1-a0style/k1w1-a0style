import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { styles } from "../styles";
import { getLogColor, getLogIcon, getLogLabel } from "../utils/logPresentation";
import type { LogEntry } from "../../../contexts/TerminalContext";

type Props = { item: LogEntry };

export default function LogRow({ item }: Props) {
  const icon = getLogIcon(item.type);
  const color = getLogColor(item.type);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onLongPress={async () => {
        await Clipboard.setStringAsync(
          `[${item.timestamp}] [${getLogLabel(item.type)}] ${item.message}`,
        );
        Alert.alert("✅ Kopiert", "Log-Zeile kopiert.");
      }}
      style={styles.logRow}
    >
      <View style={styles.logMeta}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={styles.logTime}>{item.timestamp}</Text>
        <Text style={[styles.logType, { color }]}>
          {getLogLabel(item.type)}
        </Text>
      </View>
      <Text style={styles.logMessage}>{item.message}</Text>
    </TouchableOpacity>
  );
}
