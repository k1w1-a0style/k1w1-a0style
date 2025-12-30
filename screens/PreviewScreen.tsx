// screens/PreviewScreen.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useProject } from "../contexts/ProjectContext";
import { theme } from "../theme";

type SavePreviewResponse = {
  ok: boolean;
  previewId?: string;
  previewUrl?: string;
  expiresAt?: string;
  error?: string;
};

function isHttpUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

export default function PreviewScreen() {
  const { projectData, isLoading } = useProject();

  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const webRef = useRef<WebView>(null);

  const savePreviewUrl = process.env.EXPO_PUBLIC_SAVE_PREVIEW_URL || "";
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

  const payload = useMemo(() => {
    if (!projectData) return null;

    const files: Record<string, { contents: string }> = {};
    for (const f of projectData.files || []) {
      if (!f?.path) continue;
      files[f.path] = { contents: f.content ?? "" };
    }

    return {
      name: projectData.name || "project",
      files,
    };
  }, [projectData]);

  const canGenerate =
    !!payload && !!savePreviewUrl && isHttpUrl(savePreviewUrl);

  const clearPreviewAsExpired = useCallback((msg?: string) => {
    setPreviewUrl(null);
    setExpiresAt(null);
    setFullscreen(false);
    setError(
      msg ||
        "Preview nicht gefunden (404). Wahrscheinlich abgelaufen/ungültig. Bitte neu erstellen.",
    );
  }, []);

  const createPreview = useCallback(async () => {
    if (!canGenerate || !payload) {
      Alert.alert(
        "Preview nicht möglich",
        "Projekt oder EXPO_PUBLIC_SAVE_PREVIEW_URL fehlt/ist ungültig.",
      );
      return;
    }
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(savePreviewUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(supabaseAnonKey
            ? {
                Authorization: `Bearer ${supabaseAnonKey}`,
                apikey: supabaseAnonKey,
              }
            : {}),
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: SavePreviewResponse | null = null;
      try {
        data = JSON.parse(text);
      } catch {}

      if (!res.ok) {
        const msg =
          data?.error ||
          `HTTP ${res.status} – ${text?.slice(0, 160) || "Unbekannter Fehler"}`;
        throw new Error(msg);
      }

      if (!data?.ok || !data.previewUrl) {
        throw new Error(data?.error || "Keine previewUrl bekommen.");
      }

      setPreviewUrl(data.previewUrl);
      setExpiresAt(data.expiresAt || null);

      // direkt fullscreen (wie du willst)
      setFullscreen(true);
    } catch (e: any) {
      setPreviewUrl(null);
      setExpiresAt(null);
      setFullscreen(false);
      setError(e?.message || "Unbekannter Fehler beim Erstellen der Preview.");
    } finally {
      setBusy(false);
    }
  }, [busy, canGenerate, payload, savePreviewUrl, supabaseAnonKey]);

  const reloadWebView = useCallback(() => {
    try {
      webRef.current?.reload();
    } catch {}
  }, []);

  const onShouldStart = useCallback((req: any) => {
    const url = String(req?.url || "");

    // verhindert Browser-Wechsel / intent:// usw.
    if (!isHttpUrl(url)) {
      Alert.alert("Blockiert", `Externer Link blockiert:\n${url}`);
      return false;
    }
    return true;
  }, []);

  const renderWebView = (isModal: boolean) => {
    if (!previewUrl) return null;

    return (
      <View style={[styles.webWrap, isModal && styles.webWrapModal]}>
        <WebView
          ref={webRef}
          source={{ uri: previewUrl }}
          originWhitelist={["*"]}
          onShouldStartLoadWithRequest={onShouldStart}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          startInLoadingState
          style={{ backgroundColor: "#000" }}
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.mutedText}>Preview lädt…</Text>
            </View>
          )}
          onHttpError={(e) => {
            const code = e?.nativeEvent?.statusCode;
            // WICHTIG: 404 => URL/Secret tot. PreviewUrl löschen, NICHT reloaden => keine Endlosschleife.
            if (code === 404) {
              clearPreviewAsExpired(
                "HTTP Fehler 404: Preview abgelaufen/ungültig. Neu erstellen.",
              );
              return;
            }
            setError(
              `HTTP Fehler: ${code || "?"}\n${e?.nativeEvent?.description || ""}`,
            );
          }}
          onError={(e) => {
            setError(`WebView Fehler:\n${e?.nativeEvent?.description || "?"}`);
          }}
          mixedContentMode={Platform.OS === "android" ? "always" : undefined}
        />
      </View>
    );
  };

  const closeFullscreen = useCallback(() => setFullscreen(false), []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.mutedText}>Projekt wird geladen…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!projectData) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.title}>Preview</Text>
          <Text style={styles.mutedText}>Kein Projekt geladen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Topbar */}
      <View style={styles.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Preview</Text>
          <Text style={styles.sub}>
            {projectData.name}
            {expiresAt ? ` · Ablauf: ${expiresAt}` : ""}
          </Text>
        </View>

        <Pressable
          style={[styles.btn, !canGenerate && styles.btnDisabled]}
          onPress={createPreview}
          disabled={!canGenerate || busy}
        >
          <Text style={styles.btnText}>{busy ? "…" : "Neu"}</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, !previewUrl && styles.btnDisabled]}
          onPress={() => setFullscreen(true)}
          disabled={!previewUrl}
        >
          <Text style={styles.btnText}>⛶</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, !previewUrl && styles.btnDisabled]}
          onPress={reloadWebView}
          disabled={!previewUrl}
        >
          <Text style={styles.btnText}>↻</Text>
        </Pressable>
      </View>

      {/* Fehlerbox */}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Fehler</Text>
          <Text style={styles.errorText}>{error}</Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <Pressable
              style={styles.btn}
              onPress={createPreview}
              disabled={busy}
            >
              <Text style={styles.btnText}>Neu erstellen</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => setError(null)}
              disabled={busy}
            >
              <Text style={styles.btnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Wenn Fehler aktiv -> KEIN WebView rendern => kein weißer Screen */}
      {error ? (
        <View style={styles.center}>
          <Text style={styles.mutedText}>
            Wenn du willst: „Neu erstellen“ drücken.
          </Text>
        </View>
      ) : !previewUrl ? (
        <View style={styles.center}>
          <Text style={styles.mutedText}>
            Drück auf „Neu“, dann wird die Preview erstellt und direkt
            Fullscreen geöffnet.
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>{renderWebView(false)}</View>
      )}

      {/* Fullscreen Modal */}
      <Modal
        visible={fullscreen}
        animationType="slide"
        onRequestClose={closeFullscreen}
      >
        <SafeAreaView style={styles.modalScreen}>
          <View style={styles.modalTopbar}>
            <Pressable style={styles.btn} onPress={closeFullscreen}>
              <Text style={styles.btnText}>Zurück</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              style={styles.btn}
              onPress={reloadWebView}
              disabled={!previewUrl}
            >
              <Text style={styles.btnText}>↻</Text>
            </Pressable>
          </View>

          <View style={{ flex: 1, backgroundColor: theme.palette.background }}>
            {renderWebView(true)}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.palette.background },
  modalScreen: { flex: 1, backgroundColor: theme.palette.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 10,
  },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  modalTopbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  title: {
    color: theme.palette.text.primary,
    fontSize: 18,
    fontWeight: "800",
  },
  sub: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  mutedText: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    textAlign: "center",
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: theme.palette.text.primary, fontWeight: "800" },
  webWrap: { flex: 1, backgroundColor: "#000" },
  webWrapModal: { flex: 1 },
  errorBox: {
    margin: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#5a1a1a",
    backgroundColor: "#1a0f0f",
  },
  errorTitle: {
    color: "#ff6b6b",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6,
  },
  errorText: { color: "#ffb3b3", fontSize: 12, lineHeight: 16 },
});
