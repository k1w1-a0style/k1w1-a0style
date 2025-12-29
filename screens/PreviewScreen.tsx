// screens/PreviewScreen.tsx
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
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import { useProject } from "../contexts/ProjectContext";
import type { ProjectFile } from "../contexts/types";
import { styles } from "../styles/previewScreenStyles";

// ───────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────

type PreviewMode = "supabase" | "codesandbox" | "web";

type PreviewFiles = Record<string, { type: "CODE"; contents: string }>;

type SavePreviewResponse = {
  ok?: boolean;
  previewId?: string;
  previewUrl?: string;
  error?: string;
};

type CreateCodeSandboxResponse = {
  ok?: boolean;
  sandboxId?: string;
  urls?: {
    editor?: string;
    embed?: string;
    preview?: string;
  };
  error?: string;
};

// ───────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────
const MAX_FILES = 60;
const MAX_FILE_SIZE_BYTES = 500_000;
const MAX_TOTAL_BYTES = 3_000_000;
const AUTO_REFRESH_DELAY = 2500;
const FETCH_TIMEOUT_MS = 30_000;

const TEXT_FILE_RE = /\.(tsx?|jsx?|json|md|txt|css)$/i;
const IGNORE_RE = /(^|\/)(node_modules|\.git|dist|build|android|ios|\.expo)\//i;

const DEFAULT_MANUAL_CODE = `import React from 'react';
import { View, Text, StyleSheet, Button, ScrollView } from 'react-native';

export default function App() {
  const [count, setCount] = React.useState(0);

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>🎉 Preview läuft!</Text>
        <Text style={s.subtitle}>
          Änderungen im Code-Tab werden automatisch hier angezeigt.
        </Text>
      </View>

      <View style={s.card}>
        <Text style={s.count}>{count}</Text>
        <Button title="Count +1" onPress={() => setCount(c => c + 1)} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 20
  },
  header: {
    marginBottom: 30
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00FF00',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: '#999'
  },
  card: {
    backgroundColor: '#121212',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center'
  },
  count: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#00FF00',
    marginBottom: 20
  },
});
`;

// ───────────────────────────────────────────────────────
// Env
// ───────────────────────────────────────────────────────

// Expo: public env vars must be prefixed with EXPO_PUBLIC_
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Accept multiple env names (older/newer)
const SAVE_PREVIEW_URL =
  process.env.EXPO_PUBLIC_SUPABASE_PREVIEW_SAVE_URL ??
  process.env.EXPO_PUBLIC_SAVE_PREVIEW_URL ??
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/save_preview` : "");

const CREATE_CODESANDBOX_URL =
  process.env.EXPO_PUBLIC_CREATE_CODESANDBOX_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_CREATE_CODESANDBOX_URL ??
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/create_codesandbox` : "");

// ───────────────────────────────────────────────────────
// Utils
// ───────────────────────────────────────────────────────
function utf8ByteLen(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `http://${t}`;
}

