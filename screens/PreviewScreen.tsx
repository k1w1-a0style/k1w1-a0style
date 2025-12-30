import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { useProject } from "../contexts/ProjectContext";
import { usePreview } from "../hooks/usePreview";
import { buildSandpackHtml } from "../lib/sandpackBuilder";
import { theme } from "../theme";

/**
 * PreviewScreen - Simplified single-flow preview
 * - Creates Sandpack preview in WebView
 * - No browser redirects, no external auth
 * - Direct fullscreen navigation
 */

export default function PreviewScreen() {
  const navigation = useNavigation<any>();
  const { projectData, isLoading } = useProject();

  const {
    creating,
    setCreating,
    lastCreatedAt,
    setLastCreatedAt,
    lastHtmlRef,
    fileMap,
    dependencies,
    ensureMinimumFiles,
  } = usePreview(projectData);

  const openFullscreen = useCallback(
    (html: string) => {
      navigation.navigate("PreviewFullscreen", {
        html,
        title: projectData?.name || "Preview",
      });
    },
    [navigation, projectData?.name],
  );

  const createAndOpen = useCallback(async () => {
    if (!projectData) {
      Alert.alert("Kein Projekt", "Bitte zuerst ein Projekt laden.");
      return;
    }

    setCreating(true);
    try {
      const files = ensureMinimumFiles(fileMap);
      const html = buildSandpackHtml({
        title: projectData?.name || "Preview",
        files,
        dependencies,
      });

      lastHtmlRef.current = html;
      setLastCreatedAt(Date.now());

      openFullscreen(html);
    } catch (e: any) {
      Alert.alert("Preview-Fehler", e?.message || String(e));
    } finally {
      setCreating(false);
    }
  }, [
    projectData,
    fileMap,
    dependencies,
    ensureMinimumFiles,
    openFullscreen,
    setCreating,
    setLastCreatedAt,
    lastHtmlRef,
  ]);

  const copyHtml = useCallback(async () => {
    const html = lastHtmlRef.current;
    if (!html) {
      Alert.alert("Noch nix da", "Erstelle erst eine Preview.");
      return;
    }
    await Clipboard.setStringAsync(html);
    Alert.alert("Kopiert", "HTML wurde in die Zwischenablage kopiert.");
  }, [lastHtmlRef]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
          <Text style={styles.info}>Projekt wird geladen…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!projectData) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.big}>📁</Text>
          <Text style={styles.h1}>Kein Projekt geladen</Text>
          <Text style={styles.info}>Bitte erst Projekt öffnen/erstellen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const last = lastCreatedAt
    ? new Date(lastCreatedAt).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.h1}>Preview</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {projectData.name} • zuletzt: {last}
          </Text>
        </View>

        <Pressable
          style={[
            styles.btn,
            styles.btnPrimary,
            creating && styles.btnDisabled,
          ]}
          onPress={createAndOpen}
          disabled={creating}
        >
          <Text style={styles.btnText}>
            {creating ? "Erstelle…" : "Neu erstellen"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wie das hier funktioniert</Text>
          <Text style={styles.cardText}>
            • Preview läuft direkt im WebView über Sandpack{"\n"}• Kein
            Supabase, kein Secret, kein 404-Ärger{"\n"}• Kein Browser-Wechsel
            (du bleibst in der App)
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Projekt-Dateien für Preview</Text>
          <Text style={styles.cardText}>
            {Object.keys(fileMap).length} Dateien übernommen (text-basiert).
            {"\n"}Wenn was fehlt, wird ein kleiner Default-Einstieg erzeugt.
          </Text>

          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnFlex]}
              onPress={() => {
                const html = lastHtmlRef.current;
                if (!html) {
                  Alert.alert(
                    "Noch keine Preview",
                    "Erstelle erst eine Preview.",
                  );
                  return;
                }
                openFullscreen(html);
              }}
            >
              <Text style={styles.btnText}>⛶ Vollbild öffnen</Text>
            </Pressable>

            <Pressable style={styles.btn} onPress={copyHtml}>
              <Text style={styles.btnText}>📋</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.hint}>
          <Text style={styles.hintText}>
            Tipp: Wenn Sandpack nix lädt → Internet an. Es zieht Module über
            esm.sh und den Bundler.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.palette.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  h1: {
    color: theme.palette.text.primary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sub: { color: theme.palette.text.secondary, fontSize: 13, marginTop: 2 },

  body: { flex: 1, padding: 16, gap: 14 },
  card: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  cardText: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },

  row: { flexDirection: "row", gap: 10, alignItems: "center" },

  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
  },
  btnPrimary: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  btnDisabled: { opacity: 0.5 },
  btnFlex: { flex: 1 },
  btnText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 14,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  big: { fontSize: 64 },
  info: { color: theme.palette.text.secondary, fontWeight: "700" },

  hint: { paddingHorizontal: 6 },
  hintText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
