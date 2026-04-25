import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import theme from "../../../theme";
import { useWebViewCrashRecovery } from "../../shared/preview/useWebViewCrashRecovery";
import { WebCodeEditorToolbar } from "./WebCodeEditorToolbar";
import {
  buildInjectedMessageEventScript,
  MAX_BRIDGE_PAYLOAD,
  parseBridgeMessage,
  isInboundMsg,
} from "./WebCodeEditor.bridge";

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

type OutboundMsg =
  | { t: "set"; value: string }
  | { t: "cmd"; cmd: "undo" | "redo" };

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
  const webRef = useRef<WebView>(null);

  // Bridge state
  const isReadyRef = useRef(false);
  const lastSentToWebRef = useRef<string>("");
  const lastSentFromWebRef = useRef<string>("");

  const [readyUi, setReadyUi] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const bg = theme.palette.background;
  const textColor = theme.palette.text.primary;
  const border = hasErrors ? theme.palette.error : theme.palette.border;

  const html = useMemo(() => {
    // IMPORTANT: do NOT embed `value` into HTML.
    // We always send content via postMessage after the WebView signals {t:'ready'}.
    const tabSpaces = " ".repeat(Math.max(1, tabSize));

    const css = `
      html, body { height: 100%; width: 100%; margin: 0; padding: 0; background: ${bg}; }
      * { box-sizing: border-box; }
      #root { height: 100%; width: 100%; }
      textarea {
        width: 100%; height: 100%;
        border: 0; outline: 0; resize: none;
        padding: 14px;
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

    const js = `
      (function() {
        var ta = document.getElementById('ta');
        var THROTTLE = ${Math.max(10, Math.floor(changeThrottleMs))};
        var READONLY = ${readOnly ? "true" : "false"};
        var lastSent = '';
        var timer = null;
        var didWarnInboundParse = false;
        var didWarnInboundSchema = false;

        function post(obj) {
          try {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(obj));
          } catch (e) { console.warn("[WebCodeEditor] postMessage failed", e); }
        }

        function setValue(v) {
          if (typeof v !== 'string') v = '';
          if (ta.value === v) return;
          var start = ta.selectionStart;
          var end = ta.selectionEnd;
          ta.value = v;
          try { ta.setSelectionRange(start, end); } catch (e) { console.warn("[WebCodeEditor] setSelectionRange failed", e); }
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
          try { msg = JSON.parse(data); } catch (e) {
            if (!didWarnInboundParse) {
              didWarnInboundParse = true;
              console.warn("[WebCodeEditor] dropped malformed inbound postMessage payload");
            }
            return;
          }
          if (!msg || !msg.t) {
            if (!didWarnInboundSchema) {
              didWarnInboundSchema = true;
              console.warn("[WebCodeEditor] dropped inbound postMessage with missing type");
            }
            return;
          }

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
    const postMessageFn = webRef.current?.postMessage;

    if (typeof postMessageFn === "function") {
      postMessageFn(data);
      return;
    }

    // Fallback: inject JS to dispatch a message event
    webRef.current?.injectJavaScript(
      buildInjectedMessageEventScript(data),
    );
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const raw = event.nativeEvent.data;
      const msg = parseBridgeMessage(raw);
      if (!msg) return;

      if (msg.t === "ready") {
        isReadyRef.current = true;
        setReadyUi(true);
        lastSentToWebRef.current = value;
        postToWeb({ t: "set", value });
        return;
      }

      if (msg.t === "focus") {
        setIsFocused(msg.focused);
        return;
      }

      if (msg.t === "value") {
        lastSentFromWebRef.current = msg.value;
        onChangeText(msg.value);
      }
    },
    [onChangeText, postToWeb, value],
  );

  // Push external value changes into the WebView when it isn't actively focused.
  useEffect(() => {
    if (!isReadyRef.current) return;
    if (value === lastSentFromWebRef.current) return;
    if (isFocused) return;
    if (value === lastSentToWebRef.current) return;

    lastSentToWebRef.current = value;
    postToWeb({ t: "set", value });
  }, [postToWeb, value, isFocused]);

  const runCmd = useCallback(
    (cmd: "undo" | "redo") => {
      if (!isReadyRef.current) return;
      postToWeb({ t: "cmd", cmd });
    },
    [postToWeb],
  );

  const { handleContentProcessDidTerminate, handleRenderProcessGone } =
    useWebViewCrashRecovery({
      webViewRef: webRef,
      isMountedRef,
      onError: () => {
        setReadyUi(false);
        setIsFocused(false);
        isReadyRef.current = false;
        setReloadNonce((prev) => prev + 1);
      },
      onLoadingChange: () => {
        setReadyUi(false);
      },
    });

  return (
    <View style={[styles.container, { borderColor: border, backgroundColor: bg }]}>
      <WebCodeEditorToolbar readyUi={readyUi} onRunCmd={runCmd} />

      <WebView
        key={`web-code-editor-${reloadNonce}`}
        ref={webRef}
        originWhitelist={["about:blank", "data:*"]}
        source={{ html }}
        onMessage={handleMessage}
        onContentProcessDidTerminate={handleContentProcessDidTerminate}
        onRenderProcessGone={handleRenderProcessGone}
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
        style={{ backgroundColor: bg }}
      />
    </View>
  );
};

export default WebCodeEditor;

// Exported for unit testing.
export { parseBridgeMessage, isInboundMsg, MAX_BRIDGE_PAYLOAD };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
});
