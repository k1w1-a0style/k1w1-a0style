import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../../theme";
import { SummaryPresentation } from "./secretsSectionContracts";

export function SecretsSummaryCard({ summary }: { summary: SummaryPresentation }) {
  return (
    <View
      style={{
        marginTop: 8,
        borderWidth: 1,
        borderColor: `${summary.color}55`,
        backgroundColor: `${summary.color}12`,
        borderRadius: 12,
        padding: 10,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={summary.icon} size={16} color={summary.color} />
        <Text style={{ fontSize: 12, fontWeight: "900", color: summary.color }}>{summary.title}</Text>
      </View>
      <Text style={{ fontSize: 11, lineHeight: 17, color: theme.palette.text.secondary }}>{summary.body}</Text>
    </View>
  );
}