function stripExt(p: string): string {
  return p.replace(/\.(tsx?|jsx?)$/, "");
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function generateAppWrapper(
  allFiles: ProjectFile[],
  fileMap: PreviewFiles,
): { path: string; code: string; size: number } | null {
  const srcAppFile = [
    "src/App.tsx",
    "src/App.ts",
    "src/App.js",
    "src/App.jsx",
  ].find((p) => !!fileMap[p]);

  if (srcAppFile) {
    const isTS = srcAppFile.endsWith(".ts") || srcAppFile.endsWith(".tsx");
    const wrapperPath = isTS ? "App.tsx" : "App.js";
    const importPath = stripExt(srcAppFile);
    const code = `export { default } from "./${importPath}";\n`;
    return { path: wrapperPath, code, size: utf8ByteLen(code) };
  }

  const indexFile = ["index.tsx", "index.ts", "index.js", "index.jsx"].find(
    (p) => !!fileMap[p],
  );

  if (indexFile) {
    const raw = allFiles.find((x) => x.path === indexFile)?.content ?? "";
    const hasDefault = /export\s+default/.test(raw);
    const isTS = indexFile.endsWith(".ts") || indexFile.endsWith(".tsx");
    const wrapperPath = isTS ? "App.tsx" : "App.js";
    const importPath = stripExt(indexFile);

    let code = "";
    if (hasDefault) {
      code = `export { default } from "./${importPath}";\n`;
    } else if (isTS) {
      code =
        `import * as Mod from "./${importPath}";\n` +
        `const Comp = (Mod as any).default ?? (Mod as any).App ?? (() => null);\n` +
        `export default Comp;\n`;
    } else {
      code =
        `import * as Mod from "./${importPath}";\n` +
        `function FallbackComponent() { return null; }\n` +
        `var Comp = (Mod as any).default || (Mod as any).App || FallbackComponent;\n` +
        `export default Comp;\n`;
    }

    return { path: wrapperPath, code, size: utf8ByteLen(code) };
  }

  return null;
}

function buildPreviewFilesFromProject(files: ProjectFile[]): {
  files: PreviewFiles;
  hasApp: boolean;
  stats: { fileCount: number; totalBytes: number; skipped: number };
} {
  const fileMap: PreviewFiles = {};
  let totalBytes = 0;
  let fileCount = 0;
  let skipped = 0;

  const priorityPaths = [
    "App.tsx",
    "App.ts",
    "App.js",
    "App.jsx",
    "src/App.tsx",
    "src/App.ts",
    "src/App.js",
    "src/App.jsx",
    "index.tsx",
    "index.ts",
    "index.js",
    "index.jsx",
    "package.json",
  ];

  const isValidFile = (f: ProjectFile): boolean =>
    !!f?.path &&
    typeof f.content === "string" &&
    utf8ByteLen(f.content) < MAX_FILE_SIZE_BYTES;

  const priorityFiles = files.filter(
    (f) => isValidFile(f) && priorityPaths.includes(f.path),
  );

  const otherFiles = files.filter(
    (f) =>
      isValidFile(f) &&
      TEXT_FILE_RE.test(f.path) &&
      !IGNORE_RE.test(f.path) &&
      !priorityPaths.includes(f.path),
  );

  const candidates = [...priorityFiles, ...otherFiles];

  for (const f of candidates) {
    if (fileCount >= MAX_FILES) break;

    const size = utf8ByteLen(f.content);
    if (totalBytes + size > MAX_TOTAL_BYTES) {
      skipped++;
      continue;
    }

    fileMap[f.path] = { type: "CODE", contents: f.content };
    totalBytes += size;
    fileCount++;
  }

  const appFiles = ["App.tsx", "App.ts", "App.js", "App.jsx"];
  let hasApp = appFiles.some((p) => !!fileMap[p]);

  if (!hasApp) {
    const wrapper = generateAppWrapper(files, fileMap);
    if (
      wrapper &&
      fileCount < MAX_FILES &&
      totalBytes + wrapper.size <= MAX_TOTAL_BYTES
    ) {
      fileMap[wrapper.path] = { type: "CODE", contents: wrapper.code };
      totalBytes += wrapper.size;
      fileCount++;
      hasApp = true;
    }
  }

  return { files: fileMap, hasApp, stats: { fileCount, totalBytes, skipped } };
}

function extractDependenciesForBrowser(
  files: ProjectFile[],
): Record<string, string> {
  // Keep deps browser-friendly (Expo/native modules usually break)
  const defaults: Record<string, string> = {
    react: "18.3.1",
    "react-dom": "18.3.1",
    "react-native-web": "0.19.12",
  };

  const pkgFile = files.find((f) => f.path === "package.json");
  if (!pkgFile?.content) return defaults;

  const isBlocked = (name: string) => {
    if (!name) return true;
    if (name === "react-native") return true;
    if (name === "react-native-webview") return true;
    if (
      name === "expo" ||
      name.startsWith("expo-") ||
      name.startsWith("@expo/")
    )
      return true;
    if (name.startsWith("@react-native/")) return true;
    return false;
  };

  try {
    const pkg = JSON.parse(pkgFile.content);
    const deps = pkg?.dependencies ?? {};

    const filtered: Record<string, string> = { ...defaults };

    for (const [k, v] of Object.entries(deps)) {
      if (typeof v !== "string") continue;
      if (isBlocked(k)) continue;
      if (k === "react" && v.trim().startsWith("19")) continue;
      filtered[k] = v;
    }

    filtered.react = filtered.react || defaults.react;
    filtered["react-dom"] =
      filtered["react-dom"] || filtered.react || defaults["react-dom"];
    filtered["react-native-web"] =
      filtered["react-native-web"] || defaults["react-native-web"];

    return filtered;
  } catch {
    return defaults;
  }
}

async function postSupabaseFunction(url: string, payload: unknown) {
  if (!url) throw new Error("Function URL ist leer (Env fehlt).");
  if (!SUPABASE_ANON_KEY) throw new Error("SUPABASE_ANON_KEY fehlt (Env).");

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    const short = text ? text.slice(0, 220) : "";
    throw new Error(`${res.status}${short ? ` – ${short}` : ""}`);
  }

  try {
    return JSON.parse(text) as any;
  } catch {
    throw new Error("Antwort ist kein JSON.");
  }
}

