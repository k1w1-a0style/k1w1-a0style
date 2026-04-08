import React from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../../theme";
import { styles } from "../../styles";
import { diffLineStyle, safeSliceLines, statusGlyph } from "./diffAlgorithms";
import { DiffPreviewState } from "./types";

type Props = {
  preview: DiffPreviewState;
  onClose: () => void;
};

export function DiffPreviewModal({ preview, onClose }: Props) {
  return (
    <Modal visible={preview.open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: 14, justifyContent: "center" }}>
        <View style={{ backgroundColor: theme.palette.card, borderRadius: 14, padding: 12, maxHeight: "85%" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: theme.palette.text.primary, fontWeight: "700" }}>
                {preview.path}
              </Text>
              <Text style={{ color: theme.palette.text.muted, fontSize: 12 }}>
                Status: {statusGlyph(preview.status)} {preview.status}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color={theme.palette.text.secondary} />
            </TouchableOpacity>
          </View>

          {preview.loading ? (
            <View style={{ paddingVertical: 18, alignItems: "center" }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 8, color: theme.palette.text.muted, fontSize: 12 }}>Lade Diff…</Text>
            </View>
          ) : (
            <ScrollView style={{ marginTop: 10 }}>
              {!!preview.diff ? (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: theme.palette.text.secondary, fontSize: 12, marginBottom: 6 }}>Unified Diff</Text>
                  <View style={{ borderWidth: 1, borderColor: theme.palette.border, borderRadius: 10, padding: 10 }}>
                    {safeSliceLines(preview.diff, 700)
                      .text.split("\n")
                      .map((ln, idx) => (
                        <Text key={idx} style={[{ fontFamily: "monospace", fontSize: 11, lineHeight: 16 }, diffLineStyle(ln)]}>
                          {ln}
                        </Text>
                      ))}
                  </View>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.palette.text.secondary, fontSize: 12, marginBottom: 6 }}>Local</Text>
                  <View style={{ borderWidth: 1, borderColor: theme.palette.border, borderRadius: 10, padding: 10 }}>
                    <Text style={{ color: theme.palette.text.primary, fontFamily: "monospace", fontSize: 11 }}>
                      {safeSliceLines(preview.local, 250).text || "(leer)"}
                    </Text>
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.palette.text.secondary, fontSize: 12, marginBottom: 6 }}>Remote</Text>
                  <View style={{ borderWidth: 1, borderColor: theme.palette.border, borderRadius: 10, padding: 10 }}>
                    <Text style={{ color: theme.palette.text.primary, fontFamily: "monospace", fontSize: 11 }}>
                      {safeSliceLines(preview.remote, 250).text || "(leer)"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.button, { flex: 1 }]}
                  onPress={async () => {
                    const text = preview.diff || `LOCAL\n${preview.local}\n\nREMOTE\n${preview.remote}`;
                    await Clipboard.setStringAsync(text);
                    Alert.alert("✅", "In Zwischenablage kopiert.");
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color={theme.palette.text.secondary} />
                  <Text style={styles.buttonText}>Kopieren</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={onClose}>
                  <Ionicons name="checkmark" size={16} color={theme.palette.text.secondary} />
                  <Text style={styles.buttonText}>OK</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
