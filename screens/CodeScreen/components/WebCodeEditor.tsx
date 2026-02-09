// screens/CodeScreen/components/WebCodeEditor.tsx
import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

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
 * Keeps CodeScreen UI unchanged while avoiding RN TextInput perf issues on large files.
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
  const html = useMemo(() => {
    const editorBg = "#0f0f10";
    const gutterBg = "#141416";
    const fg = "#e8e8e8";
    const border = hasErrors ? "#ff4d4f" : "#2a2a2e";
    const ro = readOnly ? "true" : "false";

    // NOTE: We intentionally do NOT inline `value` into HTML to avoid massive escaping.
    // We send it via injected JS after load.
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    html, body { height: 100%; margin: 0; padding: 0; background: ${editorBg}; }
    .wrap { height: 100%; display: flex; flex-direction: row; border: 1px solid ${border}; border-radius: 8px; overflow: hidden; }
    .gutter {
      width: 52px;
      background: ${gutterBg};
      color: rgba(232,232,232,0.55);
      font: 13px/18px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      padding: 10px 6px;
      text-align: right;
      user-select: none;
      overflow: hidden;
    }
    textarea {
      width: 100%;
      height: 100%;
      resize: none;
      border: 0;
      outline: none;
      margin: 0;
      padding: 10px 10px;
      background: ${editorBg};
      color: ${fg};
      caret-color: ${fg};
      font: 13px/18px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      tab-size: ${tabSize};
      -moz-tab-size: ${tabSize};
      white-space: pre;
      overflow: auto;
      box-sizing: border-box;
    }
    textarea::placeholder { color: ${placeholderColor}; }
  </style>
</head>
<body>
  <div class="wrap">
    <div id="gutter" class="gutter"></div>
    <textarea id="ta" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" placeholder=${JSON.stringify(
      placeholder
    )}></textarea>
  </div>

  <script>
    const ta = document.getElementById("ta");
    const gutter = document.getElementById("gutter");
    ta.readOnly = ${ro};

    function updateGutter(text) {
      let lines = 1;
      for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++;
      let out = "";
      for (let i = 1; i <= lines; i++) out += i + "\n";
      gutter.textContent = out;
    }
    function syncScroll() { gutter.scrollTop = ta.scrollTop; }

    let t = null;
    function postChange(v) {
      if (${ro}) return;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(v); } catch (e) {}
      }, ${changeThrottleMs});
    }

    ta.addEventListener("input", () => {
      updateGutter(ta.value);
      postChange(ta.value);
    });
    ta.addEventListener("scroll", syncScroll);

    ta.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        if (${ro}) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const ins = " ".repeat(${tabSize});
        ta.value = ta.value.substring(0, start) + ins + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + ins.length;
        updateGutter(ta.value);
        postChange(ta.value);
      }
    });

    function setValue(v) {
      if (typeof v !== "string") return;
      if (ta.value === v) return;
      const prevScroll = ta.scrollTop;
      ta.value = v;
      updateGutter(v);
      ta.scrollTop = prevScroll;
      syncScroll();
    }

    window.addEventListener("message", (evt) => { try { setValue(evt.data); } catch (e) {} });
    document.addEventListener("message", (evt) => { try { setValue(evt.data); } catch (e) {} });

    updateGutter("");
  </script>
</body>
</html>`;
  }, [readOnly, placeholder, placeholderColor, hasErrors, tabSize, changeThrottleMs]);

  const injectedJavaScript = useMemo(() => {
    // Push current value into webview
    return `
      (function(){
        try {
          const v = ${JSON.stringify(value ?? "")};
          window.postMessage(v, "*");
          document.dispatchEvent(new MessageEvent("message", { data: v }));
        } catch (e) {}
      })();
      true;
    `;
  }, [value]);

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        injectedJavaScript={injectedJavaScript}
        onMessage={(e) => onChangeText(String(e?.nativeEvent?.data ?? ""))}
        keyboardDisplayRequiresUserAction={false}
        setSupportMultipleWindows={false}
        scrollEnabled={false}
      />
    </View>
  );
};

export default WebCodeEditor;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
