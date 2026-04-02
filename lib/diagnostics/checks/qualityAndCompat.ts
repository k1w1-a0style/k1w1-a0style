// Auto-extracted from lib/diagnostics/preflightChecks.ts
import type { ProjectFile } from "../../../shared/types/project";
import type { PreflightCheck } from "../preflightTypes";
import {
  normalizePath, byPath, has, getText, ok, mkFix, mkJsonFix,
  existsAny, parseJson, statusBySeverity, ensureEndsWithNewline,
  normalizeGitignoreEntry, gitignoreAppendMissing, npmrcLockfileSetting,
} from "../preflightHelpers";


type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readObjectField(obj: JsonRecord | null, key: string): JsonRecord | null {
  return asRecord(obj?.[key]);
}

function readStringDeps(pkg: JsonRecord | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const bucket of [readObjectField(pkg, "dependencies"), readObjectField(pkg, "devDependencies")]) {
    if (!bucket) continue;
    for (const [key, value] of Object.entries(bucket)) {
      if (typeof value === "string") out[key] = value;
    }
  }
  return out;
}

export const checkReactNativeCompatibility: PreflightCheck = {
  id: "rn-react-compat",
  title: "React / React Native Kompatibilität",
  severity: "high",
  run(files) {
    const m = byPath(files);
    if (!has(m, "package.json")) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const pkg = asRecord(parseJson(getText(m, "package.json")));
    const deps = readStringDeps(pkg);
    const react = deps.react;
    const rn = deps["react-native"];

    if (!react || !rn) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const reactM = String(react).match(/(\d+)\.(\d+)/);
    const rnM = String(rn).match(/0\.(\d+)/);
    if (!reactM || !rnM) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const reactMajor = Number(reactM[1]);
    const reactMinor = Number(reactM[2]);
    const rnMinor = Number(rnM[1]);

    if (reactMajor === 18 && reactMinor >= 3 && rnMinor < 75) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "fail",
        message: `Mögliche Inkompatibilität: react ${react} mit react-native ${rn}. Empfohlen: RN >= 0.75 bei React 18.3+.`,
      };
    }

    return ok({ id: this.id, title: this.title, severity: this.severity });
  },
};


export const checkQualityScriptsDeps: PreflightCheck = {
  id: "quality-scripts",
  title: "Quality Scripts: TS/ESLint Dependencies",
  severity: "normal",
  run(files) {
    const m = byPath(files);
    const pkg = asRecord(parseJson(getText(m, "package.json")));
    if (!pkg) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "pass",
      });
    }

    const scripts = readStringDeps(readObjectField(pkg, "scripts"));
    const deps = readStringDeps(pkg);

    const wantsTS = Object.values(scripts).some((s) =>
      /\btsc\b|typecheck/i.test(String(s)),
    );
    const wantsEslint = Object.values(scripts).some((s) =>
      /\beslint\b/i.test(String(s)),
    );

    const missing: string[] = [];
    if (wantsTS && !deps.typescript) missing.push("typescript");
    if (wantsEslint && !deps.eslint) missing.push("eslint");

    if (!missing.length)
      return ok({ id: this.id, title: this.title, severity: this.severity });

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "warn",
      message: `Scripts vorhanden, aber Dependencies fehlen: ${missing.join(", ")}.`,
      fix: {
        patch: mkJsonFix(
          [
            {
              path: "package.json",
              patch: {
                devDependencies: Object.fromEntries(
                  missing.map((d) => [d, "*"]),
                ),
              },
              createIfMissing: false,
            },
          ],
          [],
          "Fehlende devDependencies ergänzen",
        ),
      },
    };
  },
};

// --- GitHub Actions Workflow Security: Service Role Key Leak Detection ---
// NOTE: No YAML parser here by design (lightweight). This check is conservative.

