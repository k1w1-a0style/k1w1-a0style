// Auto-extracted from lib/diagnostics/preflightChecks.ts
import type { ProjectFile } from "../../../shared/types/project";
import type { PreflightCheck } from "../preflightTypes";
import {
  normalizePath, byPath, has, getText, ok, mkFix,
  existsAny,
} from "../preflightHelpers";
import {
  collectForbiddenFileHits,
  parseAssetCandidates,
  readNativeDirState,
} from "./assetsAndFiles.helpers";
import {
  assetsAndFilesExtraChecks,
} from "./assetsAndFiles.checks";

const {
  checkLockfileConsistency,
  checkGitignorePresent,
  checkEasWithoutCredentialsForDebug,
} = assetsAndFilesExtraChecks;

export const checkAssetsExist: PreflightCheck = {
  id: "assets-exist",
  title: "Assets referenced existieren",
  severity: "normal",
  run(files) {
    const m = byPath(files);
    const cfgPath = existsAny(m, [
      "app.json",
      "app.config.js",
      "app.config.ts",
      "app.config.json",
    ]);

    if (!cfgPath) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: "Keine app.json/app.config.* gefunden.",
      });
    }

    const cfgText = getText(m, cfgPath);

    const candidates = parseAssetCandidates(cfgText);

    if (!candidates.length) {
      return ok({
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "pass",
        message: "Keine Asset-Refs gefunden.",
      });
    }

    const missing = candidates.filter((p) => !has(m, p));
    if (!missing.length)
      return ok({ id: this.id, title: this.title, severity: this.severity });

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "warn",
      message: `Asset-Dateien fehlen (${missing.length}).`,
      details: missing.slice(0, 50),
    };
  },
};

// --- Extra quality checks ---


export const checkForbiddenFiles: PreflightCheck = {
  id: "security-forbidden-files",
  title: "Security: verbotene/gefährliche Dateien",
  severity: "high",
  run(files) {
    const hits = collectForbiddenFileHits(files);

    if (!hits.length) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "fail",
      message: "Potentiell gefährliche Dateien/Secrets gefunden.",
      details: hits.slice(0, 50),
    };
  },
};



export const checkNativeDirsManagedGuard: PreflightCheck = {
  id: "native-dirs-managed-guard",
  title: "Native Ordner Konsistenz (Android-only)",
  severity: "normal",
  run(files) {
    const { androidLooksIncomplete, iosLooksIncomplete } = readNativeDirState(files);

    if (androidLooksIncomplete || iosLooksIncomplete) {
      const details: string[] = [];
      if (androidLooksIncomplete) details.push("android/ vorhanden, aber android/app/build.gradle fehlt.");
      if (iosLooksIncomplete) details.push("ios/ vorhanden, aber ios/Podfile fehlt (iOS wird hier nicht genutzt).");

      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message:
          "Unvollständige native Ordner können den EAS Build brechen. Hinweis: Dieses Projekt ist Android-only – ein halb-existierendes ios/ ist besonders gefährlich.",
        details,
      };
    }

    return ok({ id: this.id, title: this.title, severity: this.severity });
  },
};


export { checkLockfileConsistency, checkGitignorePresent, checkEasWithoutCredentialsForDebug };
