import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import theme from "../../../theme";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  hasErrors?: boolean;
  placeholder?: string;
  placeholderColor?: string;
  readOnly?: boolean;
  /** milliseconds: throttle outbound value messages */
  changeThrottleMs?: number;
  tabSize?: number;
};

type InboundMsg =
  | { t: "ready" }
  | { t: "value"; value: string }
  | { t: "focus"; focused: boolean };

type OutboundMsg =
  | { t: "set"; value: string }
  | { t: "cmd"; cmd: "undo" | "redo" };

function safeJsonParse(input: string): any {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export const WebCodeEditor = ({
  value,
  onChangeText,
  hasErrors = false,
  placeholder = "",
  placeholderColor = "#888",
  readOnly = false,
  changeThrottleMs = 60,
  tabSize = 2,
}: Props) => {
  // NOTE: Using static theme (no hook) for testability.
  const webRef = useRef<WebView>(null);

  // Bridge state (kept in refs to avoid re-render loops)
  const isFocusedRef = useRef(false);
  const isReadyRef = useRef(false);
  const lastSentToWebRef = useRef<string>("");
  const lastSentFromWebRef = useRef<string>("");

  const [readyUi, setReadyUi] = useState(false);

  const bg = theme.palette.background;
  const textColor = theme.palette.text.primary;
const textSecondary = theme.palette.text.secondary;
const border = hasErrors ? theme.palette.error : theme.palette.border;

  const html = useMemo(() => {
    // IMPORTANT: do NOT embed `value` into HTML (avoids injection + quoting edge cases).
    // We always send content via postMessage after the WebView signals {t:'ready'}.
    const tabSpaces = " ".repeat(Math.max(1, tabSize));

    const css = `
      html, body { height: 100%; width: 100%; margin: 0; padding: 0; background: ${bg}; }
      * { box-sizing: border-box; }
      #root { height: 100%; width: 100%; }
      textarea {
        width: 100%; height: 100%;
        border: 0; outline: 0; resize: none;
        padding: 14px 14px 14px 14px;
        background: ${bg};
        color: ${textColor};
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 13px;
        line-height: 19px;
        caret-color: ${textColor};
        -webkit-text-size-adjust: 100%;
      }
      textarea::placeholder { color: ${placeholderColor}; opacity: 1; }
    `;

    // Web-side script
    const js = `
      (function() {
        var ta = document.getElementById('ta');
        var THROTTLE = ${Math.max(10, Math.floor(changeThrottleMs))};
        var READONLY = ${readOnly ? "true" : "false"};
        var lastSent = '';
        var timer = null;

        function post(obj) {
          try {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(obj));
          } catch (e) {}
        }

        function setValue(v) {
          if (typeof v !== 'string') v = '';
          if (ta.value === v) return;
          var start = ta.selectionStart;
          var end = ta.selectionEnd;
          ta.value = v;
          // Keep cursor reasonably stable when not focused; when focused RN won't push updates.
          try { ta.setSelectionRange(start, end); } catch (e) {}
        }

        function scheduleSend() {
          if (READONLY) return;
          if (timer) return;
          timer = setTimeout(function() {
            timer = null;
            var v = ta.value;
            if (v === lastSent) return;
            lastSent = v;
            post({ t: 'value', value: v });
          }, THROTTLE);
        }

        ta.readOnly = READONLY;

        ta.addEventListener('input', scheduleSend);
        ta.addEventListener('focus', function(){ post({ t: 'focus', focused: true }); });
        ta.addEventListener('blur', function(){ post({ t: 'focus', focused: false }); });

        ta.addEventListener('keydown', function(e){
          if (READONLY) return;
          if (e.key === 'Tab') {
            e.preventDefault();
            var start = ta.selectionStart;
            var end = ta.selectionEnd;
            var v = ta.value;
            ta.value = v.substring(0, start) + ${JSON.stringify(tabSpaces)} + v.substring(end);
            ta.selectionStart = ta.selectionEnd = start + ${tabSpaces.length};
            scheduleSend();
          }
        });

        function handleMessage(data) {
          if (!data) return;
          var msg = null;
          try { msg = JSON.parse(data); } catch (e) { return; }
          if (!msg || !msg.t) return;

          if (msg.t === 'set') {
            setValue(String(msg.value || ''));
            return;
          }
          if (msg.t === 'cmd') {
            if (msg.cmd === 'undo') {
              document.execCommand('undo');
              scheduleSend();
            }
            if (msg.cmd === 'redo') {
              document.execCommand('redo');
              scheduleSend();
            }
          }
        }

        // RN->Web message delivery differs between iOS/Android.
        window.addEventListener('message', function(e){ handleMessage(e.data); });
        document.addEventListener('message', function(e){ handleMessage(e.data); });

        post({ t: 'ready' });
      })();
    `;

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
          <style>${css}</style>
        </head>
        <body>
          <div id="root">
            <textarea id="ta" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder=${JSON.stringify(placeholder)}></textarea>
          </div>
          <script>${js}</script>
        </body>
      </html>`;
  }, [bg, changeThrottleMs, placeholder, placeholderColor, readOnly, tabSize, textColor]);

  const postToWeb = useCallback((msg: OutboundMsg) => {
    const data = JSON.stringify(msg);
    const postMessageFn: undefined | ((d: string) => void) = (webRef.current as any)?.postMessage;
    if (typeof postMessageFn === "function") {
      postMessageFn(data);
      return;
    }
    // Fallback: inject JS to dispatch a message event
    webRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(data)}}));true;`,
    );
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const data = event.nativeEvent.data;
      const parsed = safeJsonParse(data) as InboundMsg | null;
      if (!parsed || typeof parsed !== "object") return;

      if (parsed.t === "ready") {
        isReadyRef.current = true;
        setReadyUi(true);
        // Send current value once the editor is ready.
        lastSentToWebRef.current = value;
        postToWeb({ t: "set", value });
        return;
      }

      if (parsed.t === "focus") {
        isFocusedRef.current = !!parsed.focused;
        return;
      }

      if (parsed.t === "value") {
        const v = parsed.value ?? "";
        lastSentFromWebRef.current = v;
        onChangeText(v);
      }
    },
    [onChangeText, postToWeb, value],
  );

  // Push external value changes into the WebView when it isn't actively focused.
  useEffect(() => {
    if (!isReadyRef.current) return;

    // If the change came from the editor itself, don't echo it back.
    if (value === lastSentFromWebRef.current) return;

    // Avoid stomping the cursor while typing.
    if (isFocusedRef.current) return;

    if (value === lastSentToWebRef.current) return;

    lastSentToWebRef.current = value;
    postToWeb({ t: "set", value });
  }, [postToWeb, value]);

  const runCmd = useCallback(
    (cmd: "undo" | "redo") => {
      if (!isReadyRef.current) return;
      postToWeb({ t: "cmd", cmd });
    },
    [postToWeb],
  );

  return (
    <View style={[styles.container, { borderColor: border, backgroundColor: bg }]}> 
      {/* Mini toolbar: tiny & unobtrusive (no split-screen) */}
      <View style={[styles.toolbar, { borderBottomColor: theme.palette.border }]}> 
        <Pressable
          accessibilityRole="button"
          onPress={() => runCmd("undo")}
          style={({ pressed }) => [styles.toolBtn, pressed && styles.toolBtnPressed]}
        >
          <Text style={[styles.toolText, { color: theme.palette.text.secondary }]}>↶</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => runCmd("redo")}
          style={({ pressed }) => [styles.toolBtn, pressed && styles.toolBtnPressed]}
        >
          <Text style={[styles.toolText, { color: theme.palette.text.secondary }]}>↷</Text>
        </Pressable>
        {!readyUi ? (
          <Text style={[styles.readyText, { color: theme.palette.text.secondary }]}>Editor…</Text>
        ) : null}
      </View>

      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        // Allow initial load, block external navigations.
        onShouldStartLoadWithRequest={(req) => {
          const url = req.url || "";
          if (url === "about:blank") return true;
          if (url.startsWith("data:text/html")) return true;
          return false;
        }}
        setSupportMultipleWindows={false}
        // Make it look like a native editor area.
        style={{ backgroundColor: bg }}
      />
    </View>
  );
};

export default WebCodeEditor;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  toolbar: {
    height: 34,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
  },
  toolBtn: {
    height: 26,
    minWidth: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  toolBtnPressed: {
    opacity: 0.75,
  },
  toolText: {
    fontSize: 16,
    fontWeight: "600",
  },
  readyText: {
    marginLeft: 6,
    fontSize: 12,
  },
});
