import type { ChecklistItem } from "../templateChecklistTypes";
import { ensureObj, getErrorMessage } from "../jsonUtils";

type EasProfileDefaults = { android: { buildType: "apk" } };

export function patchEasJson(
  raw: string,
): {
  next: string;
  changed: boolean;
  parseOk: boolean;
  parseError?: string;
  p0: ChecklistItem[];
} {
  const p0: ChecklistItem[] = [];
  let changed = false;

  try {
    const obj = ensureObj(JSON.parse(raw || "{}"));
    const cli = ensureObj(obj.cli);
    if (cli.appVersionSource !== "remote") {
      cli.appVersionSource = "remote";
      changed = true;
    }
    obj.cli = cli;

    const build = ensureObj(obj.build);

    // Required profiles: preview + production
    const needProfiles: ReadonlyArray<{ name: "preview" | "production"; defaults: EasProfileDefaults }> = [
      { name: "preview", defaults: { android: { buildType: "apk" } } },
      { name: "production", defaults: { android: { buildType: "apk" } } },
    ];

    for (const p of needProfiles) {
      if (!build[p.name] || typeof build[p.name] !== "object") {
        build[p.name] = p.defaults;
        changed = true;
        p0.push({
          severity: "P0",
          file: "eas.json",
          reason: `EAS Profile fehlt: build.${p.name}`,
          fix: `Profile build.${p.name} hinzufügen.`,
        });
      }
    }
    obj.build = build;

    const next = JSON.stringify(obj, null, 2);
    return { next, changed, parseOk: true, p0 };
  } catch (error: unknown) {
    const fallback = {
      cli: { appVersionSource: "remote" },
      build: {
        preview: { android: { buildType: "apk" } },
        production: { android: { buildType: "apk" } },
      },
    };
    return {
      next: JSON.stringify(fallback, null, 2),
      changed: true,
      parseOk: false,
      parseError: getErrorMessage(error),
      p0,
    };
  }
}

// -------------------- Defaults --------------------
