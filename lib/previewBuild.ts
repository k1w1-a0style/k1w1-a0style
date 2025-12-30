// lib/previewBuild.ts
import type { ProjectFile } from "../contexts/types";
import type { PreviewFiles, PreviewStats } from "../types/preview";

function toBytes(str: string): number {
  try {
    return new TextEncoder().encode(str).length;
  } catch {
    return str.length;
  }
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function normalizeDependencies(
  files: ProjectFile[],
): Record<string, string> {
  const defaults: Record<string, string> = {
    expo: "~54.0.0",
    react: "18.3.1",
    "react-dom": "18.3.1",
    "react-native-web": "0.19.12",
  };

  const pkgFile = files.find((f) => f.path === "package.json");
  if (!pkgFile?.content) return defaults;

  const pkg = safeJsonParse<{ dependencies?: Record<string, string> }>(
    pkgFile.content,
  );
  const deps = { ...(pkg?.dependencies ?? {}) };

  const isBlocked = (name: string) => {
    if (!name) return true;
    if (name === "react-native") return true;
    if (name.startsWith("@react-native/")) return true;
    if (name.startsWith("react-native-")) return true;
    return false;
  };

  const out: Record<string, string> = { ...defaults };
  for (const [name, version] of Object.entries(deps)) {
    if (isBlocked(name)) continue;
    if (!version) continue;
    out[name] = version;
  }
  return out;
}

export function buildPreviewFilesFromProject(files: ProjectFile[]): {
  files: PreviewFiles;
  hasApp: boolean;
  stats: PreviewStats;
} {
  const fileMap: PreviewFiles = {};
  let totalBytes = 0;
  let fileCount = 0;
  let skipped = 0;

  const priority = [
    "App.tsx",
    "App.ts",
    "App.js",
    "App.jsx",
    "src/App.tsx",
    "src/App.ts",
    "src/App.js",
    "src/App.jsx",
    "index.js",
  ];

  const isBinaryLike = (path: string) => {
    const lower = path.toLowerCase();
    return (
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".mp4") ||
      lower.endsWith(".mov") ||
      lower.endsWith(".mp3")
    );
  };

  const sorted = [...files].sort((a, b) => {
    const ap = priority.indexOf(a.path);
    const bp = priority.indexOf(b.path);
    if (ap !== -1 || bp !== -1)
      return (ap === -1 ? 999 : ap) - (bp === -1 ? 999 : bp);
    return a.path.localeCompare(b.path);
  });

  for (const f of sorted) {
    const path = String(f.path || "").replace(/^\/*/, "");
    const content = typeof f.content === "string" ? f.content : "";
    if (!path || !content) continue;

    if (isBinaryLike(path)) {
      skipped += 1;
      continue;
    }

    const bytes = toBytes(content);
    if (bytes > 350_000) {
      skipped += 1;
      continue;
    }

    fileMap[path] = { contents: content };
    totalBytes += bytes;
    fileCount += 1;

    if (totalBytes > 2_500_000) break;
  }

  const hasApp = Boolean(
    fileMap["App.tsx"] ||
    fileMap["App.ts"] ||
    fileMap["App.js"] ||
    fileMap["src/App.tsx"] ||
    fileMap["src/App.ts"] ||
    fileMap["src/App.js"],
  );

  return { files: fileMap, hasApp, stats: { fileCount, totalBytes, skipped } };
}
