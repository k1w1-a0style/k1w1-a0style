import React from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../../theme";
import { safeTruncateText } from "../../../lib/diagnostics/sanitize";
import type { DiagnosticScreenStyles } from "../styles";

type PreviewEntry = { path: string; oldText: string | null; newText: string | null };

export function PreviewModal(props: {
  styles: DiagnosticScreenStyles;
  visible: boolean;
  label: string;
  entries: PreviewEntry[];
  onClose: () => void;
}) {
  const { styles, visible, label, entries, onClose } = props;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.previewWrap}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle} numberOfLines={1}>
            {label}
          </Text>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color={theme.palette.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
        >
          {entries.map((e) => (
            <View key={e.path} style={styles.previewCard}>
              <Text style={styles.previewPath}>{e.path}</Text>

              <Text style={styles.previewLabel}>Before</Text>
              <Text style={styles.previewText} selectable>
                {safeTruncateText(e.oldText ?? "", 6000)}
              </Text>

              <Text style={styles.previewLabel}>After</Text>
              <Text style={styles.previewText} selectable>
                {safeTruncateText(e.newText ?? "", 6000)}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
