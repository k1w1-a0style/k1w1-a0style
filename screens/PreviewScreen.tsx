// screens/PreviewScreen.tsx
// Echter Live-Preview mit Hot-Reload

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useProject } from "../contexts/ProjectContext";
import { usePreview } from "../hooks/usePreview";
import { theme } from "../theme";
import { isHttpUrl } from "../utils/url";
import { decidePreviewNavigation } from "../utils/previewNavigation";

type PreviewPhase = "idle" | "creating" | "loading" | "ready" | "error";

const HOT_RELOAD_DEBOUNCE_MS = 1200;

export default function PreviewScreen() {
  const navigation = useNavigation<any>();
  const { projectData, isLoading } = useProject();
  const { state, lastPreview, createPreview, reset, filesFingerprint } = usePreview(projectData);

  const [phase, setPhase] = useState<PreviewPhase>("idle");
  const [webError, setWebError] = useState<string | null>(null);
  const [autoCreated, setAutoCreated] = useState(false);
  const [hotReloadEnabled, setHotReloadEnabled] = useState(true);
  const [hotReloadCount, setHotReloadCount] = useState(0);
  const webViewRef = useRef<WebView>(null);

  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hotDotAnim = useRef(new Animated.Value(1)).current;
  const flashBorderAnim = useRef(new Animated.Value(0)).current;

  // Track the fingerprint for hot reload
  const lastFingerprintRef = useRef(filesFingerprint);
  const hotReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCreatingRef = useRef(false);

  // Pulse animation for loading
  useEffect(() => {
    if (phase === "creating" || phase === "loading") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [phase, pulseAnim]);

  // Fade in when ready
  useEffect(() => {
    if (phase === "ready") {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [phase, fadeAnim]);

  // Hot dot blink when hot reload fires
  const blinkHotDot = useCallback(() => {
    Animated.sequence([
      Animated.timing(hotDotAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(hotDotAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [hotDotAnim]);

  // Flash green border around device frame on hot reload
  const flashBorder = useCallback(() => {
    flashBorderAnim.setValue(1);
    Animated.sequence([
      Animated.timing(flashBorderAnim, {
        toValue: 1,
        duration: 50,
        useNativeDriver: false,
      }),
      Animated.timing(flashBorderAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, [flashBorderAnim]);

  // Preview source
  const previewSource = useMemo(() => {
    if (lastPreview?.url && isHttpUrl(lastPreview.url)) {
      return { type: "url" as const, uri: lastPreview.url };
    }
    if (lastPreview?.html) {
      return { type: "html" as const, html: lastPreview.html };
    }
    return null;
  }, [lastPreview]);

  const baseOrigin = useMemo(() => {
    if (previewSource?.type !== "url") return null;
    try {
      const u = new URL(previewSource.uri);
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  }, [previewSource]);

  // Create preview
  const handleCreate = useCallback(async () => {
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;
    setPhase("creating");
    setWebError(null);
    try {
      const result = await createPreview();
      if (!result) {
        setPhase("error");
        setWebError("Preview konnte nicht erstellt werden.");
        return;
      }
      setPhase("loading");
      lastFingerprintRef.current = filesFingerprint;
    } catch (e: any) {
      setPhase("error");
      setWebError(e?.message || "Unbekannter Fehler");
    } finally {
      isCreatingRef.current = false;
    }
  }, [createPreview, filesFingerprint]);

  // Auto-create on mount
  useEffect(() => {
    if (autoCreated) return;
    if (isLoading || !projectData) return;
    if (previewSource) {
      lastFingerprintRef.current = filesFingerprint;
      return;
    }
    setAutoCreated(true);
    handleCreate();
  }, [isLoading, projectData, previewSource, autoCreated, handleCreate, filesFingerprint]);

  // === HOT RELOAD: Watch fingerprint changes ===
  useEffect(() => {
    if (!hotReloadEnabled) return;
    if (!previewSource) return;
    if (phase === "creating") return;
    if (filesFingerprint === lastFingerprintRef.current) return;

    // Fingerprint changed - debounce and recreate
    if (hotReloadTimerRef.current) {
      clearTimeout(hotReloadTimerRef.current);
    }

    hotReloadTimerRef.current = setTimeout(() => {
      lastFingerprintRef.current = filesFingerprint;
      blinkHotDot();
      flashBorder();
      setHotReloadCount((c) => c + 1);
      handleCreate();
    }, HOT_RELOAD_DEBOUNCE_MS);

    return () => {
      if (hotReloadTimerRef.current) {
        clearTimeout(hotReloadTimerRef.current);
      }
    };
  }, [filesFingerprint, hotReloadEnabled, previewSource, phase, handleCreate, blinkHotDot]);

  const handleReload = useCallback(() => {
    setWebError(null);
    if (webViewRef.current) {
      setPhase("loading");
      webViewRef.current.reload();
    }
  }, []);

  const handleReset = useCallback(() => {
    reset();
    setAutoCreated(false);
    setPhase("idle");
    setWebError(null);
    setHotReloadCount(0);
  }, [reset]);

  const handleCopy = useCallback(async () => {
    if (lastPreview?.url) {
      await Clipboard.setStringAsync(lastPreview.url);
      Alert.alert("Kopiert", "Preview-URL in Zwischenablage.");
    }
  }, [lastPreview]);

  const handleOpenExternal = useCallback(async () => {
    if (lastPreview?.url) {
      try {
        await Linking.openURL(lastPreview.url);
      } catch {
        Alert.alert("Fehler", "Browser konnte nicht geoeffnet werden.");
      }
    }
  }, [lastPreview]);

  const handleFullscreen = useCallback(() => {
    if (!lastPreview) return;
    navigation.navigate("PreviewFullscreen", {
      url: lastPreview.url ?? undefined,
      html: lastPreview.html ?? undefined,
      title: projectData?.name || "Preview",
    });
  }, [navigation, lastPreview, projectData?.name]);

  const handleShouldStartLoad = useCallback(
    (request: { url?: string }): boolean => {
      const requestUrl = String(request?.url || "");
      const mode = previewSource?.type ?? null;
      if (!mode) return false;
      const decision = decidePreviewNavigation({
        mode,
        baseOrigin,
        requestUrl,
      });
      if (decision.action === "allow") return true;
      if (decision.action === "external_direct") {
        setTimeout(() => {
          Linking.openURL(decision.url).catch(() => {});
        }, 0);
        return false;
      }
      return false;
    },
    [previewSource, baseOrigin],
  );

  // === RENDER ===

  if (isLoading) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
          <Text style={s.loadingText}>Projekt wird geladen...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!projectData) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <View style={s.center}>
          <Ionicons name="folder-open-outline" size={48} color={theme.palette.text.muted} />
          <Text style={s.emptyTitle}>Kein Projekt geladen</Text>
          <Text style={s.emptyText}>Oeffne oder erstelle zuerst ein Projekt.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* Toolbar */}
      <View style={s.toolbar}>
        <View style={s.toolbarLeft}>
          <Ionicons name="eye-outline" size={20} color={theme.palette.primary} />
          <View style={s.toolbarTitle}>
            <Text style={s.title}>Live Preview</Text>
            <Text style={s.subtitle} numberOfLines={1}>
              {projectData.name}
            </Text>
          </View>
        </View>

        <View style={s.toolbarActions}>
          {/* Hot Reload Toggle */}
          <Pressable
            style={[s.hotReloadBtn, hotReloadEnabled && s.hotReloadBtnOn]}
            onPress={() => setHotReloadEnabled((v) => !v)}
          >
            <Animated.View style={{ opacity: hotDotAnim }}>
              <View style={[s.hotDot, hotReloadEnabled && s.hotDotOn]} />
            </Animated.View>
            <Text style={[s.hotReloadLabel, hotReloadEnabled && s.hotReloadLabelOn]}>
              Hot
            </Text>
          </Pressable>

          <Pressable style={s.toolBtn} onPress={handleReload}>
            <Ionicons name="refresh-outline" size={18} color={theme.palette.text.primary} />
          </Pressable>
          {lastPreview?.url && (
            <Pressable style={s.toolBtn} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={16} color={theme.palette.text.primary} />
            </Pressable>
          )}
          {lastPreview?.url && (
            <Pressable style={s.toolBtn} onPress={handleOpenExternal}>
              <Ionicons name="open-outline" size={16} color={theme.palette.primary} />
            </Pressable>
          )}
          <Pressable style={s.toolBtn} onPress={handleFullscreen}>
            <Ionicons name="expand-outline" size={16} color={theme.palette.text.primary} />
          </Pressable>
        </View>
      </View>

      {/* Status Bar */}
      <View style={s.statusBar}>
        <View
          style={[
            s.statusDot,
            phase === "ready" && s.statusDotOk,
            phase === "error" && s.statusDotError,
            (phase === "creating" || phase === "loading") && s.statusDotLoading,
          ]}
        />
        <Text style={s.statusText}>
          {phase === "idle"
            ? "Bereit"
            : phase === "creating"
              ? "Preview wird erstellt..."
              : phase === "loading"
                ? "Wird geladen..."
                : phase === "ready"
                  ? "Live"
                  : "Fehler"}
        </Text>

        {(phase === "creating" || phase === "loading") && (
          <Animated.View style={{ opacity: pulseAnim }}>
            <ActivityIndicator size="small" color={theme.palette.primary} />
          </Animated.View>
        )}

        {hotReloadEnabled && hotReloadCount > 0 && (
          <View style={s.hotBadge}>
            <Text style={s.hotBadgeText}>{hotReloadCount}x reloaded</Text>
          </View>
        )}
      </View>

      {/* Main Content - Device Frame with Flash Border */}
      <View style={s.previewArea}>
        <Animated.View
          style={[
            s.deviceFrame,
            {
              borderColor: flashBorderAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [theme.palette.border, theme.palette.primary, theme.palette.primary],
              }),
              shadowOpacity: flashBorderAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.9],
              }),
              shadowColor: flashBorderAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["#000", theme.palette.primary],
              }),
              shadowRadius: flashBorderAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 24],
              }),
            },
          ]}
        >
          <View style={s.deviceNotch} />

          {previewSource ? (
            <Animated.View style={[s.webViewWrap, { opacity: phase === "ready" ? fadeAnim : 0.3 }]}>
              <WebView
                ref={webViewRef}
                style={s.webView}
                source={
                  previewSource.type === "url"
                    ? { uri: previewSource.uri }
                    : { html: previewSource.html }
                }
                originWhitelist={["*"]}
                setSupportMultipleWindows={false}
                javaScriptCanOpenWindowsAutomatically={false}
                onShouldStartLoadWithRequest={handleShouldStartLoad}
                onLoadStart={() => {
                  setPhase("loading");
                  setWebError(null);
                }}
                onLoadEnd={() => setPhase("ready")}
                onError={(e) => {
                  setPhase("error");
                  setWebError(e.nativeEvent?.description || "WebView Fehler");
                }}
                onHttpError={(e) => {
                  setPhase("error");
                  setWebError(`HTTP ${e.nativeEvent?.statusCode || "?"}`);
                }}
                mixedContentMode="always"
                startInLoadingState={false}
              />

              {(phase === "loading" || phase === "creating") && (
                <View style={s.loadingOverlay}>
                  <ActivityIndicator size="large" color={theme.palette.primary} />
                  <Text style={s.loadingOverlayText}>
                    {phase === "creating" ? "Preview wird generiert..." : "Laden..."}
                  </Text>
                </View>
              )}
            </Animated.View>
          ) : (
            <View style={s.emptyPreview}>
              {phase === "creating" ? (
                <>
                  <ActivityIndicator size="large" color={theme.palette.primary} />
                  <Text style={s.emptyPreviewText}>Preview wird erstellt...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="phone-portrait-outline" size={48} color={theme.palette.text.muted} />
                  <Text style={s.emptyPreviewText}>Noch keine Preview</Text>
                  <Pressable style={s.createBtn} onPress={handleCreate}>
                    <Ionicons name="play-outline" size={16} color={theme.palette.primary} />
                    <Text style={s.createBtnText}>Preview erstellen</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          <View style={s.deviceBottom} />
        </View>
      </View>

      {/* Error Bar */}
      {(webError || state.error) && (
        <View style={s.errorBar}>
          <Ionicons name="alert-circle" size={16} color={theme.palette.error} />
          <Text style={s.errorText} numberOfLines={2}>
            {webError || state.error}
          </Text>
          <Pressable style={s.errorRetryBtn} onPress={handleCreate}>
            <Text style={s.errorRetryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Bottom Bar */}
      <View style={s.bottomBar}>
        <Pressable
          style={[s.bottomBtn, state.isCreating && s.disabled]}
          onPress={handleCreate}
          disabled={state.isCreating}
        >
          <Ionicons name="refresh-outline" size={16} color={theme.palette.primary} />
          <Text style={s.bottomBtnText}>Neu erstellen</Text>
        </Pressable>
        <Pressable style={s.bottomBtn} onPress={handleReset}>
          <Ionicons name="trash-outline" size={16} color={theme.palette.text.secondary} />
          <Text style={[s.bottomBtnText, { color: theme.palette.text.secondary }]}>
            Zuruecksetzen
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.palette.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: { color: theme.palette.text.secondary, fontWeight: "700", fontSize: 14 },
  emptyTitle: { color: theme.palette.text.primary, fontSize: 18, fontWeight: "900" },
  emptyText: { color: theme.palette.text.secondary, fontSize: 14, textAlign: "center" },

  // Toolbar
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  toolbarLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  toolbarTitle: { flex: 1, minWidth: 0 },
  title: { color: theme.palette.text.primary, fontSize: 18, fontWeight: "900" },
  subtitle: { color: theme.palette.text.secondary, fontSize: 12 },
  toolbarActions: { flexDirection: "row", gap: 6, alignItems: "center" },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
    alignItems: "center",
    justifyContent: "center",
  },

  // Hot Reload Toggle
  hotReloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.background,
  },
  hotReloadBtnOn: {
    borderColor: theme.palette.primary,
    backgroundColor: "rgba(0,255,0,0.06)",
  },
  hotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.palette.text.disabled,
  },
  hotDotOn: {
    backgroundColor: theme.palette.primary,
    shadowColor: theme.palette.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  hotReloadLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.palette.text.muted,
    letterSpacing: 0.3,
  },
  hotReloadLabelOn: {
    color: theme.palette.primary,
  },

  // Status Bar
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.palette.backgroundDark,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.palette.text.disabled,
  },
  statusDotOk: {
    backgroundColor: theme.palette.success,
    shadowColor: theme.palette.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  statusDotError: { backgroundColor: theme.palette.error },
  statusDotLoading: { backgroundColor: theme.palette.warning },
  statusText: {
    flex: 1,
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "700",
  },
  hotBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,255,0,0.2)",
    backgroundColor: "rgba(0,255,0,0.06)",
  },
  hotBadgeText: {
    color: theme.palette.primary,
    fontSize: 10,
    fontWeight: "800",
  },

  // Preview Area
  previewArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: theme.palette.backgroundDark,
  },
  deviceFrame: {
    flex: 1,
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#111",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: theme.palette.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  deviceNotch: {
    height: 6,
    backgroundColor: "#0a0a0a",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginHorizontal: "30%",
    marginBottom: 2,
  },
  deviceBottom: {
    height: 4,
    backgroundColor: "#0a0a0a",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginHorizontal: "40%",
    marginTop: 2,
  },
  webViewWrap: { flex: 1 },
  webView: { flex: 1, backgroundColor: "#fff" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingOverlayText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  emptyPreview: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  emptyPreviewText: {
    color: theme.palette.text.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.palette.primary,
  },
  createBtnText: {
    color: theme.palette.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  // Error Bar
  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,68,68,0.08)",
    borderTopWidth: 1,
    borderTopColor: theme.palette.error,
  },
  errorText: { flex: 1, color: theme.palette.error, fontSize: 12, fontWeight: "600" },
  errorRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.palette.error,
  },
  errorRetryText: { color: theme.palette.error, fontSize: 12, fontWeight: "800" },

  // Bottom Bar
  bottomBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: "transparent",
  },
  bottomBtnText: {
    color: theme.palette.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  disabled: { opacity: 0.5 },
});
