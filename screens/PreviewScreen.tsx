import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { useProject } from "../contexts/ProjectContext";
import { theme } from "../theme";

type ProjectFile = { path?: string; content?: string };

/**
 * Variation B:
 * - Kein Supabase save_preview / preview_page
 * - Kein Browser
 * - Sandpack läuft direkt im WebView via ESM import (esm.sh)
 */

function isAllowedFile(path: string) {
  const p = path.toLowerCase();
  if (p.includes("node_modules/")) return false;
  if (p.startsWith(".expo/")) return false;
  if (p.startsWith(".git/")) return false;

  // nur "textige" Dateien
  return (
    p.endsWith(".ts") ||
    p.endsWith(".tsx") ||
    p.endsWith(".js") ||
    p.endsWith(".jsx") ||
    p.endsWith(".json") ||
    p.endsWith(".css") ||
    p.endsWith(".html") ||
    p.endsWith(".md") ||
    p.endsWith(".txt")
  );
}

function normalizePath(path: string) {
  let p = path.trim();
  if (!p.startsWith("/")) p = "/" + p;
  return p;
}

function safeJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function buildSandpackHtml(opts: {
  title: string;
  files: Record<string, string>;
  dependencies?: Record<string, string>;
}) {
  const { title, files, dependencies } = opts;

  // Sandpack config – passt für Web/React Projekte.
  // Wenn dein Projekt nicht "Web" ist, siehst du halt Errors im Preview (aber App bleibt stabil).
  const config = {
    template: "react-ts",
    files: Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, { code: v }]),
    ),
    customSetup: dependencies ? { dependencies } : undefined,
    options: {
      externalResources: [] as string[],
      classes: {
        "sp-layout": "sp-layout",
      },
    },
  };

  // XSS-safe-ish (min)
  const configJson = JSON.stringify(config).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
