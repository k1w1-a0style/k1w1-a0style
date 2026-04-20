import type { PreflightCheck } from "../preflightTypes";
import {
  byPath,
  getText,
  gitignoreAppendMissing,
  has,
  mkFix,
  mkJsonFix,
  npmrcLockfileSetting,
  ok,
} from "../preflightHelpers";
import {
  buildWithoutCredentialsPatch,
  collectMissingGitignoreEntries,
  GITIGNORE_TEMPLATE,
  parseEasJson,
  readWithoutCredentialsEnabled,
} from "./assetsAndFiles.helpers";

export const checkLockfileConsistency: PreflightCheck = {
  id: "lockfile-consistency",
  title: "Lockfile Konsistenz",
  severity: "normal",
  run(files) {
    const m = byPath(files);
    if (!has(m, "package.json")) {
      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    const hasNpm = has(m, "package-lock.json");
    const hasYarn = has(m, "yarn.lock");
    const hasPnpm = has(m, "pnpm-lock.yaml");
    const lockCount = [hasNpm, hasYarn, hasPnpm].filter(Boolean).length;

    if (lockCount === 0) {
      const npmrc = has(m, ".npmrc") ? getText(m, ".npmrc") : "";
      const setting = npmrc ? npmrcLockfileSetting(npmrc) : null;

      if (setting === true) {
        return ok({
          id: this.id,
          title: this.title,
          severity: this.severity,
          status: "pass",
          message:
            "Kein Lockfile im Source – wird beim Install generiert (.npmrc: package-lock=true).",
        });
      }

      if (setting === false) {
        return {
          id: this.id,
          title: this.title,
          severity: this.severity,
          status: "warn",
          message:
            "Kein Lockfile im Source und .npmrc deaktiviert package-lock (package-lock=false). Builds können dadurch inkonsistent werden. .npmrc ist ownership-geschützt und muss hier manuell auf package-lock=true angepasst werden.",
          details: [
            "Manueller Schritt: .npmrc öffnen und package-lock=true setzen.",
            "Lokaler diagnostics-Autofix ist für .npmrc bewusst deaktiviert (manual-critical Ownership-Schutz).",
          ],
        };
      }

      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message:
          "Kein Lockfile gefunden (package-lock.json / yarn.lock / pnpm-lock.yaml). Builds können dadurch inkonsistent werden. .npmrc kann hier nicht per local Autofix angelegt werden, weil der Pfad manual-critical geschützt ist.",
        details: [
          "Manueller Schritt: .npmrc mit package-lock=true (und optional save-exact=true) anlegen.",
          "Alternativ ein Lockfile committen, damit Build-Installationen deterministischer werden.",
        ],
      };
    }

    if (lockCount > 1) {
      const details = [
        hasNpm ? "package-lock.json" : null,
        hasYarn ? "yarn.lock" : null,
        hasPnpm ? "pnpm-lock.yaml" : null,
      ].filter(Boolean) as string[];

      const keep = hasPnpm ? "pnpm-lock.yaml" : hasNpm ? "package-lock.json" : "yarn.lock";

      const del: string[] = [];
      if (keep !== "package-lock.json" && hasNpm) del.push("package-lock.json");
      if (keep !== "yarn.lock" && hasYarn) del.push("yarn.lock");
      if (keep !== "pnpm-lock.yaml" && hasPnpm) del.push("pnpm-lock.yaml");

      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: `Mehrere Lockfiles gefunden (${details.length}). Nutze nur EINEN Package Manager.`,
        details,
        fix: del.length
          ? {
              patch: mkFix([], del, `Zusätzliche Lockfiles entfernen (behalte: ${keep})`),
            }
          : undefined,
      };
    }

    return ok({ id: this.id, title: this.title, severity: this.severity });
  },
};

export const checkGitignorePresent: PreflightCheck = {
  id: "gitignore-present",
  title: ".gitignore vorhanden",
  severity: "normal",
  run(files) {
    const m = byPath(files);

    if (has(m, ".gitignore")) {
      const content = getText(m, ".gitignore");
      const misses = collectMissingGitignoreEntries(content);

      if (misses.length) {
        const next = gitignoreAppendMissing(content, misses);
        return {
          id: this.id,
          title: this.title,
          severity: this.severity,
          status: "warn",
          message: ".gitignore wirkt unvollständig (häufige Einträge fehlen).",
          details: misses,
          fix:
            next.trim() && next.trim() !== content.trim()
              ? {
                  patch: mkFix(
                    [{ path: ".gitignore", content: next }],
                    [],
                    "Fehlende .gitignore Einträge ergänzen",
                  ),
                }
              : undefined,
        };
      }

      return ok({ id: this.id, title: this.title, severity: this.severity });
    }

    return {
      id: this.id,
      title: this.title,
      severity: this.severity,
      status: "fail",
      message: ".gitignore fehlt im Projekt.",
      fix: {
        patch: mkFix([{ path: ".gitignore", content: GITIGNORE_TEMPLATE }], [], ".gitignore erzeugen"),
      },
    };
  },
};

export const checkEasWithoutCredentialsForDebug: PreflightCheck = {
  id: "eas-withoutcredentials-debug",
  title: "EAS Debug Builds ohne Keystore",
  severity: "normal",
  run(files) {
    const m = byPath(files);
    if (!has(m, "eas.json")) return ok({ id: this.id, title: this.title, severity: this.severity });

    const eas = parseEasJson(getText(m, "eas.json"));
    if (!eas) {
      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message: "eas.json konnte nicht geparst werden.",
      };
    }

    const devOk = readWithoutCredentialsEnabled(eas, "development");
    const prevOk = readWithoutCredentialsEnabled(eas, "preview");

    if (!devOk || !prevOk) {
      const missing: string[] = [];
      if (!devOk) missing.push('eas.json: build.development.android.withoutCredentials=true fehlt');
      if (!prevOk) missing.push('eas.json: build.preview.android.withoutCredentials=true fehlt');

      const patchObj = buildWithoutCredentialsPatch({ devOk, previewOk: prevOk });

      return {
        id: this.id,
        title: this.title,
        severity: this.severity,
        status: "warn",
        message:
          "Ohne Keystore kann EAS in CI (--non-interactive) keinen neuen Keystore erzeugen. Für Debug/APK Builds sollte withoutCredentials=true gesetzt sein.",
        details: missing,
        fix: {
          patch: mkJsonFix(
            [
              {
                path: "eas.json",
                patch: { build: patchObj },
                createIfMissing: false,
              },
            ],
            [],
            "withoutCredentials=true für development/preview setzen",
          ),
        },
      };
    }

    return ok({ id: this.id, title: this.title, severity: this.severity });
  },
};

export const assetsAndFilesExtraChecks = {
  checkLockfileConsistency,
  checkGitignorePresent,
  checkEasWithoutCredentialsForDebug,
} as const;
