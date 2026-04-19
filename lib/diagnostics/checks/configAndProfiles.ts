// Auto-extracted from lib/diagnostics/preflightChecks.ts
import type { PreflightCheck } from "../preflightTypes";
import {
  byPath, has, getText, ok, mkFix,
  parseJson, statusBySeverity,
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

function readStringField(obj: JsonRecord | null, key: string): string | null {
  const value = obj?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

export const checkEasProfiles: PreflightCheck = {
  id: "eas-profiles",
  title: "EAS Profile Android (APK vs AAB)",
  severity: "normal",
  run(files, target) {
    if (target.mode !== "eas") {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "pass",
        message: "Nicht relevant (Expo Go).",
      });
    }

    const m = byPath(files);

    if (!has(m, "eas.json")) {
      const template = {
        cli: { appVersionSource: "remote" },
        build: {
          development: { developmentClient: true, distribution: "internal" },
          preview: { distribution: "internal", android: { buildType: "apk" } },
          production: { android: { buildType: "apk" } },
        },
      };
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: statusBySeverity(this.severity),
        message: "eas.json fehlt. Ohne Profile können Builds schief laufen.",
        fix: {
          patch: mkFix([
            {
              path: "eas.json",
              content: JSON.stringify(template, null, 2) + "\n",
            },
          ]),
        },
      };
    }

    const eas = asRecord(parseJson(getText(m, "eas.json")));
    if (!eas) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: "eas.json ist keine gültige JSON. Bitte prüfen.",
      };
    }

    const profile = target.profile;
    const build = readObjectField(eas, "build");
    const p = readObjectField(build, profile);
    if (!p) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: `eas.json hat kein build.${profile} Profil.`,
      };
    }

    const android = readObjectField(p, "android");
    const buildType = readStringField(android, "buildType");

    // APK-only policy: for this app, ALL profiles must build installable APKs.
    // Make it explicit; missing buildType is allowed but should be fixed.
    if (!buildType) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: `${profile}.android.buildType ist nicht gesetzt – bitte explizit "apk" setzen.`,
        fix: {
          label: `Setze ${profile}.android.buildType auf "apk"`,
          patch: {
            jsonMerge: [
              {
                path: "eas.json",
                patch: { build: { [profile]: { android: { buildType: "apk" } } } },
                createIfMissing: true,
              },
            ],
            explanation:
              "Der In-App APK Builder unterstützt ausschließlich APK (kein AAB).",
          },
        },
      };
    }

    if (buildType !== "apk") {
      return {
        id: this.id,
        title: this.title,
        severity: "high",
        status: "fail",
        message: `${profile}.android.buildType ist "${buildType}" – diese App unterstützt ausschließlich "apk".`,
        fix: {
          label: `Setze ${profile}.android.buildType auf "apk"`,
          patch: {
            jsonMerge: [
              {
                path: "eas.json",
                patch: { build: { [profile]: { android: { buildType: "apk" } } } },
                createIfMissing: true,
              },
            ],
            explanation:
              "Der In-App APK Builder unterstützt ausschließlich APK (kein AAB).",
          },
        },
      };
    }

    return ok({ id: this.id, title: this.title, severity: this.severity });
  },
};


export const checkExpoConfig: PreflightCheck = {
  id: "expo-config-validation",
  title: "Expo Config Validation",
  severity: "high",
  run(files) {
    const m = byPath(files);

    const hasAppJson = has(m, "app.json");
    const hasAppConfigJs = has(m, "app.config.js");

    if (!hasAppJson && !hasAppConfigJs) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "fail",
        message:
          "Keine app.json oder app.config.js gefunden (Expo Config fehlt).",
        fix: {
          label: "Create minimal app.json",
          patch: {
            upsert: [
              {
                path: "app.json",
                content: `${JSON.stringify({ expo: { name: "CHANGE_ME", slug: "change-me", version: "1.0.0", android: { package: "com.change.me" } } }, null, 2)}
`,
              },
            ],
            explanation:
              "Minimales app.json erstellt. TODO: expo.name/slug/version/android.package auf echte Projektwerte setzen.",
          },
        },
      };
    }

    if (hasAppConfigJs && !hasAppJson) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        message: "app.config.js vorhanden",
      });
    }

    const raw = getText(m, "app.json");
    const cfg = asRecord(parseJson(raw));
    if (!cfg) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "fail",
        message: "app.json ist keine gültige JSON.",
      };
    }

    const expo = readObjectField(cfg, "expo");
    if (!expo) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "fail",
        message: 'app.json fehlt "expo" Objekt.',
      };
    }

    const issues: string[] = [];
    if (!expo.name) issues.push("expo.name fehlt");
    if (!expo.slug) issues.push("expo.slug fehlt");
    if (!expo.version) issues.push("expo.version fehlt");
    const android = readObjectField(expo, "android");
    if (android && !readStringField(android, "package"))
      issues.push("expo.android.package fehlt");

    if (issues.length) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: `Expo Config unvollständig (${issues.length} Feld(er) fehlen).`,
        details: issues,
      };
    }

    return ok({ id: this.id, title: this.title, severity: this.severity });
  },
};


export const checkSdkConsistency: PreflightCheck = {
  id: "expo-sdk-consistency",
  title: "Expo SDK Konsistenz (light)",
  severity: "low",
  run(files) {
    const m = byPath(files);
    if (!has(m, "package.json")) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "pass",
      });
    }

    const pkg = asRecord(parseJson(getText(m, "package.json")));
    const deps = readStringDeps(pkg);
    const expo = deps.expo;
    const rn = deps["react-native"];

    if (!expo) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message:
          "expo dependency fehlt. Für Expo-Projekte ist das ungewöhnlich.",
      };
    }
    if (!rn) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: "react-native dependency fehlt.",
      };
    }

    const expoMajor = Number(String(expo).match(/(\d+)/)?.[1] ?? "0");
    const rnMajorMinor = String(rn).match(/(\d+)\.(\d+)/);
    if (expoMajor >= 54 && rnMajorMinor) {
      const rnMinor = Number(rnMajorMinor[2]);
      if (Math.abs(rnMinor - 78) >= 6) {
        return {
          id: this.id,
          title: this.title,
          severity: this.severity,
          status: "warn",
          message: `expo ${expo} und react-native ${rn} wirken ungewöhnlich kombiniert.`,
        };
      }
    }

    return ok({ id: this.id, title: this.title, severity: this.severity });
  },
};
