// lib/sandpackHelpers.ts
// Extracted from sandpackBuilder.ts: utility functions.

// lib/sandpackBuilder.ts
// Builds React Preview HTML using CDN imports (no Sandpack dependency)


export interface SandpackOptions {
  title: string;
  files: Record<string, string>;
  dependencies?: Record<string, string>;
  /** Explicit opt-in: local unsafe eval/CDN fallback is only allowed in dev/test contexts. */
  allowUnsafeLocalEval?: boolean;
  /** Sandpack Client Version (unused, kept for compatibility) */
  sandpackVersion?: string;
  /** Zeige Datei-Explorer in der Preview */
  showFileExplorer?: boolean;
}

/**
 * Sanitize HTML-kritische Zeichen im Titel
 */
export function sanitizeTitle(title: string): string {
  return title
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Escape string für JavaScript template literal
 */
export function escapeForJs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

/**
 * Extrahiert App-Komponenten-Code aus den Dateien
 */
export function findAppCode(files: Record<string, string>): string {
  // Suche nach App-Datei
  const appPaths = [
    "/src/App.tsx",
    "/App.tsx",
    "/src/App.jsx",
    "/App.jsx",
    "/src/App.ts",
    "/App.ts",
    "/src/App.js",
    "/App.js",
  ];

  for (const path of appPaths) {
    if (files[path]) {
      return files[path];
    }
  }

  // Default App
  return `
function App() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ color: "#00ff88" }}>Preview läuft ✅</h1>
      <p style={{ color: "#888" }}>Keine App.tsx gefunden.</p>
    </div>
  );
}
export default App;
`;
}

/**
 * Baut ein vollständiges HTML-Dokument mit React CDN
 * Verwendet esm.sh für schnelles Laden ohne Build-Step
 */
