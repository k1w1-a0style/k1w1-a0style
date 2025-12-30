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
import { useNavigation, useRoute } from "@react-navigation/native";
import { theme } from "../theme";

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 3) + "...";
}

export default function PreviewFullscreenScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const html: string | undefined = route?.params?.html;
  const title: string = route?.params?.title || "Preview";

  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  const isValid = useMemo(
    () => typeof html === "string" && html.length > 20,
    [html],
  );

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const onNavChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(!!navState.canGoBack);
  }, []);

  const onShouldStartLoadWithRequest = useCallback((req: any) => {
    const url = String(req?.url || "");

    // allow about:blank + local base
    if (url === "about:blank") return true;

    // allow http(s) only
    if (isHttpUrl(url)) return true;

    // block everything else (intent://, file://, etc.)
    Alert.alert(
      "Navigation blockiert",
      `Dieser Link kann nicht geöffnet werden:\n\n${truncate(url, 120)}`,
    );
    return false;
  }, []);

  const onError = useCallback((e: any) => {
    const msg = e?.nativeEvent?.description || "Unbekannter WebView-Fehler";
    setError(msg);
    setLoading(false);
  }, []);

  const onHttpError = useCallback((e: any) => {
    const status = e?.nativeEvent?.statusCode;
    const desc = e?.nativeEvent?.description || "";
    setError(`HTTP ${status}${desc ? `: ${desc}` : ""}`);
    setLoading(false);
  }, []);

  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  const share = useCallback(async () => {
    try {
      await Share.share({
        message: `Preview: ${title}`,
        title,
      });
    } catch {
      // ignore
    }
  }, [title]);

  // Android Back: wenn WebView zurück kann -> WebView back, sonst Screen back
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });

    return () => sub.remove();
  }, [canGoBack]);

  if (!isValid) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable style={styles.backBtn} onPress={goBack}>
            <Text style={styles.backBtnText}>← Zurück</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        <View style={styles.center}>
          <Text style={styles.bigIcon}>⚠️</Text>
          <Text style={styles.title}>Keine Preview-Daten</Text>
          <Text style={styles.sub}>
            Es wurde kein HTML übergeben. Geh zurück und erstelle die Preview
            neu.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backBtnText}>← Zurück</Text>
        </Pressable>

        <View style={styles.titleWrap}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.topSub} numberOfLines={1}>
            In-App Sandpack (kein Browser)
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.iconBtn} onPress={share}>
            <Text style={styles.iconTxt}>📤</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={reload}>
            <Text style={styles.iconTxt}>↻</Text>
          </Pressable>
        </View>
      </View>

      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText} numberOfLines={2}>
            ⚠️ {error}
          </Text>
          <Pressable style={styles.errorBtn} onPress={reload}>
            <Text style={styles.errorBtnText}>Neu laden</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.webWrap}>
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html, baseUrl: "https://local.preview/" }}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onNavigationStateChange={onNavChange}
          onLoadStart={() => {
            setLoading(true);
            setError(null);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={onError}
          onHttpError={onHttpError}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          allowsBackForwardNavigationGestures={Platform.OS === "ios"}
          mixedContentMode={Platform.OS === "android" ? "always" : undefined}
          style={styles.web}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.palette.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    minWidth: 90,
    alignItems: "center",
  },
  backBtnText: { color: theme.palette.text.primary, fontWeight: "900" },
  titleWrap: { flex: 1, minWidth: 0 },
  topTitle: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 16,
  },
  topSub: { color: theme.palette.text.secondary, fontSize: 11, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTxt: { fontSize: 18 },

  errorBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffebee",
    borderBottomWidth: 1,
    borderBottomColor: "#d32f2f",
  },
  errorText: { flex: 1, color: "#c62828", fontWeight: "800", fontSize: 12 },
  errorBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#d32f2f",
  },
  errorBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  webWrap: { flex: 1, backgroundColor: "#000" },
  web: { flex: 1, backgroundColor: "#000" },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { color: "#fff", fontWeight: "900" },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  bigIcon: { fontSize: 64 },
  title: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 18,
    textAlign: "center",
  },
  sub: {
    color: theme.palette.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
