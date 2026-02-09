// screens/CodeScreen/components/WebCodeEditor.tsx
import React, { useMemo, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  placeholderColor?: string;
  hasErrors?: boolean;
  tabSize?: number;
  changeThrottleMs?: number;
};

/**
 * Offline-safe WebView textarea editor.
 * Goal: keep CodeScreen UI basically the same, but avoid RN TextInput perf issues on large files.
 *
 * Notes:
 * - We don't inline `value` into HTML directly (escaping + perf). We send it via injected JS.
 * - We use the *official* RN WebView bridge: window.ReactNativeWebView.postMessage(...)
 * - We avoid cursor-jumps by only applying incoming value if it differs.
 */
export const WebCodeEditor: React.FC<Props> = ({
  value,
  onChangeText,
  readOnly = false,
  placeholder = "// Code eingeben...",
  placeholderColor = "#7a7a7a",
  hasErrors = false,
  tabSize = 2,
  changeThrottleMs = 120,
}) => {
  const lastSentFromRN = useRef<string | null>(null);

  const html = useMemo(() => {
    const editorBg = "#0f0f10";
    const fg = "#e8e8e8";
    const border = hasErrors ? "#ff4d4f" : "#2a2a2e";
    const ro = readOnly ? "true" : "false";
    const throttle = Math.max(0, Math.floor(changeThrottleMs));
    const tabs = Math.max(1, Math.floor(tabSize));

    // IMPORTANT: keep this HTML fully self-contained (no external assets).
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  html, body { height: 100%; margin: 0; padding: 0; background: ${editorBg}; }
  * { box-sizing: border-box; }
  #wrap { height: 100%; padding: 0; }
  textarea {
    width: 100%;
    height: 100%;
    padding: 14px 12px;
    border: 1px solid ${border};
    background: ${editorBg};
    color: ${fg};
    outline: none;
    resize: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 13px;
    line-height: 18px;
    tab-size: ${tabs};
    -webkit-text-size-adjust: 100%;
  }
  textarea::placeholder { color: ${placeholderColor}; opacity: 1; }
</style>
</head>
<body>
  <div id="wrap">
    <textarea id="ta" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
      placeholder="${placeholder.replace(/"/g, "&quot;")}"></textarea>
  </div>

<script>
(function(){
  const ta = document.getElementById("ta");
  if (!ta) return;

  ta.readOnly = (${ro} === true);

  // throttle helper
  let t = null;
  const emit = () => {
    if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) return;
    try { window.ReactNativeWebView.postMessage(ta.value); } catch(e) {}
  };
  const scheduleEmit = () => {
    if (${ro} === true) return;
    if (t) return;
    t = setTimeout(() => { t = null; emit(); }, ${throttle});
  };

  ta.addEventListener("input", scheduleEmit);

  // Apply value coming from RN (initial load + file switch).
  // Try hard to keep cursor stable.
  const applyIncoming = (next) => {
    try {
      if (typeof next !== "string") return;
      if (ta.value === next) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const prevLen = ta.value.length;

      ta.value = next;

      // best-effort selection restore
      const delta = next.length - prevLen;
      const ns = Math.max(0, Math.min(next.length, start + delta));
      const ne = Math.max(0, Math.min(next.length, end + delta));
      ta.setSelectionRange(ns, ne);
    } catch(e) {}
  };

  const onMsg = (e) => {
    const data = e && e.data;
    applyIncoming(data);
  };

  document.addEventListener("message", onMsg);
  window.addEventListener("message", onMsg);

  // focus on load (keeps current UX similar to TextInput edit mode)
  setTimeout(() => { try { ta.focus(); } catch(e) {} }, 0);
})();
</script>
</body>
</html>`;
  }, [readOnly, placeholder, placeholderColor, hasErrors, tabSize, changeThrottleMs]);

  const injectedJavaScriptBeforeContentLoaded = useMemo(() => {
    // Send initial content into the webview without causing a full reload.
    // We dispatch a message event that the HTML listens to.
    // NOTE: JSON.stringify handles escaping safely.
    const v = JSON.stringify(value ?? "");
    lastSentFromRN.current = value ?? "";
    return `
      (function(){
        try {
          var v = ${v};
          document.dispatchEvent(new MessageEvent("message", { data: v }));
          window.dispatchEvent(new MessageEvent("message", { data: v }));
        } catch(e) {}
      })();
      true;
    `;
  }, [value]);

  const handleMessage = (e: WebViewMessageEvent) => {
    const next = String(e?.nativeEvent?.data ?? "");
    // ignore echo caused by RN sending same value
    if (lastSentFromRN.current !== null && next === lastSentFromRN.current) return;
    onChangeText(next);
  };

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={handleMessage}
        injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
        // keep scroll behavior controlled by parent container; textarea handles its own scroll
        scrollEnabled={false}
        keyboardDisplayRequiresUserAction={false}
        setSupportMultipleWindows={false}
        // safety: block navigation
        onShouldStartLoadWithRequest={() => false}
      />
    </View>
  );
};

export default WebCodeEditor;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
