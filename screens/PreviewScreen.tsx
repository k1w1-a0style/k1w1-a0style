import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";

import { CONFIG } from "../config";
import { useGitHub } from "../contexts/GitHubContext";
import { useProject } from "../contexts/ProjectContext";
import { useTheme } from "../theme/ThemeProvider";

type Mode = "web" | "info";

function repoToPagesUrl(repoFullName: string) {
  // repoFullName = "owner/repo"
  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) return "";
  return `https://${owner}.github.io/${repo}/`;
}

export default function PreviewScreen() {
  const { projectData } = useProject();
  const { activeRepo } = useGitHub();
  const theme = useTheme();

  const [mode, setMode] = useState<Mode>("web");
  const [loading, setLoading] = useState(false);

  const webPreviewBaseFromConfig =
    (Constants.expoConfig as any)?.extra?.webPreview?.baseUrl ||
    (Constants.manifest as any)?.extra?.webPreview?.baseUrl ||
    "";

  const defaultWebUrl = useMemo(() => {
    // If user provides a full URL (e.g. Cloudflare Pages), use it.
    // Otherwise compute GitHub Pages URL from activeRepo.
    if (
      webPreviewBaseFromConfig &&
      webPreviewBaseFromConfig.startsWith("http")
    ) {
      return webPreviewBaseFromConfig.replace(/\/+$/, "") + "/";
    }
    if (!activeRepo) return "";
    return repoToPagesUrl(activeRepo);
  }, [activeRepo, webPreviewBaseFromConfig]);

  const [webUrl, setWebUrl] = useState<string>(defaultWebUrl);

  useEffect(() => {
    if (defaultWebUrl && !webUrl) setWebUrl(defaultWebUrl);
  }, [defaultWebUrl, webUrl]);

  const htmlPreview = useMemo(() => {
    const filesList = projectData?.files
      ? Object.keys(projectData.files)
          .sort()
          .map(
            (f) =>
              `<li><code>${f}</code> (${(projectData.files[f]?.content || "").length} chars)</li>`,
          )
          .join("")
      : "<li>Keine Dateien</li>";

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, system-ui, sans-serif; padding: 14px; background: #0A0A0A; color: #fff; }
            .card { background: #151515; border: 1px solid #2A2A2A; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
            h1 { font-size: 18px; margin: 0 0 8px 0; }
            h2 { font-size: 14px; margin: 16px 0 8px 0; color: #d0d0d0; }
            code { background: #111; padding: 2px 6px; border-radius: 8px; border: 1px solid #2A2A2A; }
            .muted { color: #aaa; font-size: 12px; line-height: 1.4; }
            ul { margin: 8px 0 0 0; padding-left: 18px; }
            li { margin-bottom: 6px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Preview (Info/Dummy)</h1>
            <div class="muted">
              Das ist die reine Info-Ansicht (Dateiübersicht). Für echtes UI-Preview nutze den Tab „Web Preview“.
            </div>
          </div>

          <div class="card">
            <h2>Aktives Repo</h2>
            <div class="muted">${activeRepo || "Keins ausgewählt"}</div>
          </div>

          <div class="card">
            <h2>Projektdateien</h2>
            <ul>${filesList}</ul>
          </div>
        </body>
      </html>
    `;
  }, [activeRepo, projectData?.files]);

  const triggerWebPreviewBuild = async () => {
    if (!activeRepo) {
      Alert.alert(
        "Kein Repo ausgewählt",
        "Bitte wähle erst ein Repo im GitHub-Repos Screen.",
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${CONFIG.API.SUPABASE_EDGE_URL}/github-workflow-dispatch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            githubRepo: activeRepo,
            workflowId: "web-preview.yml",
            ref: "main",
            inputs: {},
          }),
        },
      );

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error || `GitHub dispatch failed (${res.status})`,
        );
      }

      Alert.alert(
        "Web Preview gestartet",
        "GitHub Actions baut jetzt die Web Preview und deployed nach GitHub Pages.\n\nHinweis: GitHub Pages muss im Repo einmalig aktiviert sein (Settings → Pages → Source: GitHub Actions).",
      );

      // Optional: direkt auf URL springen
      if (webUrl) setMode("web");
    } catch (e: any) {
      Alert.alert("Fehler", e?.message || "Konnte Web Preview nicht starten");
    } finally {
      setLoading(false);
    }
  };

  const openExternal = async () => {
    if (!webUrl) return;
    try {
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert("Fehler", "Konnte Link nicht öffnen");
    }
  };

  const canShowWeb = mode === "web" && !!webUrl;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.palette.background }]}
    >
      <View
        style={[styles.topbar, { borderBottomColor: theme.palette.border }]}
      >
        <View style={styles.modeRow}>
          <TouchableOpacity
            onPress={() => setMode("web")}
            style={[
              styles.modeBtn,
              mode === "web" && { backgroundColor: theme.palette.primary },
              { borderColor: theme.palette.border },
            ]}
          >
            <Text style={styles.modeBtnText}>Web Preview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode("info")}
            style={[
              styles.modeBtn,
              mode === "info" && { backgroundColor: theme.palette.primary },
              { borderColor: theme.palette.border },
            ]}
          >
            <Text style={styles.modeBtnText}>Info</Text>
          </TouchableOpacity>
        </View>

        {mode === "web" && (
          <View style={styles.webControls}>
            <TouchableOpacity
              onPress={triggerWebPreviewBuild}
              disabled={loading || !activeRepo}
              style={[
                styles.webBtn,
                { backgroundColor: theme.palette.primary },
                (loading || !activeRepo) && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.webBtnText}>
                {loading ? "…" : "Build Web Preview"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={openExternal}
              disabled={!webUrl}
              style={[
                styles.webBtn,
                { backgroundColor: theme.palette.card },
                !webUrl && { opacity: 0.5 },
              ]}
            >
              <Text style={[styles.webBtnText, { color: theme.palette.text }]}>
                Open
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {mode === "web" && (
        <View
          style={[styles.urlRow, { borderBottomColor: theme.palette.border }]}
        >
          <Text
            style={[styles.urlLabel, { color: theme.palette.textSecondary }]}
          >
            URL
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={webUrl}
              onChangeText={setWebUrl}
              placeholder={defaultWebUrl || "https://…"}
              placeholderTextColor={theme.palette.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.urlInput,
                {
                  color: theme.palette.text,
                  borderColor: theme.palette.border,
                },
              ]}
            />
          </View>
        </View>
      )}

      {canShowWeb ? (
        <WebView
          source={{ uri: webUrl }}
          style={styles.webview}
          onError={(e) =>
            Alert.alert("WebView Error", e.nativeEvent.description)
          }
        />
      ) : (
        <ScrollView style={styles.scroll}>
          <WebView
            originWhitelist={["*"]}
            source={{ html: htmlPreview }}
            style={styles.webview}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topbar: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  modeRow: { flexDirection: "row", gap: 10 },
  modeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  modeBtnText: { color: "#fff", fontWeight: "600" },
  webControls: { flexDirection: "row", gap: 10 },
  webBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  webBtnText: { color: "#fff", fontWeight: "700" },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  urlLabel: { width: 40, fontSize: 12, fontWeight: "700" },
  inputWrap: { flex: 1 },
  urlInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  webview: { flex: 1 },
  scroll: { flex: 1 },
});