<title>${title.replace(/</g, "")}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; background: #0a0a0a; color: #eee; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .header { position: fixed; top: 0; left: 0; right: 0; height: 48px; background: rgba(10,10,10,0.95); border-bottom: 1px solid #222; display:flex; align-items:center; justify-content:space-between; padding: 0 12px; z-index: 9999; }
  .title { font-weight: 700; font-size: 14px; color: #00ff88; }
  .meta { font-size: 11px; color: #888; }
  .btn { padding: 6px 10px; background: #151515; border: 1px solid #2a2a2a; border-radius: 8px; color: #fff; font-weight: 700; cursor: pointer; }
  .btn:active { transform: scale(0.98); }
  .content { position: absolute; top: 48px; left: 0; right: 0; bottom: 0; }
  #frame { width: 100%; height: 100%; border: 0; background: #000; }
  #overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column; gap: 10px; background: #0a0a0a; }
  .spinner { width: 38px; height: 38px; border-radius: 999px; border: 3px solid #222; border-top-color: #00ff88; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .ot { font-size: 13px; color: #888; text-align:center; padding: 0 18px; line-height: 1.35; }
  #error { display:none; max-width: 520px; padding: 14px; border-radius: 12px; border: 1px solid #5b1b1b; background: #1a0505; color: #ffb3b3; }
  #error strong { color: #ff5555; }
  pre { white-space: pre-wrap; word-break: break-word; margin: 8px 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #ffd2d2; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${title.replace(/</g, "")}</div>
      <div class="meta">In-App Preview (Sandpack) • Kein Browser</div>
    </div>
    <div style="display:flex; gap:8px;">
      <button class="btn" id="btnReload">↻ Reload</button>
    </div>
  </div>

  <div class="content">
    <iframe id="frame" sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"></iframe>
    <div id="overlay">
      <div class="spinner"></div>
      <div class="ot">Initialisiere Sandpack… (benötigt Internet für esm.sh / Bundler)</div>
      <div id="error">
        <strong>Fehler:</strong>
        <pre id="errorText"></pre>
      </div>
    </div>
  </div>

<script type="module">
  const overlay = document.getElementById("overlay");
  const errorBox = document.getElementById("error");
  const errorText = document.getElementById("errorText");
  const frame = document.getElementById("frame");
  const btnReload = document.getElementById("btnReload");

  const config = ${configJson};

  function showError(msg) {
    errorBox.style.display = "block";
    errorText.textContent = String(msg || "Unbekannter Fehler");
  }

  btnReload.addEventListener("click", () => {
    try { location.reload(); } catch {}
  });

  try {
    const mod = await import("https://esm.sh/@codesandbox/sandpack-client@2.19.0");
    const SandpackClient = mod.SandpackClient || mod.default || mod;

    // Sandpack starten
    const client = new SandpackClient(frame, config, {
      // auf mobile: schneller "sichtbar" werden
      showLoadingScreen: true,
      showOpenInCodeSandbox: false,
    });

    // overlay weg, wenn bundler ready
    const t = setTimeout(() => { overlay.style.display = "none"; }, 1200);
    client.listen((msg) => {
      if (msg?.type === "start") {
        overlay.style.display = "none";
        clearTimeout(t);
      }
      if (msg?.type === "error") {
        overlay.style.display = "flex";
        showError(msg?.error?.message || JSON.stringify(msg));
      }
    });
  } catch (e) {
    showError(e?.message || e);
  }
</script>
</body>
</html>`;
}

export default function PreviewScreen() {
  const navigation = useNavigation<any>();
  const { projectData, isLoading } = useProject();

  const [creating, setCreating] = useState(false);
  const lastHtmlRef = useRef<string | null>(null);
  const [lastCreatedAt, setLastCreatedAt] = useState<number | null>(null);

  const fileMap = useMemo(() => {
    const files: Record<string, string> = {};
    const list: ProjectFile[] = (projectData?.files as any) || [];

    let total = 0;
    for (const f of list) {
      const p = f?.path ? String(f.path) : "";
      if (!p) continue;
      if (!isAllowedFile(p)) continue;

      const key = normalizePath(p);
      const content = String(f?.content ?? "");
      total += content.length;

      // harte Bremse, damit WebView nicht stirbt bei riesigen Projekten
      if (total > 1_200_000) break;

      files[key] = content;
    }

    return files;
  }, [projectData]);

  const dependencies = useMemo(() => {
    // optional: package.json dependencies übernehmen, wenn vorhanden
    const pkgRaw =
      fileMap["/package.json"] ||
      fileMap["/app/package.json"] ||
      fileMap["/src/package.json"];

    if (!pkgRaw) return undefined;

    const pkg = safeJson<any>(pkgRaw);
    const deps =
      pkg?.dependencies && typeof pkg.dependencies === "object"
        ? pkg.dependencies
        : null;
    if (!deps) return undefined;

    // keep it small-ish
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(deps)) {
      if (typeof v === "string") out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
  }, [fileMap]);

  const ensureMinimumFiles = useCallback((files: Record<string, string>) => {
    // Sandpack react-ts braucht irgendeinen Einstieg. Wenn keiner da ist, geben wir Default rein.
    const hasIndex =
      files["/src/index.tsx"] ||
      files["/src/main.tsx"] ||
      files["/index.tsx"] ||
      files["/index.ts"];

    const hasApp =
      files["/src/App.tsx"] ||
      files["/App.tsx"] ||
      files["/src/App.ts"] ||
      files["/App.ts"];

    const hasHtml = files["/public/index.html"] || files["/index.html"];

    const out = { ...files };

    if (!hasHtml) {
      out["/public/index.html"] =
        `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Preview</title></head><body><div id="root"></div></body></html>`;
    }

    if (!hasApp) {
      out["/src/App.tsx"] = `import React from "react";
export default function App() {
  return (
    <div style={{padding:16,fontFamily:"system-ui"}}>
      <h2>Preview läuft ✅</h2>
      <p>Kein App/Web Einstieg gefunden – das ist der Default.</p>
    </div>
  );
}`;
    }

    if (!hasIndex) {
      out["/src/index.tsx"] = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
const el = document.getElementById("root");
if (el) createRoot(el).render(<App />);
`;
    }

    if (!out["/package.json"]) {
      out["/package.json"] = JSON.stringify(
        {
          name: "preview",
          version: "1.0.0",
          private: true,
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
          },
        },
        null,
        2,
      );
    }

    return out;
  }, []);

  const openFullscreen = useCallback(
    (html: string) => {
      navigation.navigate("PreviewFullscreen", {
        html,
        title: projectData?.name || "Preview",
      });
    },
    [navigation, projectData?.name],
  );

  const createAndOpen = useCallback(async () => {
    if (!projectData) {
      Alert.alert("Kein Projekt", "Bitte zuerst ein Projekt laden.");
      return;
    }

    setCreating(true);
    try {
      const files = ensureMinimumFiles(fileMap);
      const html = buildSandpackHtml({
        title: projectData?.name || "Preview",
        files,
        dependencies,
      });

      lastHtmlRef.current = html;
      setLastCreatedAt(Date.now());

      // direkt Vollbild
      openFullscreen(html);
    } catch (e: any) {
      Alert.alert("Preview-Fehler", e?.message || String(e));
    } finally {
      setCreating(false);
    }
  }, [projectData, fileMap, dependencies, ensureMinimumFiles, openFullscreen]);

  const copyHtml = useCallback(async () => {
    const html = lastHtmlRef.current;
    if (!html) {
      Alert.alert("Noch nix da", "Erstelle erst eine Preview.");
      return;
    }
    await Clipboard.setStringAsync(html);
    Alert.alert("Kopiert", "HTML wurde in die Zwischenablage kopiert.");
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
          <Text style={styles.info}>Projekt wird geladen…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!projectData) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.big}>📁</Text>
          <Text style={styles.h1}>Kein Projekt geladen</Text>
          <Text style={styles.info}>Bitte erst Projekt öffnen/erstellen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const last = lastCreatedAt
    ? new Date(lastCreatedAt).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.h1}>Preview</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {projectData.name} • zuletzt: {last}
          </Text>
        </View>

        <Pressable
          style={[
            styles.btn,
            styles.btnPrimary,
            creating && styles.btnDisabled,
          ]}
          onPress={createAndOpen}
          disabled={creating}
        >
          <Text style={styles.btnText}>
            {creating ? "Erstelle…" : "Neu erstellen"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wie das hier funktioniert</Text>
          <Text style={styles.cardText}>
            • Preview läuft direkt im WebView über Sandpack{"\n"}• Kein
            Supabase, kein Secret, kein 404-Ärger{"\n"}• Kein Browser-Wechsel
            (du bleibst in der App)
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Projekt-Dateien für Preview</Text>
          <Text style={styles.cardText}>
            {Object.keys(fileMap).length} Dateien übernommen (text-basiert).
            {"\n"}Wenn was fehlt, wird ein kleiner Default-Einstieg erzeugt.
          </Text>

          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnFlex]}
              onPress={() => {
                const html = lastHtmlRef.current;
                if (!html) {
                  Alert.alert(
                    "Noch keine Preview",
                    "Erstelle erst eine Preview.",
                  );
                  return;
                }
                openFullscreen(html);
              }}
            >
              <Text style={styles.btnText}>⛶ Vollbild öffnen</Text>
            </Pressable>

            <Pressable style={styles.btn} onPress={copyHtml}>
              <Text style={styles.btnText}>📋</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.hint}>
          <Text style={styles.hintText}>
            Tipp: Wenn Sandpack nix lädt → Internet an. Es zieht Module über
            esm.sh und den Bundler.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.palette.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  h1: {
    color: theme.palette.text.primary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sub: { color: theme.palette.text.secondary, fontSize: 13, marginTop: 2 },

  body: { flex: 1, padding: 16, gap: 14 },
  card: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  cardText: {
    color: theme.palette.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },

  row: { flexDirection: "row", gap: 10, alignItems: "center" },

  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
  },
  btnPrimary: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  btnDisabled: { opacity: 0.5 },
  btnFlex: { flex: 1 },
  btnText: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 14,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  big: { fontSize: 64 },
  info: { color: theme.palette.text.secondary, fontWeight: "700" },

  hint: { paddingHorizontal: 6 },
  hintText: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
