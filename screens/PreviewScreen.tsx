// screens/PreviewScreen.tsx
// Moderner Preview-Screen für App-Builder

import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useProject } from "../contexts/ProjectContext";
import { usePreview } from "../hooks/usePreview";
import { theme } from "../theme";

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelativeTime(value: string): string | null {
  const d = new Date(value);
  const ts = d.getTime();
  if (Number.isNaN(ts)) return null;
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 0) return null;
  if (diffSec < 5) return "gerade eben";
  if (diffSec < 60) return `vor ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `vor ${diffD}d`;
}


/**
 * PreviewScreen
 * - Erstellt bevorzugt Supabase-Preview (URL)
 * - Fallback: Local HTML
 */

export default function PreviewScreen() {
  const navigation = useNavigation<any>();
  const { projectData, isLoading } = useProject();

  const { state, dependencies, lastPreview, createPreview, reset } =
    usePreview(projectData);

  const canUseLastPreview = useMemo(() => {
    const url = lastPreview?.url?.trim();
    const html = lastPreview?.html?.trim();
    return Boolean(url || html);
  }, [lastPreview?.url, lastPreview?.html]);

  const isLocalPreviewNotRestorable =
    lastPreview?.source === "local" && !lastPreview?.html;

  const openFullscreen = useCallback(
    (preview: { url: string | null; html: string | null }) => {
      navigation.navigate("PreviewFullscreen", {
        url: preview.url ?? undefined,
        html: preview.html ?? undefined,
        title: projectData?.name || "Preview",
      });
    },
    [navigation, projectData?.name],
  );

    const handleCreateAndOpen = useCallback(async () => {
    try {
      const result = await createPreview();
      if (!result) {
        Alert.alert(
          "⚠️ Keine Preview",
          "Preview konnte nicht erzeugt werden. Bitte erneut versuchen.",
        );
        return;
      }
      openFullscreen(result);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Unbekannter Fehler beim Erstellen der Preview.";
      Alert.alert("❌ Preview-Fehler", msg);
    }
  }, [createPreview, openFullscreen]);

    const handleReopenLast = useCallback(() => {
    if (!lastPreview || !canUseLastPreview) {
      Alert.alert(
        "⚠️ Preview nicht verfügbar",
        isLocalPreviewNotRestorable
          ? "Lokale HTML-Previews können nach App-Neustart nicht wieder geöffnet werden. Bitte eine neue Preview erstellen."
          : "Erstelle zuerst eine neue Preview.",
      );
      return;
    }
    openFullscreen(lastPreview);
  }, [lastPreview, canUseLastPreview, isLocalPreviewNotRestorable, openFullscreen]);

    const handleCopy = useCallback(async () => {
    if (!lastPreview || !canUseLastPreview) {
      Alert.alert(
        "⚠️ Nichts zu kopieren",
        isLocalPreviewNotRestorable
          ? "Diese lokale HTML-Preview ist nach App-Neustart nicht mehr verfügbar. Bitte neue Preview erstellen."
          : "Erstelle zuerst eine Preview.",
      );
      return;
    }
    const textToCopy = lastPreview.url || lastPreview.html || "";
    try {
      await Clipboard.setStringAsync(textToCopy);
      Alert.alert(
        "✅ Kopiert",
        lastPreview.url
          ? "Preview-URL wurde kopiert."
          : "HTML wurde in die Zwischenablage kopiert.",
      );
    } catch {
      Alert.alert("❌ Fehler", "Konnte nicht kopieren.");
    }
  }, [lastPreview, canUseLastPreview, isLocalPreviewNotRestorable]);

  const lastCreatedText = useMemo(() => {
    const raw = state.lastCreatedAt;
    if (!raw) return null;
    const iso = new Date(raw).toISOString();
    const abs = formatDateTime(iso);
    const rel = formatRelativeTime(iso);
    return rel ? `${abs} (${rel})` : abs;
  }, [state.lastCreatedAt]);

  const expiresText = useMemo(() => {
    const exp = lastPreview?.expiresAt;
    if (!exp) return null;
    const abs = formatDateTime(exp);
    const rel = formatRelativeTime(exp);
    return rel ? `${abs} (${rel})` : abs;
  }, [lastPreview?.expiresAt]);

  const fileStats = useMemo(() => {
    const count = state.fileCount;
    const sizeKb = (state.totalSize / 1024).toFixed(1);
    return `${count} Datei${count !== 1 ? "en" : ""} (${sizeKb} KB)`;
  }, [state.fileCount, state.totalSize]);

  const depsList = useMemo(() => {
    if (!dependencies) return null;
    const entries = Object.entries(dependencies);
    const shown = entries.slice(0, 5);
    const remaining = entries.length - shown.length;
    return {
      items: shown.map(([name, version]) => `${name}@${version}`),
      remaining,
    };
  }, [dependencies]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
          <Text style={styles.infoText}>Projekt wird geladen…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!projectData) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📁</Text>
          <Text style={styles.emptyTitle}>Kein Projekt geladen</Text>
          <Text style={styles.emptyText}>
            Bitte zuerst ein Projekt öffnen oder erstellen.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name="eye-outline"
            size={24}
            color={theme.palette.primary}
          />
          <View style={styles.headerText}>
            <Text style={styles.title}>Preview</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {projectData.name}
            </Text>
          </View>
        </View>

        <Pressable
          style={[
            styles.btn,
            styles.btnPrimary,
            state.isCreating && styles.btnDisabled,
          ]}
          onPress={handleCreateAndOpen}
          disabled={state.isCreating}
        >
          {state.isCreating ? (
            <ActivityIndicator size="small" color={theme.palette.secondary} />
          ) : (
            <>
              <Ionicons name="play" size={16} color={theme.palette.secondary} />
              <Text style={styles.btnPrimaryText}>Starten</Text>
            </>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
      >
        {lastCreatedText && (
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.palette.primary}
              />
              <Text style={styles.statusText}>
                Zuletzt erstellt: {lastCreatedText ?? "—"}
              </Text>
            </View>

            {!!lastPreview?.source && (
              <View style={styles.sourceRow}>
                <Ionicons
                  name={
                    lastPreview.source === "supabase"
                      ? "cloud-done-outline"
                      : "flask-outline"
                  }
                  size={16}
                  color={
                    lastPreview.source === "supabase"
                      ? theme.palette.primary
                      : theme.palette.text.secondary
                  }
                />
                <Text style={styles.sourceText}>
                  {lastPreview.source === "supabase"
                    ? "Quelle: Supabase Preview (stabil)"
                    : "Quelle: Local Preview (experimentell)"}
                </Text>
              </View>
            )}

            
            {!!expiresText && lastPreview?.source === "supabase" && (
              <Text style={styles.expiresText}>Gültig bis: {expiresText}</Text>
            )}
{isLocalPreviewNotRestorable && (
              <Text style={styles.localHint}>
                Hinweis: Lokale Previews sind nach App-Neustart nicht wieder verfügbar –
                bitte neu erstellen.
              </Text>
            )}

            <View style={styles.statusActions}>
              <Pressable
                style={[
                  styles.statusBtn,
                  (!canUseLastPreview || state.isCreating) && styles.btnDisabled,
                ]}
                onPress={handleReopenLast}
                disabled={!canUseLastPreview || state.isCreating}
              >
                <Ionicons
                  name="expand-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={styles.statusBtnText}>Öffnen</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.statusBtn,
                  (!canUseLastPreview || state.isCreating) && styles.btnDisabled,
                ]}
                onPress={handleCopy}
                disabled={!canUseLastPreview || state.isCreating}
              >
                <Ionicons
                  name="copy-outline"
                  size={16}
                  color={theme.palette.primary}
                />
                <Text style={styles.statusBtnText}>Kopieren</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.statusBtn,
                  (!canUseLastPreview || state.isCreating) && styles.btnDisabled,
                ]}
                onPress={() => {
                  Alert.alert(
                    "Letzte Preview löschen?",
                    "Dadurch wird die gespeicherte Preview-Info entfernt. Du kannst danach jederzeit eine neue Preview erstellen.",
                    [
                      { text: "Abbrechen", style: "cancel" },
                      {
                        text: "Löschen",
                        style: "destructive",
                        onPress: () => {
                          reset();
                        },
                      },
                    ],
                  );
                }}
                disabled={!canUseLastPreview || state.isCreating}
              ><Ionicons
                  name="refresh-outline"
                  size={16}
                  color={theme.palette.text.secondary}
                />
                <Text
                  style={[
                    styles.statusBtnText,
                    { color: theme.palette.text.secondary },
                  ]}
                >
                  Löschen
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {state.error && (
          <View style={styles.errorCard}>
            <Ionicons name="warning" size={20} color={theme.palette.error} />
            <Text style={styles.errorText}>{state.error}</Text>
            <Pressable
              style={[styles.errorBtn, state.isCreating && styles.btnDisabled]}
              onPress={handleCreateAndOpen}
              disabled={state.isCreating}
            >
              <Ionicons name="refresh" size={16} color={theme.palette.error} />
              <Text style={styles.errorBtnText}>Retry</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color={theme.palette.primary}
            />
            <Text style={styles.cardTitle}>Projekt-Dateien</Text>
          </View>
          <Text style={styles.statsText}>{fileStats}</Text>
          {state.fileCount === 0 && (
            <Text style={styles.cardText}>
              Keine Preview-fähigen Dateien gefunden.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={theme.palette.primary}
            />
            <Text style={styles.cardTitle}>Hinweis</Text>
          </View>
          <Text style={styles.cardText}>
            • Preview ist eine Sandbox: keine Secrets/Keys in Dateien{"\n"}• Für
            “echte” Vorschau wird Supabase-Preview (URL) bevorzugt{"\n"}•
            Fallback ist Local HTML (best-effort){"\n"}• Internet wird für
            Module benötigt
          </Text>
        </View>

        {depsList && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name="cube-outline"
                size={20}
                color={theme.palette.primary}
              />
              <Text style={styles.cardTitle}>Dependencies</Text>
            </View>
            <View style={styles.depsList}>
              {depsList.items.map((dep, i) => (
                <View key={i} style={styles.depPill}>
                  <Text style={styles.depPillText}>{dep}</Text>
                </View>
              ))}
              {depsList.remaining > 0 && (
                <View style={[styles.depPill, styles.depPillMore]}>
                  <Text style={styles.depPillText}>
                    +{depsList.remaining} weitere
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.hint}>
          <Ionicons
            name="bulb-outline"
            size={16}
            color={theme.palette.text.secondary}
          />
          <Text style={styles.hintText}>
            Wenn du im Vollbild nur “weiß” siehst: meist CSP oder Netzwerk. Mit
            Supabase-URL-Preview bist du i.d.R. stabiler.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },

  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    gap: 14,
  },

  statusCard: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.primary,
    borderRadius: 14,
    padding: 14,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  statusText: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginTop: 10,
  },
  sourceText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "700",
  },
  statusActions: {
    flexDirection: "row",
    marginTop: 12,
    columnGap: 8,
  },
  statusBtn: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.palette.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  statusBtnText: {
    color: theme.palette.primary,
    fontSize: 13,
    fontWeight: "700",
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    padding: 14,
    backgroundColor: "rgba(255, 100, 100, 0.1)",
    borderWidth: 1,
    borderColor: theme.palette.error,
    borderRadius: 14,
  },
  errorText: {
    flex: 1,
    color: theme.palette.error,
    fontSize: 13,
    fontWeight: "600",
  },
  errorBtn: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.error,
    backgroundColor: "rgba(255, 100, 100, 0.08)",
  },
  errorBtnText: {
    color: theme.palette.error,
    fontSize: 13,
    fontWeight: "800",
  },
  localHint: {
    marginTop: 8,
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "600",
  },
  expiresText: { fontSize: 12, color: theme.palette.text.secondary, marginTop: 6 },

  card: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  cardText: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    lineHeight: 20,
  },
  statsText: {
    color: theme.palette.text.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  depsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    gap: 6,
  },
  depPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.palette.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  depPillMore: {
    borderColor: theme.palette.primary,
  },
  depPillText: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    fontWeight: "600",
  },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    minWidth: 100,
  },
  btnPrimary: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPrimaryText: {
    color: theme.palette.secondary,
    fontWeight: "800",
    fontSize: 14,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  infoText: {
    color: theme.palette.text.secondary,
    fontWeight: "700",
    fontSize: 14,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  emptyTitle: {
    color: theme.palette.text.primary,
    fontSize: 18,
    fontWeight: "900",
  },
  emptyText: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 8,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  hintText: {
    flex: 1,
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
