import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { theme } from "../../../theme";
import { styles } from "../styles";

export function BusyFooter({ busy }: { busy: string }) {
  return (
    <View style={styles.footerBusy}>
      <Ionicons name="time-outline" size={16} color={theme.palette.text.secondary} />
      <Text style={styles.footerBusyText}>{busy}</Text>
    </View>
  );
}
