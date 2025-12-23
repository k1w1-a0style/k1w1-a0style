import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

type Props = {
  onSendLogsToAiAutoFix: () => void;
  onExportDebugZip: () => void;
  onShareVisibleLogsTxt: () => void;
  onConfirmClear: () => void;
};

export default function TerminalHeader({
  onSendLogsToAiAutoFix,
  onExportDebugZip,
  onShareVisibleLogsTxt,
  onConfirmClear,
}: Props) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Terminal</Text>

      <View style={styles.headerRight}>
        <TouchableOpacity
          onPress={onSendLogsToAiAutoFix}
          style={styles.headerBtn}
        >
          <Ionicons
            name="sparkles-outline"
            size={18}
            color={theme.palette.text.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={onExportDebugZip} style={styles.headerBtn}>
          <Ionicons
            name="archive-outline"
            size={18}
            color={theme.palette.text.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onShareVisibleLogsTxt}
          style={styles.headerBtn}
        >
          <Ionicons
            name="share-outline"
            size={18}
            color={theme.palette.text.primary}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={onConfirmClear} style={styles.headerBtn}>
          <Ionicons
            name="trash-outline"
            size={18}
            color={theme.palette.text.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
