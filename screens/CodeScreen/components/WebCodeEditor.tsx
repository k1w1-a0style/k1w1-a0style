import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderColor?: string;
  hasErrors?: boolean;
  readOnly?: boolean;

  /**
   * Keeps the visual layout unchanged by default.
   * If you want a tiny, optional editor toolbar (undo/redo), enable this.
   */
  enableToolbar?: boolean;
};

type IncomingMessage =
  | string
  | {
      __t: "value";
      value: string;
    }
  | {
      __t: "cmd";
      cmd: "undo" | "redo";
    };

const safeParse = (raw: string): IncomingMessage => {
  // Most messages are just raw text (content updates).
  // We only parse JSON if it looks like it.
  const t = raw.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return raw;
  try {
    return JSON.parse(t) as IncomingMessage;
  } catch {
    return raw;
  }
};

const makeCmd = (cmd: "undo" | "redo"): string =>
  JSON.stringify({ __t: "cmd", cmd });

export function WebCodeEditor({
  value,
  onChangeText,
  placeholder = "",
  placeholderColor = "#8892a6",
  hasErrors = false,
  readOnly = false,
  enableToolbar = false,
}: Props) {
  const webViewRef = useRef<WebView>(null);

  // We keep a local copy so we can apply external updates from RN -> WebView safely.
  const [localValue, setLocalValue] = useState(value);

  // Track focus so we don't fight the user's typing with incoming props.
  const [isFocused, setIsFocused] = useState(false);

  // Whenever the parent value changes and the editor isn't focused, sync it.
  useEffect(() => {
    if (!isFocused) setLocalValue(value);
  }, [value, isFocused]);

  const sendCommand = useCallback((cmd: "undo" | "redo") => {
    webViewRef.current?.postMessage(makeCmd(cmd));
  }, []);

  // Send external value changes into the WebView.
  // We do this via postMessage to a small bridge in the HTML.
  useEffect(() => {
    if (isFocused) return;
    try {
      webViewRef.current?.postMessage(
        JSON.stringify({ __t: "value", value: localValue }),
      );
    } catch {
      // no-op
    }
  }, [localValue, isFocused]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const msg = safeParse(String(event.nativeEvent.data ?? ""));

      // The WebView sends us raw value updates (string), or structured messages.
      if (typeof msg === "string") {
        setLocalValue(msg);
        onChangeText(msg);
        return;
      }

      if (msg && typeof msg === "object" && "__t" in msg) {
        if (msg.__t === "value") {
          const next = msg.value ?? "";
          setLocalValue(next);
          onChangeText(next);
          return;
        }

        // commands are handled inside the WebView; nothing to do here
      }
    },
    [onChangeText],
  );

  const injectedJavaScript = useMemo(() => {
    // IMPORTANT:
    // - Use a plain textarea for performance.
    // - Keep layout stable (no split views, no heavy libs).
    // - Provide a small bridge to:
    //    * receive external value updates from RN
    //    * execute commands like undo/redo
    //    * report changes back to RN

    // eslint-disable-next-line no-useless-escape
    const esc = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;");

    // Escape value for initial HTML render.
    const initialValue = esc(localValue);

    return `
      (function() {
        const rn = window.ReactNativeWebView;

        function safeParse(raw) {
          if (!raw || typeof raw !== 'string') return raw;
          const t = raw.trim();
          if (!t.startsWith('{') || !t.endsWith('}')) return raw;
          try { return JSON.parse(t); } catch (e) { return raw; }
        }

        function applyIncoming(data) {
          const msg = safeParse(data);

          // External value update from RN
          if (msg && typeof msg === 'object' && msg.__t === 'value') {
            const next = String(msg.value ?? '');
            if (ta.value !== next) {
              const start = ta.selectionStart;
              const end = ta.selectionEnd;
              ta.value = next;
              // best-effort: keep cursor in range
              try {
                ta.selectionStart = Math.min(start, ta.value.length);
                ta.selectionEnd = Math.min(end, ta.value.length);
              } catch (e) {}
            }
            return;
          }

          // Commands
          if (msg && typeof msg === 'object' && msg.__t === 'cmd') {
            const cmd = String(msg.cmd || '');
            try {
              ta.focus();
              if (cmd === 'undo' || cmd === 'redo') {
                document.execCommand(cmd);
              }
            } catch (e) {}
            return;
          }

          // Raw string fallback: treat as full value replacement.
          const next = (typeof msg === 'string') ? msg : String(msg ?? '');
          if (ta.value !== next) ta.value = next;
        }

        const html = 
          '<!doctype html>'+
          '<html><head>'+
            '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />'+
            '<style>'+
              'html,body{height:100%;margin:0;padding:0;background:transparent;}' +
              '#wrap{height:100%;padding:0;margin:0;}' +
              'textarea{' +
                'width:100%;height:100%;border:0;outline:none;resize:none;' +
                'background:transparent;color:${hasErrors ? "#ff6b6b" : "#e5e7eb"};' +
                'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;' +
                'font-size:14px;line-height:20px;' +
                'padding:14px 14px 14px 14px;box-sizing:border-box;' +
              '}' +
              'textarea::placeholder{color:${placeholderColor};}' +
            '</style>'+
          '</head><body>'+
            '<div id="wrap">' +
              '<textarea id="ta" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" placeholder="${esc(placeholder)}">${initialValue}</textarea>' +
            '</div>' +
          '</body></html>';

        document.open();
        document.write(html);
        document.close();

        const ta = document.getElementById('ta');
        if (!ta) return;

        ta.readOnly = ${readOnly ? "true" : "false"};

        let lastSent = ta.value;
        let sendTimer = null;

        function sendValueIfChanged() {
          const v = ta.value;
          if (v === lastSent) return;
          lastSent = v;
          try { rn.postMessage(v); } catch (e) {}
        }

        function scheduleSend() {
          if (sendTimer) return;
          sendTimer = setTimeout(function(){
            sendTimer = null;
            sendValueIfChanged();
          }, 120);
        }

        ta.addEventListener('input', scheduleSend);
        ta.addEventListener('blur', function(){ try { rn.postMessage(JSON.stringify({__t:'focus', focused:false})); } catch(e) {} });
        ta.addEventListener('focus', function(){ try { rn.postMessage(JSON.stringify({__t:'focus', focused:true})); } catch(e) {} });

        // Bridge for RN -> WebView updates.
        document.addEventListener('message', function(ev) { applyIncoming(ev.data); });
        window.addEventListener('message', function(ev) { applyIncoming(ev.data); });

        // Initial focus state / initial sync.
        try { rn.postMessage(JSON.stringify({__t:'ready'})); } catch(e) {}
      })();
      true;
    `;
  }, [hasErrors, localValue, placeholder, placeholderColor, readOnly]);

  const toolbar = enableToolbar ? (
    <View pointerEvents="box-none" style={styles.toolbarWrap}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityLabel="Undo"
          onPress={() => sendCommand("undo")}
          style={({ pressed }) => [styles.toolBtn, pressed && styles.toolBtnPressed]}
        >
          <Ionicons name="arrow-undo" size={18} color="#e5e7eb" />
        </Pressable>
        <Pressable
          accessibilityLabel="Redo"
          onPress={() => sendCommand("redo")}
          style={({ pressed }) => [styles.toolBtn, pressed && styles.toolBtnPressed]}
        >
          <Ionicons name="arrow-redo" size={18} color="#e5e7eb" />
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <View style={[styles.container, hasErrors && styles.containerError]}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        javaScriptEnabled
        onMessage={handleMessage}
        injectedJavaScript={injectedJavaScript}
        // Avoid any navigation.
        onShouldStartLoadWithRequest={() => false}
        // keep background transparent so it matches existing UI
        style={styles.webview}
        automaticallyAdjustContentInsets={false}
        scrollEnabled={true}
        keyboardDisplayRequiresUserAction={false}
        onLoadEnd={() => {
          // when loaded, ensure we push current value once
          try {
            webViewRef.current?.postMessage(
              JSON.stringify({ __t: "value", value: localValue }),
            );
          } catch {
            // no-op
          }
        }}
      />
      {toolbar}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#111827",
  },
  containerError: {
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  toolbarWrap: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  toolbar: {
    flexDirection: "row",
    borderRadius: 10,
    backgroundColor: "rgba(17,24,39,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toolBtnPressed: {
    opacity: 0.8,
  },
});

export default WebCodeEditor;
