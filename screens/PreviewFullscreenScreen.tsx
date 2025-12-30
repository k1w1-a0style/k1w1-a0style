// screens/PreviewFullscreenScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Share,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { theme } from "../theme";
import { isHttpUrl, truncateUrl } from "../utils/url";
import type { RootStackParamList } from "../types/preview";

type PreviewFullscreenRouteProp = RouteProp<
  RootStackParamList,
  "PreviewFullscreen"
>;
type PreviewFullscreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "PreviewFullscreen"
>;

export default function PreviewFullscreenScreen() {
  const navigation = useNavigation<PreviewFullscreenNavigationProp>();
  const route = useRoute<PreviewFullscreenRouteProp>();

  const title = route.params?.title ?? "Preview";
  const url = route.params?.url;
  const html = route.params?.html ?? "";
  const baseUrl = route.params?.baseUrl ?? "https://local.preview/";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const isMountedRef = useRef(true);

  const mode = useMemo<"html" | "url" | "none">(() => {
    if (html.trim().length > 0) return "html";
    if (typeof url === "string" && url.length > 0 && isHttpUrl(url))
      return "url";
    return "none";
  }, [html, url]);

  const headerSubtitle = useMemo(() => {
    if (mode === "html") return "Local HTML Preview";
    if (mode === "url" && url) return truncateUrl(url, 60);
    return "Keine Preview";
  }, [mode, url]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleWebViewGoBack = useCallback(() => {
    if (canGoBack) webViewRef.current?.goBack();
  }, [canGoBack]);

  const handleWebViewGoForward = useCallback(() => {
    if (canGoForward) webViewRef.current?.goForward();
  }, [canGoForward]);

  const handleReload = useCallback(() => {
    webViewRef.current?.reload();
    setError(null);
  }, []);

  const handleShare = useCallback(async () => {
    try {
      if (mode === "url" && url) {
        await Share.share({
          message: `Schau dir diese Preview an: ${url}`,
          url,
          title,
        });
      } else {
        await Share.share({
          message: `Preview: ${title}`,
          title,
        });
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  }, [mode, url, title]);

  const handleLoadStart = useCallback(() => {
    if (!isMountedRef.current) return;
    setLoading(true);
    setError(null);
  }, []);

  const handleLoadEnd = useCallback(() => {
    if (!isMountedRef.current) return;
    setLoading(false);
  }, []);

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      if (!isMountedRef.current) return;
      setCanGoBack(navState.canGoBack);
      setCanGoForward(navState.canGoForward);
    },
    [],
  );

  const handleShouldStartLoad = useCallback((request: any): boolean => {
    const requestUrl = String(request?.url || "");

    if (!isHttpUrl(requestUrl)) {
      Alert.alert(
        "Navigation blockiert",
        `Dieser Link kann nicht geöffnet werden:\n\n${truncateUrl(requestUrl, 90)}`,
        [{ text: "OK" }],
      );
      return false;
    }

    return true;
  }, []);

  const handleError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    const errorMessage =
      nativeEvent?.description || "Unbekannter WebView-Fehler";

    if (!isMountedRef.current) return;
    setError(errorMessage);
    setLoading(false);

    console.error("WebView Error:", nativeEvent);
  }, []);

  const handleHttpError = useCallback(
    (syntheticEvent: any) => {
      const { nativeEvent } = syntheticEvent;
      const statusCode = nativeEvent?.statusCode;
      const description = nativeEvent?.description || "";

      if (!isMountedRef.current) return;

      if (statusCode === 404) {
        setError("HTTP 404: Preview abgelaufen oder nicht gefunden");
        setLoading(false);

        Alert.alert(
          "Preview nicht gefunden",
          "Die Preview ist abgelaufen oder ungültig. Bitte neu erstellen.",
          [
            { text: "Zurück", onPress: handleGoBack, style: "cancel" },
            { text: "Neu laden", onPress: handleReload },
          ],
        );
        return;
      }

      setError(`HTTP ${statusCode}${description ? `: ${description}` : ""}`);
      setLoading(false);
    },
    [handleGoBack, handleReload],
  );

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) {
        handleWebViewGoBack();
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [canGoBack, handleWebViewGoBack]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (mode === "none") {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={handleGoBack}>
            <Text style={styles.backButtonText}>← Zurück</Text>
          </Pressable>

          <View style={styles.titleContainer}>
            <Text style={styles.topTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.topSubtitle} numberOfLines={1}>
              Keine gültige URL/HTML
            </Text>
          </View>

          <View style={{ width: 110 }} />
        </View>

        <View style={styles.errorState}>
          <Text style={styles.errorStateIcon}>⚠️</Text>
          <Text style={styles.errorStateTitle}>Keine gültige Preview</Text>
          <Text style={styles.errorStateText}>
            Es wurde weder eine gültige URL noch HTML übergeben.
            {"\n"}Gehe zurück und erstelle die Preview neu.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={handleGoBack}>
          <Text style={styles.backButtonText}>← Zurück</Text>
        </Pressable>

        <View style={styles.titleContainer}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.topSubtitle} numberOfLines={1}>
            {headerSubtitle}
          </Text>
        </View>

        <View style={styles.actions}>
          {canGoBack && (
            <Pressable style={styles.iconButton} onPress={handleWebViewGoBack}>
              <Text style={styles.iconText}>◀</Text>
            </Pressable>
          )}

          {canGoForward && (
            <Pressable
              style={styles.iconButton}
              onPress={handleWebViewGoForward}
            >
              <Text style={styles.iconText}>▶</Text>
            </Pressable>
          )}

          <Pressable style={styles.iconButton} onPress={handleShare}>
            <Text style={styles.iconText}>📤</Text>
          </Pressable>

          <Pressable style={styles.iconButton} onPress={handleReload}>
            <Text style={styles.iconText}>↻</Text>
          </Pressable>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠️ {error}</Text>
          <Pressable onPress={handleReload} style={styles.errorBannerButton}>
            <Text style={styles.errorBannerButtonText}>Neu laden</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          allowsBackForwardNavigationGestures={Platform.OS === "ios"}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          onHttpError={handleHttpError}
          startInLoadingState
          style={styles.webView}
          mixedContentMode={Platform.OS === "android" ? "always" : undefined}
          source={mode === "html" ? { html, baseUrl } : { uri: url! }}
        />

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.palette.primary} />
            <Text style={styles.loadingText}>Lade Preview…</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.palette.background },
  topBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    minWidth: 90,
    alignItems: "center",
  },
  backButtonText: {
    color: theme.palette.text.primary,
    fontWeight: "800",
    fontSize: 14,
  },
  titleContainer: { flex: 1, minWidth: 0 },
  topTitle: {
    color: theme.palette.text.primary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  topSubtitle: {
    color: theme.palette.text.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 18 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffebee",
    borderBottomWidth: 1,
    borderBottomColor: "#d32f2f",
    gap: 10,
  },
  errorBannerText: {
    flex: 1,
    color: "#c62828",
    fontSize: 13,
    fontWeight: "700",
  },
  errorBannerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#d32f2f",
  },
  errorBannerButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  webViewContainer: { flex: 1, backgroundColor: "#000", position: "relative" },
  webView: { flex: 1, backgroundColor: "#000" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  errorStateIcon: { fontSize: 64, marginBottom: 8 },
  errorStateTitle: {
    color: theme.palette.text.primary,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  errorStateText: {
    color: theme.palette.text.secondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 400,
  },
});
