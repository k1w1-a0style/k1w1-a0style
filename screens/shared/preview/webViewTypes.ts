// screens/shared/preview/webViewTypes.ts
//
// Minimale lokale WebView Event-Typen.
// react-native-webview@13.15.x exportiert diese nicht sauber.
// Beide Preview-Screens importieren von hier — kein Duplikat mehr.

export type WebViewShouldStartLoadRequest = { url?: string };
export type WebViewErrorEvent = { nativeEvent?: { description?: string } };
export type WebViewHttpErrorEvent = {
  nativeEvent?: { statusCode?: number; description?: string };
};
export type WebViewContentProcessDidTerminateEvent = { nativeEvent?: unknown };
export type WebViewRenderProcessGoneEvent = { nativeEvent?: { didCrash?: boolean } };
