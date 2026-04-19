// Auto-extracted from lib/diagnostics/preflightChecks.ts
import type { PreflightCheck } from "../preflightTypes";
import {
  normalizePath, byPath, has, getText, ok, mkFix,
  parseJson,
} from "../preflightHelpers";


type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const checkPackageJson: PreflightCheck = {
  id: "core-package-json",
  title: "package.json vorhanden",
  severity: "critical",
  run(files) {
    const m = byPath(files);

    if (has(m, "package.json")) {
      const pkg = parseJson(getText(m, "package.json"));
      if (!pkg || typeof pkg !== "object") {
        return ok({
          id: this.id,
          title: this.title,
          severity: this.severity,
          status: "fail",
          message: "package.json ist keine gültige JSON.",
        });
      }
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const starter = {
      name: "my-app",
      version: "1.0.0",
      private: true,
      main: "index.js",
      scripts: {
        start: "expo start",
        android: "expo run:android",
      },
      dependencies: {
        expo: "^54.0.0",
        react: "18.2.0",
        "react-native": "0.78.0",
      },
    };

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "fail",
      message: "package.json fehlt im Projekt.",
      fix: {
        patch: mkFix(
          [
            {
              path: "package.json",
              content: JSON.stringify(starter, null, 2) + "\n",
            },
          ],
          [],
          "package.json erzeugen",
        ),
      },
    };
  },
};

export const checkEntryPoint: PreflightCheck = {
  id: "entry-point",
  title: "Entry-Point / main vorhanden",
  severity: "high",
  run(files) {
    const m = byPath(files);
    const pkg = asRecord(parseJson(getText(m, "package.json")));
    const main = readNonEmptyString(pkg?.main) ?? "index.js";
    const mainNorm = normalizePath(main);

    const indexOk =
      has(m, mainNorm) ||
      has(m, "index.js") ||
      has(m, "App.tsx") ||
      has(m, "App.js");

    if (indexOk) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const stub =
      "import { registerRootComponent } from 'expo';\n" +
      "import App from './App';\n\n" +
      "registerRootComponent(App);\n";

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "fail",
      message: `Kein Entry-File gefunden ("${mainNorm}" / index.js / App.tsx).`,
      fix: {
        patch: {
          upsert: [{ path: "index.js", content: stub }],
          jsonMerge: [
            {
              path: "package.json",
              patch: { main: "index.js" },
              createIfMissing: false,
            },
          ],
          explanation: "index.js stub anlegen + package.json main setzen",
        },
      },
    };
  },
};

