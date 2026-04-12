import React, { memo, useMemo } from "react";
import type { ProjectFile } from "../../../shared/types/project";
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

type Preview = {
  remote: ProjectFile[];
  conflicts: string[];
  remoteOnly: string[];
  updates: string[];
} | null;

type Props = {
  visible: boolean;
  loading: boolean;
  preview: Preview;
  pullProgress: string;
  onCancel: () => void;
  onOverwrite: () => void;
  onSkipConflicts: () => void;
  onMirror: () => void;
  busy?: boolean;
};

export const PullPreviewModal = memo(function PullPreviewModal(props: Props) {
  const { visible, loading, preview, pullProgress, onCancel, onOverwrite, onSkipConflicts, onMirror, busy } = props;

  const counts = useMemo(() => {
    return {
      total: preview?.remote?.length || 0,
      conflicts: preview?.conflicts?.length || 0,
      remoteOnly: preview?.remoteOnly?.length || 0,
    };
  }, [preview]);

  const showList = useMemo(() => {
    const list = [
      ...(preview?.conflicts || []).map((p) => ({ p, tag: "Konflikt" })),
      ...(preview?.remoteOnly || []).map((p) => ({ p, tag: "Neu" })),
    ];
    return list.slice(0, 40);
  }, [preview]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.55)" }}>
        <View
          style={{
            backgroundColor: theme.palette.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.palette.border,
            padding: 14,
            maxHeight: "80%",
          }}
        >
          <View style={styles.rowBetween}>
            <Text style={{ fontSize: 14, fontWeight: "900", color: theme.palette.text.primary }}>
              Pull Vorschau
            </Text>
            <TouchableOpacity style={styles.iconBtn} onPress={onCancel} disabled={loading || !!busy}>
              <Ionicons name="close" size={18} color={theme.palette.text.secondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ marginTop: 14, alignItems: "center", gap: 10 }}>
              <ActivityIndicator size="small" color={theme.palette.primary} />
              <Text style={{ fontSize: 12, color: theme.palette.text.secondary }}>{pullProgress || "Lade…"}</Text>
            </View>
          ) : (
            <>
              <Text style={{ fontSize: 12, marginTop: 10, color: theme.palette.text.secondary, lineHeight: 18 }}>
                Remote Dateien: {counts.total} • Konflikte: {counts.conflicts} • Neu: {counts.remoteOnly}
              </Text>

              {showList.length ? (
                <ScrollView style={{ marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.palette.border }}>
                  {showList.map((x) => (
                    <View
                      key={`${x.tag}:${x.p}`}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.palette.border,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: theme.palette.border,
                          backgroundColor: x.tag === "Konflikt" ? "rgba(255, 99, 71, 0.12)" : "rgba(0, 255, 160, 0.10)",
                        }}
                      >
                        <Text style={{ fontSize: 10, color: theme.palette.text.secondary }}>{x.tag}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 12, color: theme.palette.text.secondary }} numberOfLines={1}>
                        {x.p}
                      </Text>
                    </View>
                  ))}
                  {((preview?.conflicts?.length || 0) + (preview?.remoteOnly?.length || 0)) > showList.length ? (
                    <Text style={{ padding: 10, fontSize: 11, color: theme.palette.text.muted }}>
                      +{((preview?.conflicts?.length || 0) + (preview?.remoteOnly?.length || 0)) - showList.length} weitere…
                    </Text>
                  ) : null}
                </ScrollView>
              ) : (
                <Text style={{ marginTop: 12, fontSize: 12, color: theme.palette.text.secondary }}>
                  Keine Konflikte erkannt.
                </Text>
              )}

              <Text style={{ fontSize: 11, marginTop: 10, color: theme.palette.text.muted, lineHeight: 16 }}>
                Merge/Overwrite übernimmt Remote-Version bei Konflikten. Skip behält lokale Version bei Konflikten und markiert den Stand bewusst nicht als vollständig synchron. Full Sync spiegelt den Remote-Stand exakt und löscht lokale-only Dateien explizit.
              </Text>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary, { flex: 1 }, busy && styles.buttonDisabled]}
                  onPress={onSkipConflicts}
                  disabled={!!busy || !preview}
                >
                  <Text style={styles.buttonTextSecondary}>{busy ? "…" : "Skip Konflikte"}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, { flex: 1 }, busy && styles.buttonDisabled]}
                  onPress={onOverwrite}
                  disabled={!!busy || !preview}
                >
                  <Text style={styles.buttonText}>{busy ? "…" : "Overwrite"}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.buttonDanger, { flex: 1 }, busy && styles.buttonDisabled]}
                  onPress={onMirror}
                  disabled={!!busy || !preview}
                >
                  <Text style={styles.buttonText}>{busy ? "…" : "Full Sync"}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
});