async function postSupabasePreview(
  payload: unknown,
): Promise<SavePreviewResponse> {
  if (!SAVE_PREVIEW_URL)
    throw new Error("SAVE_PREVIEW_URL ist leer (Env fehlt).");
  try {
    return (await postSupabaseFunction(
      SAVE_PREVIEW_URL,
      payload,
    )) as SavePreviewResponse;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Supabase Preview Fehler: ${msg}`);
  }
}

async function postCreateCodeSandbox(
  payload: unknown,
): Promise<CreateCodeSandboxResponse> {
  if (!CREATE_CODESANDBOX_URL)
    throw new Error("CREATE_CODESANDBOX_URL ist leer (Env fehlt).");
  try {
    return (await postSupabaseFunction(
      CREATE_CODESANDBOX_URL,
      payload,
    )) as CreateCodeSandboxResponse;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`CodeSandbox Fehler: ${msg}`);
  }
}

// ───────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────
export default function PreviewScreen(): React.ReactElement {
  const projectContext = useProject();
  const projectData = projectContext?.projectData ?? null;

  const isMountedRef = useRef(true);
  const previewRef = useRef<WebView>(null);
  const webRef = useRef<WebView>(null);
  const sandboxRef = useRef<WebView>(null);

  const lastBuiltRef = useRef<string>("");
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCreatingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!projectData?.lastModified) return;
    if (hasInitializedRef.current) return;
    lastBuiltRef.current = projectData.lastModified;
    hasInitializedRef.current = true;
  }, [projectData?.lastModified]);

  const defaultHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
  const defaultUrl = useMemo(
    () => `http://${defaultHost}:19006`,
    [defaultHost],
  );

  const [mode, setMode] = useState<PreviewMode>("supabase");

  // Web mode
  const [input, setInput] = useState(defaultUrl);
  const [url, setUrl] = useState(defaultUrl);
  const [webLoading, setWebLoading] = useState(false);

  // Supabase preview mode
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // CodeSandbox mode
  const [sandboxEmbedUrl, setSandboxEmbedUrl] = useState<string | null>(null);
  const [sandboxEditorUrl, setSandboxEditorUrl] = useState<string | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  // Manual editor
  const [manualCode, setManualCode] = useState(DEFAULT_MANUAL_CODE);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState("");

  const [lastError, setLastError] = useState<string | null>(null);

  const presets = useMemo(
    () => [
      { label: "Expo (19006)", value: `http://${defaultHost}:19006` },
      { label: "Metro (8081)", value: `http://${defaultHost}:8081` },
      { label: "Vite (3000)", value: `http://${defaultHost}:3000` },
    ],
    [defaultHost],
  );

  // ───────────────────────────────────────────────────────
  // Web handlers
  // ───────────────────────────────────────────────────────
  const loadUrl = useCallback(() => {
    const next = normalizeUrl(input);
    if (!next) {
      Alert.alert("Ungültige URL", "Bitte gib eine gültige URL ein.");
      return;
    }
    setLastError(null);
    setUrl(next);
  }, [input]);

  const reloadWeb = useCallback(() => {
    setLastError(null);
    webRef.current?.reload();
  }, []);

  const setPreset = useCallback((next: string) => {
    setLastError(null);
    setInput(next);
    setUrl(next);
  }, []);

  // ───────────────────────────────────────────────────────
  // Editor handlers
  // ───────────────────────────────────────────────────────
  const openEditor = useCallback(() => {
    setEditorDraft(manualCode);
    setEditorOpen(true);
  }, [manualCode]);

  const closeEditor = useCallback(() => {
    Keyboard.dismiss();
    setEditorOpen(false);
  }, []);

  // ───────────────────────────────────────────────────────
  // Supabase Preview creation
  // ───────────────────────────────────────────────────────
  const createPreviewFromCode = useCallback(
    async (code: string): Promise<void> => {
      if (isCreatingRef.current) return;
      isCreatingRef.current = true;
      setCreating(true);
      setLastError(null);

      try {
        const payload = {
          name: "Manual Preview",
          files: {
            "App.js": { type: "CODE", contents: code },
          },
          dependencies: {
            react: "18.3.1",
            "react-dom": "18.3.1",
            "react-native-web": "0.19.12",
          },
          meta: { manual: true, createdAt: new Date().toISOString() },
        };

        const res = await postSupabasePreview(payload);

        if (!res?.ok || !res.previewUrl)
          throw new Error(res?.error || "Keine previewUrl erhalten.");

        if (isMountedRef.current) setPreviewUrl(res.previewUrl);
      } catch (e) {
        if (!isMountedRef.current) return;
        const msg =
          e instanceof Error
            ? e.message
            : "Preview konnte nicht erstellt werden.";
        setLastError(msg);
      } finally {
        isCreatingRef.current = false;
        if (isMountedRef.current) setCreating(false);
      }
    },
    [],
  );

  const createPreviewFromProject = useCallback(async (): Promise<void> => {
    if (isCreatingRef.current) return;

    if (!projectData?.files?.length) {
      setLastError("Kein Projekt gefunden.");
      return;
    }

    isCreatingRef.current = true;
    setCreating(true);
    setLastError(null);

    try {
      const { files, hasApp, stats } = buildPreviewFilesFromProject(
        projectData.files,
      );

      if (!hasApp)
        throw new Error(
          "Kein App Entry Point gefunden (App.* / src/App.* / index.*).",
        );
      if (Object.keys(files).length === 0)
        throw new Error("Keine kompatiblen Dateien gefunden.");

      const dependencies = extractDependenciesForBrowser(projectData.files);

      const payload = {
        projectId: (projectData as any)?.id ?? undefined,
        name: projectData.name || "Preview",
        files,
        dependencies,
        meta: {
          lastModified: projectData.lastModified ?? null,
          fileCount: stats.fileCount,
          totalBytes: stats.totalBytes,
        },
      };

      const res = await postSupabasePreview(payload);

      if (!res?.ok || !res.previewUrl)
        throw new Error(res?.error || "Keine previewUrl erhalten.");

      if (isMountedRef.current) {
        setPreviewUrl(res.previewUrl);
        lastBuiltRef.current = projectData.lastModified || "";
      }
    } catch (e) {
      if (!isMountedRef.current) return;
      const msg =
        e instanceof Error
          ? e.message
          : "Preview konnte nicht erstellt werden.";
      setLastError(msg);
    } finally {
      isCreatingRef.current = false;
      if (isMountedRef.current) setCreating(false);
    }
  }, [projectData]);

  // Auto refresh (debounced)
  useEffect(() => {
    if (mode !== "supabase") return;
    if (!autoRefresh) return;
    if (!projectData?.lastModified) return;
    if (!hasInitializedRef.current) return;
    if (lastBuiltRef.current === projectData.lastModified) return;

    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);

    autoTimerRef.current = setTimeout(() => {
      autoTimerRef.current = null;
      void createPreviewFromProject();
    }, AUTO_REFRESH_DELAY);

    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [mode, autoRefresh, projectData?.lastModified, createPreviewFromProject]);

  // ───────────────────────────────────────────────────────
  // CodeSandbox creation
  // ───────────────────────────────────────────────────────
  const createSandboxFromProject = useCallback(async (): Promise<void> => {
    if (isCreatingRef.current) return;

    if (!projectData?.files?.length) {
      setLastError("Kein Projekt gefunden.");
      return;
    }

    isCreatingRef.current = true;
    setCreating(true);
    setLastError(null);

    try {
      const { files, hasApp, stats } = buildPreviewFilesFromProject(
        projectData.files,
      );

      if (!hasApp)
        throw new Error(
          "Kein App Entry Point gefunden (App.* / src/App.* / index.*).",
        );
      if (Object.keys(files).length === 0)
        throw new Error("Keine kompatiblen Dateien gefunden.");

      // For CodeSandbox we still filter native deps (web env), but allow navigation libs.
      const dependencies = extractDependenciesForBrowser(projectData.files);

      const payload = {
        name: projectData.name || "Preview",
        files,
        dependencies,
        meta: {
          lastModified: projectData.lastModified ?? null,
          fileCount: stats.fileCount,
          totalBytes: stats.totalBytes,
        },
      };

      const res = await postCreateCodeSandbox(payload);

      if (!res?.ok || !res.urls?.embed)
        throw new Error(res?.error || "Keine embed URL erhalten.");

      if (isMountedRef.current) {
        setSandboxEmbedUrl(res.urls.embed || null);
        setSandboxEditorUrl(res.urls.editor || null);
      }
    } catch (e) {
      if (!isMountedRef.current) return;
      const msg =
        e instanceof Error
          ? e.message
          : "Sandbox konnte nicht erstellt werden.";
      setLastError(msg);
    } finally {
      isCreatingRef.current = false;
      if (isMountedRef.current) setCreating(false);
    }
  }, [projectData]);

  const createSandboxFromCode = useCallback(
    async (code: string): Promise<void> => {
      if (isCreatingRef.current) return;
      isCreatingRef.current = true;
      setCreating(true);
      setLastError(null);

      try {
        const payload = {
          name: "Manual Sandbox",
          files: {
            "App.tsx": { type: "CODE", contents: code },
          },
          dependencies: {
            react: "18.3.1",
            "react-dom": "18.3.1",
            "react-native-web": "0.19.12",
          },
        };

        const res = await postCreateCodeSandbox(payload);

        if (!res?.ok || !res.urls?.embed)
          throw new Error(res?.error || "Keine embed URL erhalten.");

        if (isMountedRef.current) {
          setSandboxEmbedUrl(res.urls.embed || null);
          setSandboxEditorUrl(res.urls.editor || null);
        }
      } catch (e) {
        if (!isMountedRef.current) return;
        const msg =
          e instanceof Error
            ? e.message
            : "Sandbox konnte nicht erstellt werden.";
        setLastError(msg);
      } finally {
        isCreatingRef.current = false;
        if (isMountedRef.current) setCreating(false);
      }
    },
    [],
  );

  // ───────────────────────────────────────────────────────
  // Shared Actions
  // ───────────────────────────────────────────────────────
  const shareLink = useCallback(async (link: string | null) => {
    if (!link) return;
    try {
      await Share.share({ message: link, url: link });
    } catch {}
  }, []);

  const copyLink = useCallback(async (link: string | null) => {
    if (!link) return;
    try {
      await Clipboard.setStringAsync(link);
      Alert.alert("✅ Kopiert", "Link in Zwischenablage.");
    } catch {
      Alert.alert("Fehler", "Konnte nicht kopieren.");
    }
  }, []);

  const openInBrowser = useCallback(async (link: string | null) => {
    if (!link) return;
    try {
      await Linking.openURL(link);
    } catch {
      Alert.alert("Fehler", "Konnte Link nicht öffnen.");
    }
  }, []);

  const resetPreview = useCallback(() => {
    Alert.alert(
      "Preview zurücksetzen?",
      "Aktuelle Preview/Sandbox wird geschlossen.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            setPreviewUrl(null);
            setSandboxEmbedUrl(null);
            setSandboxEditorUrl(null);
            setLastError(null);
            lastBuiltRef.current = "";
          },
        },
      ],
    );
  }, []);

  const saveEditor = useCallback(() => {
    const trimmed = editorDraft.trim();
    if (!trimmed) {
      Alert.alert("Leer", "Bitte Code eingeben.");
      return;
    }

    setManualCode(trimmed);
    closeEditor();

    Alert.alert("✅ Gespeichert", "Was soll erstellt werden?", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Supabase Preview",
        onPress: () => {
          setMode("supabase");
          setAutoRefresh(false);
          void createPreviewFromCode(trimmed);
        },
      },
      {
        text: "CodeSandbox",
        onPress: () => {
          setMode("codesandbox");
          void createSandboxFromCode(trimmed);
        },
      },
    ]);
  }, [editorDraft, closeEditor, createPreviewFromCode, createSandboxFromCode]);

  // ───────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>👁️ Preview</Text>
        <Text style={styles.subtitle}>
          {mode === "web"
            ? "Lokaler Dev-Server (optional)"
            : mode === "codesandbox"
              ? "CodeSandbox Preview (öffentlich, nur für dich)"
              : autoRefresh
                ? "Supabase Preview Auto-Sync"
                : "Supabase Preview manuell"}
        </Text>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[
            styles.modeChip,
            mode === "supabase" && styles.modeChipActive,
          ]}
          onPress={() => setMode("supabase")}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.modeChipText,
              mode === "supabase" && styles.modeChipTextActive,
            ]}
          >
            🚀 Preview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeChip,
            mode === "codesandbox" && styles.modeChipActive,
          ]}
          onPress={() => setMode("codesandbox")}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.modeChipText,
              mode === "codesandbox" && styles.modeChipTextActive,
            ]}
          >
            🧪 Sandbox
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeChip, mode === "web" && styles.modeChipActive]}
          onPress={() => setMode("web")}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.modeChipText,
              mode === "web" && styles.modeChipTextActive,
            ]}
          >
            🌐 Web
          </Text>
        </TouchableOpacity>
      </View>

      {/* ─────────────────── Supabase preview ─────────────────── */}
      {mode === "supabase" && (
        <>
          <View style={styles.controls}>
            <View style={styles.autoRow}>
              <Text style={styles.autoLabel}>
                {projectData
                  ? "Auto-Sync mit Projekt"
                  : "Kein Projekt (manuell)"}
              </Text>
              <Switch
                value={autoRefresh && !!projectData}
                onValueChange={setAutoRefresh}
                disabled={!projectData}
                trackColor={{ false: "#333", true: "#00FF00" }}
                thumbColor="#fff"
              />
            </View>

            {autoRefresh && projectData && (
              <Text style={styles.hint}>
                💡 Speichere im Code-Tab → Preview aktualisiert nach{" "}
                {AUTO_REFRESH_DELAY / 1000}s
              </Text>
            )}

            <View style={styles.snackButtons}>
              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.btnWide,
                  (creating || !projectData) && styles.btnDisabled,
                ]}
                onPress={createPreviewFromProject}
                disabled={creating || !projectData}
              >
                {creating ? (
                  <ActivityIndicator color="#1a1a1a" />
                ) : (
                  <Text style={styles.btnText}>🔁 Jetzt syncen</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnWide]}
                onPress={openEditor}
              >
                <Text style={styles.btnText}>📝 Manuellen Code bearbeiten</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.btnWide,
                  creating && styles.btnDisabled,
                ]}
                onPress={() => void createPreviewFromCode(manualCode)}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#1a1a1a" />
                ) : (
                  <Text style={styles.btnText}>
                    🚀 Manuellen Preview erstellen
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {previewUrl && (
              <View style={styles.snackActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSmall]}
                  onPress={() => openInBrowser(previewUrl)}
                >
                  <Text style={styles.btnText}>🌐</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSmall]}
                  onPress={() => void shareLink(previewUrl)}
                >
                  <Text style={styles.btnText}>📤</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSmall]}
                  onPress={() => void copyLink(previewUrl)}
                >
                  <Text style={styles.btnText}>📋</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSmall, styles.btnGhost]}
                  onPress={resetPreview}
                >
                  <Text style={[styles.btnText, styles.btnGhostText]}>🔄</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {lastError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {lastError}</Text>
            </View>
          )}

          <View style={styles.webWrap}>
            {!previewUrl ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>
                  {projectData ? "Bereit für Preview" : "Kein Projekt geladen"}
                </Text>
                <Text style={styles.emptyText}>
                  Drück &quot;Jetzt syncen&quot; oder speichere im Code-Tab
                  (Auto-Sync).
                </Text>
              </View>
            ) : (
              <>
                {(previewLoading || creating) && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator color="#00FF00" />
                    <Text style={styles.loadingText}>
                      {creating ? "Erstelle Preview..." : "Lade Preview..."}
                    </Text>
                  </View>
                )}

                <WebView
                  ref={previewRef}
                  source={{ uri: previewUrl }}
                  onLoadStart={() => setPreviewLoading(true)}
                  onLoadEnd={() => setPreviewLoading(false)}
                  onError={(e) => setLastError(e.nativeEvent.description)}
                  javaScriptEnabled
                  domStorageEnabled
                  startInLoadingState
                />
              </>
            )}
          </View>

          <Modal
            visible={editorOpen}
            animationType="slide"
            onRequestClose={closeEditor}
          >
            <SafeAreaView style={styles.modalRoot}>
              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
              >
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={closeEditor}>
                    <Text style={styles.modalBtnText}>Abbrechen</Text>
                  </TouchableOpacity>

                  <Text style={styles.modalTitle}>Code Editor</Text>

                  <TouchableOpacity onPress={saveEditor}>
                    <Text style={[styles.modalBtnText, styles.modalBtnPrimary]}>
                      Speichern
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  <TextInput
                    value={editorDraft}
                    onChangeText={setEditorDraft}
                    multiline
                    style={styles.modalEditor}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="React Native Code..."
                    placeholderTextColor="#666"
                    textAlignVertical="top"
                  />
                </ScrollView>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </Modal>
        </>
      )}

      {/* ─────────────────── CodeSandbox ─────────────────── */}
      {mode === "codesandbox" && (
        <>
          <View style={styles.controls}>
            <Text style={styles.hint}>
              ⚠️ Wichtig: CodeSandbox Previews sind öffentlich. Nutze das nur
              für dich (keine sensiblen Daten).
            </Text>

            <View style={styles.snackButtons}>
              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.btnWide,
                  (creating || !projectData) && styles.btnDisabled,
                ]}
                onPress={createSandboxFromProject}
                disabled={creating || !projectData}
              >
                {creating ? (
                  <ActivityIndicator color="#1a1a1a" />
                ) : (
                  <Text style={styles.btnText}>🧪 CodeSandbox erstellen</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnWide]}
                onPress={openEditor}
              >
                <Text style={styles.btnText}>📝 Manuellen Code bearbeiten</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.btnWide,
                  creating && styles.btnDisabled,
                ]}
                onPress={() => void createSandboxFromCode(manualCode)}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#1a1a1a" />
                ) : (
                  <Text style={styles.btnText}>
                    🚀 Manuellen Sandbox erstellen
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {(sandboxEmbedUrl || sandboxEditorUrl) && (
              <View style={styles.snackActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSmall]}
                  onPress={() =>
                    openInBrowser(sandboxEditorUrl || sandboxEmbedUrl)
                  }
                >
                  <Text style={styles.btnText}>🌐</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSmall]}
                  onPress={() =>
                    void shareLink(sandboxEditorUrl || sandboxEmbedUrl)
                  }
                >
                  <Text style={styles.btnText}>📤</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSmall]}
                  onPress={() =>
                    void copyLink(sandboxEditorUrl || sandboxEmbedUrl)
                  }
                >
                  <Text style={styles.btnText}>📋</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSmall, styles.btnGhost]}
                  onPress={resetPreview}
                >
                  <Text style={[styles.btnText, styles.btnGhostText]}>🔄</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {lastError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {lastError}</Text>
            </View>
          )}

          <View style={styles.webWrap}>
            {!sandboxEmbedUrl ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>
                  {projectData ? "Bereit für Sandbox" : "Kein Projekt geladen"}
                </Text>
                <Text style={styles.emptyText}>
                  Drück &quot;CodeSandbox erstellen&quot; (kein Auto-Sync).
                </Text>
              </View>
            ) : (
              <>
                {(sandboxLoading || creating) && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator color="#00FF00" />
                    <Text style={styles.loadingText}>
                      {creating ? "Erstelle Sandbox..." : "Lade Sandbox..."}
                    </Text>
                  </View>
                )}

                <WebView
                  ref={sandboxRef}
                  source={{ uri: sandboxEmbedUrl }}
                  onLoadStart={() => setSandboxLoading(true)}
                  onLoadEnd={() => setSandboxLoading(false)}
                  onError={(e) => setLastError(e.nativeEvent.description)}
                  javaScriptEnabled
                  domStorageEnabled
                  startInLoadingState
                />
              </>
            )}
          </View>
        </>
      )}

      {/* ─────────────────── Local web ─────────────────── */}
      {mode === "web" && (
        <>
          <View style={styles.controls}>
            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="http://localhost:19006"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.urlInput}
                onSubmitEditing={loadUrl}
              />

              <TouchableOpacity style={styles.btn} onPress={loadUrl}>
                <Text style={styles.btnText}>LOAD</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={reloadWeb}
              >
                <Text style={[styles.btnText, styles.btnGhostText]}>↻</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.presetRow}>
              {presets.map((p) => (
                <TouchableOpacity
                  key={p.label}
                  style={styles.presetChip}
                  onPress={() => setPreset(p.value)}
                >
                  <Text style={styles.presetChipText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {lastError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {lastError}</Text>
            </View>
          )}

          <View style={styles.webWrap}>
            {!url ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Keine URL</Text>
              </View>
            ) : (
              <>
                {webLoading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator color="#00FF00" />
                  </View>
                )}

                <WebView
                  ref={webRef}
                  source={{ uri: url }}
                  onLoadStart={() => setWebLoading(true)}
                  onLoadEnd={() => setWebLoading(false)}
                  onError={(e) => setLastError(e.nativeEvent.description)}
                  javaScriptEnabled
                  domStorageEnabled
                  startInLoadingState
                />
              </>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
