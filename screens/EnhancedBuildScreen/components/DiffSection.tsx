import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { DiffPreview } from "../../../components/DiffPreview";

type Props = {
  oldText?: string | null;
  newText?: string | null;
  title?: string;
};

export function DiffSection({ oldText, newText, title }: Props) {
  const [expanded, setExpanded] = useState(false);

  const hasContent = !!(oldText || newText);
  if (!hasContent) return null;

  return (
    <View style={s.card}>
      <TouchableOpacity
        style={s.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <Ionicons name="git-compare-outline" size={18} color={theme.palette.primary} />
        <Text style={s.title}>{title || "Diff-Anzeige"}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.palette.text.secondary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={s.diffWrap}>
          <DiffPreview oldText={oldText} newText={newText} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: 14,
    marginHorizontal: 16,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 15,
    flex: 1,
  },
  diffWrap: {
    marginTop: 12,
  },
});
